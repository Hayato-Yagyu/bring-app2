import React, { useMemo, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Stack, Autocomplete, TextField, CircularProgress } from "@mui/material";
import { useServerLayout } from "../hooks/useServerLayout";

// props 型
type EquipmentOption = { id: string; label: string; raw: any };
type Props = {
  open: boolean;
  onClose: () => void;
  equipments: EquipmentOption[]; // 候補Equipment（サーバのみなどに絞る）
  currentUid?: string | null;
};

export const ServerRoomDiagramDialog: React.FC<Props> = ({ open, onClose, equipments, currentUid }) => {
  const { loading, layout, assign } = useServerLayout("main");
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [selectedEquip, setSelectedEquip] = useState<EquipmentOption | null>(null);

  const slotEntries = useMemo(() => Object.entries(layout.slots || {}), [layout.slots]);

  const handleSlotClick = (slotId: string) => {
    setActiveSlotId(slotId);
    const eqId = layout.slots[slotId]?.equipmentId || null;
    const found = eqId ? equipments.find((e) => e.id === eqId) || null : null;
    setSelectedEquip(found);
  };

  const handleSave = async () => {
    if (!activeSlotId) return;
    await assign(activeSlotId, selectedEquip?.id ?? null, currentUid ?? undefined);
    setActiveSlotId(null);
    setSelectedEquip(null);
  };

  // シンプルなSVGレイアウト（例）
  // 実際の配置に合わせて <rect x y width height> を調整してください。
  const SvgLayout = () => (
    <svg width="100%" height="320" viewBox="0 0 800 320" style={{ border: "1px solid #ddd", borderRadius: 8 }}>
      {/* ラックAの枠 */}
      <rect x="20" y="20" width="360" height="280" rx="8" fill="#fafafa" stroke="#bbb" />
      <text x="30" y="40" fontSize="14" fill="#555">
        Rack A
      </text>

      {/* Aのスロット群 */}
      {[
        { id: "rackA-1", x: 40, y: 60, w: 320, h: 40 },
        { id: "rackA-2", x: 40, y: 110, w: 320, h: 40 },
        { id: "rackA-3", x: 40, y: 160, w: 320, h: 40 },
      ].map((s) => {
        const assigned = layout.slots[s.id]?.equipmentId;
        return (
          <g key={s.id} onClick={() => handleSlotClick(s.id)} style={{ cursor: "pointer" }}>
            <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="6" fill={activeSlotId === s.id ? "#e3f2fd" : assigned ? "#f1f8e9" : "#fff"} stroke="#90a4ae" />
            <text x={s.x + 8} y={s.y + 25} fontSize="13" fill="#444">
              {layout.slots[s.id]?.label || s.id}
              {assigned ? `  /  ${assigned}` : ""}
            </text>
          </g>
        );
      })}

      {/* ラックB */}
      <rect x="420" y="20" width="360" height="280" rx="8" fill="#fafafa" stroke="#bbb" />
      <text x="430" y="40" fontSize="14" fill="#555">
        Rack B
      </text>

      {[
        { id: "rackB-1", x: 440, y: 60, w: 320, h: 40 },
        { id: "rackB-2", x: 440, y: 110, w: 320, h: 40 },
      ].map((s) => {
        const assigned = layout.slots[s.id]?.equipmentId;
        return (
          <g key={s.id} onClick={() => handleSlotClick(s.id)} style={{ cursor: "pointer" }}>
            <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="6" fill={activeSlotId === s.id ? "#e3f2fd" : assigned ? "#f1f8e9" : "#fff"} stroke="#90a4ae" />
            <text x={s.x + 8} y={s.y + 25} fontSize="13" fill="#444">
              {layout.slots[s.id]?.label || s.id}
              {assigned ? `  /  ${assigned}` : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>サーバ室構成を編集</DialogTitle>
      <DialogContent dividers sx={{ pt: 2 }}>
        {loading ? (
          <Box display="flex" alignItems="center" justifyContent="center" minHeight={240}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              図のスロット（箱）をクリックして、割り当てる機器（Equipment）を選択してください。
            </Typography>
            <SvgLayout />
            {activeSlotId && (
              <Box sx={{ p: 2, border: "1px dashed #bbb", borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  選択中スロット: <b>{layout.slots[activeSlotId]?.label || activeSlotId}</b>
                </Typography>
                <Autocomplete
                  value={selectedEquip}
                  onChange={(_, v) => setSelectedEquip(v)}
                  options={equipments}
                  getOptionLabel={(o) => o.label}
                  renderInput={(params) => <TextField {...params} label="割り当てる機器（サーバ）" size="small" />}
                  clearOnBlur
                  sx={{ maxWidth: 520 }}
                />
                <Stack direction="row" spacing={1.5} mt={1.5}>
                  <Button variant="contained" onClick={handleSave}>
                    保存
                  </Button>
                  <Button
                    onClick={() => {
                      setActiveSlotId(null);
                      setSelectedEquip(null);
                    }}
                  >
                    キャンセル
                  </Button>
                  <Button color="warning" onClick={() => setSelectedEquip(null)}>
                    割り当て解除（未設定にする）
                  </Button>
                </Stack>
              </Box>
            )}
            {/* 現在の割り当て一覧（簡易） */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                現在の割り当て
              </Typography>
              <Stack spacing={0.5}>
                {slotEntries.map(([slotId, slot]) => (
                  <Typography key={slotId} variant="body2">
                    • {slot.label || slotId} : {slot.equipmentId || "(未設定)"}
                  </Typography>
                ))}
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};
