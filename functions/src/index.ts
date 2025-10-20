// functions/src/index.ts
import * as admin from "firebase-admin";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {defineString} from "firebase-functions/params";

admin.initializeApp();
const db = admin.firestore();

// FieldValue の短縮（行長対策）
const {FieldValue} = admin.firestore;
const {serverTimestamp, increment} = FieldValue;

// functions:config:set で設定したキー名
const EMAILJS_SERVICE_ID = defineString("EMAILJS_SERVICE_ID");
const EMAILJS_TEMPLATE_ID = defineString("EMAILJS_TEMPLATE_ID");
const EMAILJS_PRIVATE_KEY = defineString("EMAILJS_PRIVATE_KEY");
const APPROVAL_BASE_URL = defineString("APPROVAL_BASE_URL");

/** posts ドキュメントの最小型 */
type Post = {
  id: string;
  applicant?: string;
  applicantdate?: string;
  classification?: string;
  periodfrom?: string;
  periodto?: string;
  where?: string;
  materials?: string;
  media?: string;
  requestedBy?: string;
  confirmationdate?: string;
  confirmationstamp?: string;
  returnReminderSentAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
};

/**
 * JST の "YYYY-MM-DD" を返す。
 * @returns {string} 例: "2025-10-20"
 */
const todayJst = (): string => {
  const tz = "Asia/Tokyo";
  const now = new Date();
  const parts = new Intl.DateTimeFormat("ja-JP", {timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(now);

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
};

/**
 * 返却承認が済んでいるか。
 * @param {Post} row 行データ
 * @returns {boolean} 承認済みなら true
 */
function isReturned(row: Post): boolean {
  const hasDate = !!(row.confirmationdate && String(row.confirmationdate).trim());
  const hasStamp = !!(row.confirmationstamp && String(row.confirmationstamp).trim());
  return hasDate || hasStamp;
}

/**
 * EmailJS (REST) でメール送信（サーバ to サーバ）。
 * @param {Record<string, unknown>} params テンプレ変数
 * @returns {Promise<void>} 送信完了
 */
async function sendEmailWithEmailJS(params: Record<string, unknown>): Promise<void> {
  const url = "https://api.emailjs.com/api/v1.0/email/send";
  const body = {
    service_id: EMAILJS_SERVICE_ID.value(),
    template_id: EMAILJS_TEMPLATE_ID.value(),
    // サーバー側は accessToken を推奨
    accessToken: EMAILJS_PRIVATE_KEY.value(),
    template_params: params,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EmailJS error: ${res.status} ${text}`);
  }
}

/**
 * 返却リマインド対象（未返却・未リマインド・期日到達）を取得。
 * @returns {Promise<Post[]>} 対象配列
 */
async function findTargets(): Promise<Post[]> {
  const today = todayJst(); // "YYYY-MM-DD"

  const snap = await db.collection("posts").where("periodto", "<=", today).orderBy("periodto", "asc").limit(500).get();

  const rows = snap.docs.map((d) => {
    const data = d.data() as Omit<Post, "id">;
    return {id: d.id, ...data};
  });

  const targets = rows.filter((row) => {
    const alreadyReminded = !!row.returnReminderSentAt;
    const hasRequester = !!row.requestedBy;
    return !isReturned(row) && !alreadyReminded && hasRequester;
  });

  return targets;
}

/**
 * スケジュール実行（毎日 09:00 JST）で返却案内を送信。
 */
export const remindReturnIfDue = onSchedule(
  {
    schedule: "45 13 * * *",
    timeZone: "Asia/Tokyo",
    retryCount: 3,
  },
  async () => {
    const today = todayJst();
    const targets = await findTargets();
    if (!targets.length) return;

    const batch = db.batch();

    for (const row of targets) {
      const email = row.requestedBy as string;
      const link = APPROVAL_BASE_URL.value();

      const templateParams = {
        to_email: email,
        to_name: row.applicant || "",
        id: row.id,
        applicantdate: row.applicantdate || "",
        applicant: row.applicant || "",
        classification: row.classification || "",
        periodfrom: row.periodfrom || "",
        periodto: row.periodto || "",
        where: row.where || "",
        materials: row.materials || "",
        media: row.media || "",
        link,
        purpose: "返却申請のご案内",
        action: "返却申請",
        today,
      };

      await sendEmailWithEmailJS(templateParams);

      const ref = db.collection("posts").doc(row.id);
      batch.update(ref, {
        returnReminderSentAt: serverTimestamp(),
        returnReminderCount: increment(1),
      });
    }

    await batch.commit();
  }
);
