// src/hooks/useServerLayout.ts
import { useEffect, useState, useCallback } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp, FieldValue } from "firebase/firestore";

/** スロット1枠分 */
export type ServerSlot = {
  label: string;
  equipmentId: string | null;
};

/** サーバ室レイアウト（A案: updatedBy は null 許容） */
export type ServerLayout = {
  name: string;
  slots: Record<string, ServerSlot>;
  updatedAt?: FieldValue;
  updatedBy?: string | null;
};

/** 初期レイアウト：サーバ室 正面（①〜⑫） */
const DEFAULT_LAYOUT: ServerLayout = {
  name: "サーバ室 正面",
  slots: {
    "front-01": { label: "①", equipmentId: null },
    "front-02": { label: "②", equipmentId: null },
    "front-03": { label: "③", equipmentId: null },
    "front-04": { label: "④", equipmentId: null },
    "front-05": { label: "⑤", equipmentId: null },
    "front-06": { label: "⑥", equipmentId: null },
    "front-07": { label: "⑦", equipmentId: null },
    "front-08": { label: "⑧", equipmentId: null },
    "front-09": { label: "⑨", equipmentId: null },
    "front-10": { label: "⑩", equipmentId: null },
    "front-11": { label: "⑪", equipmentId: null },
    "front-12": { label: "⑫", equipmentId: null },
  },
};

export const useServerLayout = (layoutId = "main") => {
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<ServerLayout>(DEFAULT_LAYOUT);

  // 初期読み込み（なければ作成）
  useEffect(() => {
    (async () => {
      setLoading(true);
      const ref = doc(db, "server_layouts", layoutId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setLayout(snap.data() as ServerLayout);
      } else {
        await setDoc(ref, DEFAULT_LAYOUT);
        setLayout(DEFAULT_LAYOUT);
      }
      setLoading(false);
    })();
  }, [layoutId]);

  /** スロットへ機器を割り当て/解除する（解除は equipmentId=null） */
  const assign = useCallback(
    async (slotId: string, equipmentId: string | null, uid?: string) => {
      const ref = doc(db, "server_layouts", layoutId);
      const next: ServerLayout = {
        ...layout,
        slots: {
          ...layout.slots,
          [slotId]: {
            ...(layout.slots[slotId] || { label: slotId, equipmentId: null }),
            equipmentId,
          },
        },
        updatedAt: serverTimestamp(),
        updatedBy: uid ?? null, // A案: null を保存
      };
      await setDoc(ref, next, { merge: true });
      setLayout(next);
    },
    [layout, layoutId]
  );

  return { loading, layout, assign };
};
