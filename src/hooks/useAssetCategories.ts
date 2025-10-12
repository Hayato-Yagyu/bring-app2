import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, setDoc, serverTimestamp } from "firebase/firestore";
import * as Papa from "papaparse";
import { db } from "../firebase";
import { toTimestamp } from "../utils/datetime";
import { clean } from "../utils/strings";

/** ─────────────────────────────────────────────
 * 型定義
 * ───────────────────────────────────────────── */
export type AssetCategory = {
  code: string; // 例: "PC"
  label: string; // 例: "パソコン"
  isTarget: boolean;
  displayOrder?: number | null; // ★ 追加：表示順
};

export type AssetCategoryDoc = {
  code: string;
  label: string;
  isTarget: boolean;
  group?: string | null;
  registeredOn?: any | null; // Timestamp
  notes?: string;
  updatedAt?: any | null; // Timestamp
  displayOrder?: number | null; // ★ 追加
};

/** ─────────────────────────────────────────────
 * 採番対象カテゴリの購読（タブ表示などに使用）
 * 失敗時にも loading=false へ遷移し、UI が固まらないようにする。
 * where/orderBy は使わず、クライアント側でフィルタ＆ソート。
 * ───────────────────────────────────────────── */
export const useAssetCategoryList = () => {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "asset_categories"),
      (snap) => {
        const all = snap.docs.map((d) => {
          const data = d.data() as any;
          const code = (data.code ?? d.id)?.toString() ?? "";
          const label = (data.label ?? d.id)?.toString() ?? "";
          const isTarget = typeof data.isTarget === "boolean" ? data.isTarget : true;
          const displayOrder = typeof data.displayOrder === "number" ? data.displayOrder : null;
          return { code, label, isTarget, displayOrder } as AssetCategory;
        });

        // 採番対象のみ & displayOrder → code の優先ソート
        const filtered = all
          .filter((c) => c.isTarget)
          .sort((a, b) => {
            const ao = a.displayOrder ?? Number.POSITIVE_INFINITY;
            const bo = b.displayOrder ?? Number.POSITIVE_INFINITY;
            if (ao !== bo) return ao - bo;
            return a.code.localeCompare(b.code, "ja");
          });

        setCategories(filtered);
        setLoading(false);
      },
      (err) => {
        console.error("[useAssetCategoryList] onSnapshot error:", err);
        setCategories([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { categories, loading };
};

/** ─────────────────────────────────────────────
 * 対象機器一覧CSV → asset_categories 取込（ボタン用）
 * ───────────────────────────────────────────── */
type Headers = {
  label?: number;
  code?: number;
  registeredOn?: number;
  notes?: number;
  group?: number;
};

const resolveIsTarget = (group?: string) => {
  if (!group) return true; // 既定で採番対象
  const g = group.replace(/\s/g, "");
  return !g.includes("対象外"); // 「対象外」を含めば false
};

// ★ Excel通し日付（Serial）対応
const parseRegisteredOn = (v: string) => {
  const s = (v ?? "").trim();
  if (!s) return null;
  // 数値のみ → Excel Serial とみなす
  if (/^\d+$/.test(s)) {
    const serial = Number(s);
    // Excel Serial の 1 は 1899-12-31 だが、実務的には 1899-12-30 起点が一般的
    const base = new Date(Date.UTC(1899, 11, 30));
    const ms = serial * 24 * 60 * 60 * 1000;
    const d = new Date(base.getTime() + ms);
    return toTimestamp(`${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`);
  }
  // それ以外は通常の toTimestamp に委譲（YYYY/MM/DD 等）
  return toTimestamp(s);
};

// ★ 空の code を補う（日本語ID許容・空白削除）
const ensureCode = (code: string, label: string) => {
  const c = (code ?? "").trim();
  if (c) return c;
  return (label ?? "").trim().replace(/\s+/g, "");
};

export const useAssetCategories = () => {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const importCategoryCsv = async (file: File) => {
    setImporting(true);
    setProgress(0);
    setMessage(null);
    try {
      const parsed = await new Promise<Papa.ParseResult<string[]>>((resolve, reject) => {
        Papa.parse<string[]>(file, {
          header: false,
          skipEmptyLines: "greedy",
          transform: (v) => clean(v),
          complete: (res) => resolve(res as any),
          error: (err) => reject(err),
        });
      });

      const rows = (parsed.data as unknown as string[][]).map((cols) => cols.map((c) => (c ?? "").toString().trim()));
      if (!rows.length) throw new Error("CSVに有効な行がありません。");

      // 1行目をヘッダとして列位置を推定（日本語/英語混在OK）
      const headerRow = rows[0].map((h) => h.toLowerCase());
      const headers: Headers = {
        label: headerRow.findIndex((h) => /(対象機器|label)/.test(h)),
        code: headerRow.findIndex((h) => /(分類|code)/.test(h)),
        registeredOn: headerRow.findIndex((h) => /(登録日|date|registeredon)/.test(h)),
        notes: headerRow.findIndex((h) => /(備考|notes?)/.test(h)),
        group: headerRow.findIndex((h) => /(対象区分|区分|group)/.test(h)),
      };

      if (headers.code === -1 || headers.label === -1) {
        throw new Error("ヘッダ行に『分類』または『対象機器』が見つかりません。");
      }

      const dataRows = rows.slice(1).filter((cols) => cols.some((c) => c && c.trim() !== ""));
      if (!dataRows.length) throw new Error("データ行がありません。");

      // ★ CSVの提示順を displayOrder として保存
      const CHUNK = 300;
      for (let i = 0; i < dataRows.length; i += CHUNK) {
        const slice = dataRows.slice(i, i + CHUNK);
        await Promise.all(
          slice.map(async (cols, idxInChunk) => {
            const rowIndex = i + idxInChunk; // 0,1,2,…
            const labelRaw = headers.label! >= 0 ? cols[headers.label!] : "";
            const codeRaw = headers.code! >= 0 ? cols[headers.code!] : "";
            const label = (labelRaw || "").trim();
            const code0 = ensureCode(codeRaw || "", label);
            if (!label) return; // labelが無ければスキップ

            const groupVal = headers.group! >= 0 ? cols[headers.group!] : "";
            const isTarget = resolveIsTarget(groupVal);

            const registeredOnStr = headers.registeredOn! >= 0 ? cols[headers.registeredOn!] : "";
            const notes = headers.notes! >= 0 ? cols[headers.notes!] : "";

            const docData: AssetCategoryDoc = {
              code: code0,
              label,
              isTarget,
              group: groupVal || null,
              registeredOn: registeredOnStr ? parseRegisteredOn(registeredOnStr) : null,
              notes: notes || "",
              updatedAt: null,
              displayOrder: rowIndex + 1, // ★ 1始まりで保存
            };

            // docId は code（空だった場合は label を詰めた値）
            await setDoc(doc(collection(db, "asset_categories"), code0), {
              ...docData,
              updatedAt: serverTimestamp(),
            } as any);
          })
        );
        setProgress(Math.round(Math.min(100, ((i + CHUNK) / dataRows.length) * 100)));
      }

      setMessage("対象機器一覧のインポートが完了しました。");
    } catch (e: any) {
      setMessage(e?.message ?? "対象機器一覧のインポートに失敗しました。");
    } finally {
      setImporting(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return {
    importing,
    progress,
    message,
    setMessage,
    importCategoryCsv,
  };
};
