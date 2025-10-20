// src/components/EditButton.tsx
import React, { useState } from "react";
import { Button, IconButton, Tooltip, Modal, TextField, Box, MenuItem, InputLabel, FormControl, Select } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Where from "./Where";
import ApprovalRequestDialog from "./ApprovalRequestDialog";

// Firestore
import { db } from "../firebase";
import { doc, updateDoc, collection, getDocs, getDoc, query, where } from "firebase/firestore";

// EmailJS（※ init は lib ラッパー推奨。既存のまま利用）
import emailjs from "@emailjs/browser";

// EmailJS
const EMAILJS_SERVICE_ID = "service_0sslyge";
const TEMPLATE_CHANGE_ID = "template_81c28kt"; // 変更申請（承認者向け）
const TEMPLATE_RETURN_ID = "template_81c28kt"; // 返却申請
const TEMPLATE_CHANGE_NOTICE_TO_APPLICANT = TEMPLATE_CHANGE_ID;

/** posts の1行分（必要フィールドのみ） */
export type RowData = {
  id: string;
  applicant?: string;
  applicantId?: string;
  applicantdate?: string;
  classification?: string;
  periodfrom?: string;
  periodto?: string;
  where?: string;
  materials?: string; // 設備名
  media?: string; // 設備番号
  mediaRaw?: string;
  permitdate?: string;
  permitstamp?: string;
  confirmationdate?: string;
  confirmationstamp?: string;
  requestedBy?: string; // 申請者メール
  [key: string]: any; // 他にも色々来るので逃げ道を残す
};

type Props = {
  rowData: RowData;
  setSharedState?: (rows: RowData[]) => void;
  disabled?: boolean;
  icon?: boolean;
};

const EQUIP_OPTIONS = ["PC", "スマートフォン", "USBメモリ", "外付けHDD", "その他"];

