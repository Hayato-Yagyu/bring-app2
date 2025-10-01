import { SetStateAction, useEffect, useState } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Button, MenuItem, Stack, Paper } from "@mui/material";
import "../App.css";
import { Menu } from "../components/Menu";
import { Typography, TextField, Box } from "@mui/material";
import styled from "@emotion/styled";
import emailjs from "@emailjs/browser";
import ComfirmDialog from "./ComfirmDialog";
import Where from "./Where";
// import Applicant from "./Applicant"; // ← 不要なので削除
import { useNavigate } from "react-router-dom";
import { useUser } from "../components/UserContext";

type Approver = { name: string; email: string };

const EMAILJS_SERVICE_ID = "service_0sslyge";
const EMAILJS_TEMPLATE_ID = "template_81c28kt";

const NewPost = () => {
  const [applicantdate, setApplicantdate] = useState("");
  const [applicant, setApplicant] = useState(""); // ← 自動セットして編集不可にする
  const [classification, setClassification] = useState("");
  const [periodfrom, setPeriodfrom] = useState("");
  const [periodto, setPeriodto] = useState("");
  const [where, setWhere] = useState("");
  const [materials, setMaterials] = useState("");
  const [media, setMedia] = useState("");
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

  const [isSending, setIsSending] = useState(false);
  const [toName, setToName] = useState("");

  const { user } = useUser();
  const navigate = useNavigate();

  const handleCloseDialog = () => setOpenDialog(false);

  // ▼ 申請者をログインユーザーから自動セット
  useEffect(() => {
    const name = (user as any)?.displayName?.trim?.() || (user as any)?.email || "";
    setApplicant(name);
  }, [user]);

  // 承認先選択時に氏名も同期
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

  // 承認者マスタ取得
  useEffect(() => {
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
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSending) return;

    // 未入力チェック（申請者は自動セットなのでそのままチェック継続でOK）
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

    setIsSending(true);
    try {
      const docRef = await addDoc(collection(db, "posts"), {
        applicantdate,
        applicant,
        classification,
        periodfrom,
        periodto,
        where,
        materials,
        media,
        permitdate,
        permitstamp,
        confirmationdate,
        confirmationstamp,
        notifyTo: toEmail,
        requestedBy: user?.email ?? "",
        requestedAt: new Date().toISOString(),
      });

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
        materials,
        media,
        link: emailHtml,
      };

      const res = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      console.log("EmailJS send success:", res);

      setIsSubmitted(true);
      // リセット
      setApplicantdate("");
      // applicant はログインユーザーなのでクリアしない（次回も自動セットされるが、視覚的に残したい場合は下行コメントアウトのまま）
      // setApplicant("");
      setClassification("");
      setPeriodfrom("");
      setPeriodto("");
      setWhere("");
      setMaterials("");
      setMedia("");
      setPermitdate("");
      setPermitstamp("");
      setConfirmationdate("");
      setConfirmationstamp("");
      setDateError(null);
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
    setApplicantdate("");
    // applicant はログインユーザーなので保持
    setClassification("");
    setPeriodfrom("");
    setPeriodto("");
    setWhere("");
    setMaterials("");
    setMedia("");
    setPermitdate("");
    setPermitstamp("");
    setConfirmationdate("");
    setConfirmationstamp("");
    setIsSubmitted(false);
    setSelectedOption("");
    setDateError(null);
    navigate("/BringList");
  };

  const [selectedOption, setSelectedOption] = useState("");
  const [otherInput, setOtherInput] = useState("");

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
    <>
      <Menu />

      {/* 見出し（必要なら小さく） */}
      <Typography variant="h4" align="center" sx={{ borderBottom: "1px solid #ddd", py: 0.5 }}>
        媒体等持込持出記録
      </Typography>

      <Outer>
        <Paper elevation={0} sx={{ p: 1, maxWidth: 420, width: "100%" }}>
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              "& .MuiTextField-root": {
                my: 0.25,
              },
            }}
          >
            <Stack direction="column" spacing={0.5}>
              {/* ▼ 申請者：読み取り専用（ログインユーザー） */}
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

              {selectedOption === "その他" && <TextField label="Other" variant="standard" size="small" margin="dense" fullWidth value={otherInput} onChange={handleOtherInputChange} />}

              <TextField
                label="データまたは資料名"
                variant="standard"
                size="small"
                margin="dense"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
              />

              <TextField
                label="媒体・ＰＣ 設備番号"
                select
                variant="standard"
                size="small"
                margin="dense"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={media}
                onChange={(e) => setMedia(e.target.value)}
              >
                <MenuItem value="PC">PC</MenuItem>
                <MenuItem value="スマートフォン">スマートフォン</MenuItem>
                <MenuItem value="USBメモリ">USBメモリ</MenuItem>
                <MenuItem value="外付けHDD">外付けHDD</MenuItem>
                <MenuItem value="その他">その他</MenuItem>
              </TextField>

              {/* ボタン行：余白最小・横並び */}
              <Box sx={{ display: "flex", gap: 1, pt: 0.5 }}>
                <Button onClick={handleReset} variant="outlined" size="small" sx={{ flex: 1 }} disabled={isSending}>
                  キャンセル
                </Button>
                <Button variant="contained" type="submit" size="small" sx={{ flex: 1 }} disabled={!!dateError || !toEmail || isSending}>
                  {isSending ? "送信中..." : "承認依頼"}
                </Button>
              </Box>
            </Stack>
          </Box>
        </Paper>
      </Outer>

      <ComfirmDialog open={openDialog} onClose={handleCloseDialog} title="確認！" content={dialogMessage} actions={<Button onClick={handleCloseDialog}>閉じる</Button>} />

      {isSubmitted && (
        <Paper elevation={0} sx={{ mt: 1, p: 1, maxWidth: 420, mx: "auto" }}>
          <Typography variant="body2">承認依頼されました！</Typography>
          <Box sx={{ textAlign: "right", mt: 0.5 }}>
            <Button onClick={handleReset} variant="outlined" size="small" sx={{ minWidth: 120 }}>
              閉じる
            </Button>
          </Box>
        </Paper>
      )}
    </>
  );
};

export default NewPost;

const Outer = styled(Box)`
  display: flex;
  justify-content: center;
  padding: 6px 8px;
`;
