// src/types/revision.ts
import { Timestamp } from "firebase/firestore";

export type RevisionItem = {
  id?: string; // Firestore doc id
  no: string; // "1", "2", "3"...
  noNumber: number; // 数値ソート用
  content: string; // 内容
  createdAt: Timestamp; // 制定日（Timestamp）
  author: string; // 記載者（表示名 or userId）
  createdBy?: string; // 追加者UID（任意）
  updatedBy?: string; // 更新者UID（任意）
  updatedAt?: Timestamp;
};