export const EditButton: React.FC<Props> = ({ rowData, setSharedState, disabled, icon = false }) => {
  const [open, setOpen] = useState(false);

  // 画面バインド用（UI形）
  const [formData, setFormData] = useState<RowData>({ ...rowData });

  // where=その他 の自由入力
  const [otherInput, setOtherInput] = useState("");

  // 設備=その他 の自由入力
  const [mediaOther, setMediaOther] = useState("");

  // 変更内容コメント
  const [changeNote, setChangeNote] = useState("");

  // 申請ダイアログ制御
  const [returnOpen, setReturnOpen] = useState(false); // 返却申請
  const [changeOpen, setChangeOpen] = useState(false); // 変更申請

  // 進行中フラグ（連打防止）
  const [saving, setSaving] = useState(false);

  // 表示専用：解決済みの申請者名
  const [applicantResolved, setApplicantResolved] = useState("");

  // ----- 申請者名の解決 -----
  const resolveApplicantName = async (initial: RowData) => {
    const direct = (initial?.applicant ?? "").toString().trim();
    if (direct) {
      setApplicantResolved(direct);
      return;
    }
    const uid = (initial?.applicantId ?? "").toString().trim();
    if (!uid) {
      setApplicantResolved("");
      return;
    }
    let name = "";
    try {
      // users/{uid}
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const d = (snap.data() ?? {}) as any;
          name = String(d.displayName ?? d.name ?? d.fullName ?? "").trim();
        }
      } catch {
        /* noop */
      }
      // users.where("id","==", uid)
      if (!name) {
        try {
          const qs = await getDocs(query(collection(db, "users"), where("id", "==", uid)));
          if (!qs.empty) {
            const d = (qs.docs[0].data() ?? {}) as any;
            name = String(d.displayName ?? d.name ?? d.fullName ?? "").trim();
          }
        } catch {
          /* noop */
        }
      }
      setApplicantResolved(name);
    } catch {
      setApplicantResolved("");
    }
  };

  const handleOpen = async () => {
    // DB→UI 変換
    const dbEquipName = rowData?.materials || "";
    const dbEquipNo = rowData?.media || "";
    const dbWhere = rowData?.where || "";

    const uiEquipValue = EQUIP_OPTIONS.includes(dbEquipName) ? dbEquipName : "その他";
    const uiMediaOther = EQUIP_OPTIONS.includes(dbEquipName) ? "" : dbEquipName;

    const whereOptions: string[] = Array.isArray(Where) ? (Where as string[]) : [];
    const uiWhereValue = whereOptions.includes(dbWhere) ? dbWhere : "その他";
    const uiOtherInput = whereOptions.includes(dbWhere) ? "" : dbWhere;

    const ui: RowData = {
      ...rowData,
      media: uiEquipValue, // 設備（Select）
      materials: dbEquipNo, // 設備番号（TextField）
      where: uiWhereValue, // 持込・持出先（Select）
    };

    setMediaOther(uiMediaOther);
    setOtherInput(uiOtherInput);
    setFormData(ui);
    setChangeNote(""); // 開くたびに初期化
    await resolveApplicantName(rowData);
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  // 入力系（TextField）
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<string>) => {
    const name = (e.target as HTMLInputElement).name as keyof RowData;
    const value = (e.target as HTMLInputElement).value;

    if (name === "media" && value !== "その他") setMediaOther("");
    if (name === "where" && value !== "その他") setOtherInput("");

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOtherWhereInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setOtherInput(e.target.value);

  const handleMediaOtherChange = (e: React.ChangeEvent<HTMLInputElement>) => setMediaOther(e.target.value);

  const handleChangeNoteChange = (e: React.ChangeEvent<HTMLInputElement>) => setChangeNote(e.target.value);

  // UI→DB 正規化（保存用 payload）
  const buildDbPayload = () => {
    const {
      id,
      media: uiEquip,
      materials: uiEquipNo,
      where: uiWhere,
      // --- DBに書き戻さないフィールドを除外 ---
      applicant, // 申請者は更新しない
      permitdate,
      permitstamp,
      confirmationdate,
      confirmationstamp,
      ...restEditable
    } = formData;

    const equipNameToSave = uiEquip === "その他" ? mediaOther.trim() : uiEquip || "";
    const equipNoToSave = uiEquipNo || "";
    const whereToSave = uiWhere === "その他" ? otherInput.trim() : uiWhere || "";

    return {
      id: id || rowData?.id,
      payload: {
        ...restEditable,
        materials: equipNameToSave, // 設備名
        media: equipNoToSave, // 設備番号
        where: whereToSave,
        // applicant は触らない
      },
    };
  };

  // 承認メールへ渡すデータ（UI→DB 正規化）
  const buildRowDataForMail = (): RowData => {
    const { media: uiEquip, materials: uiEquipNo, where: uiWhere, ...rest } = formData;
    const equipName = uiEquip === "その他" ? mediaOther.trim() : uiEquip || "";
    const equipNo = uiEquipNo || "";
    const whereVal = uiWhere === "その他" ? otherInput.trim() : uiWhere || "";
    return {
      ...rowData,
      ...rest,
      materials: equipName,
      media: equipNo,
      where: whereVal,
      applicant: applicantResolved || rowData?.applicant || "",
      change_note: changeNote,
    };
  };

  // 子(申請ダイアログ)・親(Edit)をどちらも閉じる
  const closeAllDialogs = () => {
    setReturnOpen(false);
    setChangeOpen(false);
    setOpen(false);
  };

  // 申請者（requestedBy）へ変更内容コメントを送る
  const notifyApplicantOfChange = async (rowId: string, mergedForMail: RowData) => {
    const toEmail = rowData?.requestedBy || ""; // 申請者メール
    if (!toEmail) return; // 旧データ対策

    const toName = applicantResolved || rowData?.applicant || "申請者さま";
    const emailHtml = "https://kdsbring.netlify.app/"; // 任意

    const params = {
      to_name: toName,
      to_email: toEmail,
      id: rowId,
      applicantdate: mergedForMail.applicantdate || "",
      applicant: mergedForMail.applicant || "",
      classification: mergedForMail.classification || "",
      periodfrom: mergedForMail.periodfrom || "",
      periodto: mergedForMail.periodto || "",
      where: mergedForMail.where || "",
      materials: mergedForMail.materials || "",
      media: mergedForMail.media || "",
      link: emailHtml,
      change_note: changeNote || "",
      purpose: "変更内容のお知らせ（申請者控え）",
      action: "変更",
    };

    await emailjs.send(EMAILJS_SERVICE_ID, TEMPLATE_CHANGE_NOTICE_TO_APPLICANT, params);
  };

  // 変更申請：まずDB保存→承認者宛ダイアログを開く＋申請者へ通知
  const handleChangeApply = async () => {
    if (saving) return;
    const { id, payload } = buildDbPayload();
    if (!id) {
      console.error("ドキュメントIDが取得できませんでした。");
      setChangeOpen(true);
      return;
    }
    try {
      setSaving(true);
      await updateDoc(doc(db, "posts", id), payload);

      // 一覧再読込
      if (typeof setSharedState === "function") {
        const snap = await getDocs(collection(db, "posts"));
        const rows: RowData[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setSharedState(rows);
      }

      // 申請者へ通知
      const mergedForMail = buildRowDataForMail();
      await notifyApplicantOfChange(id, mergedForMail);

      // 承認者向けメール用ダイアログ
      setChangeOpen(true);
    } catch (e) {
      console.error("変更申請の保存に失敗:", e);
    } finally {
      setSaving(false);
    }
  };

  // ApprovalRequestDialog に渡す共通パラメータ組立
  const buildTemplateParams = ({ rowId, rowData, approver, user, mode }: any) => {
    const emailHtml = "https://kdsbring.netlify.app/"; // 承認URL
    return {
      // 宛先（承認者）
      to_name: approver.name,
      to_email: approver.email,

      // 依頼者
      from_email: (user && user.email) || (rowData && rowData.requestedBy) || "",
      reply_to: (user && user.email) || "",

      // 申請内容
      id: rowId,
      applicantdate: (rowData && rowData.applicantdate) || "",
      applicant: applicantResolved || (rowData && rowData.applicant) || "",
      classification: (rowData && rowData.classification) || "",
      periodfrom: (rowData && rowData.periodfrom) || "",
      periodto: (rowData && rowData.periodto) || "",
      where: (rowData && rowData.where) || "",
      materials: (rowData && rowData.materials) || "",
      media: (rowData && rowData.media) || "",
      link: emailHtml,

      purpose: mode === "change" ? "変更申請" : "返却申請",
      action: mode === "change" ? "変更" : "返却",

      // 承認者にもコメント共有
      change_note: (rowData && rowData.change_note) || changeNote || "",
    };
  };

  const whereOptions: string[] = Array.isArray(Where) ? (Where as string[]) : [];

  // 登録承認（permitdate & permitstamp）が揃っているか
  const isReturnAllowed = Boolean((formData?.permitdate || "").trim() && (formData?.permitstamp || "").trim());

  return (
    <div>
      {icon ? (
        <Tooltip title="編集" arrow>
          <span>
            <IconButton onClick={handleOpen} color="primary" size="small" disabled={disabled}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ) : (
        <Button variant="outlined" color="primary" onClick={handleOpen} disabled={disabled}>
          編集
        </Button>
      )}

      <Modal open={open} onClose={handleClose} BackdropProps={{ onClick: (e) => e.stopPropagation() }}>
        <Box
          sx={{
            padding: 2,
            backgroundColor: "white",
            margin: "auto",
            mt: "4%",
            width: 420,
            maxHeight: "80vh",
            overflow: "auto",
          }}
        >
          {/* 2カラムでコンパクト */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 1,
              "& .MuiTextField-root, & .MuiFormControl-root": { mb: 0 },
            }}
          >
            <TextField name="applicantdate" label="申請日" value={formData.applicantdate || ""} onChange={handleInputChange} type="date" fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} />

            {/* 申請者は読み取り専用 */}
            <TextField label="申請者" value={applicantResolved || ""} fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} />

            <FormControl fullWidth variant="standard" size="small">
              <InputLabel id="classification-label" shrink>
                持出・持込区分
              </InputLabel>
              <Select labelId="classification-label" name="classification" value={formData.classification || ""} onChange={handleInputChange} label="持出・持込区分">
                <MenuItem value="持出">持出</MenuItem>
                <MenuItem value="持込">持込</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth variant="standard" size="small">
              <InputLabel id="where-label" shrink>
                持込・持出先
              </InputLabel>
              <Select labelId="where-label" name="where" value={formData.where || ""} onChange={handleInputChange} label="持込・持出先">
                {whereOptions.map((item, index) => (
                  <MenuItem key={index} value={item}>
                    {item}
                  </MenuItem>
                ))}
                <MenuItem value="その他">その他</MenuItem>
              </Select>
            </FormControl>

            {formData.where === "その他" && (
              <TextField label="持込・持出先（その他の内容）" value={otherInput} onChange={handleOtherWhereInputChange} fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} sx={{ gridColumn: "1 / -1" }} />
            )}

            <TextField name="periodfrom" label="持込・持出日 から" value={formData.periodfrom || ""} onChange={handleInputChange} type="date" fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} />
            <TextField name="periodto" label="持込・持出日 まで" value={formData.periodto || ""} onChange={handleInputChange} type="date" fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} />

            <FormControl fullWidth variant="standard" size="small">
              <InputLabel id="media-label" shrink>
                設備
              </InputLabel>
              <Select labelId="media-label" name="media" value={formData.media || ""} onChange={handleInputChange} label="設備">
                {EQUIP_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField name="materials" label="設備番号" value={formData.materials || ""} onChange={handleInputChange} fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} />

            {formData.media === "その他" && <TextField label="設備（その他の内容）" value={mediaOther} onChange={handleMediaOtherChange} fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} sx={{ gridColumn: "1 / -1" }} />}

            {/* 表示のみ 4項目（編集不可） */}
            <TextField label="登録承認日付" value={formData.permitdate || ""} fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} />
            <TextField label="承認者" value={formData.permitstamp || ""} fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} />
            <TextField label="返却承認日付" value={formData.confirmationdate || ""} fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} />
            <TextField label="承認者" value={formData.confirmationstamp || ""} fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} />

            {/* 変更内容コメント */}
            <TextField label="変更内容（コメント）" value={changeNote} onChange={handleChangeNoteChange} fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} multiline minRows={2} maxRows={6} sx={{ gridColumn: "1 / -1" }} />
          </Box>

          {/* ボタン行 */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2, gap: 1 }}>
            <Button variant="outlined" color="primary" onClick={handleClose} sx={{ width: 140 }}>
              キャンセル
            </Button>
            <Button variant="contained" color="primary" onClick={handleChangeApply} sx={{ width: 140 }} disabled={saving}>
              {saving ? "保存中..." : "変更申請"}
            </Button>

            {/* 返却申請は登録承認済み（permitdate & permitstamp）でないと押せない */}
            <Tooltip title={isReturnAllowed ? "" : "登録承認（承認日付・承認者）が未登録のため返却申請できません"} arrow>
              <span>
                <Button variant="contained" color="primary" onClick={() => isReturnAllowed && setReturnOpen(true)} sx={{ width: 140 }} disabled={!isReturnAllowed}>
                  返却申請
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Modal>

      {/* 変更申請（承認者向け） */}
      <ApprovalRequestDialog
        open={changeOpen}
        onClose={() => setChangeOpen(false)}
        onCloseAll={closeAllDialogs}
        mode="change"
        serviceId={EMAILJS_SERVICE_ID}
        templateId={TEMPLATE_CHANGE_ID}
        rowId={formData?.id || rowData?.id}
        rowData={buildRowDataForMail()}
        buildTemplateParams={buildTemplateParams}
      />

      {/* 返却申請 */}
      <ApprovalRequestDialog
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        onCloseAll={closeAllDialogs}
        mode="return"
        serviceId={EMAILJS_SERVICE_ID}
        templateId={TEMPLATE_RETURN_ID}
        rowId={formData?.id || rowData?.id}
        rowData={buildRowDataForMail()}
        buildTemplateParams={buildTemplateParams}
      />
    </div>
  );
};

export default EditButton;
