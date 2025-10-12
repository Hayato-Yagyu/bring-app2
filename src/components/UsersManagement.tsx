// src/pages/UsersManagement.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, LinearProgress, Stack, Typography, Tooltip, IconButton } from "@mui/material";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { collection, doc, onSnapshot, orderBy, query, setDoc, writeBatch, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import * as Papa from "papaparse";
import AuthDialog from "../components/AuthDialog";
import { Menu } from "../components/Menu";

// Firestoreに保存する1行分の型
type UserDoc = {
  id?: string | null;
  staffcode?: string | null;
  displayName?: string | null;
  email?: string | null;
  group?: string | null;
  partner?: boolean;
  albite_part_timer?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  unitPrice?: number;
  role?: string | null;
  unForecasts?: boolean;
  supervising_responsible?: boolean;
  consignment?: boolean;
  equipmentManagement?: boolean; // ★追加
};

// DataGrid 用の行型
type Row = {
  id: string;
  staffcode: string;
  displayName: string;
  email: string;
  group: string;
  partner: boolean;
  albite_part_timer: boolean;
  consignment: boolean;
  startDate: string;
  endDate: string;
  unitPrice: number;
  role: string;
  unForecasts: boolean;
  supervising_responsible: boolean;
  equipmentManagement: boolean;
};

// ヘッダ正規化（表記ゆらぎ対策）
const headerNormalizer = (raw: string) => {
  const h = raw.replace(/^\uFEFF/, "").trim();
  const hl = h.toLowerCase();

  if (["albite_par", "albite_part", "albite_part_time", "albite_part_timer"].includes(hl)) return "albite_part_timer";
  if (hl === "consignmen" || hl === "consignment") return "consignment";
  if (["equipment_management", "equipmentmgmt", "equipment", "equip_mgmt", "equip"].includes(hl)) return "equipmentManagement";

  const canonical = ["staffcode", "displayName", "email", "group", "partner", "albite_part_timer", "startDate", "endDate", "unitPrice", "id", "role", "unForecasts", "supervising_responsible", "consignment", "equipmentManagement"];
  const exact = canonical.find((k) => k.toLowerCase() === hl);
  return exact ?? h;
};

