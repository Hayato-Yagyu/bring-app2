// src/components/EquipmentManagement.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Stack, Tooltip, IconButton, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, LinearProgress, TextField, MenuItem } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { collection, onSnapshot, orderBy, query, setDoc, doc, getDocs, writeBatch, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Menu } from "../components/Menu";
import * as Papa from "papaparse";

// ================= 定数 =================
const STATUS_OPTIONS = ["未使用", "使用中", "廃棄", "所在不明"] as const;

// ================= 型定義 =================
type EquipmentDoc = {
  id?: string | null;
  assetNo?: string | null;
  category?: string | null;
  branchNo?: string | null;
  deviceName?: string | null;

  acceptedDate?: Timestamp | null;
  updatedOn?: Timestamp | null;
  confirmedOn?: Timestamp | null;
  disposedOn?: Timestamp | null;

  owner?: string | null;
  status?: string | null;
  history?: string | null;
  note?: string | null;
  location?: string | null;
  lastEditor?: string | null;

  seqOrder?: number | null; // No.
};

type Row = {
  id: string;
  seq: string;
  acceptedDate: string;
  assetNo: string;
  category: string;
  branchNo: string;
  deviceName: string;
  updatedOn: string;
  confirmedOn: string;
  disposedOn: string;
  owner: string;
  status: string;
  history: string;
  note: string;
  location: string;
  lastEditor: string;
};

type UserDoc = {
  staffcode?: string | null;
  displayName?: string | null;
  email?: string | null;
  startDate?: string | Timestamp | null;
  endDate?: string | Timestamp | null;
};

