// src/components/EquipmentManagement.tsx
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
import { auth, db } from "../firebase";
import { FloorLayoutDialog } from "../components/FloorLayoutDialog";
import LanIcon from "@mui/icons-material/Lan";
import DomainIcon from "@mui/icons-material/Domain";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { ymdToTimestamp } from "../utils/datetime";

const EquipmentManagement: React.FC = () => {
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [openServerRoom, setOpenServerRoom] = useState(false);
  const [openFloor, setOpenFloor] = useState(false);

  const { activeUsers, activeUserRaw } = useActiveUsers();
  const { categories, loading } = useAssetCategoryList();
  const { rowsRaw, gridRows, importing, progress, message, importCsvForCategory, pendingFileRef, updateOne, deleteOne, createOne } = useEquipments();

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

  // ===== DataGrid columns =====
  const columns: GridColDef<GridRow>[] = useMemo(() => {
    const base: GridColDef<GridRow>[] = [
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
    ];

    if (currentCategory.label === "USBハブ") {
      const usbCols: GridColDef<GridRow>[] = [
        ...base.slice(0, -1),
        { field: "hdmi", headerName: "HDMI", flex: 0.6 },
        { field: "usbA", headerName: "USB A", flex: 0.6 },
        { field: "usbC", headerName: "USB C", flex: 0.6 },
        { field: "lan", headerName: "LAN", flex: 0.6 },
        { field: "lastEditor", headerName: "最終更新者", flex: 0.8 },
      ];
      return usbCols;
    }

    if (currentCategory.label === "ディスプレイ") {
      const displayCols = base.slice();
      const historyIdx = displayCols.findIndex((c) => c.field === "history");

      const seatCol: GridColDef<GridRow> = {
        field: "seatNo",
        headerName: "座席",
        flex: 0.5,
        align: "center",
        headerAlign: "center",
        renderCell: (params: any) => {
          const id = (params?.id ?? params?.row?.id) as string | undefined;
          const doc = id ? rowsRaw.find((r) => r.docId === id) : undefined;
          const n = doc?.data?.seatNo;
          return typeof n === "number" ? String(n) : "";
        },
      };

      displayCols.splice(historyIdx + 1, 0, seatCol);
      return displayCols;
    }

    return base;
  }, [currentCategory.label, rowsRaw]);

  const handleRowClick = (params: any) => {
    const id = params?.id ?? params?.row?.id;
    const hit = rowsRaw.find((r) => r.docId === String(id));
    if (!hit) return;
    setSelected({ docId: hit.docId, data: { ...hit.data } });
    setOpenEdit(true);
  };

  const handleEditChange = (key: keyof EquipmentDoc, value: string | number | null) => {
    if (!selected) return;
    if (key === "seqOrder") return;

    if (key === "acceptedDate" || key === "updatedOn" || key === "confirmedOn" || key === "disposedOn") {
      setSelected((prev) => (prev ? { ...prev, data: { ...prev.data, [key]: value ? ymdToTimestamp(String(value)) : null } } : prev));
      return;
    }

    if (key === "seatNo") {
      const v = value == null || value === "" ? null : Number(value);
      setSelected((prev) => (prev ? { ...prev, data: { ...prev.data, seatNo: v } } : prev));
      return;
    }

    setSelected((prev) => (prev ? { ...prev, data: { ...prev.data, [key]: value as string } } : prev));
  };

  const handleSave = async () => {
    if (!selected) return;
    const payload: EquipmentDoc = {
      ...selected.data,
      acceptedDate: selected.data.acceptedDate ?? null,
      updatedOn: selected.data.updatedOn ?? null,
      confirmedOn: selected.data.confirmedOn ?? null,
      disposedOn: selected.data.disposedOn ?? null,
      seatNo: selected.data.seatNo == null ? null : Number(selected.data.seatNo),
    };
    await updateOne(selected.docId, payload);
    setOpenEdit(false);
  };

  // ✅ 新規登録処理
  const handleCreate = async (payload: EquipmentDoc) => {
    await createOne(payload);
    setOpenNew(false);
  };

  const handlePickCsv = (f: File) => {
    pendingFileRef.current = f;
    setConfirmOpen(true);
  };

  // フロアレイアウト：不足座席の自動補完
  const handleOpenFloor = async () => {
    try {
      const snap = await getDocs(collection(db, "seatMasters"));
      const exists = new Set(snap.docs.map((d) => d.id));
      const missing: number[] = [];
      for (let i = 1; i <= 26; i++) {
        if (!exists.has(String(i))) missing.push(i);
      }
      if (missing.length > 0) {
        const go = window.confirm(`座席マスタに不足 (${missing.length}) があります。追加しますか？\n[不足番号] ${missing.join(", ")}`);
        if (go) {
          const batch = writeBatch(db);
          for (const n of missing) {
            batch.set(doc(db, "seatMasters", String(n)), { number: n, label: String(n), enabled: true });
          }
          await batch.commit();
          alert("不足分の座席マスタを追加しました。");
        }
      }
      setOpenFloor(true);
    } catch (e) {
      console.error(e);
      alert("座席マスタの確認/更新でエラーが発生しました。");
      setOpenFloor(true);
    }
  };

  const [openRevisionList, setOpenRevisionList] = useState(false);
  const { rowsForGrid: revisionRows, loading: revisionLoading, create, update, remove } = useRevisionHistory();

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Menu />

      {/* タイトルバー */}
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
          <Tooltip title="フロアレイアウト" arrow>
            <IconButton color="primary" size="large" onClick={handleOpenFloor}>
              <DomainIcon />
            </IconButton>
          </Tooltip>
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
          sx={{ "& .MuiTab-root": { minWidth: 90, fontSize: "0.9rem", minHeight: 40, fontWeight: 500 } }}
        >
          {loading ? <Tab label="読み込み中…" /> : categories.map((c) => <Tab key={c.code} label={c.label} />)}
        </Tabs>
      </Box>

      {/* 新規ボタン＋CSV */}
      <Box>
        <Stack direction="row">
          <Tooltip title={`${currentCategory.label} を新規登録`} arrow>
            <IconButton color="primary" size="large" onClick={() => setOpenNew(true)}>
              <AddCircleOutlineIcon />
            </IconButton>
          </Tooltip>
          <CsvImport importing={importing} progress={progress} message={message} onPick={handlePickCsv} />
        </Stack>
      </Box>

      {/* 一覧 */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", px: 2, pb: 2 }}>
        <DataGrid<GridRow>
          rows={filteredRows}
          columns={columns}
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
            "& .MuiDataGrid-columnHeaderTitle": { whiteSpace: "pre-line", lineHeight: 1.1 },
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
        activeTab={currentCategory.label}
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

      {/* CSV置換確認 */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>「{currentCategory.label}」を全件置換しますか？</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">「{currentCategory.label}」カテゴリの既存データを全削除して、 選択した CSV の内容で再作成します。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>キャンセル</Button>
          <Button
            onClick={async () => {
              const f = pendingFileRef.current;
              setConfirmOpen(false);
              if (f) await importCsvForCategory(f, activeUserRaw, currentCategory.label);
            }}
            color="error"
            variant="contained"
          >
            実行する
          </Button>
        </DialogActions>
      </Dialog>

      <FloorLayoutDialog open={openFloor} onClose={() => setOpenFloor(false)} src="/floor-layout.png" />

      <ServerRoomDiagramDialog
        open={openServerRoom}
        onClose={() => setOpenServerRoom(false)}
        equipments={rowsRaw.map((r) => ({
          id: r.docId,
          label: r.data.assetNo ?? "",
          raw: r.data,
        }))}
        currentUid={currentUid}
      />

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
            createdBy: currentUid ?? undefined,
          })
        }
        onUpdate={async (id, v) =>
          await update(id, {
            no: v.no,
            content: v.content,
            createdAtYmd: v.createdAtYmd,
            author: v.author,
            updatedBy: currentUid ?? undefined,
          })
        }
        onDelete={async (id) => {
          if (window.confirm("この改訂履歴を削除します。よろしいですか？")) await remove(id);
        }}
      />
    </Box>
  );
};

export default EquipmentManagement;
