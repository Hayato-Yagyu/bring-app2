import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogTitle, DialogContent, TextField, Button, MenuItem, Box, Stack, FormControl, InputLabel, Select, FormHelperText } from "@mui/material";
import { EquipmentDoc, STATUS_OPTIONS } from "../types/equipment";
import { ymdToTimestamp } from "../utils/datetime";
import { Timestamp } from "firebase/firestore";
import { generateEquipmentNo } from "../utils/equipmentNo";
import { useSeatMasters } from "../hooks/useSeatMasters";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: EquipmentDoc) => Promise<void> | void;
  activeUsers: Array<{ key: string; label: string }>;
  nextSeq: number;
  /** ★ 選択中カテゴリ（タブで選ばれたもの） */
  currentCategory: { code: string; label: string };
};

// 文字列が「未入力 or 空白のみ」ではないかを安全に判定するヘルパー
const isNonEmpty = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;

export const EquipmentCreateDialog: React.FC<Props> = ({ open, onClose, onCreate, activeUsers, nextSeq, currentCategory }) => {
  const [form, setForm] = useState<EquipmentDoc>({
    acceptedDate: null,
    updatedOn: null,
    confirmedOn: null,
    disposedOn: null,
    assetNo: "",
    category: "",
    branchNo: "",
    deviceName: "",
    owner: "",
    status: "",
    history: "",
    note: "",
    location: "",
    lastEditor: "",
    hdmi: "",
    usbA: "",
    usbC: "",
    lan: "",
    seqOrder: null,
    seatNo: null,
  });

  const { seats, loading } = useSeatMasters();

  // カテゴリ判定
  const isUsbHub = currentCategory?.label === "USBハブ";
  const isDisplay = currentCategory?.label === "ディスプレイ";

  useEffect(() => {
    if (open) {
      setForm({
        acceptedDate: null,
        updatedOn: null,
        confirmedOn: null,
        disposedOn: null,
        assetNo: "",
        category: "", // 保存時に currentCategory.label を設定
        branchNo: "",
        deviceName: "",
        owner: "",
        status: "",
        history: "",
        note: "",
        location: "",
        lastEditor: "",
        hdmi: "",
        usbA: "",
        usbC: "",
        lan: "",
        seqOrder: nextSeq,
        seatNo: null, // ディスプレイの時は必須チェック対象（下の errors 参照）
      });
    }
  }, [open, nextSeq, currentCategory]);

  const onChange = (key: keyof EquipmentDoc, value: string | number | null) => {
    if (key === "seqOrder" || key === "category" || key === "assetNo") return;
    if (["acceptedDate", "updatedOn", "confirmedOn", "disposedOn"].includes(key)) {
      setForm((prev) => ({ ...prev, [key]: value ? ymdToTimestamp(value as string) : null }));
      return;
    }
    if (key === "seatNo") {
      setForm((prev) => ({ ...prev, seatNo: value === "" || value == null ? null : Number(value) }));
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 必須チェック */
  const errors = useMemo(() => {
    const base = {
      acceptedDate: !form.acceptedDate, // 受付日 必須
      deviceName: !isNonEmpty(form.deviceName), // 機器名 必須
      owner: !isNonEmpty(form.owner), // 保有者 必須
      status: !isNonEmpty(form.status), // 状態 必須
      location: !isNonEmpty(form.location), // 所在地 必須
      lastEditor: !isNonEmpty(form.lastEditor), // 最終更新者 必須
    } as Record<string, boolean>;

    // ★ ディスプレイの時のみ座席番号を必須にする
    if (isDisplay) {
      base.seatNo = !(typeof form.seatNo === "number" && !Number.isNaN(form.seatNo));
    }

    return base;
  }, [form, isDisplay]);

  const isValid = useMemo(() => Object.values(errors).every((v) => v === false), [errors]);

  const handleSave = async () => {
    if (!isValid) return;
    const registeredAt = (form.acceptedDate as Timestamp).toDate();
    const assetNo = await generateEquipmentNo({ registeredAt, categoryCode: currentCategory.code });

    const payload: EquipmentDoc = {
      ...form,
      seqOrder: form.seqOrder ?? nextSeq,
      category: currentCategory.label, // 保存するのはラベル
      assetNo, // 自動採番
      // seatNo はすでに number | null に正規化済み
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

            {/* 受付日（必須） */}
            <TextField
              label="受付日"
              type="date"
              variant="standard"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              onChange={(e) => onChange("acceptedDate", e.target.value)}
              error={errors.acceptedDate}
              helperText={errors.acceptedDate ? "必須です" : ""}
            />

            <TextField label="機器番号（自動採番）" variant="standard" size="small" fullWidth InputProps={{ readOnly: true }} value={form.assetNo || ""} placeholder="保存時に自動採番されます" />

            <TextField label="枝番" variant="standard" size="small" fullWidth value={form.branchNo ?? ""} onChange={(e) => onChange("branchNo", e.target.value)} />

            {/* 機器名（必須） */}
            <TextField
              label="機器名"
              variant="standard"
              size="small"
              fullWidth
              value={form.deviceName ?? ""}
              onChange={(e) => onChange("deviceName", e.target.value)}
              error={errors.deviceName}
              helperText={errors.deviceName ? "必須です" : ""}
            />

            <TextField label="更新日" type="date" variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} onChange={(e) => onChange("updatedOn", e.target.value)} />

            <TextField label="確認日" type="date" variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} onChange={(e) => onChange("confirmedOn", e.target.value)} />

            <TextField label="廃棄日" type="date" variant="standard" size="small" fullWidth InputLabelProps={{ shrink: true }} onChange={(e) => onChange("disposedOn", e.target.value)} />

            {/* 保有者（必須） */}
            <TextField
              label="保有者"
              select
              variant="standard"
              size="small"
              fullWidth
              value={form.owner ?? ""}
              onChange={(e) => onChange("owner", e.target.value)}
              error={errors.owner}
              helperText={errors.owner ? "必須です" : ""}
            >
              {activeUsers.map((u) => (
                <MenuItem key={u.key} value={u.key}>
                  {u.label}
                </MenuItem>
              ))}
            </TextField>

            {/* 状態（必須） */}
            <TextField
              label="状態"
              select
              variant="standard"
              size="small"
              fullWidth
              value={form.status ?? ""}
              onChange={(e) => onChange("status", e.target.value)}
              error={errors.status}
              helperText={errors.status ? "必須です" : ""}
            >
              {STATUS_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>

            {/* 保有履歴 */}
            <TextField label="保有履歴" variant="standard" size="small" fullWidth value={form.history ?? ""} onChange={(e) => onChange("history", e.target.value)} />

            {/* ★ 座席番号（ディスプレイのみ表示・必須） → 保有履歴の"次"に配置 */}
            {isDisplay && (
              <FormControl variant="standard" size="small" fullWidth error={Boolean(errors.seatNo)}>
                <InputLabel shrink>座席番号</InputLabel>
                <Select value={form.seatNo ?? ""} onChange={(e) => onChange("seatNo", e.target.value ? Number(e.target.value) : null)} displayEmpty>
                  <MenuItem value="">未指定</MenuItem>
                  {loading ? (
                    <MenuItem disabled>読み込み中…</MenuItem>
                  ) : (
                    seats.map((s) => (
                      <MenuItem key={s.id} value={s.number}>
                        {s.label}
                      </MenuItem>
                    ))
                  )}
                </Select>
                {errors.seatNo && <FormHelperText>ディスプレイは座席番号の指定が必須です</FormHelperText>}
              </FormControl>
            )}

            {/* 備考 */}
            <TextField label="備考" variant="standard" size="small" fullWidth value={form.note ?? ""} onChange={(e) => onChange("note", e.target.value)} />

            {/* 所在地（必須） */}
            <TextField
              label="所在地"
              variant="standard"
              size="small"
              fullWidth
              value={form.location ?? ""}
              onChange={(e) => onChange("location", e.target.value)}
              error={errors.location}
              helperText={errors.location ? "必須です" : ""}
            />

            {/* 最終更新者（必須） */}
            <TextField
              label="最終更新者"
              select
              variant="standard"
              size="small"
              fullWidth
              value={form.lastEditor ?? ""}
              onChange={(e) => onChange("lastEditor", e.target.value)}
              error={errors.lastEditor}
              helperText={errors.lastEditor ? "必須です" : ""}
            >
              {activeUsers.map((u) => (
                <MenuItem key={`${u.key}-editor`} value={u.key}>
                  {u.label}
                </MenuItem>
              ))}
            </TextField>

            {/* ★ USBハブ専用フィールド */}
            {isUsbHub && (
              <Stack direction="row" spacing={2}>
                <TextField label="HDMI" variant="standard" size="small" value={form.hdmi ?? ""} onChange={(e) => onChange("hdmi", e.target.value)} />
                <TextField label="USB A" variant="standard" size="small" value={form.usbA ?? ""} onChange={(e) => onChange("usbA", e.target.value)} />
                <TextField label="USB C" variant="standard" size="small" value={form.usbC ?? ""} onChange={(e) => onChange("usbC", e.target.value)} />
                <TextField label="LAN" variant="standard" size="small" value={form.lan ?? ""} onChange={(e) => onChange("lan", e.target.value)} />
              </Stack>
            )}

            <Box sx={{ display: "flex", gap: 1, pt: 0.5 }}>
              <Button onClick={onClose} variant="outlined" size="small" sx={{ flex: 1 }}>
                閉じる
              </Button>
              <Button onClick={handleSave} variant="contained" size="small" sx={{ flex: 1 }} disabled={!isValid}>
                保存
              </Button>
            </Box>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
