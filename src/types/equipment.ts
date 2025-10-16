import { Timestamp } from "firebase/firestore";

export type EquipmentDoc = {
  id?: string | null;
  assetNo?: string | null;
  category?: string | null;
  branchNo?: string | null;
  deviceName?: string | null;

  acceptedDate?: Timestamp | null;
  updatedOn?: Timestamp | null;
  confirmedOn?: Timestamp | null;
  disposedOn?: Timestamp | null;

  owner?: string | null;
  status?: string | null;
  history?: string | null;
  note?: string | null;
  location?: string | null;
  lastEditor?: string | null;

  // ★ 追加：USBハブ用の拡張項目
  hdmi?: string | null;
  usbA?: string | null;
  usbC?: string | null;
  lan?: string | null;

  seqOrder?: number | null; // No.
};

export type GridRow = {
  id: string;
  seq: string;
  acceptedDate: string;
  assetNo: string;
  category: string;
  branchNo: string;
  deviceName: string;
  updatedOn: string;
  confirmedOn: string;
  disposedOn: string;
  owner: string;
  status: string;
  history: string;
  note: string;
  location: string;
  lastEditor: string;

  // ★ 追加：一覧にも表示
  hdmi?: string;
  usbA?: string;
  usbC?: string;
  lan?: string;
};

export const STATUS_OPTIONS = ["未使用", "使用中", "廃棄", "所在不明"] as const;

export type UserDoc = {
  staffcode?: string | null;
  displayName?: string | null;
  email?: string | null;
  startDate?: string | Timestamp | null;
  endDate?: string | Timestamp | null;
};
