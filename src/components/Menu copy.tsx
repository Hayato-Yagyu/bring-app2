// src/components/Menu.tsx
import * as React from "react";
import styled from "@emotion/styled";
import { Tooltip, IconButton, ButtonGroup, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import ListAltIcon from "@mui/icons-material/ListAlt"; // BringList へ
import ApprovalsInboxButton from "./ApprovalsInboxButton"; // ★ 追加：承認バッジボタン

export const Menu: React.FC = () => {
  const navigate = useNavigate();

  const handleLogin = () => navigate("/");
  const handleLogoClick = () => navigate("/BringList");
  const handleUserMgmt = () => navigate("/users");

  return (
    <>
      <StyledBox>
        <Box
          className="form"
          component="section"
          sx={{
            p: 2,
            border: 1,
            borderStyle: "dashed",
            borderColor: "primary.dark",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          {/* 左：ロゴ（クリックで一覧へ） */}
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Tooltip title="KDSbring" arrow>
              <Box component="img" src={`${process.env.PUBLIC_URL}/KDSbring_title.png`} alt="KDSbring" sx={{ height: 36, cursor: "pointer", userSelect: "none" }} onClick={handleLogoClick} />
            </Tooltip>
          </Box>

          {/* 右：アイコン群 */}
          <ButtonGroup size="large" aria-label="Large button group">
            <Tooltip title="媒体等持込持出一覧" arrow>
              <IconButton onClick={handleLogoClick} color="inherit" aria-label="媒体等持込持出一覧">
                <ListAltIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="ユーザ管理" arrow>
              <IconButton onClick={handleUserMgmt} color="inherit" aria-label="ユーザ管理">
                <PersonAddAlt1Icon />
              </IconButton>
            </Tooltip>

            {/* ★ 承認バッジ（管理者のみ内部で表示）。クリックで一覧ダイアログ */}
            <ApprovalsInboxButton />

            <Tooltip title="ログアウト" arrow>
              <IconButton onClick={handleLogin} color="inherit" aria-label="ログアウト">
                <LogoutIcon />
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
    text-align: left;
  }
`;
