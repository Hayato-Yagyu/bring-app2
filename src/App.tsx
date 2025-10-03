import React, { useState } from "react";
import { Box, Button, TextField, Typography, CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { auth } from "./firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useUser } from "./components/UserContext";
import theme from "./theme"; // ← アプリ共通テーマ（primary.main = #00BF4F など）

const App = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const { setUser } = useUser();

  const handleLogin = async () => {
    await signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        setUser(userCredential.user);
        navigate("/BringList");
      })
      .catch((error) => {
        alert(error.message);
        console.error(error);
      });
  };

  const handleChangeEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.currentTarget.value);
  };
  const handleChangePassword = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.currentTarget.value);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* 画面全体の背景をメインカラーに */}
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            width: "auto",
            flexDirection: "column",
            alignItems: "center",
            margin: { xs: "20px", sm: "100px" },
            border: "2px solid gray",
            padding: { xs: "20px", sm: "100px" },
            gap: { xs: "20px", sm: "40px" },
            bgcolor: "transparent", // 背景は外側 Box に任せる
          }}
        >
          <Typography variant="h5">媒体等持込持出記録</Typography>

          <TextField label="メールアドレス" name="email" variant="standard" value={email} onChange={handleChangeEmail} sx={{ width: "100%" }} />

          <TextField label="パスワード" name="password" type="password" variant="standard" value={password} onChange={handleChangePassword} sx={{ width: "100%" }} />

          {/* テーマの defaultProps により primary/contained が既定で適用 */}
          <Button sx={{ width: "100%" }} onClick={handleLogin}>
            ログイン
          </Button>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
