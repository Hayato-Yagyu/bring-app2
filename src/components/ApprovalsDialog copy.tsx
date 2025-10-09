// src/components/ApprovalsDialog.tsx
import React, { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemText, Stack, Typography, TextField, IconButton, Box } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelIcon from "@mui/icons-material/Cancel";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
  getDocs,
  getDoc, // 返却承認の前提チェックに使用
} from "firebase/firestore";
import { useUser } from "./UserContext";
import emailjs from "@emailjs/browser";

const ADMIN_EMAIL = "hayato.yagyu@digitalsoft.co.jp";

// ★ EmailJS（あなたの環境に合わせて差し替え）
const EMAILJS_SERVICE_ID = "service_0sslyge";
const TEMPLATE_APPROVED_ID = "template_h2bmeqd"; // ← 承認通知テンプレID
const TEMPLATE_REJECTED_ID = "template_h2bmeqd"; // ← 却下通知テンプレID（必要なら別テンプレに）

type ApprovalRow = {
  id: string;
  postId: string;
  type: "new" | "change" | "return";
  assigneeEmail: string;
  assigneeName?: string;
  requestedBy?: string; // 申請者メール
  requestedByName?: string; // 申請者表示名
  status: "pending" | "approved" | "rejected";
  snapshot: any;
  requestedAt?: any;
  updatedAt?: any;
};

type Props = { open: boolean; onClose: () => void };

