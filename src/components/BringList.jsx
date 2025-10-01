// src/components/BringList.jsx
import * as React from "react";
import Box from "@mui/material/Box";
import { DataGrid } from "@mui/x-data-grid";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { Menu } from "./Menu";
import { Typography } from "@mui/material";
import DeleteButton from "./DeleteButton";
import EditButton from "./EditButton";
import ReturnButton from "./ReturnButtun";
import { useUser } from "./UserContext";

export const BringList = () => {
  const { user } = useUser();
  const isAuthorized = user && user.email === "hayato.yagyu@digitalsoft.co.jp";

  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const usersCollectionRef = collection(db, "posts");
        const querySnapshot = await getDocs(usersCollectionRef);
        const postData = querySnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
        setPosts(postData);
      } catch (error) {
        console.error("Error fetching posts:", error);
      }
    };
    fetchPosts();
  }, []);

  const defaultSortModel = [{ field: "applicantdate", sort: "desc" }];

  // ★ 固定幅はボタン列とIDだけ。その他は flex で可視幅にフィット
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
      renderCell: (params) => <ReturnButton rowId={params.id} rowData={params.row} sharedState={posts} setSharedState={setPosts} />,
    },
    { field: "id", headerName: "ID", width: 96 }, // ← 固定幅はここまで

    // ここから可変幅（flex）。minWidth は控えめに
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

  return (
    // ★ ページ全体で 100vh。外側スクロールは殺す
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Menu csvData={csvData} />

      {/* ★ コンテンツ領域（タイトル＋グリッド） */}
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Typography variant="h4" align="center" borderBottom={"2px solid gray"}>
          媒体等持込持出一覧
        </Typography>

        {/* ★ DataGrid の枠。ここは高さだけを与え、横/外側スクロールは持たせない */}
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
              // 横スクロール抑止（v7 の内部要素をまとめて clip）
              "&.MuiDataGrid-root, & .MuiDataGrid-main, & .MuiDataGrid-virtualScroller, & .MuiDataGrid-columnHeaders": {
                overflowX: "clip",
              },
              // 折り返し設定（既存）
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
    </Box>
  );
};

export default BringList;
