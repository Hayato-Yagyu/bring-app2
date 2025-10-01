import * as React from "react";
import styled from "@emotion/styled";
import { Tooltip, IconButton, ButtonGroup, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import NoteAddIcon from "@mui/icons-material/NoteAdd";

export const Menu = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate("/");
  };

  const handleNewPost = () => {
    navigate("/NewPost");
  };

  // ロゴクリックで一覧に戻る等、任意の遷移にしたい場合
  const handleLogoClick = () => {
    navigate("/BringList");
  };

  return (
    <>
      <StyledBox>
        <Box
          className="form"
          component="section"
          sx={{
            p: 2,
            border: "1px dashed grey",
            bgcolor: "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between", // 左:ロゴ / 右:アイコン
            gap: 2,
          }}
        >
          {/* 左：ロゴ */}
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Tooltip title="KDSbring">
              <Box component="img" src={`${process.env.PUBLIC_URL}/KDSbring_title.png`} alt="KDSbring" sx={{ height: 36, cursor: "pointer", userSelect: "none" }} onClick={handleLogoClick} />
            </Tooltip>
          </Box>

          {/* 右：アイコン群 */}
          <ButtonGroup size="large" aria-label="Large button group">
            {/* 新規登録アイコンのみ */}
            <Tooltip title="新規登録">
              <IconButton onClick={handleNewPost}>
                <NoteAddIcon sx={{ color: "white" }} />
              </IconButton>
            </Tooltip>

            {/* ログアウトアイコンのみ */}
            <Tooltip title="ログアウト">
              <IconButton onClick={handleLogin}>
                <LogoutIcon sx={{ color: "white" }} />
              </IconButton>
            </Tooltip>
          </ButtonGroup>
        </Box>
      </StyledBox>
      <br />
    </>
  );
};

const StyledBox = styled(Box)`
  display: flex;
  justify-content: center;

  .form {
    width: 100%;
    /* 右寄せはやめ、上の sx で flex 布置 */
    text-align: left;
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
