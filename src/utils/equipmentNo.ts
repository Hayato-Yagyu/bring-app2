// 採番ユーティリティ: Excelの yyyymm_連番_0_分類コード を生成（連番はTxで発行）
import { runTransaction, doc } from "firebase/firestore";
import { db } from "../firebase";

const pad2 = (n: number) => n.toString().padStart(2, "0");

/**
 * 分類コードを返す。
 * 今回は「パソコン」固定運用なので code = "PC" を既定値にしつつ、
 * 将来の拡張に備えて label からの解決も可能な形にしておく。
 */
export async function resolveCategoryCode(labelOrCode: string): Promise<string> {
  // 既にコードが渡されたケースを優先（2文字の大文字など）
  if (/^[A-Z]{2,}$/.test(labelOrCode)) return labelOrCode;

  // ラベルが「パソコン」の場合は PC を既定に
  if (labelOrCode === "パソコン") return "PC";

  // ここから先は必要に応じて拡張（例：asset_categories を検索して label → code を求める等）
  // 最低限のフォールバック
  return "PC";
}

/**
 * 月×分類ごとの連番をTxで+1して機器番号を返す。
 * - counterDoc: equip_no_counters / `${yyyymm}_${categoryCode}`
 * - seq: number（最新連番）
 */
export async function generateEquipmentNo(params: {
  registeredAt: Date; // 受付日
  categoryCode: string; // 例: "PC"
}): Promise<string> {
  const { registeredAt, categoryCode } = params;

  const y = registeredAt.getFullYear();
  const m = registeredAt.getMonth() + 1;
  const yyyymm = `${y}${m.toString().padStart(2, "0")}`;
  const counterId = `${yyyymm}_${categoryCode}`;
  const counterRef = doc(db, "equip_no_counters", counterId);

  const nextSeq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    if (!snap.exists()) {
      // 初回作成
      tx.set(counterRef, { seq: 0 });
      // 直後に +1
      tx.update(counterRef, { seq: 1 });
      return 1;
    } else {
      const current = (snap.data().seq as number) ?? 0;
      const next = current + 1;
      tx.update(counterRef, { seq: next });
      return next;
    }
  });

  // Excelの "_0_" も踏襲
  return `${yyyymm}_${pad2(nextSeq)}_0_${categoryCode}`;
}
