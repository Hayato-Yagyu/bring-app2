import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { User } from "firebase/auth";
import { db } from "../firebase";

/** Auth ユーザーを Firestore users/{uid} に upsert */
export async function upsertUserDoc(user: User, extra?: Partial<UserDoc>) {
  const ref = doc(db, "users", user.uid);
  const now = serverTimestamp();

  const base: UserDoc = {
    uid: user.uid,
    email: user.email ?? "",
    emailLower: (user.email ?? "").toLowerCase(),
    displayName: user.displayName ?? "",
    photoURL: user.photoURL ?? "",
    role: "user", // 権限を付けたい場合の初期値
    createdAt: now,
    updatedAt: now,
  };

  // 既存があれば createdAt を保持
  const snap = await getDoc(ref);
  const payload = snap.exists() ? { ...base, createdAt: snap.data().createdAt ?? now, ...extra, updatedAt: now } : { ...base, ...extra };

  await setDoc(ref, payload, { merge: true });
}

export type UserDoc = {
  uid: string;
  email: string;
  emailLower: string;
  displayName: string;
  photoURL?: string;
  role?: "user" | "admin";
  createdAt: any;
  updatedAt: any;
};
