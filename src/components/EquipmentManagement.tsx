import React, { useMemo, useState } from "react";
import { Box, Stack, Tooltip, IconButton, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { Menu } from "../components/Menu";
import { useEquipments } from "../hooks/useEquipments";
import { useActiveUsers } from "../hooks/useActiveUsers";
import { EquipmentDoc, GridRow } from "../types/equipment";
import { CsvImport } from "../components/CsvImport";
import { EquipmentEditDialog } from "../components/EquipmentEditDialog";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";

const EquipmentManagement: React.FC = () => {
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false); // 全件置換確認
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const { activeUsers, activeUserRaw } = useActiveUsers();
  const { rowsRaw, gridRows, importing, progress, message, importCsv, pendingFileRef, updateOne, deleteOne, ymdToTimestamp } = useEquipments();

  const [selected, setSelected] = useState<{ docId: string; data: EquipmentDoc } | null>(null);

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

  // 保存
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

  // 削除
  const handleConfirmDelete = async () => {
    if (!selected) return;
    await deleteOne(selected.docId);
    setConfirmDeleteOpen(false);
    setOpenEdit(false);
  };

  // CSV: ファイル選択 → 確認 → 実行
  const handlePickCsv = (f: File) => {
    pendingFileRef.current = f;
    setConfirmOpen(true);
  };
  const handleConfirmReplace = async () => {
    const f = pendingFileRef.current;
    setConfirmOpen(false);
    if (f) await importCsv(f, activeUserRaw);
  };

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Menu />
      <Typography variant="h4" align="center" sx={{ borderBottom: 2, borderColor: "primary.dark", color: "primary.main", pb: 1 }}>
        機器管理台帳
      </Typography>

      <Box sx={{ px: 2, pt: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Tooltip title="新規登録" arrow>
            <IconButton color="primary" size="large" onClick={() => setOpenNew(true)}>
              <AddCircleOutlineIcon />
            </IconButton>
          </Tooltip>

          <CsvImport importing={importing} progress={progress} message={message} onPick={handlePickCsv} />
        </Stack>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", px: 2, pb: 2 }}>
        <DataGrid<GridRow>
          rows={gridRows}
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

      {/* 新規登録（プレースホルダー） */}
      <Dialog open={openNew} onClose={() => setOpenNew(false)} fullWidth maxWidth="md">
        <DialogTitle>機器 新規登録</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            新規登録フォームは次のステップで実装します。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNew(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

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
      <DeleteConfirmDialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} onOk={handleConfirmDelete} />

      {/* 全件置換の確認 */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>全件置換を実行しますか？</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">equipments コレクションを全削除して CSV の内容で再作成します。取り消しはできません。</Typography>
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
