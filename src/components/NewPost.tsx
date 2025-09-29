import { SetStateAction, useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import {db} from "../firebase";
import { Button, MenuItem } from '@mui/material';
import '../App.css';
import { Menu } from '../components/Menu';
import { Typography,TextField, Box} from '@mui/material';
import styled from '@emotion/styled';
import { Email } from '../Email'
import { init } from 'emailjs-com';
import emailjs from 'emailjs-com';
import ComfirmDialog from "./ComfirmDialog";
import Where from "./Where";
import Applicant from "./Applicant";




const NewPost = () => {
    const [applicantdate, setApplicantdate] = useState("");
    const [applicant, setApplicant] = useState("");
    const [classification, setClassification] = useState("");
    const [periodfrom, setPeriodfrom] = useState("");
    const [periodto, setPeriodto] = useState("");
    const [where, setWhere] = useState("");
    const [materials, setMaterials] = useState("");
    const [media, setMedia] = useState("");
    const [permitdate, setPermitdate] = useState("");
    const [permitstamp, setPermitstamp] = useState("");
    const [confirmationdate, setConfirmationdate] = useState("");
    const [confirmationstamp, setConfirmationstamp] = useState("");


    const [openDialog, setOpenDialog] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleOpenDialog = () => {
      setOpenDialog(true);
    };
  
    const handleCloseDialog = () => {
      setOpenDialog(false);
    };
    
    let docID = ""

    const handleSubmit = async (event: { preventDefault: () => void; }) => {
      event.preventDefault();
      
      if (!applicantdate.trim() 
            || !applicant.trim()
            || !classification.trim()
            || !periodfrom.trim()
            || !periodto.trim()
            || !where.trim()
            || !materials.trim()
            || !media.trim()
         //  || !permitdate.trim()
         //  || !permitstamp.trim()
         //  || !confirmationdate.trim()
         //  || !confirmationstamp.trim()
         ) {
        setOpenDialog(true);
        return;
      }
      
      try {
        const docRef = await addDoc(collection(db, "posts"), {
        
            applicantdate:applicantdate,
            applicant:applicant,
            classification:classification,
            periodfrom:periodfrom,
            periodto:periodto,
            where:where,
            materials:materials,
            media:media,
            permitdate:permitdate,
            permitstamp:permitstamp,
            confirmationdate:confirmationdate,
            confirmationstamp:confirmationstamp
        });
        docID = docRef.id
        

        setApplicantdate('')
        setApplicant('')
        setClassification('')
        setPeriodfrom('')
        setPeriodto('')
        setWhere('')
        setMaterials('')
        setMedia('')
        setPermitdate('')
        setPermitstamp('')
        setConfirmationdate('')
        setConfirmationstamp('')

    } catch (error) {
        console.log(error);
    }
      console.log('フォームがサブミットされました。');
      setIsSubmitted(true);
      handleApproval();
    };

    const handleApproval = () => {
    // emailjsのUser_IDを使って初期化
    init("mmbrcdIStlsQnbKkE")
    //init(process.env.GATSBY_USER_ID);

    // 環境変数からService_IDとTemplate_IDを取得する。
    //const emailjsServiceId = process.env.GATSBY_EMAILJS_SERVICE_ID;
    //const emailjsTemplateId = process.env.GATSBY_EMAILJS_TEMPLATE_ID;
    const emailjsServiceId = "service_0sslyge"
    const emailjsTemplateId = "template_81c28kt"

    const emailHtml = "https://bring-app2.vercel.app/"

    // emailjsのテンプレートに渡すパラメータを宣言
    const templateParams = {
        to_name: "柳生部長",
        //from_name: emailName,
        from_name: "bring-app（媒体等持込持出記録アプリ）",
        //message: emailText
        id:  docID  ,
        applicantdate: applicantdate,
        applicant: applicant,
        classification: classification,
        periodfrom: periodfrom,
        periodto: periodto,
        where: where,
        materials: materials,
        media: media,
        link: emailHtml

    };

    // ServiceId,Template_ID,テンプレートに渡すパラメータを引数にemailjsを呼び出し
    //emailjs.send(emailjsServiceId,emailjsTemplateId, templateParams).
    emailjs.send("service_0sslyge","template_81c28kt", templateParams).
    then(()=>{
      // do something
    });
    
    }
    
    const handleReset = () => {
      setApplicantdate('')
      setApplicant('')
      setClassification('')
      setPeriodfrom('')
      setPeriodto('')
      setWhere('')
      setMaterials('')
      setMedia('')
      setPermitdate('')
      setPermitstamp('')
      setConfirmationdate('')
      setConfirmationstamp('')
      setIsSubmitted(false);
      setSelectedOption('')
    };

    const [selectedOption, setSelectedOption] = useState('');
    const [otherInput, setOtherInput] = useState('');

    const handleOptionChange = (event: { target: { value: any; }; }) => {
      const value = event.target.value;
      setSelectedOption(value);
      setWhere(value)
      console.log(where)
      
      // If "その他" is selected, clear otherInput
      if (value === 'その他') {
        setOtherInput('');
     
      }
    };
  
    const handleOtherInputChange = (event: { target: { value: SetStateAction<string>; }; }) => {
      const other = event.target.value
      setOtherInput(other);
      setWhere(other)
    };

    return (
        <>
          <Menu />
          
          <Typography variant='h4' align='center' borderBottom={'2px solid gray'}>媒体等持込持出記録</Typography> 
          <StyledBox>
          <Box className='form' >
            <ComfirmDialog open={openDialog} onClose={handleCloseDialog} title="確認！" content="入力されていないフィールドがあります。" actions={<Button onClick={handleCloseDialog}>閉じる</Button>} />
            {isSubmitted ?(<div><p>承認依頼されました！</p><button onClick={handleReset}>閉じる</button> </div>) : (
            
            <form onSubmit={handleSubmit} >
                <br />
                <TextField id="filled-basic" label="申請日"  InputLabelProps={{shrink: true}} type="date" sx={{ width: "400px"}} value={applicantdate} onChange={(e) => {setApplicantdate(e.target.value)}}/>
                <br />
                <br />
                <TextField id="filled-basic" label="申請者" select sx={{ width: "400px" }} value={applicant} onChange={(e) => {setApplicant(e.target.value)}}
                    InputLabelProps={{shrink: true,}} InputProps={{style: {textAlign: 'left',},}}>
                      {Applicant.map((item:string, index:any) => (
                        <MenuItem key={index} value={item}>
                           {item}
                        </MenuItem>
                      ))}
                </TextField>
                <br />
                <br />
                <TextField id="filled-basic" label="持出・持込区分"  select sx={{ width: "400px" }} value={classification} onChange={(e) => {setClassification(e.target.value) }} 
                    InputLabelProps={{shrink: true,}} InputProps={{style: {textAlign: 'left',},}}>
                      <MenuItem value="持出">持出</MenuItem>
                      <MenuItem value="持込">持込</MenuItem>
                </TextField>
                <br />
                <br />
                <TextField id="filled-basic" label="持込・持出日 から" InputLabelProps={{shrink: true}} type="date" sx={{ width: "400px" }} value={periodfrom} onChange={(e) => {setPeriodfrom(e.target.value) }}/>
                <br />
                <br />
                <TextField id="filled-basic" label="持込・持出日 まで" InputLabelProps={{shrink: true}} type="date" sx={{ width: "400px" }} value={periodto} onChange={(e) => {setPeriodto(e.target.value) }}/>
                <br />
                <br />
                <TextField id="filled-basic" label="持込・持出先" select  sx={{ width: "400px" }} value={selectedOption} onChange={handleOptionChange}
                      InputLabelProps={{shrink: true,}} InputProps={{style: {textAlign: 'left',},}}>
                      {Where.map((item:string, index:any) => (
                        <MenuItem key={index} value={item}>
                           {item}
                        </MenuItem>
                      ))}
                </TextField>
                <br />
                {selectedOption === 'その他' && (
                  <TextField
                  label="Other"
                  value={otherInput}
                  onChange={handleOtherInputChange}
                  fullWidth
                  sx={{ width: 400 }}
                  />
                )}

                <br />
                <TextField id="filled-basic" label="データまたは資料名" InputLabelProps={{shrink: true}}  sx={{ width: "400px" }} value={materials} onChange={(e) => {setMaterials(e.target.value) }}/>
                <br />
                <br />
                <TextField id="filled-basic" label="媒体・ＰＣ 設備番号" select sx={{ width: "400px" }} value={media} onChange={(e) => {setMedia(e.target.value) }}
                    InputLabelProps={{shrink: true,}} InputProps={{style: {textAlign: 'left',},}}>
                      <MenuItem value="PC">PC</MenuItem>
                      <MenuItem value="スマートフォン">スマートフォン</MenuItem>
                      <MenuItem value="USBメモリ">USBメモリ</MenuItem>
                      <MenuItem value="外付けHDD">外付けHDD</MenuItem>
                      <MenuItem value="その他">その他</MenuItem>
                </TextField>
                <br />
                <br />

                <Button onClick={handleReset} variant="outlined"  sx={{ width: 150 }}>キャンセル</Button>
                <Button variant="contained" type='submit' sx={{ width: 150 }}>承認依頼</Button>
            </form>
            )}
          </Box>
          </StyledBox>
        </>
    )
}
export default NewPost

const StyledBox = styled(Box)`
  .form {
    display: flex;
    justify-content: center;
    width: 100%;
    text-align: center;
  }
`;

