// src/components/DeleteButton.js
import React, { useState } from "react";
import { Button, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { db } from "../firebase";
import { deleteDoc, doc } from "firebase/firestore";

const DeleteButton = ({
  rowId,
  sharedState,
  setSharedState,
  disabled = false,
  icon = true, // true=アイコン表示 / false=通常ボタン
}) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => !busy && setOpen(false);

  const handleDelete = async () => {
    if (!rowId) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "posts", rowId));

      // 親の一覧を即時反映
      if (typeof setSharedState === "function") {
        setSharedState((prev) => {
          const rows = Array.isArray(prev) ? prev : sharedState || [];
          return rows.filter((r) => r.id !== rowId);
        });
      }
      setOpen(false);
    } catch (e) {
      console.error("削除に失敗しました:", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {icon ? (
        <Tooltip title="削除" arrow>
          <span>
            <IconButton onClick={handleOpen} color="error" size="small" disabled={disabled || busy}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ) : (
        <Button variant="outlined" color="error" onClick={handleOpen} disabled={disabled || busy}>
          削除
        </Button>
      )}

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>削除確認</DialogTitle>
        <DialogContent>
          <DialogContentText>ID「{rowId}」を削除します。元に戻せません。</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} variant="outlined" disabled={busy}>
            キャンセル
          </Button>
          <Button onClick={handleDelete} variant="contained" color="error" disabled={busy}>
            {busy ? "削除中..." : "削除"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DeleteButton;
