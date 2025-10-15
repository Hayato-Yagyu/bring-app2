import React, { useMemo, useState } from "react";
import { Box, Stack, Tooltip, IconButton, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, Tabs, Tab } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import HistoryEduIcon from "@mui/icons-material/HistoryEdu";
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
import { useRevisionHistory } from "../hooks/useRevisionHistory";
import { RevisionHistoryListDialog } from "../components/RevisionHistoryListDialog";
import { ServerRoomDiagramDialog } from "../components/ServerRoomDiagramDialog";
import { auth } from "../firebase"; // ★ 追加
import LanIcon from "@mui/icons-material/Lan"; // 好きなアイコンでOK

const EquipmentManagement: React.FC = () => {
  // ----------------------------------------------------------------
  // 機器管理
  // ----------------------------------------------------------------
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [openServerRoom, setOpenServerRoom] = useState(false);

  const { activeUsers, activeUserRaw } = useActiveUsers();
  const { categories, loading } = useAssetCategoryList();
  const { rowsRaw, gridRows, importing, progress, message, importCsvForCategory, pendingFileRef, updateOne, deleteOne, ymdToTimestamp, createOne } = useEquipments();

  // ログイン中ユーザーUID（string | undefined）
  const currentUid = auth.currentUser?.uid;

  const [tabIndex, setTabIndex] = useState(0);
  const currentCategory = useMemo(() => {
    if (!categories.length) return { code: "PC", label: "パソコン" };
    return categories[Math.min(tabIndex, categories.length - 1)];
  }, [categories, tabIndex]);

  const [selected, setSelected] = useState<{ docId: string; data: EquipmentDoc } | null>(null);

  const filteredRows = useMemo(() => gridRows.filter((r) => r.category === currentCategory.label), [gridRows, currentCategory]);

  const nextSeq = useMemo(() => {
    const target = rowsRaw.filter((r) => r.data.category === currentCategory.label);
    if (!target.length) return 1;
    const nums = target.map((r) => r.data.seqOrder).filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    if (!nums.length) return target.length + 1;
    return Math.max(...nums) + 1;
  }, [rowsRaw, currentCategory]);

  const columns: GridColDef<GridRow>[] = useMemo(
    () => [
      { field: "seq", headerName: "No.", flex: 0.4 },
      { field: "acceptedDate", headerName: "受付日", flex: 0.7 },
      { field: "assetNo", headerName: "機器番号", flex: 1.0 },
      { field: "category", headerName: "機器分類", flex: 0.7 },
      { field: "branchNo", headerName: "枝番", flex: 0.6 },
      { field: "deviceName", headerName: "機器名", flex: 1.1 },
      { field: "updatedOn", headerName: "更新日", flex: 0.8 },
      { field: "confirmedOn", headerName: "確認日", flex: 0.8 },
      { field: "disposedOn", headerName: "廃棄日", flex: 0.8 },
      { field: "owner", headerName: "保有者", flex: 0.8 },
      { field: "status", headerName: "状態", flex: 0.8 },
      { field: "history", headerName: "保有履歴", flex: 1.2 },
      { field: "note", headerName: "備考", flex: 1.2 },
      { field: "location", headerName: "所在地", flex: 0.9 },
      { field: "lastEditor", headerName: "最終更新者", flex: 0.8 },
    ],
    []
  );

  const handleRowClick = (params: any) => {
    const hit = rowsRaw.find((r) => r.docId === params.id);
    if (!hit) return;
    setSelected({ docId: hit.docId, data: { ...hit.data } });
    setOpenEdit(true);
  };

  const handleEditChange = (key: keyof EquipmentDoc, value: string) => {
    if (!selected) return;
    if (key === "seqOrder") return;
    if (key === "acceptedDate" || key === "updatedOn" || key === "confirmedOn" || key === "disposedOn") {
      setSelected({
        ...selected,
        data: { ...selected.data, [key]: ymdToTimestamp(value) },
      });
      return;
    }
    setSelected({ ...selected, data: { ...selected.data, [key]: value } });
  };

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

  // CSVファイル読込確認
  const handlePickCsv = (f: File) => {
    pendingFileRef.current = f;
    setConfirmOpen(true);
  };

  const handleConfirmReplace = async () => {
    const f = pendingFileRef.current;
    setConfirmOpen(false);
    if (f) await importCsvForCategory(f, activeUserRaw, currentCategory.label);
  };

  const handleCreate = async (payload: EquipmentDoc) => {
    await createOne(payload);
    setOpenNew(false);
  };

  // ----------------------------------------------------------------
  // ★ 改訂履歴機能
  // ----------------------------------------------------------------
  const [openRevisionList, setOpenRevisionList] = useState(false);
  const { rowsForGrid: revisionRows, loading: revisionLoading, create, update, remove } = useRevisionHistory();

  // ----------------------------------------------------------------
  // レンダリング
  // ----------------------------------------------------------------
  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Menu />

      {/* タイトル + 右上ボタン */}
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
        <Box
          sx={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            gap: 1.5,
            alignItems: "center",
          }}
        >
          <AssetCategoryImportButton />
          {/* ★ サーバ室構成編集ボタン */}
          <Tooltip title="サーバ室構成を編集" arrow>
            <IconButton color="primary" size="large" onClick={() => setOpenServerRoom(true)}>
              <LanIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="改訂履歴の一覧・追加・編集" arrow>
            <IconButton color="primary" onClick={() => setOpenRevisionList(true)}>
              <HistoryEduIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Typography>

      {/* カテゴリタブ */}
      <Box>
        <Tabs
          value={Math.min(tabIndex, Math.max(0, categories.length - 1))}
          onChange={(_, v) => setTabIndex(v)}
          variant="scrollable"
          scrollButtons={false}
          allowScrollButtonsMobile={false}
          sx={{
            "& .MuiTab-root": {
              minWidth: 90,
              fontSize: "0.9rem",
              padding: "6px 12px",
              minHeight: 40,
              fontWeight: 500,
              textTransform: "none",
            },
            "& .MuiTabs-flexContainer": {
              justifyContent: "flex-start",
              flexWrap: "nowrap",
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

          {/* CSV置換 */}
          <CsvImport importing={importing} progress={progress} message={message} onPick={handlePickCsv} />
        </Stack>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", px: 2, pb: 2 }}>
        <DataGrid<GridRow>
          rows={filteredRows}
          columns={columns}
          autoHeight={false}
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

      {/* 各種ダイアログ */}
      <EquipmentCreateDialog open={openNew} onClose={() => setOpenNew(false)} onCreate={handleCreate} activeUsers={activeUsers} nextSeq={nextSeq} currentCategory={currentCategory} />

      <EquipmentEditDialog
        open={openEdit}
        selected={selected}
        onChange={handleEditChange}
        onClose={() => setOpenEdit(false)}
        onDeleteAsk={() => setConfirmDeleteOpen(true)}
        onSave={handleSave}
        activeUsers={activeUsers}
      />

      <DeleteConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onOk={async () => {
          if (selected) await deleteOne(selected.docId);
          setConfirmDeleteOpen(false);
          setOpenEdit(false);
        }}
      />

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>「{currentCategory.label}」を全件置換しますか？</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">「{currentCategory.label}」カテゴリの既存データを全削除して、選択した CSV の内容で再作成します。 取り消しはできません。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>キャンセル</Button>
          <Button onClick={handleConfirmReplace} color="error" variant="contained">
            実行する
          </Button>
        </DialogActions>
      </Dialog>

      <ServerRoomDiagramDialog
        open={openServerRoom}
        onClose={() => setOpenServerRoom(false)}
        // 機器候補としてサーバカテゴリを渡す（必要なら label で判定を調整）
        equipments={rowsRaw.filter((r) => r.data.category === "サーバー").map((r) => ({ id: r.docId, label: `${r.data.deviceName || r.data.assetNo || r.docId}`, raw: r }))}
        currentUid={currentUid}
      />

      {/* 改訂履歴ダイアログ */}
      <RevisionHistoryListDialog
        open={openRevisionList}
        onClose={() => setOpenRevisionList(false)}
        rows={revisionRows}
        loading={revisionLoading}
        authors={activeUsers}
        onCreate={async (v) =>
          await create({
            no: v.no,
            content: v.content,
            createdAtYmd: v.createdAtYmd,
            author: v.author,
            createdBy: currentUid ?? undefined, // null → undefined
          })
        }
        onUpdate={async (id, v) =>
          await update(id, {
            no: v.no,
            content: v.content,
            createdAtYmd: v.createdAtYmd,
            author: v.author,
            updatedBy: currentUid ?? undefined, // null → undefined
          })
        }
        onDelete={async (id) => {
          if (window.confirm("この改訂履歴を削除します。よろしいですか？")) {
            await remove(id);
          }
        }}
      />
    </Box>
  );
};

export default EquipmentManagement;
