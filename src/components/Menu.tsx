import * as React from 'react';
import Box from '@mui/material/Box';
import styled from '@emotion/styled';
import { Button, ButtonGroup} from '@mui/material';
import { useNavigate } from "react-router-dom";
import * as sgMail from '@sendgrid/mail';





export const Menu = () => {
    const navigate = useNavigate()
    const handleLogin = () => {
      navigate('/')
     }

    const handleNewPost = () => {
      navigate('/NewPost')
     }

     const handleBringList = () => {
      navigate('/BringList')
     }

  return (
    <>
    <StyledBox>
      <Box className='form' component="section"  sx={{ p: 2, border: '1px dashed grey', bgcolor:'primary.main'}}>
        <ButtonGroup size="large" aria-label="Large button group" >
          <Button className='text' onClick={handleNewPost}>新規作成</Button>
          <Button className='text' onClick={handleBringList}>既存編集</Button>
          <Button className='text' onClick={handleLogin}>戻る</Button>
        </ButtonGroup>
      </Box>
    </StyledBox>
    <br />
    </>
  )
}

const StyledBox = styled(Box)`
  display: flex;
  justify-content: center;
  .form {
    width: 100%;
    text-align: right;
  }
  .text {
    text-align: center;
    color: white;
  }
  .btn {
    width: 60%;
    color: green;
    text-align: center;
    margin: 1.5rem 0;
  }
  .login {
    background-color: lightseagreen;
  }
  .signup {
    background-color: #06579b;
  }
`;