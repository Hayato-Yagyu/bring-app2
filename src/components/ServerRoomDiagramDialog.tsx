// src/components/ServerRoomDiagramDialog.tsx
import React, { useMemo, useState, useCallback } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Stack, Autocomplete, TextField, CircularProgress } from "@mui/material";
import { useServerLayout } from "../hooks/useServerLayout";

type EquipmentOption = { id: string; label: string; raw: any };

type Props = {
  open: boolean;
  onClose: () => void;
  equipments: EquipmentOption[];
  currentUid?: string | null;
};

export const ServerRoomDiagramDialog: React.FC<Props> = ({ open, onClose, equipments, currentUid }) => {
  const { loading, layout, assign } = useServerLayout("main");
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [selectedEquip, setSelectedEquip] = useState<EquipmentOption | null>(null);

  // === ルータ用スロット判定（Wifiルータ／旧Wifiルータ／YAMAHAルータ） ===
  const routerSlotIds = useMemo(() => new Set(["left-net-01", "left-net-02", "left-net-03"]), []);
  const isRouterSlot = useCallback((slotId?: string | null) => (slotId ? routerSlotIds.has(slotId) : false), [routerSlotIds]);

  // === HUB用スロット判定（USBハブの候補に切替したいスロット） ===
  const hubSlotIds = useMemo(() => new Set(["left-net-04", "left-net-05"]), []);
  const isHubSlot = useCallback((slotId?: string | null) => (slotId ? hubSlotIds.has(slotId) : false), [hubSlotIds]);

  // === L2スイッチ・ハブ用スロット判定（ONU／モバビジ機器） ===
  const l2HubSlotIds = useMemo(() => new Set(["left-net-06", "left-net-07"]), []);
  const isL2HubSlot = useCallback((slotId?: string | null) => (slotId ? l2HubSlotIds.has(slotId) : false), [l2HubSlotIds]);

  // === ラベルは assetNo を最優先（空なら label→id） ===
  const getAssetNoLabel = useCallback((opt?: EquipmentOption | null) => {
    if (!opt) return "";
    const clean = (v: any) => (v == null ? "" : String(v).trim());
    const a = clean(opt?.raw?.assetNo);
    if (a) return a;
    const l = clean(opt?.label);
    if (l) return l;
    return opt!.id;
  }, []);

  // === servers: equipments から category==="サーバー" のみ抽出し、assetNo を表示用ラベルに付け替え ===
  const serverOptions = useMemo(() => {
    const src = (equipments || []).filter((e) => String(e?.raw?.category ?? "").trim() === "サーバー");
    const withLabel = src.map((e) => ({ ...e, label: getAssetNoLabel(e) }));
    // 並び順: seqOrder -> ラベル
    withLabel.sort((a, b) => {
      const sa = Number(a.raw?.seqOrder ?? Number.MAX_SAFE_INTEGER);
      const sb = Number(b.raw?.seqOrder ?? Number.MAX_SAFE_INTEGER);
      if (sa !== sb) return sa - sb;
      return a.label.localeCompare(b.label, "ja");
    });
    return withLabel;
  }, [equipments, getAssetNoLabel]);

  // === routers: equipments から category==="ルーター" のみ抽出し、assetNo ラベル ===
  const routerOptions = useMemo(() => {
    const src = (equipments || []).filter((e) => String(e?.raw?.category ?? "").trim() === "ルーター");
    const withLabel = src.map((e) => ({ ...e, label: getAssetNoLabel(e) }));
    withLabel.sort((a, b) => {
      const sa = Number(a.raw?.seqOrder ?? Number.MAX_SAFE_INTEGER);
      const sb = Number(b.raw?.seqOrder ?? Number.MAX_SAFE_INTEGER);
      if (sa !== sb) return sa - sb;
      return a.label.localeCompare(b.label, "ja");
    });
    return withLabel;
  }, [equipments, getAssetNoLabel]);

  // === usbHubs: equipments から category==="USBハブ" のみ抽出（HUBスロット用） ===
  const usbHubOptions = useMemo(() => {
    const src = (equipments || []).filter((e) => String(e?.raw?.category ?? "").trim() === "USBハブ");
    const withLabel = src.map((e) => ({ ...e, label: getAssetNoLabel(e) }));
    withLabel.sort((a, b) => {
      const sa = Number(a.raw?.seqOrder ?? Number.MAX_SAFE_INTEGER);
      const sb = Number(b.raw?.seqOrder ?? Number.MAX_SAFE_INTEGER);
      if (sa !== sb) return sa - sb;
      return a.label.localeCompare(b.label, "ja");
    });
    return withLabel;
  }, [equipments, getAssetNoLabel]);

  // === l2Hubs: equipments から category==="L2スイッチ・ハブ" のみ抽出（ONU／モバビジ機器用） ===
  const l2HubOptions = useMemo(() => {
    const src = (equipments || []).filter((e) => String(e?.raw?.category ?? "").trim() === "L2スイッチ・ハブ");
    const withLabel = src.map((e) => ({ ...e, label: getAssetNoLabel(e) }));
    withLabel.sort((a, b) => {
      const sa = Number(a.raw?.seqOrder ?? Number.MAX_SAFE_INTEGER);
      const sb = Number(b.raw?.seqOrder ?? Number.MAX_SAFE_INTEGER);
      if (sa !== sb) return sa - sb;
      return a.label.localeCompare(b.label, "ja");
    });
    return withLabel;
  }, [equipments, getAssetNoLabel]);

  // id から元 equipment を取得（注釈表示にも assetNo 表示を使用）
  const findEquipById = useCallback(
    (id?: string | null) => {
      if (!id) return null;
      return (equipments || []).find((e) => e.id === id) || null;
    },
    [equipments]
  );

  const slotAssignedLabel = useCallback(
    (slotId: string) => {
      const eqId = layout.slots?.[slotId]?.equipmentId || null;
      const option = findEquipById(eqId);
      if (!option) return eqId ?? "(未設定)";
      return getAssetNoLabel(option);
    },
    [layout.slots, findEquipById, getAssetNoLabel]
  );

  // クリック時：スロットの種別に応じて候補（ルーター／USBハブ／L2スイッチ・ハブ／サーバー）を決定
  const handleSlotClick = (slotId: string) => {
    setActiveSlotId(slotId);
    const eqId = layout.slots[slotId]?.equipmentId || null;

    const pool = isRouterSlot(slotId) ? routerOptions : isHubSlot(slotId) ? usbHubOptions : isL2HubSlot(slotId) ? l2HubOptions : serverOptions;

    const current = (pool || []).find((e) => e.id === eqId) || null;
    setSelectedEquip(current);
  };

  const handleSave = async () => {
    if (!activeSlotId) return;
    await assign(activeSlotId, selectedEquip?.id ?? null, currentUid ?? undefined);
    setActiveSlotId(null);
    setSelectedEquip(null);
  };

  const handleUnassign = async () => {
    if (!activeSlotId) return;
    await assign(activeSlotId, null, currentUid ?? undefined);
    setActiveSlotId(null);
    setSelectedEquip(null);
  };

  // ========= 共通：矩形描画 =========
  const Rect: React.FC<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    labelOverride?: string;
  }> = ({ id, x, y, w, h, labelOverride }) => {
    const assigned = layout.slots[id]?.equipmentId;
    const active = activeSlotId === id;
    return (
      <g onClick={() => handleSlotClick(id)} style={{ cursor: "pointer" }}>
        <rect x={x} y={y} width={w} height={h} rx={3} fill={active ? "#e3f2fd" : assigned ? "#f1f8e9" : "#fff"} stroke="#000" strokeWidth={1} />
        <text x={x + w / 2} y={y + h / 2} fontSize={6} fill="#d32f2f" textAnchor="middle" dominantBaseline="central">
          {labelOverride ?? layout.slots[id]?.label ?? id}
        </text>
      </g>
    );
  };

  // ========= 左面 =========
  const WL = 420;
  const Lx0 = 16,
    Ly0 = 16;
  const nwH = 20,
    nwW = 54,
    nwGap = 6;

  const nwLeftX = Lx0;
  const wifiY = Ly0 + 6;
  const wifiH = nwH * 2 + nwGap; // Wifiルータ2段分
  const yamahaY = wifiY + wifiH + nwGap;
  const yamahaH = nwH * 2 + nwGap; // ONU＋モバイル2段分
  const leftBlockWidth = nwW * 2 + nwGap;
  const rightColX = nwLeftX + leftBlockWidth + 12;
  const rightTopY = wifiY;

  const firstRowBottom = Math.max(yamahaY + yamahaH, rightTopY + nwH * 4 + nwGap * 3);
  const lSep1Y = firstRowBottom + 12; // 1段目下線

  // ラック寸法（横幅は thin 幅）
  const rackH = 90;
  const rackGapX = 24;
  const rackThinW = 40;

  // 2段目（left-13,14,15）
  const baseY13 = lSep1Y + 10;
  const x13 = Lx0 + 20;
  const x14 = x13 + rackThinW + rackGapX;
  const x15 = x14 + rackThinW + rackGapX;
  const lSep2Y = baseY13 + rackH + 20; // 2段目下線

  // 3段目（left-16,17,18）
  const baseY17 = lSep2Y + 10;
  const x16 = Lx0 + 20;
  const x17 = x16 + rackThinW + rackGapX;
  const x18 = x17 + rackThinW + rackGapX;
  const rackMidH = 90;
  const lSep3Y = baseY17 + rackMidH + 20; // 3段目下線

  // left-19（3段目・left-17の上）
  const rack19H = nwH; // HUBと同じ
  const idealY19 = baseY17 - rack19H - 8;
  const GAP_ABOVE_LINE = 6,
    GAP_BELOW_LINE = 6;
  const minY19 = lSep2Y + GAP_ABOVE_LINE;
  const maxY19 = lSep3Y - rack19H - GAP_BELOW_LINE;
  const y19 = Math.max(minY19, Math.min(idealY19, maxY19));

  // 4段目（left-20）
  const baseY20 = lSep3Y + 10;
  const x20 = x17; // 3段目中央列上
  const rack20H = 100;
  const lSep4Y = baseY20 + rack20H;
  const HL = lSep4Y + 16;

  // ========= 正面：左面に段を揃える ＋ 幅・間隔も統一 =========
  const Wf = 420;
  const marginX = 16;

  const fRackW = rackThinW; // = 40
  const fGapX = rackGapX; // = 24

  const row1Yf = Ly0 + 10;
  const row2Yf = lSep1Y + 10;
  const row3Yf = lSep2Y + 10;

  const rackHf = 90;
  const LOWER_BY = 6; // front-01/08/09 の微調整

  const r1x1 = marginX;
  const r1x2 = r1x1 + fRackW + fGapX;
  const r1x3 = r1x2 + fRackW + fGapX;
  const r1x4 = r1x3 + fRackW + fGapX;

  const r2x1 = marginX;
  const r2x2 = r2x1 + fRackW + fGapX;
  const r2x3 = r2x2 + fRackW + fGapX;
  const r2x4 = r2x3 + fRackW + fGapX;

  const r3x1 = marginX;
  const r3x2 = r3x1 + fRackW + fGapX;
  const r3x3 = r3x2 + fRackW + fGapX;
  const r3x4 = r3x3 + fRackW + fGapX;

  // ========= 段の注釈（横スペース表示） =========
  const annotateRow = (xRight: number, yTop: number, slotIds: string[]) => {
    const innerRight = Wf - marginX - 4;
    const ax = Math.min(innerRight, xRight + 8);
    const lineH = 9;
    return (
      <g>
        {slotIds.map((sid, i) => (
          <text key={sid} x={ax} y={yTop + 12 + i * lineH} fontSize={7} fill="#333" textAnchor="start">
            {sid}: {slotAssignedLabel(sid)}
          </text>
        ))}
      </g>
    );
  };

  const annotateLeftRow = (xRight: number, yTop: number, slotIds: string[]) => {
    const innerRight = WL - Lx0 - 4;
    const ax = Math.min(innerRight, xRight + 8);
    const lineH = 9;
    return (
      <g>
        {slotIds.map((sid, i) => (
          <text key={sid} x={ax} y={yTop + 12 + i * lineH} fontSize={7} fill="#333" textAnchor="start">
            {sid}: {slotAssignedLabel(sid)}
          </text>
        ))}
      </g>
    );
  };

  // ========= 全体 =========
  const panelGap = 24;
  const totalW = Wf + panelGap + WL;
  const totalH = Math.max(HL, lSep4Y + 20);
  const leftOriginX = Wf + panelGap;

  const SvgBoth: React.FC = () => (
    <svg width="100%" viewBox={`0 0 ${totalW} ${totalH}`} style={{ border: "1px solid #ddd", borderRadius: 6 }} preserveAspectRatio="xMidYMid meet">
      {/* ==== 正面 ==== */}
      <text x={marginX} y={10} fontSize={10} fill="#333">
        サーバ室 正面
      </text>

      {/* 1段目（front-01〜04） */}
      <Rect id="front-01" x={r1x1} y={row1Yf + LOWER_BY} w={fRackW} h={rackHf - LOWER_BY} />
      <Rect id="front-02" x={r1x2} y={row1Yf} w={fRackW} h={rackHf} />
      <Rect id="front-03" x={r1x3} y={row1Yf} w={fRackW} h={rackHf} />
      <Rect id="front-04" x={r1x4} y={row1Yf} w={fRackW} h={rackHf} />
      {annotateRow(r1x4 + fRackW, row1Yf, ["front-01", "front-02", "front-03", "front-04"])}
      <line x1={marginX} y1={lSep1Y} x2={Wf - marginX} y2={lSep1Y} stroke="#000" strokeWidth={1} />

      {/* 2段目（front-05〜08） */}
      <Rect id="front-05" x={r2x1} y={row2Yf} w={fRackW} h={rackHf} />
      <Rect id="front-06" x={r2x2} y={row2Yf} w={fRackW} h={rackHf} />
      <Rect id="front-07" x={r2x3} y={row2Yf} w={fRackW} h={rackHf} />
      <Rect id="front-08" x={r2x4} y={row2Yf + LOWER_BY} w={fRackW} h={rackHf - LOWER_BY} />
      {annotateRow(r2x4 + fRackW, row2Yf, ["front-05", "front-06", "front-07", "front-08"])}
      <line x1={marginX} y1={lSep2Y} x2={Wf - marginX} y2={lSep2Y} stroke="#000" strokeWidth={1} />

      {/* 3段目（front-09〜12） */}
      <Rect id="front-09" x={r3x1} y={row3Yf + LOWER_BY} w={fRackW} h={rackHf - LOWER_BY} />
      <Rect id="front-10" x={r3x2} y={row3Yf} w={fRackW} h={rackHf} />
      <Rect id="front-11" x={r3x3} y={row3Yf} w={fRackW} h={rackHf} />
      <Rect id="front-12" x={r3x4} y={row3Yf} w={fRackW} h={rackHf} />
      {annotateRow(r3x4 + fRackW, row3Yf, ["front-09", "front-10", "front-11", "front-12"])}
      <line x1={marginX} y1={lSep3Y} x2={Wf - marginX} y2={lSep3Y} stroke="#000" strokeWidth={1} />

      {/* 4段目（区切り線のみ） */}
      <line x1={marginX} y1={lSep4Y} x2={Wf - marginX} y2={lSep4Y} stroke="#000" strokeWidth={1} />

      {/* ==== 左面 ==== */}
      <g transform={`translate(${leftOriginX},0)`}>
        <text x={Lx0} y={10} fontSize={10} fill="#333">
          サーバ室 左面
        </text>

        {/* 上段（ネットワーク棚） */}
        <Rect id="left-net-01" x={nwLeftX} y={wifiY} w={nwW} h={wifiH} labelOverride="Wifiルータ" />
        <Rect id="left-net-02" x={nwLeftX + nwW + nwGap} y={wifiY} w={nwW} h={wifiH} labelOverride="旧Wifiルータ" />
        <Rect id="left-net-03" x={nwLeftX} y={yamahaY} w={nwW * 2 + nwGap} h={yamahaH} labelOverride="YAMAHA ルータ" />
        <Rect id="left-net-04" x={rightColX} y={rightTopY} w={nwW} h={nwH} labelOverride="HUB" />
        <Rect id="left-net-05" x={rightColX} y={rightTopY + (nwH + nwGap)} w={nwW} h={nwH} labelOverride="HUB" />
        <Rect id="left-net-06" x={rightColX} y={rightTopY + 2 * (nwH + nwGap)} w={nwW} h={nwH} labelOverride="ONU" />
        <Rect id="left-net-07" x={rightColX} y={rightTopY + 3 * (nwH + nwGap)} w={nwW} h={nwH} labelOverride="モバビジ機器" />

        {/* 左面1段目（ネットワーク棚）の割り当てリストを右横に表示 */}
        {annotateLeftRow(rightColX + nwW, wifiY, ["left-net-01", "left-net-02", "left-net-03", "left-net-04", "left-net-05", "left-net-06", "left-net-07"])}

        <line x1={Lx0} y1={lSep1Y} x2={WL - Lx0} y2={lSep1Y} stroke="#000" strokeWidth={1} />

        {/* 2段目（left-13〜15）＋注釈 */}
        <Rect id="left-13" x={x13} y={baseY13} w={rackThinW} h={rackH} labelOverride="left-13" />
        <Rect id="left-14" x={x14} y={baseY13} w={rackThinW} h={rackH} labelOverride="left-14" />
        <Rect id="left-15" x={x15} y={baseY13} w={rackThinW} h={rackH} labelOverride="left-15" />
        {annotateLeftRow(x15 + rackThinW, baseY13, ["left-13", "left-14", "left-15"])}
        <line x1={Lx0} y1={lSep2Y} x2={WL - Lx0} y2={lSep2Y} stroke="#000" strokeWidth={1} />

        {/* 3段目（left-16〜18・19）＋注釈 */}
        <Rect id="left-16" x={x16} y={baseY17} w={rackThinW} h={rackMidH} labelOverride="left-16" />
        <Rect id="left-17" x={x17} y={baseY17} w={rackThinW} h={rackMidH} labelOverride="left-17" />
        <Rect id="left-18" x={x18} y={baseY17} w={rackThinW} h={rackMidH} labelOverride="left-18" />
        <Rect id="left-19" x={x17} y={y19} w={rackThinW} h={rack19H} labelOverride="left-19" />
        {annotateLeftRow(x18 + rackThinW, baseY17, ["left-16", "left-17", "left-18", "left-19"])}
        <line x1={Lx0} y1={lSep3Y} x2={WL - Lx0} y2={lSep3Y} stroke="#000" strokeWidth={1} />

        {/* 4段目（left-20）＋注釈 */}
        <Rect id="left-20" x={x20} y={baseY20} w={rackThinW} h={rack20H} labelOverride="left-20" />
        {annotateLeftRow(x20 + rackThinW, baseY20, ["left-20"])}
        <line x1={Lx0} y1={lSep4Y} x2={WL - Lx0} y2={lSep4Y} stroke="#000" strokeWidth={1} />
      </g>
    </svg>
  );

  // === スロット種別に応じてオートコンプリートの候補・表示文言を切替 ===
  const optionPool = isRouterSlot(activeSlotId) ? routerOptions : isHubSlot(activeSlotId) ? usbHubOptions : isL2HubSlot(activeSlotId) ? l2HubOptions : serverOptions;

  const acLabel = isRouterSlot(activeSlotId)
    ? "割り当てる機器（assetNo／ルーターのみ）"
    : isHubSlot(activeSlotId)
    ? "割り当てる機器（assetNo／USBハブのみ）"
    : isL2HubSlot(activeSlotId)
    ? "割り当てる機器（assetNo／L2スイッチ・ハブのみ）"
    : "割り当てる機器（assetNo／サーバーのみ）";

  const noOptionsText = isRouterSlot(activeSlotId) ? "ルーターが見つかりません" : isHubSlot(activeSlotId) ? "USBハブが見つかりません" : isL2HubSlot(activeSlotId) ? "L2スイッチ・ハブが見つかりません" : "サーバーが見つかりません";

  const placeholder = "assetNo を選択";

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
        <DialogTitle>サーバ室</DialogTitle>
        <DialogContent dividers sx={{ pt: 1, overflowX: "hidden", overflowY: "auto" }}>
          {loading ? (
            <Box display="flex" alignItems="center" justifyContent="center" minHeight={240}>
              <CircularProgress />
            </Box>
          ) : (
            <SvgBoth />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 編集用ダイアログ（サーバー／ルーター／USBハブ／L2スイッチ・ハブに自動切替） */}
      <Dialog
        open={!!activeSlotId}
        onClose={() => {
          setActiveSlotId(null);
          setSelectedEquip(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>スロット編集</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              対象スロット：<b>{activeSlotId}</b>
            </Typography>
            <Autocomplete
              value={selectedEquip}
              onChange={(_, v) => setSelectedEquip(v)}
              options={optionPool}
              getOptionLabel={(o) => o?.label ?? ""}
              isOptionEqualToValue={(a, b) => a?.id === b?.id}
              noOptionsText={noOptionsText}
              renderInput={(params) => <TextField {...params} label={acLabel} size="small" placeholder={placeholder} />}
              clearOnBlur
              sx={{ maxWidth: 520 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setActiveSlotId(null);
              setSelectedEquip(null);
            }}
          >
            キャンセル
          </Button>
          <Button color="warning" onClick={handleUnassign}>
            割り当て解除
          </Button>
          <Button variant="contained" onClick={handleSave}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