// ユーティリティ
const trimOrNull = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};
const toBool = (v: unknown): boolean | null => {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "t", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "f", "no", "n", "off"].includes(s)) return false;
  return null;
};
const toBoolStrict = (v: unknown): boolean => toBool(v) ?? false;
const toNumberStrict = (v: unknown): number => {
  if (v == null) return 0;
  const s = String(v).trim();
  if (s === "") return 0;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const UsersManagement: React.FC = () => {
  const [rowsRaw, setRowsRaw] = useState<Array<{ docId: string; data: UserDoc }>>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Firestore購読
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("staffcode", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: Array<{ docId: string; data: UserDoc }> = snap.docs.map((d) => ({
        docId: d.id,
        data: d.data() as UserDoc,
      }));
      setRowsRaw(list);
    });
    return () => unsub();
  }, []);

  // DataGrid 用行整形
  const gridRows: Row[] = useMemo(
    () =>
      rowsRaw.map(({ docId, data }) => ({
        id: docId,
        staffcode: data.staffcode ?? "",
        displayName: data.displayName ?? "",
        email: data.email ?? "",
        group: data.group ?? "",
        partner: data.partner ?? false,
        albite_part_timer: data.albite_part_timer ?? false,
        consignment: data.consignment ?? false,
        startDate: data.startDate ?? "",
        endDate: data.endDate ?? "",
        unitPrice: data.unitPrice ?? 0,
        role: data.role ?? "",
        unForecasts: data.unForecasts ?? false,
        supervising_responsible: data.supervising_responsible ?? false,
        equipmentManagement: data.equipmentManagement ?? false,
      })),
    [rowsRaw]
  );

  // CSVインポート処理
  const importCsvAllReplace = async (file: File) => {
    setImporting(true);
    setProgress(0);
    setMessage(null);
    try {
      const parsed = await new Promise<Papa.ParseResult<Record<string, any>>>((resolve, reject) => {
        Papa.parse<Record<string, any>>(file, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h: string) => headerNormalizer(h),
          complete: (res) => resolve(res),
          error: (err) => reject(err),
        });
      });

      const raw = (parsed.data || []).filter((r) => r && Object.keys(r).length > 0);
      if (!raw.length) throw new Error("CSVに有効な行がありません");

      setMessage("users を全削除中…");
      const snap = await getDocs(collection(db, "users"));
      const docs = snap.docs;
      const DEL_CHUNK = 400;
      for (let i = 0; i < docs.length; i += DEL_CHUNK) {
        const batch = writeBatch(db);
        docs.slice(i, i + DEL_CHUNK).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      setMessage("CSV 取り込み中…");
      const toImport = raw.map((r) => {
        const docId = trimOrNull(r.id) ?? doc(collection(db, "users")).id;
        const data: UserDoc = {
          id: trimOrNull(r.id),
          staffcode: trimOrNull(r.staffcode),
          displayName: trimOrNull(r.displayName),
          email: trimOrNull(r.email),
          group: trimOrNull(r.group),
          role: trimOrNull(r.role),
          startDate: trimOrNull(r.startDate),
          endDate: trimOrNull(r.endDate),
          partner: toBoolStrict(r.partner),
          albite_part_timer: toBoolStrict(r.albite_part_timer ?? r.albite_par),
          consignment: toBoolStrict(r.consignment),
          supervising_responsible: toBoolStrict(r.supervising_responsible),
          unForecasts: toBoolStrict(r.unForecasts),
          unitPrice: toNumberStrict(r.unitPrice),
          equipmentManagement: toBoolStrict(r.equipmentManagement), // ★追加
        };
        return { docId: String(docId), data };
      });

      const CHUNK = 300;
      for (let i = 0; i < toImport.length; i += CHUNK) {
        const slice = toImport.slice(i, i + CHUNK);
        await Promise.all(
          slice.map(async (item) => {
            await setDoc(doc(db, "users", item.docId), item.data, { merge: false });
          })
        );
        setProgress(Math.round(Math.min(100, ((i + CHUNK) / toImport.length) * 100)));
      }

      setMessage("完了しました。");
    } catch (e: any) {
      setMessage(e?.message ?? "CSVインポートに失敗しました");
    } finally {
      setImporting(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const onClickImport = () => fileRef.current?.click();
  const onChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0];
    if (f) importCsvAllReplace(f);
    e.currentTarget.value = "";
  };

  // DataGrid列
  const columns: GridColDef<Row>[] = useMemo(
    () => [
      { field: "staffcode", headerName: "staffcode", flex: 0.8, minWidth: 110 },
      { field: "displayName", headerName: "displayName", flex: 1.2, minWidth: 140 },
      { field: "email", headerName: "email", flex: 1.4, minWidth: 180 },
      { field: "group", headerName: "group", flex: 1.2, minWidth: 160 },
      { field: "partner", headerName: "partner", type: "boolean", flex: 0.6, minWidth: 90 },
      { field: "albite_part_timer", headerName: "albite_part_timer", type: "boolean", flex: 0.9, minWidth: 140 },
      { field: "consignment", headerName: "consignment", type: "boolean", flex: 0.9, minWidth: 130 },
      { field: "startDate", headerName: "startDate", flex: 0.8, minWidth: 110 },
      { field: "endDate", headerName: "endDate", flex: 0.8, minWidth: 110 },
      { field: "unitPrice", headerName: "unitPrice", flex: 0.7, minWidth: 100, renderCell: (p) => String(p.value ?? 0) },
      { field: "role", headerName: "role", flex: 0.7, minWidth: 100 },
      { field: "unForecasts", headerName: "unForecasts", type: "boolean", flex: 0.9, minWidth: 130 },
      { field: "supervising_responsible", headerName: "supervising_responsible", type: "boolean", flex: 1.1, minWidth: 180 },
      { field: "equipmentManagement", headerName: "equipmentManagement", type: "boolean", flex: 0.9, minWidth: 160 },
    ],
    []
  );

  const defaultSortModel = useMemo(() => [{ field: "staffcode", sort: "asc" as const }], []);

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Menu />
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Typography variant="h4" align="center" sx={{ borderBottom: 2, borderColor: "primary.dark", color: "primary.main", pb: 1 }}>
          ユーザー管理
        </Typography>

        <Box>
          <Stack direction="row">
            <Tooltip title="新規登録" arrow>
              <span>
                <IconButton onClick={() => setNewOpen(true)} size="large" color="primary" aria-label="新規登録">
                  <PersonAddAlt1Icon />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="CSVからインポート" arrow>
              <span>
                <IconButton onClick={onClickImport} size="large" color="primary" aria-label="CSVからインポート" disabled={importing}>
                  <FileUploadIcon />
                </IconButton>
              </span>
            </Tooltip>

            <input type="file" ref={fileRef} hidden accept=".csv,text/csv" onChange={onChangeFile} />
          </Stack>
        </Box>

        {importing && (
          <Box sx={{ px: 2, pb: 1 }}>
            <LinearProgress variant="determinate" value={progress} color="primary" />
            <Typography variant="caption">
              {progress}% {message ?? ""}
            </Typography>
          </Box>
        )}

        <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <DataGrid
            rows={gridRows}
            columns={columns}
            initialState={{ pagination: { paginationModel: { pageSize: 100 } } }}
            pageSizeOptions={[20, 50, 100]}
            checkboxSelection={false}
            disableRowSelectionOnClick
            sortModel={defaultSortModel}
            rowHeight={40}
            sx={{
              overflowX: "hidden",
              "& .MuiDataGrid-main, & .MuiDataGrid-virtualScroller, & .MuiDataGrid-columnHeaders": { overflowX: "hidden" },
              "& .MuiDataGrid-columnHeader": {
                whiteSpace: "normal",
                overflow: "visible",
                textOverflow: "clip",
                lineHeight: "1.5 !important",
                maxHeight: "none !important",
              },
              "& .MuiDataGrid-cell": { whiteSpace: "normal", wordWrap: "break-word" },
            }}
          />
        </Box>
      </Box>

      <AuthDialog open={newOpen} onClose={() => setNewOpen(false)} onSuccess={() => setNewOpen(false)} />
    </Box>
  );
};

export default UsersManagement;
