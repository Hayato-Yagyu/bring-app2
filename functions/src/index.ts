// functions/src/index.ts
import * as admin from "firebase-admin";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {defineString} from "firebase-functions/params";

admin.initializeApp();
const db = admin.firestore();

// FieldValue の短縮（行長対策）
const {FieldValue} = admin.firestore;
const {serverTimestamp, increment} = FieldValue;

// params（.env）キー
const EMAILJS_SERVICE_ID = defineString("EMAILJS_SERVICE_ID");
const EMAILJS_TEMPLATE_ID = defineString("EMAILJS_TEMPLATE_ID");
const EMAILJS_PRIVATE_KEY = defineString("EMAILJS_PRIVATE_KEY");
const EMAILJS_PUBLIC_KEY = defineString("EMAILJS_PUBLIC_KEY");
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
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

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
    // Public Key（＝旧 user_id）が必須
    public_key: EMAILJS_PUBLIC_KEY.value(),
    // サーバー間は Private Key を accessToken に
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
    throw new Error(`EmailJS ${res.status}: ${text}`);
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
 * スケジュール実行（毎日 14:10 JST）で返却案内を送信。
 */
export const remindReturnIfDue = onSchedule(
  {
    schedule: "50 14 * * *",
    timeZone: "Asia/Tokyo",
    retryCount: 3,
  },
  async () => {
    try {
      // パラメータの存在だけログ（値は出さない）
      console.log("[remind] params:", {
        SERVICE: !!EMAILJS_SERVICE_ID.value(),
        TEMPLATE: !!EMAILJS_TEMPLATE_ID.value(),
        PUBLIC: !!EMAILJS_PUBLIC_KEY.value(),
        KEY: !!EMAILJS_PRIVATE_KEY.value(),
        BASE_URL: !!APPROVAL_BASE_URL.value(),
      });

      const today = todayJst();
      const targets = await findTargets();

      console.log("[remind] start", {date: today, count: targets.length});

      if (!targets.length) {
        console.log("[remind] no targets; exit normally");
        return;
      }

      const batch = db.batch();
      let ok = 0;
      let ng = 0;

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

        try {
          console.log("[remind] send ->", email, "post:", row.id);
          await sendEmailWithEmailJS(templateParams);

          const ref = db.collection("posts").doc(row.id);
          batch.update(ref, {
            returnReminderSentAt: serverTimestamp(),
            returnReminderCount: increment(1),
          });
          ok++;
        } catch (e) {
          ng++;
          console.warn("[remind] send failed:", row.id, String((e as Error)?.message ?? e));
          // 続行（他の対象へ）
        }
      }

      await batch.commit();
      console.log("[remind] finished.", {ok, ng});
      // 例外を投げない → Scheduler から成功扱い
    } catch (e) {
      // 想定外の例外もログだけ出して終了（次回へ）
      console.error("[remind] fatal:", String(e));
    }
  }
);
