// src/components/ApprovalRequestDialog.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField, MenuItem, Box } from "@mui/material";
import emailjs from "@emailjs/browser";
import { useUser } from "./UserContext";

// Firestore
import { collection, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

type Approver = { name: string; email: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onCloseAll?: () => void; // 完了ダイアログの「閉じる」で親も閉じる
  mode: "change" | "return"; // 変更申請 / 返却申請
  serviceId: string;
  templateId: string;
  rowId: string; // 対象postのID
  rowData: any; // UI→DB正規化済み
  buildTemplateParams: (args: { rowId: string; rowData: any; approver: { name: string; email: string }; user?: any; mode: "change" | "return" }) => Record<string, any>;
  title?: string;
  confirmLabel?: string;
  description?: string;
};

const ApprovalRequestDialog: React.FC<Props> = ({ open, onClose, onCloseAll, mode, serviceId, templateId, rowId, rowData, buildTemplateParams, title, confirmLabel, description }) => {
  const { user } = useUser();

  const [completionOpen, setCompletionOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // approvers（active==true）
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState("");

  const defaultTitle = mode === "change" ? "変更申請の確認" : "返却申請の確認";
  const defaultDesc = description ?? `ID「${rowId}」を${mode === "change" ? "変更申請" : "返却申請"}しますか？`;
  const defaultConfirm = confirmLabel ?? "申請";

  // 承認者読込
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoadingApprovers(true);
      setError(null);
      try {
        const qy = query(collection(db, "approvers"), where("active", "==", true));
        const snap = await getDocs(qy);
        const list: Approver[] = snap.docs
          .map((d) => {
            const data = d.data() as any;
            return { name: data?.name ?? "", email: data?.email ?? "" };
          })
          .filter((a) => a.email);

        setApprovers(list);

        // 既定選択: 1) 行に保存済み notifyTo 2) 先頭 3) 空
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

  const selectedApprover = useMemo(
    () =>
      approvers.find((a) => a.email === selectedEmail) ?? {
        name: "承認者各位",
        email: "",
      },
    [approvers, selectedEmail]
  );

  const handleClose = () => onClose();
  const handleCompletionClose = () => {
    setCompletionOpen(false);
    onCloseAll?.();
  };

  /** approvals へ pending を作成（★バッジと同じスキーマに統一） */
  const createApprovalDoc = async (emailParams: Record<string, any>) => {
    const payload = {
      type: mode, // "change" | "return"
      status: "pending" as const, // pending | approved | rejected
      postId: rowId,
      assigneeEmail: selectedApprover.email, // ★バッジが参照
      assigneeName: selectedApprover.name, // ★任意
      requestedBy: user?.email ?? rowData?.applicant ?? "",
      requestedByName: user?.displayName ?? user?.email ?? rowData?.applicant ?? "",
      requestedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      snapshot: {
        id: rowId,
        applicantdate: rowData?.applicantdate ?? "",
        applicant: rowData?.applicant ?? "",
        classification: rowData?.classification ?? "",
        periodfrom: rowData?.periodfrom ?? "",
        periodto: rowData?.periodto ?? "",
        where: rowData?.where ?? "",
        materials: rowData?.materials ?? "",
        media: rowData?.media ?? "",
      },
      link: "https://kdsbring.netlify.app/",
      emailParams, // 監査用（任意）
    };
    await addDoc(collection(db, "approvals"), payload);
  };

  const handleApproval = async () => {
    if (sending) return;
    setSending(true);
    setError(null);

    if (!selectedEmail) {
      setError("承認先メールアドレスが選択されていません。");
      setSending(false);
      return;
    }

    try {
      // メールに渡すパラメータ生成
      const params = buildTemplateParams({
        rowId,
        rowData,
        approver: selectedApprover,
        user,
        mode,
      });

      // 1) EmailJS 送信
      await emailjs.send(serviceId, templateId, params);

      // 2) approvals に pending 保存（★ここがバッジと連動）
      await createApprovalDoc(params);

      // 完了ダイアログへ
      setCompletionOpen(true);
      onClose();
    } catch (e: any) {
      console.error("EmailJS送信 or approvals保存 失敗:", e);
      setError(e?.text ?? e?.message ?? "送信に失敗しました。");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
        <DialogTitle>{title ?? defaultTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>{defaultDesc}</DialogContentText>

          {/* 承認者選択 */}
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
          <Button onClick={handleClose} variant="outlined" color="primary" sx={{ width: 150 }}>
            キャンセル
          </Button>
          <Button onClick={handleApproval} variant="contained" color="primary" sx={{ width: 150 }} disabled={sending || !selectedEmail}>
            {sending ? "送信中..." : defaultConfirm}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 完了ダイアログ */}
      <Dialog open={completionOpen} onClose={handleCompletionClose}>
        <DialogTitle>完了</DialogTitle>
        <DialogContent>
          <DialogContentText>{mode === "change" ? "変更申請" : "返却申請"}が完了しました。</DialogContentText>
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

export default ApprovalRequestDialog;
