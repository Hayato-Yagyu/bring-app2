// src/components/AuthDialog.tsx
import React, { useMemo, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography, Box, FormControlLabel, Checkbox } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

type Props = { open: boolean; onClose: () => void; onSuccess?: () => void };

// Firestore に保存するユーザー型
type UserDoc = {
  staffcode: string | null;
  displayName: string | null;
  email: string | null;
  group: string | null;
  partner: boolean;
  albite_part_timer: boolean;
  consignment: boolean;
  startDate: string | null; // "YYYY-MM-DD"
  endDate: string | null; // "YYYY-MM-DD"
  unitPrice: number; // number で統一
  role: string | null;
  unForecasts: boolean;
  supervising_responsible: boolean;
};

const AuthDialog: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  // Auth用
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 追加プロファイル
  const [displayName, setDisplayName] = useState("");
  const [staffcode, setStaffcode] = useState("");
  const [group, setGroup] = useState("");
  const [role, setRole] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [unitPrice, setUnitPrice] = useState<string>(""); // 入力は文字列、保存時に number へ

  const [partner, setPartner] = useState(false);
  const [albitePartTimer, setAlbitePartTimer] = useState(false);
  const [consignment, setConsignment] = useState(false);
  const [unForecasts, setUnForecasts] = useState(false);
  const [supervisingResponsible, setSupervisingResponsible] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  // バリデーション
  const emailOk = useMemo(() => /\S+@\S+\.\S+/.test(email), [email]);
  const passwordOk = useMemo(() => password.length >= 6, [password]);
  const displayNameOk = useMemo(() => displayName.trim().length > 0, [displayName]);
  const staffcodeOk = useMemo(() => staffcode.trim().length > 0, [staffcode]);

  const formOk = emailOk && passwordOk && displayNameOk && staffcodeOk && !submitting;

  // number 正規化（変換できなければ 0）
  const toNumberStrict = (v: string) => {
    const s = (v ?? "").trim();
    if (!s) return 0;
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const register = async () => {
    if (!formOk) return;
    setSubmitting(true);
    setError(null);
    try {
      // 1) Auth ユーザ作成
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // 2) 表示名更新
      await updateProfile(cred.user, { displayName: displayName.trim() });

      // 3) Firestore users/{uid} に保存（id は uid）
      const payload: UserDoc = {
        staffcode: staffcode.trim() || null,
        displayName: displayName.trim() || null,
        email: cred.user.email ?? null,
        group: group.trim() || null,
        partner,
        albite_part_timer: albitePartTimer,
        consignment,
        startDate: startDate || null,
        endDate: endDate || null,
        unitPrice: toNumberStrict(unitPrice),
        role: role.trim() || null,
        unForecasts,
        supervising_responsible: supervisingResponsible,
      };

      await setDoc(doc(db, "users", cred.user.uid), payload, { merge: false });

      onSuccess?.();
      onClose();
      navigate("/users"); // ユーザー管理へ戻す場合
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
      onClose={(_e, reason) => {
        if (reason !== "backdropClick") onClose();
      }}
      disableEscapeKeyDown
      fullWidth
      maxWidth="sm" // 入力項目が増えるので xs→sm に広げる
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
        {/* Auth 基本情報 */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
          <TextField
            label="氏名（displayName）"
            fullWidth
            variant="outlined"
            value={displayName}
            onChange={(e) => setDisplayName(e.currentTarget.value)}
            error={!!displayName && !displayNameOk}
            helperText={!!displayName && !displayNameOk ? "氏名を入力してください" : " "}
            sx={{ mt: 0.5 }}
          />
          <TextField
            label="社員コード（staffcode）"
            fullWidth
            variant="outlined"
            value={staffcode}
            onChange={(e) => setStaffcode(e.currentTarget.value)}
            error={!!staffcode && !staffcodeOk}
            helperText={!!staffcode && !staffcodeOk ? "社員コードを入力してください" : " "}
            sx={{ mt: 0.5 }}
          />
          <TextField
            label="E-mail（Auth用）"
            fullWidth
            variant="outlined"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            error={!!email && !emailOk}
            helperText={!!email && !emailOk ? "メールアドレスの形式が不正です" : " "}
            sx={{ my: 0.5 }}
          />
          <TextField
            label="Password（Auth用）"
            fullWidth
            variant="outlined"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            error={!!password && !passwordOk}
            helperText={!!password && !passwordOk ? "6文字以上で入力してください" : " "}
            sx={{ my: 0.5 }}
          />
        </Box>

        {/* 追加プロフィール */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1, mt: 1 }}>
          <TextField label="所属グループ（group）" fullWidth variant="outlined" value={group} onChange={(e) => setGroup(e.currentTarget.value)} />
          <TextField label="役割（role）" fullWidth variant="outlined" value={role} onChange={(e) => setRole(e.currentTarget.value)} />

          <TextField label="開始日（startDate）" type="date" fullWidth InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => setStartDate(e.currentTarget.value)} />
          <TextField label="終了日（endDate）" type="date" fullWidth InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => setEndDate(e.currentTarget.value)} />

          <TextField label="単価（unitPrice, number）" type="number" fullWidth value={unitPrice} onChange={(e) => setUnitPrice(e.currentTarget.value)} inputProps={{ inputMode: "numeric", min: 0 }} />
        </Box>

        {/* boolean 項目 */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, mt: 1 }}>
          <FormControlLabel control={<Checkbox checked={partner} onChange={(e) => setPartner(e.target.checked)} />} label="partner" />
          <FormControlLabel control={<Checkbox checked={albitePartTimer} onChange={(e) => setAlbitePartTimer(e.target.checked)} />} label="albite_part_timer" />
          <FormControlLabel control={<Checkbox checked={consignment} onChange={(e) => setConsignment(e.target.checked)} />} label="consignment" />
          <FormControlLabel control={<Checkbox checked={unForecasts} onChange={(e) => setUnForecasts(e.target.checked)} />} label="unForecasts" />
          <FormControlLabel control={<Checkbox checked={supervisingResponsible} onChange={(e) => setSupervisingResponsible(e.target.checked)} />} label="supervising_responsible" />
        </Box>

        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined" sx={{ width: 140 }}>
          閉じる
        </Button>
        <Button type="submit" variant="contained" color="success" sx={{ width: 160 }} disabled={!formOk}>
          {submitting ? "登録中..." : "ユーザー作成"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AuthDialog;
