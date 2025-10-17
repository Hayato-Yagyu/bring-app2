import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query, setDoc, doc, getDocs, writeBatch, updateDoc, deleteDoc, addDoc, serverTimestamp, where } from "firebase/firestore";
import { db } from "../firebase";
import * as Papa from "papaparse";
import { EquipmentDoc, GridRow } from "../types/equipment";
import { clean, pad2, toInt, toStrBlank } from "../utils/strings";
import { tsToSlash, ymdToTimestamp, tsToYMD, toTimestamp } from "../utils/datetime";
import { resolveNameFromUsers } from "../utils/users";
import { UserDoc } from "../types/equipment";

// 文字列→ number | null （空/ハイフン/非数値は null）
const toNumberOrNull = (v: unknown): number | null => {
  const s = String(v ?? "").trim();
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export const useEquipments = () => {
  const [rowsRaw, setRowsRaw] = useState<Array<{ docId: string; data: EquipmentDoc }>>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const pendingFileRef = useRef<File | null>(null);

  // 購読（No.順で常に最新を反映）
  useEffect(() => {
    const qEq = query(collection(db, "equipments"), orderBy("seqOrder", "asc"));
    const unsub = onSnapshot(qEq, (snap) => {
      const list = snap.docs.map((d) => ({ docId: d.id, data: d.data() as EquipmentDoc }));
      setRowsRaw(list);
    });
    return () => unsub();
  }, []);

  // Grid 表示用変換（座席は含めない：備考への混入事故を避ける）
  const gridRows: GridRow[] = useMemo(
    () =>
      rowsRaw.map(({ docId, data }, idx) => {
        const n = data.seqOrder ?? idx + 1;
        return {
          id: docId,
          seq: pad2(n),
          acceptedDate: tsToSlash(data.acceptedDate),
          assetNo: data.assetNo ?? "",
          category: data.category ?? "",
          branchNo: data.branchNo ?? "",
          deviceName: data.deviceName ?? "",
          updatedOn: tsToSlash(data.updatedOn),
          confirmedOn: tsToSlash(data.confirmedOn),
          disposedOn: tsToSlash(data.disposedOn),
          owner: data.owner ?? "",
          status: data.status ?? "",
          history: data.history ?? "",
          note: data.note ?? "",
          location: data.location ?? "",
          lastEditor: data.lastEditor ?? "",
          // USBハブ列
          hdmi: data.hdmi ?? "",
          usbA: data.usbA ?? "",
          usbC: data.usbC ?? "",
          lan: data.lan ?? "",
        };
      }),
    [rowsRaw]
  );

  // --- 共通ユーティリティ ---

  const deleteAllEquipments = async () => {
    const snap = await getDocs(collection(db, "equipments"));
    const docs = snap.docs;
    const DEL_CHUNK = 400;
    for (let i = 0; i < docs.length; i += DEL_CHUNK) {
      const batch = writeBatch(db);
      docs.slice(i, i + DEL_CHUNK).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  };

  // ★ カテゴリ内のみ全削除
  const deleteEquipmentsByCategory = async (categoryLabel: string) => {
    const qCat = query(collection(db, "equipments"), where("category", "==", categoryLabel));
    const snap = await getDocs(qCat);
    const docs = snap.docs;
    const DEL_CHUNK = 400;
    for (let i = 0; i < docs.length; i += DEL_CHUNK) {
      const batch = writeBatch(db);
      docs.slice(i, i + DEL_CHUNK).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  };

  const hasMeaningfulValue = (o: Record<string, any>) => {
    const ignore = new Set(["seq", "id", "seqOrder"]);
    return Object.entries(o).some(([k, v]) => {
      if (ignore.has(k)) return false;
      if (v == null) return false;
      if (typeof v === "string") return v.trim() !== "";
      return true;
    });
  };

  // === CSV 定義（インデックス） ===
  // 既定のインデックス（座席列なし）
  const IDX_BASE = {
    no: 0,
    acceptedDate: 1,
    assetNo: 2,
    category: 3,
    branchNo: 4,
    deviceName: 5,
    updatedOn: 6,
    confirmedOn: 7,
    disposedOn: 8,
    owner: 9,
    status: 10,
    history: 11,
    note: 12,
    location: 13,
    lastEditor: 14,
  } as const;

  // USBハブ拡張（HDMI/USB A/USB C/LAN/lastEditor シフト）
  const IDX_USB = {
    ...IDX_BASE,
    hdmi: 14,
    usbA: 15,
    usbC: 16,
    lan: 17,
    lastEditor: 18,
  } as const;

  // ★ ディスプレイ：座席列あり（history の次に seatNo を挿入）
  //    → note, location, lastEditor が 1 つずつ後ろにスライド
  const IDX_DISPLAY_WITH_SEAT = {
    ...IDX_BASE,
    seatNo: 12,
    note: 13,
    location: 14,
    lastEditor: 15,
  } as const;

  // --- CSV インポート（従来：全体置換） ---
  // ※ 混在CSVに対応：行ごとにカテゴリを見て USB/ディスプレイを解釈
  const importCsv = async (file: File, activeUserRaw: UserDoc[]) => {
    setImporting(true);
    setProgress(0);
    setMessage(null);
    try {
      const parsed = await new Promise<Papa.ParseResult<string[]>>((resolve, reject) => {
        Papa.parse<string[]>(file, {
          header: false,
          skipEmptyLines: "greedy",
          transform: (value) => clean(value),
          complete: (res) => resolve(res as any),
          error: (err) => reject(err),
        });
      });

      let rows = (parsed.data as unknown as string[][]).map((cols) => cols.map((c) => clean(c)));
      if (rows.length && /^no\.?$/i.test(rows[0][0] ?? "")) rows = rows.slice(1);
      if (!rows.length) throw new Error("CSVに有効な行がありません。");

      const resolvePerson = (v: unknown) => resolveNameFromUsers(toStrBlank(v), activeUserRaw);

      setMessage("既存データを全削除中…");
      await deleteAllEquipments();

      const toWrite: Array<{ data: Partial<EquipmentDoc> }> = [];

      rows.forEach((cols, i) => {
        const c = (k: number) => clean(cols[k] ?? "");
        const csvCategory = (c(IDX_BASE.category) || "") as string;
        const isUsb = csvCategory === "USBハブ" && cols.length >= 19;
        const isDisplay = csvCategory === "ディスプレイ";

        // ディスプレイで座席列が入った新フォーマット（総列数 16 以上）を優先認識
        const useDisplayWithSeat = isDisplay && cols.length >= 16;

        const IDX: any = isUsb ? IDX_USB : useDisplayWithSeat ? IDX_DISPLAY_WITH_SEAT : IDX_BASE;

        const seqFromCsv = toInt(c(IDX.no));
        const baseData: Partial<EquipmentDoc> = {
          seqOrder: seqFromCsv ?? i + 1,
          acceptedDate: toTimestamp(c(IDX.acceptedDate)),
          assetNo: toStrBlank(c(IDX.assetNo)),
          category: toStrBlank(csvCategory),
          branchNo: toStrBlank(c(IDX.branchNo)),
          deviceName: toStrBlank(c(IDX.deviceName)),
          updatedOn: toTimestamp(c(IDX.updatedOn)),
          confirmedOn: toTimestamp(c(IDX.confirmedOn)),
          disposedOn: toTimestamp(c(IDX.disposedOn)),
          owner: resolvePerson(c(IDX.owner)),
          status: toStrBlank(c(IDX.status)),
          history: toStrBlank(c(IDX.history)),
          note: toStrBlank(c(IDX.note)),
          location: toStrBlank(c(IDX.location)),
          lastEditor: resolvePerson(c(IDX.lastEditor)),
        };

        // ★ ディスプレイ：座席列
        if (useDisplayWithSeat) {
          baseData.seatNo = toNumberOrNull(c(IDX.seatNo));
        } else if (isDisplay) {
          // 旧フォーマット（座席列なし）→ null
          baseData.seatNo = null;
        }

        // ★ USBハブ追加列
        if (isUsb) {
          baseData.hdmi = toStrBlank(c(IDX.hdmi));
          baseData.usbA = toStrBlank(c(IDX.usbA));
          baseData.usbC = toStrBlank(c(IDX.usbC));
          baseData.lan = toStrBlank(c(IDX.lan));
        }

        if (hasMeaningfulValue(baseData as Record<string, any>)) {
          toWrite.push({ data: baseData });
        }
      });

      const CHUNK = 300;
      for (let i = 0; i < toWrite.length; i += CHUNK) {
        const slice = toWrite.slice(i, i + CHUNK);
        await Promise.all(slice.map(async ({ data }) => setDoc(doc(collection(db, "equipments")), data)));
        setProgress(Math.round(Math.min(100, ((i + CHUNK) / toWrite.length) * 100)));
      }

      setMessage("全件置換が完了しました。");
    } catch (e: any) {
      setMessage(e?.message ?? "CSVインポートに失敗しました。");
    } finally {
      setImporting(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // --- CSV インポート（★カテゴリ単位の全件置換） ---
  const importCsvForCategory = async (file: File, activeUserRaw: UserDoc[], categoryLabel: string) => {
    setImporting(true);
    setProgress(0);
    setMessage(null);
    try {
      const parsed = await new Promise<Papa.ParseResult<string[]>>((resolve, reject) => {
        Papa.parse<string[]>(file, {
          header: false,
          skipEmptyLines: "greedy",
          transform: (value) => clean(value),
          complete: (res) => resolve(res as any),
          error: (err) => reject(err),
        });
      });

      let rows = (parsed.data as unknown as string[][]).map((cols) => cols.map((c) => clean(c)));
      if (rows.length && /^no\.?$/i.test(rows[0][0] ?? "")) rows = rows.slice(1);
      if (!rows.length) throw new Error("CSVに有効な行がありません。");

      const resolvePerson = (v: unknown) => resolveNameFromUsers(toStrBlank(v), activeUserRaw);

      setMessage(`カテゴリ「${categoryLabel}」の既存データを削除中…`);
      await deleteEquipmentsByCategory(categoryLabel);

      const isUsbCategory = categoryLabel === "USBハブ";
      const isDisplayCategory = categoryLabel === "ディスプレイ";

      const toWrite: Array<{ data: Partial<EquipmentDoc> }> = [];

      rows.forEach((cols, i) => {
        const c = (k: number) => clean(cols[k] ?? "");

        // ディスプレイで座席列がある新フォーマット（16 列以上）を優先、
        // そうでなければ BASE/USB で解釈
        const useDisplayWithSeat = isDisplayCategory && cols.length >= 16;
        const IDX: any = isUsbCategory ? (cols.length >= 19 ? IDX_USB : IDX_BASE) : useDisplayWithSeat ? IDX_DISPLAY_WITH_SEAT : IDX_BASE;

        const seqFromCsv = toInt(c(IDX.no));
        const baseData: Partial<EquipmentDoc> = {
          seqOrder: seqFromCsv ?? i + 1,
          acceptedDate: toTimestamp(c(IDX.acceptedDate)),
          assetNo: toStrBlank(c(IDX.assetNo)),
          category: categoryLabel, // 強制
          branchNo: toStrBlank(c(IDX.branchNo)),
          deviceName: toStrBlank(c(IDX.deviceName)),
          updatedOn: toTimestamp(c(IDX.updatedOn)),
          confirmedOn: toTimestamp(c(IDX.confirmedOn)),
          disposedOn: toTimestamp(c(IDX.disposedOn)),
          owner: resolvePerson(c(IDX.owner)),
          status: toStrBlank(c(IDX.status)),
          history: toStrBlank(c(IDX.history)),
          note: toStrBlank(c(IDX.note)),
          location: toStrBlank(c(IDX.location)),
          lastEditor: resolvePerson(c(IDX.lastEditor)),
        };

        // ★ ディスプレイ：座席列
        if (useDisplayWithSeat) {
          baseData.seatNo = toNumberOrNull(c(IDX.seatNo));
        } else if (isDisplayCategory) {
          baseData.seatNo = null;
        }

        // ★ USBハブ：追加列
        if (isUsbCategory && cols.length >= 19) {
          baseData.hdmi = toStrBlank(c(IDX.hdmi));
          baseData.usbA = toStrBlank(c(IDX.usbA));
          baseData.usbC = toStrBlank(c(IDX.usbC));
          baseData.lan = toStrBlank(c(IDX.lan));
        }

        if (hasMeaningfulValue(baseData as Record<string, any>)) {
          toWrite.push({ data: baseData });
        }
      });

      const CHUNK = 300;
      for (let i = 0; i < toWrite.length; i += CHUNK) {
        const slice = toWrite.slice(i, i + CHUNK);
        await Promise.all(slice.map(async ({ data }) => setDoc(doc(collection(db, "equipments")), data)));
        setProgress(Math.round(Math.min(100, ((i + CHUNK) / toWrite.length) * 100)));
      }

      setMessage(`カテゴリ「${categoryLabel}」の全件置換が完了しました。`);
    } catch (e: any) {
      setMessage(e?.message ?? "カテゴリCSVインポートに失敗しました。");
    } finally {
      setImporting(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // --- CRUD ---

  const createOne = async (payload: EquipmentDoc) => {
    const data: EquipmentDoc & { createdAt?: any; updatedAt?: any } = {
      ...payload,
      seqOrder: payload.seqOrder ?? Date.now(),
    };
    await addDoc(collection(db, "equipments"), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as any);
  };

  const updateOne = async (docId: string, payload: EquipmentDoc) => {
    await updateDoc(doc(collection(db, "equipments"), docId), {
      ...payload,
      updatedAt: serverTimestamp(),
    } as any);
  };

  const deleteOne = async (docId: string) => {
    await deleteDoc(doc(collection(db, "equipments"), docId));
  };

  return {
    rowsRaw,
    gridRows,
    importing,
    progress,
    message,
    setMessage,
    // CSV
    importCsv, // 全体置換（混在CSV対応）
    importCsvForCategory, // カテゴリ単置換（ディスプレイ座席/USB拡張対応）
    pendingFileRef,
    setImporting,
    setProgress,
    // CRUD
    createOne,
    updateOne,
    deleteOne,
    // 日付ユーティリティ（フォームから利用）
    tsToYMD,
    ymdToTimestamp,
  };
};
