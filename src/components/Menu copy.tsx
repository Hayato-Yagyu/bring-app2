// src/components/Menu.tsx
import * as React from "react";
import styled from "@emotion/styled";
import { Tooltip, IconButton, ButtonGroup, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import ListAltIcon from "@mui/icons-material/ListAlt"; // BringList へ
import ApprovalsInboxButton from "./ApprovalsInboxButton"; // 承認バッジボタン

// ★ 追加：ユーザ情報と Firestore
import { useEffect, useState } from "react";
import { useUser } from "./UserContext";
import { db } from "../firebase";
import { collection, onSnapshot, query, where, limit } from "firebase/firestore";

export const Menu: React.FC = () => {
  const navigate = useNavigate();

  // ★ 追加：ログインユーザ
  const { user } = useUser();
  const userEmail = user?.email ?? "";

  // ★ 追加：監督責任（supervising_responsible）フラグ
  const [isSupervisor, setIsSupervisor] = useState(false);

  // ★ 追加：users コレクションから権限をリアルタイム購読
  useEffect(() => {
    // 未ログイン時は非表示
    if (!userEmail) {
      setIsSupervisor(false);
      return;
    }
    const usersRef = collection(db, "users");
    // email 一致 & supervising_responsible = true のドキュメントが存在するか
    const q = query(usersRef, where("email", "==", userEmail), where("supervising_responsible", "==", true), limit(1));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setIsSupervisor(!snap.empty);
      },
      (err) => {
        console.error("users load error:", err);
        setIsSupervisor(false);
      }
    );

    return () => unsub();
  }, [userEmail]);

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

            {/* ★ supervising_responsible = true のときだけ表示 */}
            {isSupervisor && (
              <Tooltip title="ユーザ管理" arrow>
                <IconButton onClick={handleUserMgmt} color="inherit" aria-label="ユーザ管理">
                  <PersonAddAlt1Icon />
                </IconButton>
              </Tooltip>
            )}

            {/* ★ supervising_responsible = true のときだけ承認バッジを表示 */}
            {isSupervisor && <ApprovalsInboxButton />}

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
