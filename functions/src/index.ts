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
const EMAILJS_PRIVATE_KEY = defineString("EMAILJS_PRIVATE_KEY"); // ← Private Key
const EMAILJS_PUBLIC_KEY = defineString("EMAILJS_PUBLIC_KEY"); // ← Public Key (user_id)
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

/** JST の "YYYY-MM-DD" を返す。 */
const todayJst = (): string => {
  const tz = "Asia/Tokyo";
  const now = new Date();
  const parts = new Intl.DateTimeFormat("ja-JP", {timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(now);

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
};

/** 返却承認が済んでいるか。 */
function isReturned(row: Post): boolean {
  const hasDate = !!(row.confirmationdate && String(row.confirmationdate).trim());
  const hasStamp = !!(row.confirmationstamp && String(row.confirmationstamp).trim());
  return hasDate || hasStamp;
}

/** 必須パラメータ存在チェック（起動時1回分） */
function checkEnvOnce(): { ok: boolean; miss: string[] } {
  const miss: string[] = [];
  if (!EMAILJS_SERVICE_ID.value()) miss.push("EMAILJS_SERVICE_ID");
  if (!EMAILJS_TEMPLATE_ID.value()) miss.push("EMAILJS_TEMPLATE_ID");
  if (!EMAILJS_PUBLIC_KEY.value()) miss.push("EMAILJS_PUBLIC_KEY (user_id / Public Key)");
  if (!EMAILJS_PRIVATE_KEY.value()) miss.push("EMAILJS_PRIVATE_KEY (accessToken / Private Key)");
  if (!APPROVAL_BASE_URL.value()) miss.push("APPROVAL_BASE_URL");
  return {ok: miss.length === 0, miss};
}

/** EmailJS (REST) でメール送信（サーバ to サーバ）。 */
async function sendEmailWithEmailJS(params: Record<string, unknown>): Promise<void> {
  const url = "https://api.emailjs.com/api/v1.0/email/send";
  const body = {
    service_id: EMAILJS_SERVICE_ID.value(),
    template_id: EMAILJS_TEMPLATE_ID.value(),
    // 重要：Public Key は user_id フィールド名で送る
    user_id: EMAILJS_PUBLIC_KEY.value(),
    // サーバー（非ブラウザ）利用は Private Key を accessToken で同梱
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

/** 返却リマインド対象（未返却・未リマインド・期日到達）を取得。 */
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

/** スケジュール実行（毎日 14:50 JST）で返却案内を送信。 */
export const remindReturnIfDue = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "Asia/Tokyo",
    retryCount: 3,
  },
  async () => {
    try {
      // 1) .env が揃っているか
      const env = checkEnvOnce();
      console.log("[remind] params:", {
        SERVICE: !!EMAILJS_SERVICE_ID.value(),
        TEMPLATE: !!EMAILJS_TEMPLATE_ID.value(),
        PUBLIC: !!EMAILJS_PUBLIC_KEY.value(),
        KEY: !!EMAILJS_PRIVATE_KEY.value(),
        BASE_URL: !!APPROVAL_BASE_URL.value(),
      });
      if (!env.ok) {
        console.error("[remind] missing env:", env.miss);
        return; // 送信処理に進まない
      }

      // 2) 対象抽出
      const today = todayJst();
      const targets = await findTargets();
      console.log("[remind] start", {date: today, count: targets.length});
      if (!targets.length) {
        console.log("[remind] no targets; exit normally");
        return;
      }

      // 3) 送信ループ
      const batch = db.batch();
      let ok = 0;
      let ng = 0;

      for (const row of targets) {
        const email = (row.requestedBy || "").trim();
        const link = (APPROVAL_BASE_URL.value() || "").trim();

        // 最低限のテンプレ必須値
        if (!email || !link) {
          ng++;
          console.warn("[remind] skip (missing to_email/link):", row.id, {email, link});
          continue;
        }

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
          action: "返却申請依頼（催促）",
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

      // 4) フラグ更新コミット
      await batch.commit();
      console.log("[remind] finished.", {ok, ng});
      // 例外を投げない → Scheduler から成功扱い
    } catch (e) {
      // 想定外の例外もログだけ出して終了（次回へ）
      console.error("[remind] fatal:", String(e));
    }
  }
);
