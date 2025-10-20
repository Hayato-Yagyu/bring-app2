// src/components/NewPostDialog.tsx
import React, { SetStateAction, useEffect, useMemo, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography, TextField, MenuItem, Box, Paper, Autocomplete, CircularProgress } from "@mui/material";
import styled from "@emotion/styled";
import { collection, addDoc, getDocs, getDoc, doc, serverTimestamp, query, where } from "firebase/firestore";
import { db } from "../firebase";
//import emailjs from "@emailjs/browser";
import emailjs from "../lib/emailjs";
import ComfirmDialog from "./ComfirmDialog";
import Where from "./Where";
import { useUser } from "../components/UserContext";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

type Approver = { name: string; email: string };

// 資産カテゴリ（asset_categories）
type AssetCategory = {
  id: string;
  code?: string;
  label: string; // 例：パソコン
  displayOrder?: number; // 表示順
  isTarget?: boolean;
};

// equipments（設備台帳）: 設備番号をここから拾う
type EquipmentLite = {
  id: string;
  assetNo: string; // 設備番号
  deviceName?: string; // 表示補助
  owner?: string; // 所有者表示用
  seqOrder?: number; // 並び順
  category?: string; // カテゴリ名（asset_categories.label と一致）
};

const EMAILJS_SERVICE_ID = "service_0sslyge";
const EMAILJS_TEMPLATE_ID = "template_81c28kt";

