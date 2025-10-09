// src/components/BringList.jsx
import * as React from "react";
import Box from "@mui/material/Box";
import { DataGrid } from "@mui/x-data-grid";
import { collection, onSnapshot, query, orderBy, where, limit } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { Menu } from "./Menu";
import { Typography, Stack, Tooltip, IconButton } from "@mui/material";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteButton from "./DeleteButton";
import EditButton from "./EditButton";
import { useUser } from "./UserContext";
import NewPostDialog from "../components/NewPostDialog";

// ルーティング
import { useLocation, useNavigate } from "react-router-dom";
import ApprovalsDialog from "./ApprovalsDialog";

export const BringList = () => {
  const { user } = useUser();
  const userEmail = user?.email ?? "";

  const [posts, setPosts] = useState([]);
  const [openNew, setOpenNew] = useState(false);

  // 承認ダイアログの開閉
  const [openApprovals, setOpenApprovals] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // ★ 監督責任フラグ（users.supervising_responsible）
  const [isSupervisor, setIsSupervisor] = useState(false);

  // posts をリアルタイム購読
  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("applicantdate", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPosts(list);
      },
      (err) => {
        console.error("onSnapshot(posts) failed:", err);
      }
    );
    return () => unsub();
  }, []);

  // users から supervising_responsible をリアルタイム購読
  useEffect(() => {
    if (!userEmail) {
      setIsSupervisor(false);
      return;
    }
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", userEmail), where("supervising_responsible", "==", true), limit(1));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setIsSupervisor(!snap.empty);
      },
      (err) => {
        console.error("onSnapshot(users) failed:", err);
        setIsSupervisor(false);
      }
    );
    return () => unsub();
  }, [userEmail]);

  // メールのリンク等で来た場合に承認ダイアログを自動オープン
  useEffect(() => {
    const flag = location.state && location.state.approvalsOpen;
    if (flag) {
      setOpenApprovals(true);
      // 再読込でまた開かないように state をクリア
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // 返却承認済みかどうかのユーティリティ
  const isReturnedRow = (row) => Boolean((row?.confirmationdate && String(row.confirmationdate).trim()) || (row?.confirmationstamp && String(row.confirmationstamp).trim()));

  // DataGrid の初期並び（クエリ側で orderBy 済なのでここは任意）
  const defaultSortModel = [{ field: "applicantdate", sort: "desc" }];

  const columns = [
    {
      field: "deleteBtn",
      headerName: "削除",
      sortable: false,
      width: 76,
      disableClickEventBubbling: true,
      // supervising_responsible のみ有効
      renderCell: (params) => <DeleteButton rowId={params.id} sharedState={posts} setSharedState={setPosts} disabled={!isSupervisor} icon />,
    },
    {
      field: "editBtn",
      headerName: "編集",
      sortable: false,
      width: 76,
      disableClickEventBubbling: true,
      // ★ 返却承認済みは一般ユーザは編集不可。ただし supervisor は編集可
      renderCell: (params) => {
        const lockedByReturn = isReturnedRow(params.row);
        const disabled = !isSupervisor && lockedByReturn;
        return <EditButton rowData={params.row} setSharedState={setPosts} disabled={disabled} icon />;
      },
    },
    { field: "id", headerName: "ID", width: 96 },
    { field: "applicantdate", headerName: "申請日", flex: 1, minWidth: 100 },
    { field: "applicant", headerName: "申請者", flex: 1, minWidth: 110 },
    { field: "classification", headerName: "持込・持出区分", flex: 1, minWidth: 130 },
    { field: "periodfrom", headerName: "持込・持出日 から", flex: 1, minWidth: 140 },
    { field: "periodto", headerName: "持込・持出日 まで", flex: 1, minWidth: 140 },
    { field: "where", headerName: "持込・持出先", flex: 1, minWidth: 140 },
    { field: "materials", headerName: "設備", flex: 2, minWidth: 180 },
    { field: "media", headerName: "設備番号", flex: 1, minWidth: 160 },
    { field: "permitdate", headerName: "登録承認日付", flex: 1, minWidth: 100 },
    { field: "permitstamp", headerName: "承認者", flex: 1, minWidth: 100 },
    { field: "confirmationdate", headerName: "返却承認日付", flex: 1, minWidth: 120 },
    { field: "confirmationstamp", headerName: "承認者", flex: 1, minWidth: 100 },
  ];

  // CSV 出力（state posts をそのまま利用）
  const csvData = [...posts]
    .sort((a, b) => new Date(b.applicantdate || "").getTime() - new Date(a.applicantdate || "").getTime())
    .map((row) => ({
      ID: row.id,
      申請日: row.applicantdate || "",
      申請者: row.applicant || "",
      "持込・持出区分": row.classification || "",
      "持込・持出日 から": row.periodfrom || "",
      "持込・持出日 まで": row.periodto || "",
      "持込・持出先": row.where || "",
      データまたは資料名: row.materials || "",
      "媒体・ＰＣ 設備番号": row.media || "",
      許可日: row.permitdate || "",
      許可者: row.permitstamp || "",
      返却確認日: row.confirmationdate || "",
      確認者: row.confirmationstamp || "",
    }));

  const handleExportCsv = () => {
    if (!csvData.length) return;
    const headers = Object.keys(csvData[0] ?? {});
    const esc = (v) => {
      const s = v == null ? "" : String(v);
      const needsQuote = /[",\r\n]/.test(s);
      const body = s.replace(/"/g, '""');
      return needsQuote ? `"${body}"` : body;
    };
    const rows = [headers.map(esc).join(","), ...csvData.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\r\n");
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "BringList.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Menu />

      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Typography variant="h4" align="center" sx={{ borderBottom: 2, borderColor: "primary.dark", color: "primary.main", pb: 1 }}>
          媒体等持込持出一覧
        </Typography>

        <Box>
          <Stack direction="row">
            <Tooltip title="新規登録" arrow>
              <span>
                <IconButton onClick={() => setOpenNew(true)} size="large" color="primary" aria-label="新規登録">
                  <NoteAddIcon />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="CSV出力" arrow>
              <span>
                <IconButton onClick={handleExportCsv} size="large" color="primary" aria-label="CSV出力" disabled={!csvData.length}>
                  <DownloadIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <DataGrid
            rows={posts}
            columns={columns}
            initialState={{ pagination: { paginationModel: { pageSize: 100 } } }}
            pageSizeOptions={[20, 50, 100]}
            checkboxSelection={false}
            disableRowSelectionOnClick
            sortModel={defaultSortModel}
            rowHeight={40}
            sx={{
              "&.MuiDataGrid-root, & .MuiDataGrid-main, & .MuiDataGrid-virtualScroller, & .MuiDataGrid-columnHeaders": { overflowX: "clip" },
              "& .MuiDataGrid-columnHeader": { whiteSpace: "normal", overflow: "visible", textOverflow: "clip", lineHeight: "1.5 !important", maxHeight: "none !important" },
              "& .MuiDataGrid-cell": { whiteSpace: "normal", wordWrap: "break-word" },
            }}
          />
        </Box>
      </Box>

      <NewPostDialog open={openNew} onClose={() => setOpenNew(false)} />

      {/* 承認ダイアログ（メール→画面遷移で自動オープン対応済み） */}
      <ApprovalsDialog open={openApprovals} onClose={() => setOpenApprovals(false)} />
    </Box>
  );
};

export default BringList;
