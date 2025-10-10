export const clean = (v: unknown): string => {
  const s = String(v ?? "");
  return s
    .replace(/\uFEFF/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\u3000/g, " ")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .trim();
};

export const toStrBlank = (v: unknown): string => clean(v);

export const toInt = (v: unknown): number | undefined => {
  const s = clean(v).replace(/[, ]/g, "");
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

export const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
