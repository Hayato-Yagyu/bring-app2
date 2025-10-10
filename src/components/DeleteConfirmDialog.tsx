import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from "@mui/material";

type Props = {
  open: boolean;
  onClose: () => void;
  onOk: () => void;
};

export const DeleteConfirmDialog: React.FC<Props> = ({ open, onClose, onOk }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>このレコードを削除しますか？</DialogTitle>
    <DialogContent dividers>
      <Typography variant="body2">この操作は取り消せません。削除してよろしいですか？</Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>キャンセル</Button>
      <Button color="error" variant="contained" onClick={onOk}>
        OK（削除）
      </Button>
    </DialogActions>
  </Dialog>
);
