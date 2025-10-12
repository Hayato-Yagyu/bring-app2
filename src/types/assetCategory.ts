import { Timestamp } from "firebase/firestore";

export type AssetCategoryDoc = {
  code: string; // 例: "PC"
  label: string; // 例: "パソコン"
  isTarget: boolean; // 採番対象か
  group?: string | null; // "採番対象" / "対象外" / "その他対象外" など（任意）
  registeredOn?: Timestamp | null;
  notes?: string;
  updatedAt?: Timestamp | null;
};
