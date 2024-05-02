import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import {db} from "../firebase";
import Button from '@mui/material/Button';
import '../App.css';
import { Menu } from '../components/Menu';
import { Typography,TextField, Box} from '@mui/material';
import styled from '@emotion/styled';
import { render } from '@react-email/render'
import sendgrid from '@sendgrid/mail'
import { Email } from '../components/Email'





const NewPost = () => {
    const [applicant, setApplicant] = useState("");
    const [classification, setClassification] = useState("");
    const [period, setPeriod] = useState("");
    const [where, setWhere] = useState("");
    const [materials, setMaterials] = useState("");
    const [media, setMedia] = useState("");
    const [permitdate, setPermitdate] = useState("");
    const [permitstamp, setPermitstamp] = useState("");
    const [confirmationdate, setConfirmationdate] = useState("");
    const [confirmationstamp, setConfirmationstamp] = useState("");
 
    const [disable, setDisable] = useState(false);
    const [text, enableButton] = useState<boolean>(false);

    const onSubmit = async (e:any) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, "posts"), {
                applicant:applicant,
                classification:classification,
                period:period,
                where:where,
                materials:materials,
                media:media,
                permitdate:permitdate,
                permitstamp:permitstamp,
                confirmationdate:confirmationdate,
                confirmationstamp:confirmationstamp
            });
            setApplicant('')
            setClassification('')
            setPeriod('')
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
        
    };
    
    const handleApproval = () => {

    }
    
    return (
        <>
          <Menu />
          
          <Typography variant='h4' align='center' borderBottom={'2px solid gray'}>媒体等持込持出記録</Typography> 
          <StyledBox>
          <Box className='form' >
            <form onSubmit={onSubmit} >
                <br />
                <TextField id="filled-basic" label="申請者" variant="filled"  sx={{ width: "800px" }} value={applicant} onChange={(e) => {setApplicant(e.target.value); enableButton(true); }}/>
                <br />
                <TextField id="filled-basic" label="持出・持込区分" variant="filled" sx={{ width: "800px" }} value={classification} onChange={(e) => {setClassification(e.target.value); enableButton(true); }}/>
                <br />
                <TextField id="filled-basic" label="持込・持出日" variant="filled" sx={{ width: "800px" }} value={period} onChange={(e) => {setPeriod(e.target.value); enableButton(true); }}/>
                <br />
                <TextField id="filled-basic" label="持込・持出先" variant="filled" sx={{ width: "800px" }} value={where} onChange={(e) => {setWhere(e.target.value); enableButton(true); }}/>
                <br />
                <TextField id="filled-basic" label="データまたは資料名" variant="filled" sx={{ width: "800px" }} value={materials} onChange={(e) => {setMaterials(e.target.value); enableButton(true); }}/>
                <br />
                <TextField id="filled-basic" label="媒体・PC" variant="filled" sx={{ width: "800px" }} value={media} onChange={(e) => {setMedia(e.target.value); enableButton(true); }}/>
                <br />
                <TextField id="filled-basic" label="許可日" variant="filled" sx={{ width: "800px" }} value={permitdate} onChange={(e) => {setPermitdate(e.target.value); enableButton(true); }}/>
                <br />
                <TextField id="filled-basic" label="許可者印" variant="filled" sx={{ width: "800px" }} value={permitstamp} onChange={(e) => {setPermitstamp(e.target.value); enableButton(true); }}/>
                <br />
                <TextField id="filled-basic" label="持出返却確認日" variant="filled" sx={{ width: "800px" }} value={confirmationdate} onChange={(e) => {setConfirmationdate(e.target.value); enableButton(true); }}/>
                <br />
                <TextField id="filled-basic" label="確認者印" variant="filled" sx={{ width: "800px" }} value={confirmationstamp} onChange={(e) => {setConfirmationstamp(e.target.value); enableButton(true); }}/>
                <br />
                <br />
                <br />             
                <Button disabled={!text} onClick={() => setDisable(true)} variant="contained" type='submit' >保存</Button>
                <Button disabled={!text} onClick={handleApproval} variant="contained" type='submit' color="success">承認依頼</Button>
            </form>
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
    text-align: right;
  }
`;

