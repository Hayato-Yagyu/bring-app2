import React, { useEffect, useMemo, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField, MenuItem, Box } from "@mui/material";
import emailjs from "@emailjs/browser";
import { useUser } from "./UserContext";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

const EMAILJS_SERVICE_ID = "service_0sslyge";
const EMAILJS_TEMPLATE_ID = "template_81c28kt";

type Approver = { name: string; email: string };

type Props = {
  open: boolean; // 親(Edit)から制御
  onClose: () => void; // 親(Edit)から制御（承認者選択ダイアログを閉じる）
  onCloseAll?: () => void; // ★ 追加: 完了ダイアログの「閉じる」で親(Edit)も閉じたい時に呼ぶ
  rowId: string;
  rowData: any; // メール本文に埋め込むデータ（UI→DB 形で渡す）
};

const ReturnDialog: React.FC<Props> = ({ open, onClose, onCloseAll, rowId, rowData }) => {
  const { user } = useUser();

  const [completionOpen, setCompletionOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState("");

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoadingApprovers(true);
      setError(null);
      try {
        const q = query(collection(db, "approvers"), where("active", "==", true));
        const snap = await getDocs(q);
        const list: Approver[] = snap.docs
          .map((d) => {
            const data = d.data() as any;
            return { name: data?.name ?? "", email: data?.email ?? "" };
          })
          .filter((a) => a.email);

        setApprovers(list);
        const initial = (rowData?.notifyTo && list.find((a) => a.email === rowData.notifyTo)?.email) ?? list[0]?.email ?? "";
        setSelectedEmail(initial);
      } catch (e) {
        console.error("Failed to load approvers:", e);
        setApprovers([]);
        setSelectedEmail("");
        setError("承認者リストの取得に失敗しました。ネットワーク/権限をご確認ください。");
      } finally {
        setLoadingApprovers(false);
      }
    };
    load();
  }, [open, rowData?.notifyTo]);

  const selectedName = useMemo(() => approvers.find((a) => a.email === selectedEmail)?.name ?? "承認者各位", [approvers, selectedEmail]);

  const handleApproval = async () => {
    if (sending) return;
    setSending(true);
    setError(null);

    const toEmail = selectedEmail;
    if (!toEmail) {
      setError("承認先メールアドレスが選択されていません。");
      setSending(false);
      return;
    }

    const emailHtml = "https://kdsbring.netlify.app";

    const templateParams = {
      to_name: selectedName,
      to_email: toEmail,
      from_email: user?.email ?? rowData?.applicant ?? "",
      reply_to: user?.email ?? "",
      id: rowId,
      applicantdate: rowData?.applicantdate ?? "",
      applicant: rowData?.applicant ?? "",
      classification: rowData?.classification ?? "",
      periodfrom: rowData?.periodfrom ?? "",
      periodto: rowData?.periodto ?? "",
      where: rowData?.where ?? "",
      materials: rowData?.materials ?? "",
      media: rowData?.media ?? "",
      link: emailHtml,
      action: "承認依頼（返却申請）",
    };

    try {
      const res = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      console.log("EmailJS送信成功:", res);
      setCompletionOpen(true); // 完了ダイアログを開く
      onClose(); // 承認者選択ダイアログは閉じる
    } catch (e: any) {
      console.error("EmailJS送信失敗:", e);
      setError(e?.text ?? e?.message ?? "送信に失敗しました。");
    } finally {
      setSending(false);
    }
  };

  // 完了ダイアログの「閉じる」→ 親(Edit)も閉じる
  const handleCompletionClose = () => {
    setCompletionOpen(false);
    onCloseAll?.(); // ★ 親から渡されていれば呼ぶ
  };

  return (
    <>
      {/* 承認者選択ダイアログ（親制御） */}
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
        <DialogTitle>確認</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>ID「{rowId}」を返却申請しますか？</DialogContentText>

          <Box sx={{ mt: 0.5 }}>
            <TextField
              label="承認者"
              select
              fullWidth
              variant="standard"
              size="small"
              margin="dense"
              value={selectedEmail}
              onChange={(e) => setSelectedEmail(e.target.value)}
              disabled={loadingApprovers || approvers.length === 0}
              helperText={loadingApprovers ? "承認者を読込中..." : approvers.length === 0 ? "有効な承認者が見つかりません" : " "}
            >
              {approvers.map((a, idx) => (
                <MenuItem key={idx} value={a.email}>
                  {a.name}（{a.email}）
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {error && (
            <DialogContentText color="error" sx={{ mt: 1 }}>
              エラー: {error}
            </DialogContentText>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} variant="outlined" color="primary" sx={{ width: 150 }}>
            キャンセル
          </Button>
          <Button onClick={handleApproval} variant="contained" color="primary" sx={{ width: 150 }} disabled={sending || !selectedEmail}>
            {sending ? "送信中..." : "申請"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 完了ダイアログ（内部制御） */}
      <Dialog open={completionOpen} onClose={handleCompletionClose}>
        <DialogTitle>完了</DialogTitle>
        <DialogContent>
          <DialogContentText>返却申請が完了しました。</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCompletionClose} variant="outlined" color="primary" sx={{ width: 150 }}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ReturnDialog;
