// src/components/NewPostDialog.tsx
import React, { SetStateAction, useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography, TextField, MenuItem, Box, Paper } from "@mui/material";
import styled from "@emotion/styled";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import emailjs from "@emailjs/browser";
import ComfirmDialog from "./ComfirmDialog";
import Where from "./Where";
import { useUser } from "../components/UserContext";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

type Approver = { name: string; email: string };

const EMAILJS_SERVICE_ID = "service_0sslyge";
const EMAILJS_TEMPLATE_ID = "template_81c28kt";

const NewPostDialog: React.FC<Props> = ({ open, onClose, onSaved }) => {
  const [applicantdate, setApplicantdate] = useState("");
  const [applicant, setApplicant] = useState("");
  const [classification, setClassification] = useState("");
  const [periodfrom, setPeriodfrom] = useState("");
  const [periodto, setPeriodto] = useState("");
  const [where, setWhere] = useState("");

  // UI: 設備番号（DBでは media に入れる）
  const [materials, setMaterials] = useState("");

  // UI: 設備（選択）
  const [media, setMedia] = useState("");
  const [mediaOther, setMediaOther] = useState("");

  const [permitdate, setPermitdate] = useState("");
  const [permitstamp, setPermitstamp] = useState("");
  const [confirmationdate, setConfirmationdate] = useState("");
  const [confirmationstamp, setConfirmationstamp] = useState("");

  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("入力されていないフィールドがあります。");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [dateError, setDateError] = useState<string | null>(null);

  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [toEmail, setToEmail] = useState<string>("");
  const [toName, setToName] = useState("");

  const [isSending, setIsSending] = useState(false);

  const { user } = useUser();

  const handleCloseDialog = () => setOpenDialog(false);

  useEffect(() => {
    const name = (user as any)?.displayName?.trim?.() || (user as any)?.email || "";
    setApplicant(name);
  }, [user]);

  useEffect(() => {
    const a = approvers.find((x) => x.email === toEmail);
    setToName(a?.name ?? "");
  }, [toEmail, approvers]);

  const validateDateRange = (from: string, to: string) => {
    if (!from || !to) {
      setDateError(null);
      return true;
    }
    const ok = new Date(from).getTime() <= new Date(to).getTime();
    setDateError(ok ? null : "「持込・持出日 から」より「まで」が過去日になっています。");
    return ok;
  };

  useEffect(() => {
    if (!open) return;
    const loadApprovers = async () => {
      try {
        const qs = await getDocs(collection(db, "approvers"));
        const list: Approver[] = qs.docs
          .map((d) => {
            const data = d.data() as any;
            return { name: data?.name ?? "", email: data?.email ?? "" };
          })
          .filter((a) => a.email);

        setApprovers(list);
        if (list.length > 0) setToEmail(list[0].email);
      } catch (e) {
        console.error("Failed to load approvers:", e);
        setDialogMessage("承認者マスタの取得に失敗しました。ネットワークや権限をご確認ください。");
        setOpenDialog(true);
      }
    };
    loadApprovers();
  }, [open]);

  useEffect(() => {
    if (!open) setIsSubmitted(false);
  }, [open]);

  // ★ フォーム一括リセット（applicant/toEmail は残す）
  const [selectedOption, setSelectedOption] = useState("");
  const [otherInput, setOtherInput] = useState("");
  const resetForm = () => {
    setApplicantdate("");
    setClassification("");
    setPeriodfrom("");
    setPeriodto("");
    setWhere("");
    setMaterials("");
    setMedia("");
    setMediaOther("");
    setPermitdate("");
    setPermitstamp("");
    setConfirmationdate("");
    setConfirmationstamp("");
    setDateError(null);
    setIsSubmitted(false);
    setSelectedOption("");
    setOtherInput("");
  };

  // DialogのonCloseをラップ：閉じる経路すべてで確実にリセット
  const handleDialogClose = (_event?: object, _reason?: string) => {
    if (!isSending) resetForm();
    onClose?.();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSending) return;

    if (!applicantdate.trim() || !applicant.trim() || !classification.trim() || !periodfrom.trim() || !periodto.trim() || !where.trim() || !materials.trim() || !media.trim()) {
      setDialogMessage("入力されていないフィールドがあります。");
      setOpenDialog(true);
      return;
    }

    if (!validateDateRange(periodfrom, periodto)) {
      setDialogMessage("「持込・持出日」の範囲が不正です（開始日 ≤ 終了日 となるように入力してください）。");
      setOpenDialog(true);
      return;
    }

    if (!toEmail) {
      setDialogMessage("承認先（受信者）が選択されていません。");
      setOpenDialog(true);
      return;
    }

    if (media === "その他" && !mediaOther.trim()) {
      setDialogMessage("設備で『その他』を選択した場合は、具体的な名称を入力してください。");
      setOpenDialog(true);
      return;
    }

    setIsSending(true);
    try {
      // 保存用に設備名を正規化
      const mediaDisplay = media === "その他" ? mediaOther.trim() : media;

      // 1) posts へ登録
      const postPayload = {
        applicantdate,
        applicant,
        classification,
        periodfrom,
        periodto,
        where,
        materials: mediaDisplay, // 設備名
        media: materials, // 設備番号
        mediaRaw: media,
        permitdate,
        permitstamp,
        confirmationdate,
        confirmationstamp,
        notifyTo: toEmail,
        requestedBy: user?.email ?? "",
        requestedAt: new Date().toISOString(),
      };
      const docRef = await addDoc(collection(db, "posts"), postPayload);

      // 2) approvals へ「未処理タスク」を作成
      const approvalPayload = {
        type: "new" as const, // "new" | "change" | "return"
        status: "pending" as const, // "pending" | "approved" | "rejected"
        postId: docRef.id,
        assigneeEmail: toEmail,
        assigneeName: toName,
        requestedBy: user?.email ?? "",
        requestedAt: serverTimestamp(),
        snapshot: {
          id: docRef.id,
          applicantdate,
          applicant,
          classification,
          periodfrom,
          periodto,
          where,
          materials: mediaDisplay,
          media: materials,
        },
        link: "https://kdsbring.netlify.app/",
      };
      await addDoc(collection(db, "approvals"), approvalPayload);

      // 3) 承認メール送信（EmailJS）
      const emailHtml = "https://kdsbring.netlify.app/";
      const templateParams = {
        to_name: toName,
        to_email: toEmail,
        from_email: user?.email ?? "",
        reply_to: user?.email ?? "",
        id: docRef.id,
        applicantdate,
        applicant,
        classification,
        periodfrom,
        periodto,
        where,
        materials: mediaDisplay, // 設備名
        media: materials, // 設備番号
        link: emailHtml,
        action: "登録",
      };
      const res = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      console.log("EmailJS send success:", res);

      setIsSubmitted(true);

      // ★ 入力クリアして閉じる（次回オープン時に前回選択が残らない）
      resetForm();
      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error("Submit failed:", err);
      setDialogMessage(`送信に失敗しました。\n詳細: ${err?.text ?? err?.message ?? JSON.stringify(err) ?? "不明なエラー"}`);
      setOpenDialog(true);
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    if (isSending) return;
    resetForm();
    onClose();
  };

  const handleOptionChange = (event: { target: { value: any } }) => {
    const value = event.target.value;
    setSelectedOption(value);
    setWhere(value);
    if (value === "その他") setOtherInput("");
  };

  const handleOtherInputChange = (event: { target: { value: SetStateAction<string> } }) => {
    const other = event.target.value as string;
    setOtherInput(other);
    setWhere(other);
  };

  return (
    <Dialog open={open} onClose={handleDialogClose} fullWidth maxWidth="sm">
      <DialogTitle>新規登録</DialogTitle>
      <DialogContent dividers>
        <Outer>
          <Paper elevation={0} sx={{ p: 1, width: "100%" }}>
            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{
                "& .MuiTextField-root": { my: 0.25 },
              }}
            >
              <Stack direction="column" spacing={0.5}>
                <TextField label="申請者" variant="standard" size="small" margin="dense" fullWidth InputLabelProps={{ shrink: true }} value={applicant} InputProps={{ readOnly: true }} />

                <TextField
                  label="申請日"
                  type="date"
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={applicantdate}
                  onChange={(e) => setApplicantdate(e.target.value)}
                />

                <TextField
                  label="持出・持込区分"
                  select
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={classification}
                  onChange={(e) => setClassification(e.target.value)}
                >
                  <MenuItem value="持出">持出</MenuItem>
                  <MenuItem value="持込">持込</MenuItem>
                </TextField>

                <TextField
                  label="持込・持出日 から"
                  type="date"
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={periodfrom}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPeriodfrom(v);
                    validateDateRange(v, periodto);
                  }}
                  error={!!dateError}
                  helperText={dateError ? dateError : undefined}
                  inputProps={{ max: periodto || undefined }}
                />

                <TextField
                  label="持込・持出日 まで"
                  type="date"
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={periodto}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPeriodto(v);
                    validateDateRange(periodfrom, v);
                  }}
                  error={!!dateError}
                  helperText={dateError ? dateError : undefined}
                  inputProps={{ min: periodfrom || undefined }}
                />

                <TextField
                  label="承認先（受信者）"
                  select
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                >
                  {approvers.map((a, idx) => (
                    <MenuItem key={idx} value={a.email}>
                      {a.name}（{a.email}）
                    </MenuItem>
                  ))}
                </TextField>

                <TextField label="持込・持出先" select variant="standard" size="small" margin="dense" fullWidth InputLabelProps={{ shrink: true }} value={selectedOption} onChange={handleOptionChange}>
                  {Where.map((item: string, index: number) => (
                    <MenuItem key={index} value={item}>
                      {item}
                    </MenuItem>
                  ))}
                </TextField>

                {selectedOption === "その他" && (
                  <TextField
                    label="持込・持出先（その他の内容）"
                    variant="standard"
                    size="small"
                    margin="dense"
                    fullWidth
                    value={otherInput}
                    onChange={handleOtherInputChange}
                    placeholder="例）○○顧客先、○○工場 など"
                  />
                )}

                <TextField
                  label="設備"
                  select
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={media}
                  onChange={(e) => {
                    const v = e.target.value as string;
                    setMedia(v);
                    if (v !== "その他") setMediaOther("");
                  }}
                >
                  <MenuItem value="PC">PC</MenuItem>
                  <MenuItem value="スマートフォン">スマートフォン</MenuItem>
                  <MenuItem value="USBメモリ">USBメモリ</MenuItem>
                  <MenuItem value="外付けHDD">外付けHDD</MenuItem>
                  <MenuItem value="その他">その他</MenuItem>
                </TextField>

                {media === "その他" && (
                  <TextField
                    label="設備（その他の内容）"
                    variant="standard"
                    size="small"
                    margin="dense"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={mediaOther}
                    onChange={(e) => setMediaOther(e.target.value)}
                    placeholder="例）タブレット端末、計測機器 など"
                  />
                )}

                <TextField
                  label="設備番号"
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                />

                <Box sx={{ display: "flex", gap: 1, pt: 0.5 }}>
                  <Button onClick={handleReset} variant="outlined" size="small" sx={{ flex: 1 }} disabled={isSending}>
                    キャンセル
                  </Button>
                  <Button variant="contained" type="submit" size="small" sx={{ flex: 1 }} disabled={!!dateError || !toEmail || isSending || (media === "その他" && !mediaOther.trim())}>
                    {isSending ? "送信中..." : "承認依頼"}
                  </Button>
                </Box>
              </Stack>
            </Box>
          </Paper>
        </Outer>

        {open && isSubmitted && (
          <Paper elevation={0} sx={{ mt: 1, p: 1 }}>
            <Typography variant="body2">承認依頼されました！</Typography>
          </Paper>
        )}

        <ComfirmDialog open={openDialog} onClose={handleCloseDialog} title="確認！" content={dialogMessage} actions={<Button onClick={handleCloseDialog}>閉じる</Button>} />
      </DialogContent>

      <DialogActions>
        <Button onClick={handleReset}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewPostDialog;

const Outer = styled(Box)`
  display: flex;
  justify-content: center;
  padding: 6px 0;
`;
