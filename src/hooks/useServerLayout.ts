// src/hooks/useServerLayout.ts
import { useEffect, useState, useCallback } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp, FieldValue } from "firebase/firestore";

/**
 * スロット1枠分の型
 * - label: 表示名（Rack名/段数など）
 * - equipmentId: 割り当てる Equipment ドキュメントID（未設定は null）
 */
export type ServerSlot = {
  label: string;
  equipmentId: string | null;
};

/**
 * サーバ室レイアウトの型
 * - updatedBy は null を許容（解法A）
 * - updatedAt は serverTimestamp() を保持
 */
export type ServerLayout = {
  name: string;
  slots: Record<string, ServerSlot>;
  updatedAt?: FieldValue;
  updatedBy?: string | null; // ★ 解法A: null を許容
};

/**
 * 初期レイアウト（必要に応じて編集してください）
 */
const DEFAULT_LAYOUT: ServerLayout = {
  name: "メインルーム",
  slots: {
    "rackA-1": { label: "Rack A / 1U", equipmentId: null },
    "rackA-2": { label: "Rack A / 2U", equipmentId: null },
    "rackA-3": { label: "Rack A / 3U", equipmentId: null },
    "rackB-1": { label: "Rack B / 1U", equipmentId: null },
    "rackB-2": { label: "Rack B / 2U", equipmentId: null },
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

  /**
   * スロットへ機器を割り当て/解除する
   * @param slotId スロットID（例: "rackA-1"）
   * @param equipmentId 機器ID（解除は null）
   * @param uid 実行ユーザーUID（未指定なら null 保存）
   */
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
        updatedBy: uid ?? null, // ★ 解法A: null を入れる
      };

      await setDoc(ref, next, { merge: true });
      setLayout(next);
    },
    [layout, layoutId]
  );

  return { loading, layout, assign };
};
