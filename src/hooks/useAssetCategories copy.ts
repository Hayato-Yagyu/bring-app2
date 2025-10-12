import { useState } from "react";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import * as Papa from "papaparse";
import { AssetCategoryDoc } from "../types/assetCategory";
import { toTimestamp } from "../utils/datetime";
import { clean } from "../utils/strings";

type Headers = {
  label?: number;
  code?: number;
  registeredOn?: number;
  notes?: number;
  group?: number;
};

const resolveIsTarget = (group?: string) => {
  if (!group) return true;
  const g = group.replace(/\s/g, "");
  // "対象外" を含む場合に false とする（採番対象外/その他対象外）
  if (g.includes("対象外")) return false;
  return true; // それ以外は採番対象
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

      const CHUNK = 300;
      for (let i = 0; i < dataRows.length; i += CHUNK) {
        const slice = dataRows.slice(i, i + CHUNK);
        await Promise.all(
          slice.map(async (cols) => {
            const code = (headers.code! >= 0 ? cols[headers.code!] : "").trim();
            const label = (headers.label! >= 0 ? cols[headers.label!] : "").trim();
            if (!code || !label) return;

            const groupVal = headers.group! >= 0 ? cols[headers.group!] : "";
            const isTarget = resolveIsTarget(groupVal);

            const registeredOnStr = headers.registeredOn! >= 0 ? cols[headers.registeredOn!] : "";
            const notes = headers.notes! >= 0 ? cols[headers.notes!] : "";

            const docData: AssetCategoryDoc = {
              code,
              label,
              isTarget,
              group: groupVal || null,
              registeredOn: registeredOnStr ? toTimestamp(registeredOnStr) : null,
              notes: notes || "",
              updatedAt: null,
            };

            // docId は分類コード固定
            await setDoc(doc(collection(db, "asset_categories"), code), {
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
