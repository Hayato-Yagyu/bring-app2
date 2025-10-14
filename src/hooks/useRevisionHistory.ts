import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase"; // ← プロジェクト構成に合わせて
import { RevisionItem } from "../types/revision";
import { ymdToTimestamp } from "../utils/datetime";

const COL = "revision_histories";

export const useRevisionHistory = () => {
  const [rows, setRows] = useState<RevisionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<null | { message: string; indexUrl?: string }>(null);

  useEffect(() => {
    setLoading(true);

    // 🔹 インデックス不要バージョン（必要なら orderBy("noNumber", "desc") を追加）
    const q = query(collection(db, COL), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: RevisionItem[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as RevisionItem) }));
        setRows(list);
        setErrorState(null);
        setLoading(false);
      },
      (err) => {
        // 🔹 複合インデックス未作成などのエラーも握り潰さずUIに返す
        let indexUrl: string | undefined;
        const m = /https:\/\/console\.firebase\.google\.com\/[^\s]+/i.exec(err.message);
        if (m) indexUrl = m[0];

        setErrorState({ message: err.message, indexUrl });
        setRows([]);
        setLoading(false);
        console.error("useRevisionHistory onSnapshot error:", err);
      }
    );

    return () => unsub();
  }, []);

  // ----------------------------------------------------------------
  // 🔹 CREATE: 新規追加
  // ----------------------------------------------------------------
  const create = async (payload: {
    no: string;
    content: string;
    createdAtYmd: string; // "YYYY-MM-DD"
    author: string;
    createdBy?: string; // string | undefined
  }) => {
    const noNumber = Number(payload.no.replace(/[^\d]/g, "")) || 0;
    const createdAt = ymdToTimestamp(payload.createdAtYmd) as Timestamp;

    await addDoc(collection(db, COL), {
      no: payload.no,
      noNumber,
      content: payload.content,
      author: payload.author,
      createdAt,
      createdBy: payload.createdBy ?? null, // ✅ undefined → null に変換
      updatedBy: null, // ✅ Firestoreはundefinedを許容しないので明示的にnull
      updatedAt: serverTimestamp(),
    });
  };

  // ----------------------------------------------------------------
  // 🔹 UPDATE: 既存更新
  // ----------------------------------------------------------------
  const update = async (
    id: string,
    payload: {
      no: string;
      content: string;
      createdAtYmd: string;
      author: string;
      updatedBy?: string; // string | undefined
    }
  ) => {
    const noNumber = Number(payload.no.replace(/[^\d]/g, "")) || 0;
    const createdAt = ymdToTimestamp(payload.createdAtYmd) as Timestamp;

    await updateDoc(doc(db, COL, id), {
      no: payload.no,
      noNumber,
      content: payload.content,
      author: payload.author,
      createdAt,
      updatedBy: payload.updatedBy ?? null, // ✅ null に変換
      updatedAt: serverTimestamp(),
    });
  };

  // ----------------------------------------------------------------
  // 🔹 DELETE: 削除
  // ----------------------------------------------------------------
  const remove = async (id: string) => {
    await deleteDoc(doc(db, COL, id));
  };

  // ----------------------------------------------------------------
  // 🔹 DataGrid 用にフォーマット済み行を生成
  // ----------------------------------------------------------------
  const rowsForGrid = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id!,
        no: r.no,
        content: r.content,
        createdAtYmd: (() => {
          const d = r.createdAt?.toDate?.();
          if (!d) return "";
          const y = d.getFullYear();
          const m = `${d.getMonth() + 1}`.padStart(2, "0");
          const day = `${d.getDate()}`.padStart(2, "0");
          return `${y}-${m}-${day}`;
        })(),
        author: r.author,
      })),
    [rows]
  );

  return { rows, rowsForGrid, loading, errorState, create, update, remove };
};
