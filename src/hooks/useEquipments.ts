import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query, setDoc, doc, getDocs, writeBatch, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import * as Papa from "papaparse";
import { EquipmentDoc, GridRow } from "../types/equipment";
import { clean, pad2, toInt, toStrBlank } from "../utils/strings";
import { tsToSlash, ymdToTimestamp, tsToYMD, toTimestamp } from "../utils/datetime";
import { resolveNameFromUsers } from "../utils/users";
import { UserDoc } from "../types/equipment";

export const useEquipments = () => {
  const [rowsRaw, setRowsRaw] = useState<Array<{ docId: string; data: EquipmentDoc }>>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const pendingFileRef = useRef<File | null>(null);

  // 購読
  useEffect(() => {
    const qEq = query(collection(db, "equipments"), orderBy("seqOrder", "asc"));
    const unsub = onSnapshot(qEq, (snap) => {
      const list = snap.docs.map((d) => ({ docId: d.id, data: d.data() as EquipmentDoc }));
      setRowsRaw(list);
    });
    return () => unsub();
  }, []);

  // Grid用変換
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
        };
      }),
    [rowsRaw]
  );

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

  const hasMeaningfulValue = (o: Record<string, any>) => {
    const ignore = new Set(["seq", "id", "seqOrder"]);
    return Object.entries(o).some(([k, v]) => {
      if (ignore.has(k)) return false;
      if (v == null) return false;
      if (typeof v === "string") return v.trim() !== "";
      return true;
    });
  };

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

      const IDX = {
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

      const toWrite: Array<{ data: Partial<EquipmentDoc> }> = [];
      rows.forEach((cols, i) => {
        const c = (k: number) => clean(cols[k] ?? "");
        const seqFromCsv = toInt(c(IDX.no));
        const data: Partial<EquipmentDoc> = {
          seqOrder: seqFromCsv ?? i + 1,
          acceptedDate: toTimestamp(c(IDX.acceptedDate)),
          assetNo: toStrBlank(c(IDX.assetNo)),
          category: toStrBlank(c(IDX.category)),
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
        if (hasMeaningfulValue(data)) toWrite.push({ data });
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

  const updateOne = async (docId: string, payload: EquipmentDoc) => {
    await updateDoc(doc(collection(db, "equipments"), docId), payload as any);
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
    importCsv,
    pendingFileRef,
    setImporting,
    setProgress,
    updateOne,
    deleteOne,
    tsToYMD,
    ymdToTimestamp, // フォーム用
  };
};
