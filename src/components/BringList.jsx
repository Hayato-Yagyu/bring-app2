// src/components/BringList.jsx
import * as React from "react";
import Box from "@mui/material/Box";
import { DataGrid } from "@mui/x-data-grid";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState, useCallback } from "react";
import { db } from "../firebase";
import { Menu } from "./Menu";
import { Typography, Stack, Tooltip, IconButton } from "@mui/material";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteButton from "./DeleteButton";
import EditButton from "./EditButton";
import ReturnButton from "./ReturnButtun";
import { useUser } from "./UserContext";
import NewPostDialog from "../components/NewPostDialog";

export const BringList = () => {
  const { user } = useUser();
  const isAuthorized = user && user.email === "hayato.yagyu@digitalsoft.co.jp";

  const [posts, setPosts] = useState([]);
  const [openNew, setOpenNew] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const postsRef = collection(db, "posts");
      const querySnapshot = await getDocs(postsRef);
      const postData = querySnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      setPosts(postData);
    } catch (error) {
      console.error("Error fetching posts:", error);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const defaultSortModel = [{ field: "applicantdate", sort: "desc" }];

  const columns = [
    {
      field: "deleteBtn",
      headerName: "削除",
      sortable: false,
      width: 76,
      disableClickEventBubbling: true,
      renderCell: (params) => <DeleteButton rowId={params.id} sharedState={posts} setSharedState={setPosts} disabled={!isAuthorized} />,
    },
    {
      field: "editBtn",
      headerName: "編集",
      sortable: false,
      width: 76,
      disableClickEventBubbling: true,
      renderCell: (params) => <EditButton rowData={params.row} setSharedState={setPosts} disabled={!isAuthorized} />,
    },
    {
      field: "returnBtn",
      headerName: "返却",
      sortable: false,
      width: 76,
      disableClickEventBubbling: true,
      renderCell: (params) => <ReturnButton rowId={params.id} rowData={params.row} />,
    },
    { field: "id", headerName: "ID", width: 96 },
    { field: "applicantdate", headerName: "申請日", flex: 1, minWidth: 100 },
    { field: "applicant", headerName: "申請者", flex: 1, minWidth: 110 },
    { field: "classification", headerName: "持込・持出区分", flex: 1, minWidth: 130 },
    { field: "periodfrom", headerName: "持込・持出日 から", flex: 1, minWidth: 140 },
    { field: "periodto", headerName: "持込・持出日 まで", flex: 1, minWidth: 140 },
    { field: "where", headerName: "持込・持出先", flex: 1, minWidth: 140 },
    { field: "materials", headerName: "データまたは資料名", flex: 2, minWidth: 180 },
    { field: "media", headerName: "媒体・ＰＣ 設備番号", flex: 1, minWidth: 160 },
    { field: "permitdate", headerName: "許可日", flex: 1, minWidth: 100 },
    { field: "permitstamp", headerName: "許可者", flex: 1, minWidth: 100 },
    { field: "confirmationdate", headerName: "返却確認日", flex: 1, minWidth: 120 },
    { field: "confirmationstamp", headerName: "確認者", flex: 1, minWidth: 100 },
  ];

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
              "&.MuiDataGrid-root, & .MuiDataGrid-main, & .MuiDataGrid-virtualScroller, & .MuiDataGrid-columnHeaders": {
                overflowX: "clip",
              },
              // ← ヘッダ色・行色はテーマで統一。ここでは上書きしない
              "& .MuiDataGrid-columnHeader": {
                whiteSpace: "normal",
                overflow: "visible",
                textOverflow: "clip",
                lineHeight: "1.5 !important",
                maxHeight: "none !important",
              },
              "& .MuiDataGrid-cell": {
                whiteSpace: "normal",
                wordWrap: "break-word",
              },
            }}
          />
        </Box>
      </Box>

      <NewPostDialog
        open={openNew}
        onClose={() => setOpenNew(false)}
        onSaved={() => {
          fetchPosts();
        }}
      />
    </Box>
  );
};

export default BringList;
