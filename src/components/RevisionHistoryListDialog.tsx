// src/components/RevisionHistoryListDialog.tsx
import React, { useMemo, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Stack, Box } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { RevisionHistoryDialog } from "./RevisionHistoryDialog";

type Row = {
  id: string;
  no: string;
  content: string;
  createdAtYmd: string;
  author: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  rows: Row[];
  loading?: boolean;
  onCreate: (v: { no: string; content: string; createdAtYmd: string; author: string }) => Promise<void> | void;
  onUpdate: (id: string, v: { no: string; content: string; createdAtYmd: string; author: string }) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  authors?: Array<{ key: string; label: string }>;
};

export const RevisionHistoryListDialog: React.FC<Props> = ({ open, onClose, rows, loading = false, onCreate, onUpdate, onDelete, authors = [] }) => {
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  // ★ No. の昇順（数値）ソート
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const numA = Number(a.no.replace(/[^\d]/g, "")) || 0;
      const numB = Number(b.no.replace(/[^\d]/g, "")) || 0;
      return numA - numB;
    });
  }, [rows]);

  const columns: GridColDef<Row>[] = useMemo(
    () => [
      { field: "no", headerName: "No.", width: 80 },
      {
        field: "content",
        headerName: "内容",
        flex: 1,
        minWidth: 400,
        // ★ 改行・折り返しを有効にするカスタムレンダラ
        renderCell: (params) => (
          <Box
            sx={{
              whiteSpace: "pre-wrap", // ← \n を改行として表示
              wordBreak: "break-word", // ← 長い単語の折り返し
              lineHeight: 1.4,
              py: 0.5,
              width: "100%",
            }}
          >
            {params.value as string}
          </Box>
        ),
      },
      { field: "createdAtYmd", headerName: "制定日", width: 120 },
      {
        field: "author",
        headerName: "記載者",
        width: 160,
        // ★ 「54001 小林 幸司（xxx）」→「小林 幸司」に変換
        renderCell: (params) => {
          const raw = params.value as string;
          // 氏名だけを抽出する正規表現
          const match = raw.match(/[一-龥ぁ-んァ-ヶーA-Za-z]+(?:\s*[一-龥ぁ-んァ-ヶーA-Za-z]+)?/);
          const display = match ? match[0].trim() : raw;
          return display;
        },
      },
      {
        field: "actions",
        headerName: "",
        sortable: false,
        width: 120,
        renderCell: (params) => (
          <Stack direction="row" spacing={0.5}>
            <IconButton
              size="small"
              onClick={() => {
                setEditing(params.row);
                setOpenForm(true);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => onDelete(params.row.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ),
      },
    ],
    [onDelete]
  );

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
        <DialogTitle>改訂履歴一覧</DialogTitle>
        <DialogContent dividers>
          <div style={{ height: 480 }}>
            <DataGrid
              rows={sortedRows}
              columns={columns}
              loading={loading}
              pageSizeOptions={[25, 50, 100]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
              }}
              disableRowSelectionOnClick
              // ★ 行の高さを内容に合わせて自動化
              getRowHeight={() => "auto"}
              sx={{
                "& .MuiDataGrid-cell": {
                  alignItems: "flex-start", // 上寄せ
                  py: 0.75,
                },
              }}
            />
          </div>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Button onClick={onClose}>閉じる</Button>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => {
              setEditing(null);
              setOpenForm(true);
            }}
          >
            追加
          </Button>
        </DialogActions>
      </Dialog>

      {/* 追加/編集フォーム */}
      <RevisionHistoryDialog
        open={openForm}
        onClose={() => setOpenForm(false)}
        initial={
          editing
            ? {
                no: editing.no,
                content: editing.content,
                createdAtYmd: editing.createdAtYmd,
                author: editing.author,
              }
            : null
        }
        authors={authors}
        onSubmit={async (v) => {
          if (editing) {
            await onUpdate(editing.id, v);
          } else {
            await onCreate(v);
          }
          setOpenForm(false);
        }}
      />
    </>
  );
};