// ================= ユーティリティ関数 =================
const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const clean = (v: unknown): string => {
  const s = String(v ?? "");
  return s
    .replace(/\uFEFF/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\u3000/g, " ")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .trim();
};
const toStrBlank = (v: unknown): string => clean(v);
const toInt = (v: unknown): number | undefined => {
  const s = clean(v).replace(/[, ]/g, "");
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

// 任意 → Date|null（users.startDate/endDate用）
const anyToDate = (v: string | Timestamp | null | undefined): Date | null => {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  const s = clean(v);
  if (!s) return null;
  const m = s.match(/^(\d{2,4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m) {
    const y = Number(m[1].length === 2 ? "20" + m[1] : m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
};

// CSV文字列/Excelシリアル → Timestamp|null
const toTimestamp = (v: unknown): Timestamp | null => {
  const s = clean(v);
  if (!s) return null;

  const m = s.match(/^(\d{2,4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m) {
    const y = Number(m[1].length === 2 ? "20" + m[1] : m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    return isNaN(dt.getTime()) ? null : Timestamp.fromDate(dt);
  }

  if (/^\d{3,6}$/.test(s)) {
    const n = Number(s);
    if (n > 20000 && n < 60000) {
      const base = new Date(1899, 11, 30);
      const dt = new Date(base.getTime() + n * 86400000);
      return Timestamp.fromDate(dt);
    }
  }

  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : Timestamp.fromDate(parsed);
};

// Timestamp → "YYYY/MM/DD"
const tsToSlash = (ts?: Timestamp | null): string => (ts ? `${ts.toDate().getFullYear()}/${ts.toDate().getMonth() + 1}/${ts.toDate().getDate()}` : "");

// Timestamp → "YYYY-MM-DD"（<input type="date"> 用）
const tsToYMD = (ts?: Timestamp | null): string => {
  if (!ts) return "";
  const d = ts.toDate();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

// "YYYY-MM-DD" → Timestamp|null
const ymdToTimestamp = (s: string): Timestamp | null => {
  const c = clean(s);
  if (!c) return null;
  const m = c.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(dt.getTime()) ? null : Timestamp.fromDate(dt);
};

const hasMeaningfulValue = (o: Record<string, any>) => {
  const ignore = new Set(["seq", "id", "seqOrder"]);
  return Object.entries(o).some(([_, v]) => {
    if (ignore.has(_)) return false;
    if (v == null) return false;
    if (v instanceof Timestamp) return true;
    if (typeof v === "string") return v.trim() !== "";
    return true;
  });
};

// 当日有効判定
const isActiveToday = (u: UserDoc, today: Date): boolean => {
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = anyToDate(u.startDate);
  const end = anyToDate(u.endDate);
  const startOk = !start || start <= dayStart;
  const endOk = !end || end >= dayStart;
  return startOk && endOk;
};

// 苗字っぽい入力 → users から displayName を解決
const normalizeSurname = (s: string): string => {
  return clean(
    s
      .replace(/（.*?）/g, "")
      .replace(/\(.*?\)/g, "")
      .replace(/[様さんくんちゃん殿氏]/g, "")
  )
    .split(/\s+/)[0]
    .split("　")[0];
};

const resolveNameFromUsers = (raw: string, users: UserDoc[]): string => {
  const inStr = clean(raw);
  if (!inStr) return "";
  const key = normalizeSurname(inStr);
  if (!key) return inStr;

  const hit = users.find((u) => {
    const dn = clean(u.displayName ?? "");
    if (dn && dn.startsWith(key)) return true;
    const sc = clean(u.staffcode ?? "");
    if (sc === key) return true;
    const emailLeft = clean(u.email ?? "").split("@")[0];
    if (emailLeft && emailLeft.startsWith(key)) return true;
    return false;
  });

  return hit?.displayName ? clean(hit.displayName) : inStr;
};

// ================= メインコンポーネント =================
const EquipmentManagement: React.FC = () => {
  const [rowsRaw, setRowsRaw] = useState<Array<{ docId: string; data: EquipmentDoc }>>([]);
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [selected, setSelected] = useState<{ docId: string; data: EquipmentDoc } | null>(null);

  // users（当日有効）
  const [activeUsers, setActiveUsers] = useState<Array<{ key: string; label: string }>>([]);
  const [activeUserRaw, setActiveUserRaw] = useState<UserDoc[]>([]);

  // インポートUI・メッセージ
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false); // 全件置換
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false); // 削除確認 ←★ ここだけで宣言
  const pendingFileRef = useRef<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // equipments購読（No順）
  useEffect(() => {
    const qEq = query(collection(db, "equipments"), orderBy("seqOrder", "asc"));
    const unsubEq = onSnapshot(qEq, (snap) => {
      const list = snap.docs.map((d) => ({ docId: d.id, data: d.data() as EquipmentDoc }));
      setRowsRaw(list);
    });
    return () => unsubEq();
  }, []);

  // users購読（staffcode昇順）→ 当日有効のみ抽出
  useEffect(() => {
    const qUsers = query(collection(db, "users"), orderBy("staffcode", "asc"));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const today = new Date();
      const items: Array<{ key: string; label: string }> = [];
      const raws: UserDoc[] = [];

      snap.docs.forEach((d) => {
        const u = d.data() as UserDoc;
        if (!isActiveToday(u, today)) return;

        const staff = (u.staffcode ?? "").trim();
        const name = (u.displayName ?? "").trim();
        const email = (u.email ?? "").trim();

        const label = [staff, name].filter(Boolean).join(" ") + (email ? `（${email}）` : "");
        const key = name || email || staff || "";
        if (key) {
          items.push({ key, label });
          raws.push({ staffcode: staff, displayName: name, email, startDate: u.startDate ?? null, endDate: u.endDate ?? null });
        }
      });

      setActiveUsers(items);
      setActiveUserRaw(raws);
    });
    return () => unsubUsers();
  }, []);

  // DataGrid 行データ（Timestamp を表示文字列に）
  const gridRows: Row[] = useMemo(
    () =>
      rowsRaw.map(({ docId, data }, idx) => {
        const n = data.seqOrder ?? idx + 1;
        return {
          id: docId,
          seq: pad2(n),
          acceptedDate: tsToSlash(data.acceptedDate),
          assetNo: data.assetNo ?? "",
          category: data.category ?? "",
          branchNo: data.branchNo ?? "",
          deviceName: data.deviceName ?? "",
          updatedOn: tsToSlash(data.updatedOn),
          confirmedOn: tsToSlash(data.confirmedOn),
          disposedOn: tsToSlash(data.disposedOn),
          owner: data.owner ?? "",
          status: data.status ?? "",
          history: data.history ?? "",
          note: data.note ?? "",
          location: data.location ?? "",
          lastEditor: data.lastEditor ?? "",
        };
      }),
    [rowsRaw]
  );

  // 列定義
  const columns: GridColDef<Row>[] = [
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
  ];

  // ================= CSVインポート（常に全削除→再取込） =================
  const deleteAllEquipments = async () => {
    const snap = await getDocs(collection(db, "equipments"));
    const docs = snap.docs;
    const DEL_CHUNK = 400;
    for (let i = 0; i < docs.length; i += DEL_CHUNK) {
      const batch = writeBatch(db);
      docs.slice(i, i + DEL_CHUNK).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  };

  const importCsv = async (file: File) => {
    setImporting(true);
    setProgress(0);
    setMessage(null);
    try {
      const parsed = await new Promise<Papa.ParseResult<string[]>>((resolve, reject) => {
        Papa.parse<string[]>(file, {
          header: false,
          skipEmptyLines: "greedy",
          transform: (value) => clean(value),
          complete: (res) => resolve(res as any),
          error: (err) => reject(err),
        });
      });

      let rows = (parsed.data as unknown as string[][]).map((cols) => cols.map((c) => clean(c)));
      if (rows.length && /^no\.?$/i.test(rows[0][0] ?? "")) rows = rows.slice(1);
      if (!rows.length) throw new Error("CSVに有効な行がありません。");

      const resolvePerson = (v: unknown) => resolveNameFromUsers(toStrBlank(v), activeUserRaw);

      setMessage("既存データを全削除中…");
      await deleteAllEquipments();

      const IDX = {
        no: 0,
        acceptedDate: 1,
        assetNo: 2,
        category: 3,
        branchNo: 4,
        deviceName: 5,
        updatedOn: 6,
        confirmedOn: 7,
        disposedOn: 8,
        owner: 9,
        status: 10,
        history: 11,
        note: 12,
        location: 13,
        lastEditor: 14,
      } as const;

      const toWrite: Array<{ data: Partial<EquipmentDoc> }> = [];
      rows.forEach((cols, i) => {
        const c = (k: number) => clean(cols[k] ?? "");
        const seqFromCsv = toInt(c(IDX.no));
        const data: Partial<EquipmentDoc> = {
          seqOrder: seqFromCsv ?? i + 1,
          acceptedDate: toTimestamp(c(IDX.acceptedDate)),
          assetNo: toStrBlank(c(IDX.assetNo)),
          category: toStrBlank(c(IDX.category)),
          branchNo: toStrBlank(c(IDX.branchNo)),
          deviceName: toStrBlank(c(IDX.deviceName)),
          updatedOn: toTimestamp(c(IDX.updatedOn)),
          confirmedOn: toTimestamp(c(IDX.confirmedOn)),
          disposedOn: toTimestamp(c(IDX.disposedOn)),
          owner: resolvePerson(c(IDX.owner)),
          status: toStrBlank(c(IDX.status)),
          history: toStrBlank(c(IDX.history)),
          note: toStrBlank(c(IDX.note)),
          location: toStrBlank(c(IDX.location)),
          lastEditor: resolvePerson(c(IDX.lastEditor)),
        };
        if (hasMeaningfulValue(data)) toWrite.push({ data });
      });

      const CHUNK = 300;
      for (let i = 0; i < toWrite.length; i += CHUNK) {
        const slice = toWrite.slice(i, i + CHUNK);
        await Promise.all(slice.map(async ({ data }) => setDoc(doc(collection(db, "equipments")), data)));
        setProgress(Math.round(Math.min(100, ((i + CHUNK) / toWrite.length) * 100)));
      }

      setMessage("全件置換が完了しました。");
    } catch (e: any) {
      setMessage(e?.message ?? "CSVインポートに失敗しました。");
    } finally {
      setImporting(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // ================= 編集・削除 =================
  const handleRowClick = (params: any) => {
    const hit = rowsRaw.find((r) => r.docId === params.id);
    if (!hit) return;
    setSelected({ docId: hit.docId, data: { ...hit.data } });
    setOpenEdit(true);
  };

  const handleEditChange = (key: keyof EquipmentDoc, value: string) => {
    if (!selected) return;
    if (key === "seqOrder") return; // No. は編集不可
    if (key === "acceptedDate" || key === "updatedOn" || key === "confirmedOn" || key === "disposedOn") {
      setSelected({ ...selected, data: { ...selected.data, [key]: ymdToTimestamp(value) } });
      return;
    }
    setSelected({ ...selected, data: { ...selected.data, [key]: toStrBlank(value) } });
  };

  const handleSave = async () => {
    if (!selected) return;
    const ref = doc(db, "equipments", selected.docId);
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
    await updateDoc(ref, payload as any);
    setOpenEdit(false);
  };

  const handleConfirmDelete = async () => {
    if (!selected) return;
    await deleteDoc(doc(db, "equipments", selected.docId));
    setConfirmDeleteOpen(false);
    setOpenEdit(false);
  };

  // ================= ファイル選択（全件置換） =================
  const onClickImport = () => fileRef.current?.click();
  const onChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0] || null;
    e.currentTarget.value = "";
    if (!f) return;
    setConfirmOpen(true);
    pendingFileRef.current = f;
  };
  const handleConfirmReplace = () => {
    const f = pendingFileRef.current;
    setConfirmOpen(false);
    if (f) importCsv(f);
    pendingFileRef.current = null;
  };

  // ================= レンダリング =================
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

          <Tooltip title="CSVからインポート（全件置換）" arrow>
            <span>
              <IconButton color="primary" size="large" onClick={onClickImport} disabled={importing}>
                <FileUploadIcon />
              </IconButton>
            </span>
          </Tooltip>

          <input type="file" ref={fileRef} hidden accept=".csv,text/csv" onChange={onChangeFile} />
        </Stack>
      </Box>

      {importing && (
        <Box sx={{ px: 2, pb: 1 }}>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="caption">
            {progress}% {message ?? ""}
          </Typography>
        </Box>
      )}
      {!importing && message && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography variant="caption">{message}</Typography>
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", px: 2, pb: 2 }}>
        <DataGrid<Row>
          rows={gridRows}
          columns={columns}
          autoHeight={false}
          sortModel={[]}
          disableColumnMenu
          disableColumnSelector
          disableDensitySelector
          disableRowSelectionOnClick
          initialState={{
            pagination: { paginationModel: { pageSize: 100 } },
          }}
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
      <Dialog open={openEdit} onClose={() => setOpenEdit(false)} fullWidth maxWidth="sm">
        <DialogTitle>機器情報 編集</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Box component="form" sx={{ "& .MuiTextField-root": { my: 0.25 } }}>
              <Stack direction="column" spacing={0.5}>
                <TextField
                  label="No."
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ readOnly: true }}
                  value={String(selected.data.seqOrder ?? "")}
                />

                <TextField
                  label="受付日"
                  type="date"
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={tsToYMD(selected.data.acceptedDate)}
                  onChange={(e) => handleEditChange("acceptedDate", e.target.value)}
                />

                <TextField
                  label="機器番号"
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ readOnly: true }}
                  value={selected.data.assetNo ?? ""}
                />

                <TextField
                  label="機器分類"
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ readOnly: true }}
                  value={selected.data.category ?? ""}
                />

                <TextField
                  label="枝番"
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={selected.data.branchNo ?? ""}
                  onChange={(e) => handleEditChange("branchNo", e.target.value)}
                />

                <TextField
                  label="機器名"
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={selected.data.deviceName ?? ""}
                  onChange={(e) => handleEditChange("deviceName", e.target.value)}
                />

                <TextField
                  label="更新日"
                  type="date"
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={tsToYMD(selected.data.updatedOn)}
                  onChange={(e) => handleEditChange("updatedOn", e.target.value)}
                />

                <TextField
                  label="確認日"
                  type="date"
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={tsToYMD(selected.data.confirmedOn)}
                  onChange={(e) => handleEditChange("confirmedOn", e.target.value)}
                />

                <TextField
                  label="廃棄日"
                  type="date"
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={tsToYMD(selected.data.disposedOn)}
                  onChange={(e) => handleEditChange("disposedOn", e.target.value)}
                />

                <TextField
                  label="保有者"
                  select
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={selected.data.owner ?? ""}
                  onChange={(e) => handleEditChange("owner", e.target.value)}
                >
                  {activeUsers.map((u) => (
                    <MenuItem key={u.key} value={u.key}>
                      {u.label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="状態"
                  select
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={selected.data.status ?? ""}
                  onChange={(e) => handleEditChange("status", e.target.value)}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="保有履歴"
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={selected.data.history ?? ""}
                  onChange={(e) => handleEditChange("history", e.target.value)}
                />

                <TextField
                  label="備考"
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={selected.data.note ?? ""}
                  onChange={(e) => handleEditChange("note", e.target.value)}
                />

                <TextField
                  label="所在地"
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={selected.data.location ?? ""}
                  onChange={(e) => handleEditChange("location", e.target.value)}
                />

                <TextField
                  label="最終更新者"
                  select
                  variant="standard"
                  size="small"
                  margin="dense"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={selected.data.lastEditor ?? ""}
                  onChange={(e) => handleEditChange("lastEditor", e.target.value)}
                >
                  {activeUsers.map((u) => (
                    <MenuItem key={`${u.key}-editor`} value={u.key}>
                      {u.label}
                    </MenuItem>
                  ))}
                </TextField>

                <Box sx={{ display: "flex", gap: 1, pt: 0.5 }}>
                  <Button onClick={() => setConfirmDeleteOpen(true)} color="error" variant="outlined" size="small" sx={{ flex: 1 }}>
                    削除
                  </Button>
                  <Button onClick={() => setOpenEdit(false)} variant="outlined" size="small" sx={{ flex: 1 }}>
                    閉じる
                  </Button>
                  <Button onClick={handleSave} variant="contained" size="small" sx={{ flex: 1 }}>
                    保存
                  </Button>
                </Box>
              </Stack>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* レコード削除の確認 */}
      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
        <DialogTitle>このレコードを削除しますか？</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">この操作は取り消せません。削除してよろしいですか？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)}>キャンセル</Button>
          <Button color="error" variant="contained" onClick={handleConfirmDelete}>
            OK（削除）
          </Button>
        </DialogActions>
      </Dialog>

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
