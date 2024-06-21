import React, { useState, useEffect } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import {db} from '../firebase'
import { collection,  deleteDoc,  doc,  getDocs } from 'firebase/firestore'
import { init } from 'emailjs-com';
import emailjs from 'emailjs-com';

const ReturnButton = ({rowId, rowData,sharedState, setSharedState}) => {
  const [open, setOpen] = useState(false); // 確認ダイアログの表示/非表示
  const [completionOpen, setCompletionOpen] = useState(false);
  
  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleCompletionClose = () => {
    setCompletionOpen(false);
  };

  const deleteRow = (rowId, e) => {
    // (ここで削除処理)
    deleteDoc(doc(db,"posts", rowId))
    setOpen(false);
    setSharedState((prevRows) => prevRows.filter((sharedState) => sharedState.id !== rowId));
  };


  const handleApproval = (rowId,e) => {
    // emailjsのUser_IDを使って初期化
    init("mmbrcdIStlsQnbKkE")
    const emailjsUserID = "mmbrcdIStlsQnbKkE"
    //const emailjsUserID = process.env.REACT_APP_EMAILJS_USER_ID;
    //init(emailjsUserID);

    // 環境変数からService_IDとTemplate_IDを取得する。
    //const emailjsServiceId = process.env.REACT_APP_EMAILJS_SERVICE_ID;
    //const emailjsTemplateId = process.env.REACT_APP_EMAILJS_TEMPLATE_ID_R;
    const emailjsServiceId = "service_0sslyge"
    const emailjsTemplateId = "template_h2bmeqd"

    if (!emailjsUserID || !emailjsServiceId || !emailjsTemplateId) {
      console.log('サービスID、テンプレートID、またはユーザーIDが指定されていません。');
      return;
    }
    const emailHtml = "http://localhost:3000/BringList"

    // emailjsのテンプレートに渡すパラメータを宣言
    const templateParams = {
        to_name: "柳生部長",
        //from_name: emailName,
        from_name: "bring-app（媒体等持込持出記録アプリ）",
        //message: emailText
        id:  rowId  ,
        applicantdate: rowData.applicantdate,
        applicant: rowData.applicant,
        classification: rowData.classification,
        periodfrom: rowData.periodfrom,
        periodto: rowData.periodto,
        where: rowData.where,
        materials: rowData.materials,
        media: rowData.media,
        link: emailHtml

    }
    // ServiceId,Template_ID,テンプレートに渡すパラメータを引数にemailjsを呼び出し
    emailjs.send(emailjsServiceId,emailjsTemplateId, templateParams).
    //emailjs.send("service_0sslyge","template_h2bmeqd", templateParams).
    then(()=>{
      // do something
    });
    setOpen(false);
    setCompletionOpen(true);
  }

  return (
    <div>
      <Button variant="outlined" color="success" onClick={handleOpen}>
        返却申請
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{'確認'}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">ID「{rowId}」を返却申請しますか？</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} variant="outlined" color="primary" autoFocus sx={{ width: 150 }}>
            キャンセル
          </Button>
          <Button onClick={(e) => handleApproval(rowId, e) } variant="outlined" color="error" sx={{ width: 150 }}>
            申請
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={completionOpen}
        onClose={handleCompletionClose}
        aria-labelledby="completion-dialog-title"
        aria-describedby="completion-dialog-description"
      >
        <DialogTitle id="completion-dialog-title">{'完了'}</DialogTitle>
        <DialogContent>
          <DialogContentText id="completion-dialog-description">返却申請が完了しました。</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCompletionClose} variant="outlined" color="primary" autoFocus sx={{ width: 150 }}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ReturnButton;
