import React, { useMemo, useState } from "react";
import { Box, Stack, Tooltip, IconButton, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, Tabs, Tab } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { Menu } from "../components/Menu";
import { useEquipments } from "../hooks/useEquipments";
import { useActiveUsers } from "../hooks/useActiveUsers";
import { EquipmentDoc, GridRow } from "../types/equipment";
import { CsvImport } from "../components/CsvImport";
import { EquipmentEditDialog } from "../components/EquipmentEditDialog";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";
import { EquipmentCreateDialog } from "../components/EquipmentCreateDialog";
import { AssetCategoryImportButton } from "../components/AssetCategoryImportButton";
import { useAssetCategoryList } from "../hooks/useAssetCategories";

const EquipmentManagement: React.FC = () => {
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false); // CSV全件置換（カテゴリ単位）
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const { activeUsers, activeUserRaw } = useActiveUsers();
  const { categories, loading } = useAssetCategoryList();
  const { rowsRaw, gridRows, importing, progress, message, importCsvForCategory, pendingFileRef, updateOne, deleteOne, ymdToTimestamp, createOne } = useEquipments();

  // ★ 選択中カテゴリ（初期は先頭）
  const [tabIndex, setTabIndex] = useState(0);
  const currentCategory = useMemo(() => {
    if (!categories.length) return { code: "PC", label: "パソコン" };
    return categories[Math.min(tabIndex, categories.length - 1)];
  }, [categories, tabIndex]);

  const [selected, setSelected] = useState<{ docId: string; data: EquipmentDoc } | null>(null);

  // 現在カテゴリのみ表示
  const filteredRows = useMemo(() => gridRows.filter((r) => r.category === currentCategory.label), [gridRows, currentCategory]);

  // ★ 現在の最終No.（seqOrder）から nextSeq（最終+1）を算出（カテゴリ内で計算）
  const nextSeq = useMemo(() => {
    const target = rowsRaw.filter((r) => r.data.category === currentCategory.label);
    if (!target.length) return 1;
    const nums = target.map((r) => r.data.seqOrder).filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    if (!nums.length) return target.length + 1;
    return Math.max(...nums) + 1;
  }, [rowsRaw, currentCategory]);

  const columns: GridColDef<GridRow>[] = useMemo(
    () => [
      { field: "seq", headerName: "No.", flex: 0.4, sortable: false },
      { field: "acceptedDate", headerName: "受付日", flex: 0.7, sortable: false },
      { field: "assetNo", headerName: "機器番号", flex: 1.0, sortable: false },
      { field: "category", headerName: "機器分類", flex: 0.7, sortable: false },
      { field: "branchNo", headerName: "枝番", flex: 0.6, sortable: false },
      { field: "deviceName", headerName: "機器名", flex: 1.1, sortable: false },
      { field: "updatedOn", headerName: "更新日", flex: 0.8, sortable: false },
      { field: "confirmedOn", headerName: "確認日", flex: 0.8, sortable: false },
      { field: "disposedOn", headerName: "廃棄日", flex: 0.8, sortable: false },
      { field: "owner", headerName: "保有者", flex: 0.8, sortable: false },
      { field: "status", headerName: "状態", flex: 0.8, sortable: false },
      { field: "history", headerName: "保有履歴", flex: 1.2, sortable: false },
      { field: "note", headerName: "備考", flex: 1.2, sortable: false },
      { field: "location", headerName: "所在地", flex: 0.9, sortable: false },
      { field: "lastEditor", headerName: "最終更新者", flex: 0.8, sortable: false },
    ],
    []
  );

  // 行クリック → 編集
  const handleRowClick = (params: any) => {
    const hit = rowsRaw.find((r) => r.docId === params.id);
    if (!hit) return;
    setSelected({ docId: hit.docId, data: { ...hit.data } });
    setOpenEdit(true);
  };

  // 編集ダイアログの値変更
  const handleEditChange = (key: keyof EquipmentDoc, value: string) => {
    if (!selected) return;
    if (key === "seqOrder") return;
    if (key === "acceptedDate" || key === "updatedOn" || key === "confirmedOn" || key === "disposedOn") {
      setSelected({ ...selected, data: { ...selected.data, [key]: ymdToTimestamp(value) } });
      return;
    }
    setSelected({ ...selected, data: { ...selected.data, [key]: value } });
  };

  // 編集保存
  const handleSave = async () => {
    if (!selected) return;
    const payload: EquipmentDoc = {
      ...selected.data,
      acceptedDate: selected.data.acceptedDate ?? null,
      updatedOn: selected.data.updatedOn ?? null,
      confirmedOn: selected.data.confirmedOn ?? null,
      disposedOn: selected.data.disposedOn ?? null,
      assetNo: selected.data.assetNo ?? "",
      category: selected.data.category ?? "",
      branchNo: selected.data.branchNo ?? "",
      deviceName: selected.data.deviceName ?? "",
      owner: selected.data.owner ?? "",
      status: selected.data.status ?? "",
      history: selected.data.history ?? "",
      note: selected.data.note ?? "",
      location: selected.data.location ?? "",
      lastEditor: selected.data.lastEditor ?? "",
      seqOrder: selected.data.seqOrder ?? null,
    };
    await updateOne(selected.docId, payload);
    setOpenEdit(false);
  };

  // CSV: ファイル選択 → カテゴリ内全件置換
  const handlePickCsv = (f: File) => {
    pendingFileRef.current = f;
    setConfirmOpen(true);
  };
  const handleConfirmReplace = async () => {
    const f = pendingFileRef.current;
    setConfirmOpen(false);
    if (f) await importCsvForCategory(f, activeUserRaw, currentCategory.label);
  };

  // 新規登録保存
  const handleCreate = async (payload: EquipmentDoc) => {
    await createOne(payload);
    setOpenNew(false);
  };

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Menu />

      {/* タイトル + 右端インポートボタン */}
      <Typography
        variant="h4"
        align="center"
        sx={{
          borderBottom: 2,
          borderColor: "primary.dark",
          color: "primary.main",
          pb: 1,
          position: "relative",
        }}
      >
        機器管理台帳
        <Box sx={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)" }}>
          <AssetCategoryImportButton />
        </Box>
      </Typography>

      {/* カテゴリタブ */}
      <Box>
        <Tabs
          value={Math.min(tabIndex, Math.max(0, categories.length - 1))}
          onChange={(_, v) => setTabIndex(v)}
          variant="scrollable"
          scrollButtons={false} // ← 矢印を非表示
          allowScrollButtonsMobile={false}
          sx={{
            "& .MuiTab-root": {
              minWidth: 90,
              fontSize: "0.9rem",
              padding: "6px 12px",
              minHeight: 40, // ← タブの高さも上げてバランス取り
              fontWeight: 500, // ← 少し太めで視認性を上げる
              textTransform: "none", // ← 全角英字や日本語に自然な表記
            },
            "& .MuiTabs-flexContainer": {
              justifyContent: "flex-start", // ★ 左詰めに変更！
              flexWrap: "nowrap", // 1行に収める
            },
          }}
        >
          {loading ? <Tab label="読み込み中…" /> : categories.map((c) => <Tab key={c.code} label={c.label} />)}
        </Tabs>
      </Box>

      <Box>
        <Stack direction="row">
          <Tooltip title={`${currentCategory.label} を新規登録`} arrow>
            <IconButton color="primary" size="large" onClick={() => setOpenNew(true)}>
              <AddCircleOutlineIcon />
            </IconButton>
          </Tooltip>

          {/* カテゴリ単位のCSV置換 */}
          <CsvImport importing={importing} progress={progress} message={message} onPick={handlePickCsv} />
        </Stack>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", px: 2, pb: 2 }}>
        <DataGrid<GridRow>
          rows={filteredRows}
          columns={columns}
          autoHeight={false}
          sortModel={[]}
          disableColumnMenu
          disableColumnSelector
          disableDensitySelector
          disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 100 } } }}
          pageSizeOptions={[50, 100, 200]}
          rowHeight={38}
          onRowClick={handleRowClick}
          sx={{
            flex: 1,
            border: "1px solid #ddd",
            "& .MuiDataGrid-columnHeaders": { backgroundColor: "#f9f9f9" },
            "& .MuiDataGrid-virtualScroller": { overflowX: "hidden !important" },
          }}
        />
      </Box>

      {/* 新規登録ダイアログ（カテゴリ & nextSeq を渡す） */}
      <EquipmentCreateDialog
        open={openNew}
        onClose={() => setOpenNew(false)}
        onCreate={handleCreate}
        activeUsers={activeUsers}
        nextSeq={nextSeq}
        currentCategory={currentCategory} // ★ 追加
      />

      {/* 編集ダイアログ */}
      <EquipmentEditDialog
        open={openEdit}
        selected={selected}
        onChange={handleEditChange}
        onClose={() => setOpenEdit(false)}
        onDeleteAsk={() => setConfirmDeleteOpen(true)}
        onSave={handleSave}
        activeUsers={activeUsers}
      />

      {/* レコード削除の確認 */}
      <DeleteConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onOk={async () => {
          /* 編集側の削除 */ await (selected && deleteOne(selected.docId));
          setConfirmDeleteOpen(false);
          setOpenEdit(false);
        }}
      />

      {/* カテゴリCSV全件置換の確認 */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>「{currentCategory.label}」を全件置換しますか？</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">「{currentCategory.label}」カテゴリの既存データを全削除して、選択した CSV の内容で再作成します。取り消しはできません。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>キャンセル</Button>
          <Button onClick={handleConfirmReplace} color="error" variant="contained">
            実行する
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EquipmentManagement;
