import { Timestamp } from "firebase/firestore";
import { clean } from "./strings";
import { UserDoc } from "../types/equipment";

// 任意 → Date|null（users.startDate/endDate用）
const anyToDate = (v: string | Timestamp | null | undefined): Date | null => {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  const s = clean(v);
  if (!s) return null;
  const m = s.match(/^(\d{2,4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m) {
    const y = Number(m[1].length === 2 ? "20" + m[1] : m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export const isActiveToday = (u: UserDoc, today: Date): boolean => {
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = anyToDate(u.startDate);
  const end = anyToDate(u.endDate);
  const startOk = !start || start <= dayStart;
  const endOk = !end || end >= dayStart;
  return startOk && endOk;
};

// 苗字正規化 & usersからフルネーム解決
export const normalizeSurname = (s: string): string => {
  return clean(
    s
      .replace(/（.*?）/g, "")
      .replace(/\(.*?\)/g, "")
      .replace(/[様さんくんちゃん殿氏]/g, "")
  )
    .split(/\s+/)[0]
    .split("　")[0];
};

export const resolveNameFromUsers = (raw: string, users: UserDoc[]): string => {
  const inStr = clean(raw);
  if (!inStr) return "";
  const key = normalizeSurname(inStr);
  if (!key) return inStr;

  const hit = users.find((u) => {
    const dn = clean(u.displayName ?? "");
    if (dn && dn.startsWith(key)) return true;
    const sc = clean(u.staffcode ?? "");
    if (sc === key) return true;
    const emailLeft = clean(u.email ?? "").split("@")[0];
    if (emailLeft && emailLeft.startsWith(key)) return true;
    return false;
  });

  return hit?.displayName ? clean(hit.displayName) : inStr;
};
