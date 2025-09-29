import { useState } from "react";
import { Button, Modal, TextField, Box, MenuItem, InputLabel, FormControl, Select } from "@mui/material";
import { db } from "../firebase";
import { collection, doc, getDocs, updateDoc, where } from "firebase/firestore";
import Applicant from "./Applicant";
import Where from "./Where";

export const EditButton = ({ rowData, setSharedState, disabled }) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({});
  const [otherInput, setOtherInput] = useState("");
  const [selectedOption, setSelectedOption] = useState("");

  const handleOpen = () => {
    setFormData(rowData); // 編集開始時に選択された行のデータをセット
    console.log(rowData);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleOptionChange = (e) => {
    const { name, value } = e.target.value;
    setSelectedOption(value);
    setFormData({ ...formData, [name]: value });

    // If "その他" is selected, clear otherInput
    if (value === "その他") {
      setOtherInput("");
    }
  };

  const handleOtherInputChange = (e) => {
    const { name, other } = e.target.value;
    setOtherInput(other);
    setFormData({ ...formData, [name]: other });
  };

  const handleSave = async () => {
    try {
      const docRef = doc(db, "posts", formData.id);
      await updateDoc(docRef, formData);
      const querySnapshot = await getDocs(collection(db, "posts"));
      const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSharedState(data); // 最新データを親コンポーネントに渡す
      handleClose();
    } catch (error) {
      console.error("データベースに書き込めません", error);
    }
  };

  const handleBackdropClick = (event) => {
    event.stopPropagation();
  };

  return (
    <div>
      <Button variant="outlined" color="primary" onClick={handleOpen} disabled={disabled}>
        編集
      </Button>
      <Modal open={open} onClose={handleClose} BackdropProps={{ onClick: handleBackdropClick }}>
        <Box sx={{ padding: 2, backgroundColor: "white", margin: "auto", mt: "7%", width: 400, maxHeight: "80vh", overflow: "auto" }}>
          <TextField name="applicantdate" label="申請日" value={formData.applicantdate} onChange={handleInputChange} fullWidth margin="dense" type="date" />
          <FormControl fullWidth margin="dense">
            <InputLabel id="name-label">申請者</InputLabel>
            <Select labelId="name-label" name="applicant" value={formData.applicant} onChange={handleInputChange} label="申請者">
              {Applicant.map((item, index) => (
                <MenuItem key={index} value={item}>
                  {item}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel id="name-label">持出・持込区分</InputLabel>
            <Select labelId="name-label" name="classification" value={formData.classification} onChange={handleInputChange} label="持出・持込区分">
              <MenuItem value="持出">持出</MenuItem>
              <MenuItem value="持込">持込</MenuItem>
            </Select>
          </FormControl>
          <TextField name="periodfrom" label="持込・持出日 から" value={formData.periodfrom} onChange={handleInputChange} fullWidth margin="dense" type="date" />
          <TextField name="periodto" label="持込・持出日 まで" value={formData.periodto} onChange={handleInputChange} fullWidth margin="dense" type="date" />
          <FormControl fullWidth margin="dense">
            <InputLabel id="name-label">持込・持出先</InputLabel>
            <Select labelId="name-label" name="where" value={formData.where} onChange={handleInputChange} label="持込・持出先">
              {Where.map((item, index) => (
                <MenuItem key={index} value={item}>
                  {item}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {formData.where === "その他" && <TextField label="Other" value={otherInput} onChange={handleOtherInputChange} fullWidth sx={{ width: 400 }} />}
          <TextField name="materials" label="データまたは資料名" value={formData.materials} onChange={handleInputChange} fullWidth margin="dense" />
          <FormControl fullWidth margin="dense">
            <InputLabel id="media-label">媒体・ＰＣ 設備番号</InputLabel>
            <Select labelId="media-label" name="media" value={formData.media} onChange={handleInputChange} label="媒体・ＰＣ 設備番号">
              <MenuItem value="PC">PC</MenuItem>
              <MenuItem value="スマートフォン">スマートフォン</MenuItem>
              <MenuItem value="USBメモリ">USBメモリ</MenuItem>
              <MenuItem value="外付けHDD">外付けHDD</MenuItem>
              <MenuItem value="その他">その他</MenuItem>
            </Select>
          </FormControl>
          <TextField name="permitdate" label="許可日" value={formData.permitdate} onChange={handleInputChange} fullWidth margin="dense" type="date" />
          <FormControl fullWidth margin="dense">
            <InputLabel id="name-label">許可者</InputLabel>
            <Select labelId="name-label" name="permitstamp" value={formData.permitstamp} onChange={handleInputChange} label="許可者">
              {Applicant.map((item, index) => (
                <MenuItem key={index} value={item}>
                  {item}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField name="confirmationdate" label="持出返却確認日" value={formData.confirmationdate} onChange={handleInputChange} fullWidth margin="dense" type="date" />
          <FormControl fullWidth margin="dense">
            <InputLabel id="name-label">確認者</InputLabel>
            <Select labelId="name-label" name="confirmationstamp" value={formData.confirmationstamp} onChange={handleInputChange} label="確認者">
              {Applicant.map((item, index) => (
                <MenuItem key={index} value={item}>
                  {item}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
            <Button variant="outlined" color="primary" onClick={handleClose} sx={{ width: 150 }}>
              キャンセル
            </Button>
            <Button variant="contained" color="primary" onClick={handleSave} sx={{ width: 150 }}>
              保存
            </Button>
          </Box>
        </Box>
      </Modal>
    </div>
  );
};

export default EditButton;