const ApprovalsDialog: React.FC<Props> = ({ open, onClose }) => {
  const { user } = useUser();
  const email = user?.email ?? "";
  const approverName = user?.displayName ?? user?.email ?? "";
  const isAdmin = email === ADMIN_EMAIL;

  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !email) return;

    const base = collection(db, "approvals");
    const q = isAdmin ? query(base, where("status", "==", "pending")) : query(base, where("status", "==", "pending"), where("assigneeEmail", "==", email));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ApprovalRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setRows(list);
        setErrorText(null);
      },
      async (err) => {
        console.error("approvals onSnapshot error:", err);
        setErrorText("承認リストの取得に失敗しました。権限/インデックスをご確認ください。");
        try {
          const q2 = query(base, where("status", "==", "pending"));
          const snap2 = await getDocs(q2);
          let list: ApprovalRow[] = snap2.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          if (!isAdmin) list = list.filter((r) => r.assigneeEmail === email);
          setRows(list);
        } catch (e) {
          console.error("fallback fetch failed:", e);
        }
      }
    );
    return () => unsub();
  }, [open, email, isAdmin]);

  const todayStr = () => new Date().toISOString().slice(0, 10);
  const typeLabel = (t: ApprovalRow["type"]) => (t === "change" ? "変更申請" : t === "return" ? "返却申請" : "新規申請");

  // ★ 新規承認 → posts に permitdate/permitstamp を付与（他フィールドは触らない）
  const approveNew = async (r: ApprovalRow) => {
    const p = {
      permitdate: todayStr(),
      permitstamp: approverName,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(doc(db, "posts", r.postId), p);
  };

  // 変更承認 → snapshot を反映し、permitdate/permitstamp も設定
  const approveChange = async (r: ApprovalRow) => {
    const p = {
      applicantdate: r.snapshot?.applicantdate ?? "",
      applicant: r.snapshot?.applicant ?? "",
      classification: r.snapshot?.classification ?? "",
      periodfrom: r.snapshot?.periodfrom ?? "",
      periodto: r.snapshot?.periodto ?? "",
      where: r.snapshot?.where ?? "",
      materials: r.snapshot?.materials ?? "",
      media: r.snapshot?.media ?? "",
      // 承認印を付与
      permitdate: todayStr(),
      permitstamp: approverName,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(doc(db, "posts", r.postId), p);
  };

  // approvals ドキュメントの状態更新
  const markApproval = async (r: ApprovalRow, status: "approved" | "rejected", extra?: Record<string, any>) => {
    await updateDoc(doc(db, "approvals", r.id), {
      status,
      updatedAt: serverTimestamp(),
      processedByEmail: email,
      processedByName: approverName,
      processedAt: serverTimestamp(),
      ...(extra ?? {}),
    });
  };

  // ★ 申請者へ結果通知メール送信（承認／却下）
  const sendResultMail = async (r: ApprovalRow, action: "approved" | "rejected", rejectNote?: string) => {
    const toEmail = r.requestedBy ?? ""; // 申請者メール
    if (!toEmail) return; // 送信先がなければスキップ

    const toName = r.requestedByName || r.requestedBy || "申請者さま";
    const emailHtml = "https://kdsbring.netlify.app/"; // 必要なら変更

    const params = {
      to_name: toName,
      to_email: toEmail,
      id: r.postId,
      request_type: typeLabel(r.type),
      action: action === "approved" ? "承認しました" : "却下しました",
      reject_note: rejectNote ?? "",
      materials: r.snapshot?.materials ?? "",
      media: r.snapshot?.media ?? "",
      where: r.snapshot?.where ?? "",
      periodfrom: r.snapshot?.periodfrom ?? "",
      periodto: r.snapshot?.periodto ?? "",
      applicant: r.snapshot?.applicant ?? "",
      applicantdate: r.snapshot?.applicantdate ?? "",
      classification: r.snapshot?.classification ?? "",
      link: emailHtml,
    };

    const templateId = action === "approved" ? TEMPLATE_APPROVED_ID : TEMPLATE_REJECTED_ID;
    await emailjs.send(EMAILJS_SERVICE_ID, templateId, params);
  };

  // ★ 返却承認 → permitdate/permitstamp が必須。無ければ自動却下（posts は更新しない）
  // 戻り値: true=承認処理継続OK / false=承認せず（内部で自動却下済み）
  const approveReturn = async (r: ApprovalRow): Promise<boolean> => {
    const postRef = doc(db, "posts", r.postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      const note = "返却承認できません。対象の申請（posts）が存在しません。";
      await markApproval(r, "rejected", { rejectNote: note, autoRejected: true });
      await sendResultMail(r, "rejected", note);
      return false;
    }

    const post = postSnap.data() as any;
    const permitdate = post?.permitdate ?? "";
    const permitstamp = post?.permitstamp ?? "";

    if (!permitdate || !permitstamp) {
      const note = "返却承認できません。許可日/許可印（permitdate/permitstamp）が未登録です。";
      await markApproval(r, "rejected", { rejectNote: note, autoRejected: true });
      await sendResultMail(r, "rejected", note);
      return false; // 承認処理は行わない
    }

    // 前提クリア → 返却確認の印を押す
    const p = {
      confirmationdate: todayStr(),
      confirmationstamp: approverName,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(postRef, p);
    return true; // 承認へ進める
  };

  // ★ 一覧側へ即時反映を促すためのアプリ内イベント（任意）
  const notifyLists = (postId: string, approvalId: string) => {
    // posts を表示している一覧へ
    window.dispatchEvent(new CustomEvent("posts-updated", { detail: { postId } }));
    // approvals を表示している一覧へ
    window.dispatchEvent(new CustomEvent("approvals-updated", { detail: { approvalId } }));
  };

  const handleApprove = async (r: ApprovalRow) => {
    if (busyId) return;
    setBusyId(r.id);
    try {
      if (r.type === "new") {
        await approveNew(r);
        await markApproval(r, "approved");
        await sendResultMail(r, "approved");
        notifyLists(r.postId, r.id);
      } else if (r.type === "change") {
        await approveChange(r);
        await markApproval(r, "approved");
        await sendResultMail(r, "approved");
        notifyLists(r.postId, r.id);
      } else if (r.type === "return") {
        const ok = await approveReturn(r);
        if (ok) {
          await markApproval(r, "approved");
          await sendResultMail(r, "approved");
          notifyLists(r.postId, r.id);
        }
        // ok=false の場合は approveReturn 内で自動却下済み（そこでも通知は不要だが、必要なら下行を解除）
        // else notifyLists(r.postId, r.id);
      }
    } catch (e) {
      console.error("承認処理/通知に失敗:", e);
      setErrorText("承認処理または通知メール送信に失敗しました。コンソールのエラーをご確認ください。");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (r: ApprovalRow) => {
    if (busyId) return;
    setBusyId(r.id);
    try {
      const note = notes[r.id] ?? "";
      await markApproval(r, "rejected", { rejectNote: note });
      await sendResultMail(r, "rejected", note);
      setNotes((prev) => ({ ...prev, [r.id]: "" }));
      notifyLists(r.postId, r.id);
    } catch (e) {
      console.error("却下処理/通知に失敗:", e);
      setErrorText("却下処理または通知メール送信に失敗しました。コンソールのエラーをご確認ください。");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>承認待ちの依頼</DialogTitle>
      <DialogContent dividers>
        {errorText && (
          <Typography variant="body2" color="error" sx={{ mb: 1 }}>
            {errorText}
          </Typography>
        )}

        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            承認待ちはありません。
          </Typography>
        ) : (
          <List dense>
            {rows.map((r) => (
              <ListItem key={r.id} divider alignItems="flex-start">
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Typography variant="subtitle1" sx={{ minWidth: 84 }}>
                        {typeLabel(r.type)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ID: {r.postId} ／ 依頼者: {r.requestedByName || r.requestedBy}
                      </Typography>
                    </Stack>
                  }
                  secondary={
                    <Stack spacing={0.5} sx={{ mt: 1 }}>
                      {r.type !== "return" ? (
                        <>
                          <Typography variant="body2">設備: {r.snapshot?.materials || "-"}</Typography>
                          <Typography variant="body2">設備番号: {r.snapshot?.media || "-"}</Typography>
                          <Typography variant="body2">持込・持出先: {r.snapshot?.where || "-"}</Typography>
                          <Typography variant="body2">
                            期間: {r.snapshot?.periodfrom || "-"} 〜 {r.snapshot?.periodto || "-"}
                          </Typography>
                        </>
                      ) : (
                        <>
                          <Typography variant="body2">
                            返却対象: {r.snapshot?.materials || "-"}（設備番号: {r.snapshot?.media || "-"}）
                          </Typography>
                          <Typography variant="body2">申請者: {r.snapshot?.applicant || "-"}</Typography>
                        </>
                      )}
                      <TextField
                        label="却下メモ（任意）"
                        size="small"
                        variant="standard"
                        value={notes[r.id] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        sx={{ mt: 1, maxWidth: 520 }}
                      />
                    </Stack>
                  }
                />
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: 1 }}>
                  <IconButton color="success" onClick={() => handleApprove(r)} disabled={!!busyId} title="承認">
                    <CheckCircleOutlineIcon />
                  </IconButton>
                  <IconButton color="error" onClick={() => handleReject(r)} disabled={!!busyId} title="却下">
                    <CancelIcon />
                  </IconButton>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApprovalsDialog;
