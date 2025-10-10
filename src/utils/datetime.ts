import { Timestamp } from "firebase/firestore";
import { clean } from "./strings";

// CSV/テキスト → Timestamp|null
export const toTimestamp = (v: unknown): Timestamp | null => {
  const s = clean(v);
  if (!s) return null;

  const m = s.match(/^(\d{2,4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m) {
    const y = Number(m[1].length === 2 ? "20" + m[1] : m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    return isNaN(dt.getTime()) ? null : Timestamp.fromDate(dt);
  }

  if (/^\d{3,6}$/.test(s)) {
    const n = Number(s);
    if (n > 20000 && n < 60000) {
      const base = new Date(1899, 11, 30);
      const dt = new Date(base.getTime() + n * 86400000);
      return Timestamp.fromDate(dt);
    }
  }

  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : Timestamp.fromDate(parsed);
};

export const tsToSlash = (ts?: Timestamp | null): string => (ts ? `${ts.toDate().getFullYear()}/${ts.toDate().getMonth() + 1}/${ts.toDate().getDate()}` : "");

export const tsToYMD = (ts?: Timestamp | null): string => {
  if (!ts) return "";
  const d = ts.toDate();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

export const ymdToTimestamp = (s: string): Timestamp | null => {
  const c = clean(s);
  if (!c) return null;
  const m = c.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(dt.getTime()) ? null : Timestamp.fromDate(dt);
};
