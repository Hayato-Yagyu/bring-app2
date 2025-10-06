import React, { useState } from "react";
import { Button, IconButton, Tooltip, Modal, TextField, Box, MenuItem, InputLabel, FormControl, Select } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Applicant from "./Applicant";
import Where from "./Where";
import ApprovalRequestDialog from "./ApprovalRequestDialog";

// Firestore
import { db } from "../firebase";
import { doc, updateDoc, collection, getDocs } from "firebase/firestore";

// EmailJS（あなたの環境に合わせて保持）
const EMAILJS_SERVICE_ID = "service_0sslyge";
const TEMPLATE_CHANGE_ID = "template_81c28kt"; // 変更申請（＝新規登録と同テンプレ）
const TEMPLATE_RETURN_ID = "template_h2bmeqd"; // 返却申請

export const EditButton = ({ rowData, setSharedState, disabled, icon = false }) => {
  const [open, setOpen] = useState(false);

  // 画面バインド用（UI形）
  const [formData, setFormData] = useState({});

  // where=その他 の自由入力
  const [otherInput, setOtherInput] = useState("");

  // 設備=その他 の自由入力
  const [mediaOther, setMediaOther] = useState("");

  // 申請ダイアログ制御
  const [returnOpen, setReturnOpen] = useState(false); // 返却申請
  const [changeOpen, setChangeOpen] = useState(false); // 変更申請

  // 進行中フラグ（連打防止）
  const [saving, setSaving] = useState(false);

  const EQUIP_OPTIONS = ["PC", "スマートフォン", "USBメモリ", "外付けHDD", "その他"];

  const handleOpen = () => {
    // --- DB構成 ---
    // materials = 設備名、media = 設備番号
    const dbEquipName = (rowData && rowData.materials) || "";
    const dbEquipNo = (rowData && rowData.media) || "";
    const dbWhere = (rowData && rowData.where) || "";

    const uiEquipValue = EQUIP_OPTIONS.includes(dbEquipName) ? dbEquipName : "その他";
    const uiMediaOther = EQUIP_OPTIONS.includes(dbEquipName) ? "" : dbEquipName;

    const whereOptions = Array.isArray(Where) ? Where : [];
    const uiWhereValue = whereOptions.includes(dbWhere) ? dbWhere : "その他";
    const uiOtherInput = whereOptions.includes(dbWhere) ? "" : dbWhere;

    const ui = {
      ...rowData,
      media: uiEquipValue, // 設備（Select）
      materials: dbEquipNo, // 設備番号（TextField）
      where: uiWhereValue, // 持込・持出先（Select）
    };

    setMediaOther(uiMediaOther);
    setOtherInput(uiOtherInput);
    setFormData(ui);
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "media" && value !== "その他") setMediaOther("");
    if (name === "where" && value !== "その他") setOtherInput("");
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOtherWhereInputChange = (e) => setOtherInput(e.target.value);
  const handleMediaOtherChange = (e) => setMediaOther(e.target.value);

  // UI→DB 正規化（保存用 payload を作る）
  const buildDbPayload = () => {
    const {
      id,
      media: uiEquip,
      materials: uiEquipNo,
      where: uiWhere,
      // 表示のみ4項目は除外してDB上書きしない
      permitdate,
      permitstamp,
      confirmationdate,
      confirmationstamp,
      ...restEditable
    } = formData;

    const equipNameToSave = uiEquip === "その他" ? (mediaOther || "").trim() : uiEquip; // DB materials（設備名）
    const equipNoToSave = uiEquipNo || ""; // DB media（設備番号）
    const whereToSave = uiWhere === "その他" ? (otherInput || "").trim() : uiWhere; // DB where

    return {
      id: id || (rowData && rowData.id),
      payload: {
        ...restEditable,
        materials: equipNameToSave,
        media: equipNoToSave,
        where: whereToSave,
      },
    };
  };

  // 承認メールへ渡すデータ（UI→DB 正規化）
  const buildRowDataForMail = () => {
    const { media: uiEquip, materials: uiEquipNo, where: uiWhere, ...rest } = formData;
    const equipName = uiEquip === "その他" ? (mediaOther || "").trim() : uiEquip; // 設備名
    const equipNo = uiEquipNo || ""; // 設備番号
    const whereVal = uiWhere === "その他" ? (otherInput || "").trim() : uiWhere; // 持込・持出先
    return {
      ...rowData,
      ...rest,
      materials: equipName,
      media: equipNo,
      where: whereVal,
    };
  };

  // 子(申請ダイアログ)・親(Edit)をどちらも閉じる
  const closeAllDialogs = () => {
    setReturnOpen(false);
    setChangeOpen(false);
    setOpen(false);
  };

  const handleBackdropClick = (event) => event.stopPropagation();

  // 変更申請：まずDB保存→（成功時）承認ダイアログを開く
  const handleChangeApply = async () => {
    if (saving) return;
    const { id, payload } = buildDbPayload();
    if (!id) {
      console.error("ドキュメントIDが取得できませんでした。");
      setChangeOpen(true); // それでもメールは出すなら
      return;
    }
    try {
      setSaving(true);
      await updateDoc(doc(db, "posts", id), payload);

      // 一覧再読込（親から関数が渡されている場合のみ）
      if (typeof setSharedState === "function") {
        const snap = await getDocs(collection(db, "posts"));
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSharedState(rows);
      }

      // DB反映後の値でメール出すため、承認ダイアログを開く
      setChangeOpen(true);
    } catch (e) {
      console.error("変更申請の保存に失敗:", e);
      // 失敗時は承認ダイアログを開かない or 開くなら現在のUI値で送るかは運用に合わせて
      // setChangeOpen(true);
    } finally {
      setSaving(false);
    }
  };

  // ApprovalRequestDialog に渡す共通パラメータ組立（JSだけ）
  const buildTemplateParams = ({ rowId, rowData, approver, user, mode }) => {
    const emailHtml = "https://kdsbring.netlify.app/"; // 承認URL
    return {
      // 宛先
      to_name: approver.name,
      to_email: approver.email,

      // 依頼者
      from_email: (user && user.email) || (rowData && rowData.applicant) || "",
      reply_to: (user && user.email) || "",

      // 申請内容
      id: rowId,
      applicantdate: (rowData && rowData.applicantdate) || "",
      applicant: (rowData && rowData.applicant) || "",
      classification: (rowData && rowData.classification) || "",
      periodfrom: (rowData && rowData.periodfrom) || "",
      periodto: (rowData && rowData.periodto) || "",
      where: (rowData && rowData.where) || "",
      materials: (rowData && rowData.materials) || "", // 設備名
      media: (rowData && rowData.media) || "", // 設備番号
      link: emailHtml,

      // 任意：テンプレ用
      purpose: mode === "change" ? "変更申請" : "返却申請",
    };
  };

  const whereOptions = Array.isArray(Where) ? Where : [];

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

      <Modal open={open} onClose={handleClose} BackdropProps={{ onClick: handleBackdropClick }}>
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
            <TextField
              name="applicantdate"
              label="申請日"
              value={formData.applicantdate || ""}
              onChange={handleInputChange}
              type="date"
              fullWidth
              variant="standard"
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth variant="standard" size="small">
              <InputLabel id="applicant-label" shrink>
                申請者
              </InputLabel>
              <Select labelId="applicant-label" name="applicant" value={formData.applicant || ""} onChange={handleInputChange} label="申請者">
                {Array.isArray(Applicant)
                  ? Applicant.map((item, index) => (
                      <MenuItem key={index} value={item}>
                        {item}
                      </MenuItem>
                    ))
                  : null}
              </Select>
            </FormControl>

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
              </Select>
            </FormControl>

            {formData.where === "その他" && (
              <TextField
                label="持込・持出先（その他の内容）"
                value={otherInput}
                onChange={handleOtherWhereInputChange}
                fullWidth
                variant="standard"
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={{ gridColumn: "1 / -1" }}
              />
            )}

            <TextField
              name="periodfrom"
              label="持込・持出日 から"
              value={formData.periodfrom || ""}
              onChange={handleInputChange}
              type="date"
              fullWidth
              variant="standard"
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              name="periodto"
              label="持込・持出日 まで"
              value={formData.periodto || ""}
              onChange={handleInputChange}
              type="date"
              fullWidth
              variant="standard"
              size="small"
              InputLabelProps={{ shrink: true }}
            />

            <FormControl fullWidth variant="standard" size="small">
              <InputLabel id="media-label" shrink>
                設備
              </InputLabel>
              <Select labelId="media-label" name="media" value={formData.media || ""} onChange={handleInputChange} label="設備">
                <MenuItem value="PC">PC</MenuItem>
                <MenuItem value="スマートフォン">スマートフォン</MenuItem>
                <MenuItem value="USBメモリ">USBメモリ</MenuItem>
                <MenuItem value="外付けHDD">外付けHDD</MenuItem>
                <MenuItem value="その他">その他</MenuItem>
              </Select>
            </FormControl>

            <TextField name="materials" label="設備番号" value={formData.materials || ""} onChange={handleInputChange} fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} />

            {formData.media === "その他" && (
              <TextField
                label="設備（その他の内容）"
                value={mediaOther}
                onChange={handleMediaOtherChange}
                fullWidth
                variant="standard"
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={{ gridColumn: "1 / -1" }}
              />
            )}

            {/* 表示のみ 4項目（編集不可） */}
            <TextField label="登録承認日付" value={formData.permitdate || ""} fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} />
            <TextField label="承認者" value={formData.permitstamp || ""} fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} />
            <TextField label="返却承認日付" value={formData.confirmationdate || ""} fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} />
            <TextField label="承認者" value={formData.confirmationstamp || ""} fullWidth variant="standard" size="small" InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} />
          </Box>

          {/* ボタン行：キャンセル / 変更申請 / 返却申請 */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2, gap: 1 }}>
            <Button variant="outlined" color="primary" onClick={handleClose} sx={{ width: 140 }}>
              キャンセル
            </Button>
            <Button variant="contained" color="primary" onClick={handleChangeApply} sx={{ width: 140 }} disabled={saving}>
              {saving ? "保存中..." : "変更申請"}
            </Button>
            <Button variant="contained" color="primary" onClick={() => setReturnOpen(true)} sx={{ width: 140 }}>
              返却申請
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* 変更申請（新規登録と同テンプレ） */}
      <ApprovalRequestDialog
        open={changeOpen}
        onClose={() => setChangeOpen(false)}
        onCloseAll={closeAllDialogs}
        mode="change"
        serviceId={EMAILJS_SERVICE_ID}
        templateId={TEMPLATE_CHANGE_ID}
        rowId={(formData && formData.id) || (rowData && rowData.id)}
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
        rowId={(formData && formData.id) || (rowData && rowData.id)}
        rowData={buildRowDataForMail()}
        buildTemplateParams={buildTemplateParams}
      />
    </div>
  );
};

export default EditButton;
