import React from "react";
import { Dialog, DialogTitle, DialogContent, TextField, Button, MenuItem, Box, Stack, FormControl, InputLabel, Select } from "@mui/material";
import { EquipmentDoc, STATUS_OPTIONS } from "../types/equipment";
import { tsToYMD } from "../utils/datetime";
import { useSeatMasters } from "../hooks/useSeatMasters";

type Props = {
  open: boolean;
  selected: { docId: string; data: EquipmentDoc } | null;
  onChange: (key: keyof EquipmentDoc, value: string | number | null) => void;
  onClose: () => void;
  onDeleteAsk: () => void;
  onSave: () => void;
  activeUsers: Array<{ key: string; label: string }>;
  /** 現在のタブ名（例: "ディスプレイ"） */
  activeTab: string;
};

export const EquipmentEditDialog: React.FC<Props> = ({ open, selected, onChange, onClose, onDeleteAsk, onSave, activeUsers, activeTab }) => {
  const isUsbHub = selected?.data?.category === "USBハブ";
  const { seats, loading } = useSeatMasters();

  // ディスプレイのときだけ座席番号を表示
  const showSeat = activeTab === "ディスプレイ";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>機器情報 編集</DialogTitle>
      <DialogContent dividers>
        {selected && (
          <Box component="form" sx={{ "& .MuiTextField-root": { my: 0.25 } }}>
            <Stack direction="column" spacing={0.5}>
              <TextField label="No." variant="standard" size="small" fullWidth InputProps={{ readOnly: true }} value={String(selected.data.seqOrder ?? "")} />
              <TextField label="受付日" type="date" variant="standard" size="small" fullWidth value={tsToYMD(selected.data.acceptedDate)} onChange={(e) => onChange("acceptedDate", e.target.value)} />
              <TextField label="機器番号" variant="standard" size="small" fullWidth InputProps={{ readOnly: true }} value={selected.data.assetNo ?? ""} />
              <TextField label="機器分類" variant="standard" size="small" fullWidth InputProps={{ readOnly: true }} value={selected.data.category ?? ""} />

              <TextField label="枝番" variant="standard" size="small" fullWidth value={selected.data.branchNo ?? ""} onChange={(e) => onChange("branchNo", e.target.value)} />
              <TextField label="機器名" variant="standard" size="small" fullWidth value={selected.data.deviceName ?? ""} onChange={(e) => onChange("deviceName", e.target.value)} />
              <TextField label="更新日" type="date" variant="standard" size="small" fullWidth value={tsToYMD(selected.data.updatedOn)} onChange={(e) => onChange("updatedOn", e.target.value)} />
              <TextField label="確認日" type="date" variant="standard" size="small" fullWidth value={tsToYMD(selected.data.confirmedOn)} onChange={(e) => onChange("confirmedOn", e.target.value)} />
              <TextField label="廃棄日" type="date" variant="standard" size="small" fullWidth value={tsToYMD(selected.data.disposedOn)} onChange={(e) => onChange("disposedOn", e.target.value)} />

              <TextField label="保有者" select variant="standard" size="small" fullWidth value={selected.data.owner ?? ""} onChange={(e) => onChange("owner", e.target.value)}>
                {activeUsers.map((u) => (
                  <MenuItem key={u.key} value={u.key}>
                    {u.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField label="状態" select variant="standard" size="small" fullWidth value={selected.data.status ?? ""} onChange={(e) => onChange("status", e.target.value)}>
                {STATUS_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </TextField>

              <TextField label="保有履歴" variant="standard" size="small" fullWidth value={selected.data.history ?? ""} onChange={(e) => onChange("history", e.target.value)} />

              {/* ★ ディスプレイのときだけ座席番号を表示 */}
              {showSeat && (
                <FormControl variant="standard" size="small" fullWidth>
                  <InputLabel shrink>座席番号</InputLabel>
                  <Select value={selected.data.seatNo ?? ""} onChange={(e) => onChange("seatNo", e.target.value ? Number(e.target.value) : null)}>
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
                </FormControl>
              )}

              <TextField label="備考" variant="standard" size="small" fullWidth value={selected.data.note ?? ""} onChange={(e) => onChange("note", e.target.value)} />
              <TextField label="所在地" variant="standard" size="small" fullWidth value={selected.data.location ?? ""} onChange={(e) => onChange("location", e.target.value)} />

              <TextField label="最終更新者" select variant="standard" size="small" fullWidth value={selected.data.lastEditor ?? ""} onChange={(e) => onChange("lastEditor", e.target.value)}>
                {activeUsers.map((u) => (
                  <MenuItem key={`${u.key}-editor`} value={u.key}>
                    {u.label}
                  </MenuItem>
                ))}
              </TextField>

              {/* USBハブ専用 */}
              {isUsbHub && (
                <Stack direction="row" spacing={2}>
                  <TextField label="HDMI" variant="standard" size="small" value={selected.data.hdmi ?? ""} onChange={(e) => onChange("hdmi", e.target.value)} />
                  <TextField label="USB A" variant="standard" size="small" value={selected.data.usbA ?? ""} onChange={(e) => onChange("usbA", e.target.value)} />
                  <TextField label="USB C" variant="standard" size="small" value={selected.data.usbC ?? ""} onChange={(e) => onChange("usbC", e.target.value)} />
                  <TextField label="LAN" variant="standard" size="small" value={selected.data.lan ?? ""} onChange={(e) => onChange("lan", e.target.value)} />
                </Stack>
              )}

              <Box sx={{ display: "flex", gap: 1, pt: 0.5 }}>
                <Button onClick={onDeleteAsk} color="error" variant="outlined" size="small" sx={{ flex: 1 }}>
                  削除
                </Button>
                <Button onClick={onClose} variant="outlined" size="small" sx={{ flex: 1 }}>
                  閉じる
                </Button>
                <Button onClick={onSave} variant="contained" size="small" sx={{ flex: 1 }}>
                  保存
                </Button>
              </Box>
            </Stack>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};
