import React, {  useState } from "react";
import {  Box, Button,   TextField, Typography } from '@mui/material';
import { useNavigate } from "react-router-dom";

import { auth } from "./firebase";
import { signInWithEmailAndPassword} from "firebase/auth";


const App = () => {

  const navigate = useNavigate()

  const handleBringList = () => {
      navigate('/BringList')
  }
  const handleAuth = () => {
    navigate('/Auth')
  }
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const handleLogin = async () => {

    await signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        console.log(userCredential);
        navigate('/BringList');
      })
      .catch((error) => {
        alert(error.message);
        console.error(error);
      });
  }
  
  const handleChangeEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.currentTarget.value);
  };
  const handleChangePassword = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.currentTarget.value);
  };

  return (
    <>
      
         <Box sx={{ display: 'flex', justifyContent: 'center', width: 'auto', flexDirection: 'column', alignItems:'center', margin:'100px',border: '2px solid gray', padding:'100px', gap: '40px' }}>
            <Typography variant={'h5'}>媒体等持込持出記録</Typography>
            <TextField label="メールアドレス" name="email" variant="standard" value={email} onChange={(event: React.ChangeEvent<HTMLInputElement>) => {handleChangeEmail(event) }} sx={{ width: '100%'}} />
            <TextField label="パスワード" name="password" variant="standard" type="password" value={password} onChange={(event: React.ChangeEvent<HTMLInputElement>) => {handleChangePassword(event)}} sx={{ width: '100%'}} />
            <Button variant="contained" sx={{ width: '100%' }} onClick={handleLogin}>ログイン</Button>
            <Button variant="contained" sx={{ width: '100%' }} onClick={handleAuth} color="success">新規ユーザー登録はこちら</Button>
        </Box>
     
      
    </>
  );
};


export default App;