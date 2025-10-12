import React, { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, TextField, Button, MenuItem, Box, Stack } from "@mui/material";
import { EquipmentDoc, STATUS_OPTIONS } from "../types/equipment";
import { ymdToTimestamp } from "../utils/datetime";
import { Timestamp } from "firebase/firestore";
import { generateEquipmentNo } from "../utils/equipmentNo";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: EquipmentDoc) => Promise<void> | void;
  activeUsers: Array<{ key: string; label: string }>;
  nextSeq: number;
  /** ★ 選択中カテゴリ（タブで選ばれたもの） */
  currentCategory: { code: string; label: string };
};

export const EquipmentCreateDialog: React.FC<Props> = ({ open, onClose, onCreate, activeUsers, nextSeq, currentCategory }) => {
  const [form, setForm] = useState<EquipmentDoc>({
    acceptedDate: null,
    updatedOn: null,
    confirmedOn: null,
    disposedOn: null,
    assetNo: "",
    category: "", // UIでは入力しない（固定: currentCategory.label）
    branchNo: "",
    deviceName: "",
    owner: "",
    status: "",
    history: "",
    note: "",
    location: "",
    lastEditor: "",
    seqOrder: null,
  });

  useEffect(() => {
    if (open) {
      setForm({
        acceptedDate: null,
        updatedOn: null,
        confirmedOn: null,
        disposedOn: null,
        assetNo: "",
        category: "", // ラベルは保存時に currentCategory.label をセット
        branchNo: "",
        deviceName: "",
        owner: "",
        status: "",
        history: "",
        note: "",
        location: "",
        lastEditor: "",
        seqOrder: nextSeq,
      });
    }
  }, [open, nextSeq, currentCategory]);

  const onChange = (key: keyof EquipmentDoc, value: string) => {
    if (key === "seqOrder" || key === "category" || key === "assetNo") return;
    if (key === "acceptedDate" || key === "updatedOn" || key === "confirmedOn" || key === "disposedOn") {
      setForm((prev) => ({ ...prev, [key]: value ? ymdToTimestamp(value) : null }));
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.acceptedDate) {
      alert("受付日を入力してください（機器番号は受付日を基準に採番します）。");
      return;
    }

    // ★ タブで選択されたカテゴリcodeで採番
    const registeredAt = (form.acceptedDate as Timestamp).toDate();
    const assetNo = await generateEquipmentNo({ registeredAt, categoryCode: currentCategory.code });

    const payload: EquipmentDoc = {
      ...form,
      seqOrder: form.seqOrder ?? nextSeq,
      category: currentCategory.label, // 保存するのはラベル（既存互換）
      acceptedDate: form.acceptedDate ?? null,
      updatedOn: form.updatedOn ?? null,
      confirmedOn: form.confirmedOn ?? null,
      disposedOn: form.disposedOn ?? null,
      assetNo, // 自動採番
      branchNo: form.branchNo?.trim() ?? "",
      deviceName: form.deviceName?.trim() ?? "",
      owner: form.owner ?? "",
      status: form.status ?? "",
      history: form.history ?? "",
      note: form.note ?? "",
      location: form.location ?? "",
      lastEditor: form.lastEditor ?? "",
    };

    await onCreate(payload);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>機器情報 新規登録（{currentCategory.label}）</DialogTitle>
      <DialogContent dividers>
        <Box component="form" sx={{ "& .MuiTextField-root": { my: 0.25 } }}>
          <Stack direction="column" spacing={0.5}>
            <TextField label="No." variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} value={String(form.seqOrder ?? nextSeq)} />
            <TextField label="受付日" type="date" variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} onChange={(e) => onChange("acceptedDate", e.target.value)} />

            <TextField label="機器番号（保存時に自動採番）" variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} value={form.assetNo || ""} placeholder="保存時に自動採番されます" />

            {/* カテゴリ入力は出さない（タブで選択済み） */}
            <TextField label="枝番" variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} value={form.branchNo} onChange={(e) => onChange("branchNo", e.target.value)} />
            <TextField label="機器名" variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} value={form.deviceName} onChange={(e) => onChange("deviceName", e.target.value)} />
            <TextField label="更新日" type="date" variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} onChange={(e) => onChange("updatedOn", e.target.value)} />
            <TextField label="確認日" type="date" variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} onChange={(e) => onChange("confirmedOn", e.target.value)} />
            <TextField label="廃棄日" type="date" variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} onChange={(e) => onChange("disposedOn", e.target.value)} />
            <TextField label="保有者" select variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} value={form.owner} onChange={(e) => onChange("owner", e.target.value)}>
              {activeUsers.map((u) => (
                <MenuItem key={u.key} value={u.key}>
                  {u.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="状態" select variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} value={form.status} onChange={(e) => onChange("status", e.target.value)}>
              {STATUS_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="保有履歴" variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} value={form.history} onChange={(e) => onChange("history", e.target.value)} />
            <TextField label="備考" variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} value={form.note} onChange={(e) => onChange("note", e.target.value)} />
            <TextField label="所在地" variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} value={form.location} onChange={(e) => onChange("location", e.target.value)} />
            <TextField label="最終更新者" select variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} value={form.lastEditor} onChange={(e) => onChange("lastEditor", e.target.value)}>
              {activeUsers.map((u) => (
                <MenuItem key={`${u.key}-editor`} value={u.key}>
                  {u.label}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ display: "flex", gap: 1, pt: 0.5 }}>
              <Button onClick={onClose} variant="outlined" size="small" sx={{ flex: 1 }}>
                閉じる
              </Button>
              <Button onClick={handleSave} variant="contained" size="small" sx={{ flex: 1 }}>
                保存
              </Button>
            </Box>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