const NewPostDialog: React.FC<Props> = ({ open, onClose, onSaved }) => {
  const [applicantdate, setApplicantdate] = useState("");
  const [applicant, setApplicant] = useState(""); // 表示・保存・メール送信用の氏名
  const [classification, setClassification] = useState("");
  const [periodfrom, setPeriodfrom] = useState("");
  const [periodto, setPeriodto] = useState("");
  const [whereValue, setWhereValue] = useState("");

  // 既存仕様：materials=設備名（カテゴリ名）、media=設備番号（assetNo）
  const [materials, setMaterials] = useState(""); // 設備番号（assetNo）
  const [media, setMedia] = useState(""); // 設備（カテゴリ名／label）
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
  const [toName, setToName] = useState<string>("");

  const [isSending, setIsSending] = useState(false);

  const { user } = useUser();
  const handleCloseDialog = () => setOpenDialog(false);

  // カテゴリ＆設備番号候補
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [assetNoOptions, setAssetNoOptions] = useState<EquipmentLite[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingAssetNos, setLoadingAssetNos] = useState(false);

  // 持込・持出先 UI
  const [selectedOption, setSelectedOption] = useState("");
  const [otherInput, setOtherInput] = useState("");

  // 申請者名の解決：users コレクションから displayName を取得（フォールバックあり）
  useEffect(() => {
    const fallbackName = (user as any)?.displayName?.trim?.() || (user as any)?.email || "";

    const pickName = (data: any | undefined) => {
      if (!data) return "";
      const tryNames = [data.displayName, data.name, data.fullName];
      const hit = tryNames.find((v) => typeof v === "string" && v.trim());
      return (hit ?? "").toString().trim();
    };

    const loadApplicantName = async () => {
      if (!user?.uid) {
        setApplicant(fallbackName);
        return;
      }
      let resolvedName = "";
      try {
        // 1) users/{uid}
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          resolvedName = pickName(snap.exists() ? snap.data() : undefined);
        } catch (e) {
          console.warn("users/{uid} read failed:", e);
        }

        // 2) id == uid
        if (!resolvedName) {
          try {
            const qs = await getDocs(query(collection(db, "users"), where("id", "==", user.uid)));
            if (!qs.empty) resolvedName = pickName(qs.docs[0].data());
          } catch (e) {
            console.warn("users where id==uid read failed:", e);
          }
        }

        // 3) email == currentUser.email
        if (!resolvedName && user?.email) {
          try {
            const qs = await getDocs(query(collection(db, "users"), where("email", "==", user.email)));
            if (!qs.empty) resolvedName = pickName(qs.docs[0].data());
          } catch (e) {
            console.warn("users where email==current email read failed:", e);
          }
        }
      } catch (e) {
        console.error("Failed to resolve applicant displayName:", e);
      } finally {
        setApplicant(resolvedName || fallbackName);
      }
    };

    loadApplicantName();
  }, [user]);

  // 承認者名の追従
  useEffect(() => {
    const a = approvers.find((x) => x.email === toEmail);
    setToName(a?.name ?? "");
  }, [toEmail, approvers]);

  // 日付検証
  const validateDateRange = (from: string, to: string) => {
    if (!from || !to) {
      setDateError(null);
      return true;
    }
    const ok = new Date(from).getTime() <= new Date(to).getTime();
    setDateError(ok ? null : "「持込・持出日 から」より「まで」が過去日になっています。");
    return ok;
  };

  // 初期ロード：カテゴリ(asset_categories) と 承認者
  useEffect(() => {
    if (!open) return;
    const loadInitial = async () => {
      try {
        setLoadingCategories(true);
        // isTarget==true → displayOrder でクライアントソート
        const qsCats = await getDocs(query(collection(db, "asset_categories"), where("isTarget", "==", true)));
        const cats: AssetCategory[] = qsCats.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            code: data?.code ?? undefined,
            label: String(data?.label ?? ""),
            displayOrder: data?.displayOrder,
            isTarget: !!data?.isTarget,
          };
        });
        cats.sort((a, b) => (a.displayOrder ?? 9e9) - (b.displayOrder ?? 9e9));
        setCategories(cats);
        if (!media && cats.length > 0) setMedia(cats[0].label);
      } catch (e) {
        console.error("Failed to load asset_categories:", e);
        setDialogMessage("設備カテゴリ（asset_categories）の取得に失敗しました。");
        setOpenDialog(true);
      } finally {
        setLoadingCategories(false);
      }

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
        setDialogMessage("承認者マスタの取得に失敗しました。");
        setOpenDialog(true);
      }
    };
    loadInitial();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // 設備カテゴリ（media/label）変更時：equipments から assetNo を取得
  useEffect(() => {
    if (!open) return;
    if (!media) {
      setAssetNoOptions([]);
      setMaterials("");
      return;
    }
    const fetchAssetNos = async () => {
      setLoadingAssetNos(true);
      try {
        const snap = await getDocs(query(collection(db, "equipments"), where("category", "==", media)));
        const rows: EquipmentLite[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            assetNo: String(data?.assetNo ?? ""),
            deviceName: data?.deviceName ?? "",
            owner: data?.owner ?? "",
            seqOrder: data?.seqOrder,
            category: data?.category ?? "",
          };
        });
        rows.sort((a, b) => (a.seqOrder ?? 9e9) - (b.seqOrder ?? 9e9));
        setAssetNoOptions(rows);
        setMaterials(""); // カテゴリを変えたら設備番号はクリア
      } catch (e) {
        console.error("Failed to load equipments by category:", e);
        setDialogMessage("equipments の取得に失敗しました。");
        setOpenDialog(true);
      } finally {
        setLoadingAssetNos(false);
      }
    };
    fetchAssetNos();
  }, [open, media]);

  // ダイアログ再オープンで送信済みフラグを戻す
  useEffect(() => {
    if (!open) setIsSubmitted(false);
  }, [open]);

  // フォーム一括リセット（applicant/toEmail は残す）
  const resetForm = () => {
    setApplicantdate("");
    setClassification("");
    setPeriodfrom("");
    setPeriodto("");
    setWhereValue("");
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
    setAssetNoOptions([]);
  };

  // Dialog onClose ラップ
  const handleDialogClose = (_event?: object, _reason?: string) => {
    if (!isSending) resetForm();
    onClose?.();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSending) return;

    if (
      !applicantdate.trim() ||
      !applicant.trim() ||
      !classification.trim() ||
      !periodfrom.trim() ||
      !periodto.trim() ||
      !whereValue.trim() ||
      !media.trim() || // 設備（カテゴリ名）
      !materials.trim() // 設備番号（assetNo）
    ) {
      setDialogMessage("入力されていないフィールドがあります。");
      setOpenDialog(true);
      return;
    }

    if (!validateDateRange(periodfrom, periodto)) {
      setDialogMessage("「持込・持出日」の範囲が不正です（開始日 ≤ 終了日）。");
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
      // 保存用に設備名（カテゴリ）を確定
      const mediaDisplay = media === "その他" ? mediaOther.trim() : media;

      // 送信者（依頼者）情報
      const requestedBy = user?.email ?? "";
      const requestedByName = applicant; // ★氏名を保持

      // 1) posts へ登録（既存仕様：materials=設備名, media=設備番号）
      const postPayload = {
        applicantdate,
        applicant, // users 由来の displayName
        applicantId: user?.uid ?? "", // 参考：紐付け用
        classification,
        periodfrom,
        periodto,
        where: whereValue,
        materials: mediaDisplay, // 設備名（カテゴリlabel）
        media: materials, // 設備番号（assetNo）
        mediaRaw: media, // 選択カテゴリlabel（その他含む）
        permitdate,
        permitstamp,
        confirmationdate,
        confirmationstamp,
        notifyTo: toEmail,
        requestedBy, // メール
        requestedByName, // ★追加
        requestedAt: new Date().toISOString(),
      } as const;
      const docRef = await addDoc(collection(db, "posts"), postPayload);

      // 2) approvals へ未処理タスク
      const approvalPayload = {
        type: "new" as const,
        status: "pending" as const,
        postId: docRef.id,
        assigneeEmail: toEmail,
        assigneeName: toName,
        requestedBy, // メール
        requestedByName, // ★追加
        requestedAt: serverTimestamp(),
        snapshot: {
          id: docRef.id,
          applicantdate,
          applicant,
          classification,
          periodfrom,
          periodto,
          where: whereValue,
          materials: mediaDisplay,
          media: materials,
          requestedByName, // （必要なら）スナップショットにも保持
        },
        link: "https://kdsbring.netlify.app/",
      } as const;
      await addDoc(collection(db, "approvals"), approvalPayload);

      // 3) 承認メール（EmailJS）
      const emailHtml = "https://kdsbring.netlify.app/";
      const templateParams = {
        to_name: toName,
        to_email: toEmail,
        from_email: requestedBy,
        from_name: requestedByName, // ★テンプレで送り主名を使う場合
        reply_to: requestedBy,
        id: docRef.id,
        applicantdate,
        applicant,
        classification,
        periodfrom,
        periodto,
        where: whereValue,
        materials: mediaDisplay,
        media: materials,
        link: emailHtml,
        action: "承認依頼（登録申請）",
      } as const;
      const res = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      console.log("EmailJS send success:", res);

      setIsSubmitted(true);
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

  // 持込・持出先ハンドラ
  const handleOptionChange = (event: { target: { value: any } }) => {
    const value = event.target.value;
    setSelectedOption(value);
    setWhereValue(value);
    if (value === "その他") setOtherInput("");
  };
  const handleOtherInputChange = (event: { target: { value: SetStateAction<string> } }) => {
    const other = event.target.value as string;
    setOtherInput(other);
    setWhereValue(other);
  };

  // 選択中の設備番号 option
  const selectedAssetOption = useMemo(() => (materials ? assetNoOptions.find((x) => x.assetNo === materials) || null : null), [assetNoOptions, materials]);

  // 表示用：assetNo + deviceName + owner
  const assetNoDisplay = (e: EquipmentLite) => {
    const parts: string[] = [];
    if (e.deviceName) parts.push(e.deviceName);
    if (e.owner) parts.push(e.owner);
    return parts.length ? `${e.assetNo}（${parts.join(" ／ ")}）` : e.assetNo;
  };

  return (
    <Dialog open={open} onClose={handleDialogClose} fullWidth maxWidth="sm">
      <DialogTitle>新規登録</DialogTitle>
      <DialogContent dividers>
        <Outer>
          <Paper elevation={0} sx={{ p: 1, width: "100%" }}>
            <Box component="form" onSubmit={handleSubmit} sx={{ "& .MuiTextField-root": { my: 0.25 } }}>
              <Stack direction="column" spacing={0.5}>
                <TextField label="申請者" variant="standard" size="small" margin="dense" fullWidth InputLabelProps={{ shrink: true }} value={applicant} InputProps={{ readOnly: true }} />

                <TextField label="申請日" type="date" variant="standard" size="small" margin="dense" fullWidth InputLabelProps={{ shrink: true }} value={applicantdate} onChange={(e) => setApplicantdate(e.target.value)} />

                <TextField label="持出・持込区分" select variant="standard" size="small" margin="dense" fullWidth InputLabelProps={{ shrink: true }} value={classification} onChange={(e) => setClassification(e.target.value)}>
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

                <TextField label="承認先（受信者）" select variant="standard" size="small" margin="dense" fullWidth InputLabelProps={{ shrink: true }} value={toEmail} onChange={(e) => setToEmail(e.target.value)}>
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

                {selectedOption === "その他" && <TextField label="持込・持出先（その他の内容）" variant="standard" size="small" margin="dense" fullWidth value={otherInput} onChange={handleOtherInputChange} placeholder="例）○○顧客先、○○工場 など" />}

                {/* 設備（カテゴリ） */}
                <Autocomplete
                  value={media || null}
                  onChange={(_, v) => {
                    const name = (v as string) || "";
                    setMedia(name);
                    if (name !== "その他") setMediaOther("");
                  }}
                  options={categories.map((c) => c.label)}
                  loading={loadingCategories}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="設備"
                      variant="standard"
                      size="small"
                      margin="dense"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingCategories ? <CircularProgress size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />

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

                {/* 設備番号 */}
                <Autocomplete
                  value={selectedAssetOption}
                  onChange={(_, v) => {
                    const selectedNo = (v as EquipmentLite | null)?.assetNo ?? "";
                    setMaterials(selectedNo);
                  }}
                  options={assetNoOptions}
                  getOptionLabel={(o) => (o ? assetNoDisplay(o) : "")}
                  isOptionEqualToValue={(a, b) => a?.assetNo === (b as any)?.assetNo}
                  loading={loadingAssetNos}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="設備番号"
                      variant="standard"
                      size="small"
                      margin="dense"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      placeholder={media ? `${media} の設備番号を選択` : "先に設備（資産カテゴリ）を選択してください"}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingAssetNos ? <CircularProgress size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
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
