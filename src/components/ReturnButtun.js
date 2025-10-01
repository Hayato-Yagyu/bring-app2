import React, { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import emailjs from "@emailjs/browser"; // ← emailjs-com ではなくこちら

const ReturnButton = ({ rowId, rowData, sharedState, setSharedState }) => {
  const [open, setOpen] = useState(false); // 確認ダイアログの表示/非表示
  const [completionOpen, setCompletionOpen] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const handleCompletionClose = () => setCompletionOpen(false);

  const handleApproval = async (rowId, e) => {
    const emailjsServiceId = "service_0sslyge";
    const emailjsTemplateId = "template_h2bmeqd";
    const emailHtml = "https://bring-app2.vercel.app/";

    const templateParams = {
      to_name: "柳生部長",
      from_name: "bring-app（媒体等持込持出記録アプリ）",
      id: rowId,
      applicantdate: rowData.applicantdate,
      applicant: rowData.applicant,
      classification: rowData.classification,
      periodfrom: rowData.periodfrom,
      periodto: rowData.periodto,
      where: rowData.where,
      materials: rowData.materials,
      media: rowData.media,
      link: emailHtml,
    };

    try {
      const res = await emailjs.send(emailjsServiceId, emailjsTemplateId, templateParams);
      console.log("EmailJS送信成功:", res);
      setCompletionOpen(true);
    } catch (err) {
      console.error("EmailJS送信失敗:", err);
    } finally {
      setOpen(false);
    }
  };

  return (
    <div>
      <Button variant="outlined" color="success" onClick={handleOpen}>
        返却
      </Button>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>確認</DialogTitle>
        <DialogContent>
          <DialogContentText>ID「{rowId}」を返却申請しますか？</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} variant="outlined" color="primary" sx={{ width: 150 }}>
            キャンセル
          </Button>
          <Button onClick={(e) => handleApproval(rowId, e)} variant="outlined" color="error" sx={{ width: 150 }}>
            申請
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={completionOpen} onClose={handleCompletionClose}>
        <DialogTitle>完了</DialogTitle>
        <DialogContent>
          <DialogContentText>返却申請が完了しました。</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCompletionClose} variant="outlined" color="primary" sx={{ width: 150 }}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ReturnButton;
