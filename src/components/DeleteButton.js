import React, { useState, useEffect } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import {db} from '../firebase'
import { collection,  deleteDoc,  doc,  getDocs } from 'firebase/firestore'

export const DeleteButton = ({rowId,sharedState, setSharedState, disabled }) => {
  const [open, setOpen] = useState(false); // 確認ダイアログの表示/非表示
  
  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const deleteRow = (rowId, e) => {
    // (ここで削除処理)
    deleteDoc(doc(db,"posts", rowId))
    setOpen(false);
    setSharedState((prevRows) => prevRows.filter((sharedState) => sharedState.id !== rowId));
  };


  

  return (
    <div>
      <Button variant="outlined" color="error" onClick={handleOpen} disabled={disabled}>
        削除
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{'確認'}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">ID「{rowId}」を本当に削除しますか？</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} variant="outlined" color="primary" autoFocus sx={{ width: 150 }}>
            キャンセル
          </Button>
          <Button onClick={(e) => deleteRow(rowId, e) } variant="outlined" color="error" sx={{ width: 150 }}>
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default DeleteButton;
