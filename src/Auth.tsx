// src/components/AuthDialog.tsx
import React, { useMemo, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, updateProfile /*, sendEmailVerification */ } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

type Props = {
  open: boolean;
  onClose: () => void; // 明示的に閉じるときだけ呼ぶ
  onSuccess?: () => void; // 登録成功後に親側でリロード等したい場合
};

const AuthDialog: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  // 簡易バリデーション
  const emailOk = useMemo(() => /\S+@\S+\.\S+/.test(email), [email]);
  const passwordOk = useMemo(() => password.length >= 6, [password]); // Firebase 最小6文字
  const nameOk = useMemo(() => name.trim().length > 0, [name]);
  const formOk = emailOk && passwordOk && nameOk && !submitting;

  const register = async () => {
    if (!formOk) return;
    setSubmitting(true);
    setError(null);
    try {
      // 1) 認証ユーザー作成
      const cred = await createUserWithEmailAndPassword(auth, email, password); // 公式手順
      // 2) displayName を設定
      await updateProfile(cred.user, { displayName: name.trim() });
      // 3) Firestore users/{uid} に upsert
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          uid: cred.user.uid,
          email: cred.user.email ?? "",
          emailLower: (cred.user.email ?? "").toLowerCase(),
          displayName: name.trim(),
          photoURL: cred.user.photoURL ?? "",
          role: "user",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      // 4) （必要なら）メール確認
      // await sendEmailVerification(cred.user);

      // 成功ハンドリング
      onSuccess?.();
      onClose(); // 明示的に閉じる
      navigate("/"); // 既存の遷移先に合わせて
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "登録に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      // ★ 背景クリックでは閉じない
      onClose={(_e, reason) => {
        if (reason !== "backdropClick") onClose();
      }}
      // ★ Esc では閉じない
      disableEscapeKeyDown
      fullWidth
      maxWidth="xs"
      keepMounted
      PaperProps={{
        component: "form",
        onSubmit: (e: React.FormEvent) => {
          e.preventDefault();
          register();
        },
      }}
    >
      <DialogTitle>新規ユーザー登録</DialogTitle>
      <DialogContent>
        <TextField
          label="氏名"
          fullWidth
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          error={!!name && !nameOk}
          helperText={!!name && !nameOk ? "氏名を入力してください" : " "}
          sx={{ mt: 0.5 }}
        />
        <TextField
          label="E-mail"
          fullWidth
          variant="outlined"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          error={!!email && !emailOk}
          helperText={!!email && !emailOk ? "メールアドレスの形式が不正です" : " "}
          sx={{ my: 1 }}
        />
        <TextField
          label="Password"
          fullWidth
          variant="outlined"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          error={!!password && !passwordOk}
          helperText={!!password && !passwordOk ? "6文字以上で入力してください" : " "}
        />
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        {/* 閉じるボタンを明示的に用意（背景やEscでは閉じないため） */}
        <Button onClick={onClose} variant="outlined" sx={{ width: 140 }}>
          閉じる
        </Button>
        <Button type="submit" variant="contained" color="success" sx={{ width: 140 }} disabled={!formOk}>
          {submitting ? "登録中..." : "新規登録"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AuthDialog;
