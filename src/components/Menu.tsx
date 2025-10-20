// src/components/Menu.tsx
import * as React from "react";
import styled from "@emotion/styled";
import { Tooltip, IconButton, ButtonGroup, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import ListAltIcon from "@mui/icons-material/ListAlt";
import DevicesOtherIcon from "@mui/icons-material/DevicesOther";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ApprovalsInboxButton from "./ApprovalsInboxButton";

import { useEffect, useState } from "react";
import { useUser } from "./UserContext";
import { db } from "../firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

// ▼ 追加：分離したダイアログ
import VersionDialog from "./VersionDialog";

export const Menu: React.FC = () => {
  const navigate = useNavigate();

  const { user } = useUser();
  const userEmail = (user?.email ?? "").trim();

  const [isSupervisor, setIsSupervisor] = useState(false);

  // ▼ バージョンダイアログ制御
  const [openVersion, setOpenVersion] = useState(false);
  const handleOpenVersion = () => setOpenVersion(true);
  const handleCloseVersion = () => setOpenVersion(false);

  useEffect(() => {
    if (!userEmail) {
      setIsSupervisor(false);
      return;
    }

    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", userEmail));

    const unsub = onSnapshot(
      q,
      (snap) => {
        let supervisor = false;
        snap.docs.forEach((d) => {
          const v = d.data() as { supervising_responsible?: boolean };
          if (v?.supervising_responsible) supervisor = true;
        });
        setIsSupervisor(supervisor);
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
  const handleEquipmentMgmt = () => navigate("/equipment");

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
            {/* 一覧 */}
            <Tooltip title="媒体等持込持出一覧" arrow>
              <IconButton onClick={handleLogoClick} color="inherit" aria-label="媒体等持込持出一覧">
                <ListAltIcon />
              </IconButton>
            </Tooltip>

            {/* ユーザ管理（責任者のみ表示） */}
            {isSupervisor && (
              <Tooltip title="ユーザ管理" arrow>
                <IconButton onClick={handleUserMgmt} color="inherit" aria-label="ユーザ管理">
                  <PersonAddAlt1Icon />
                </IconButton>
              </Tooltip>
            )}

            {/* 機器台帳管理（全員に表示） */}
            <Tooltip title="機器台帳管理" arrow>
              <IconButton onClick={handleEquipmentMgmt} color="inherit" aria-label="機器台帳管理">
                <DevicesOtherIcon />
              </IconButton>
            </Tooltip>

            {/* バージョン表示（別コンポーネントのダイアログを開く） */}
            <Tooltip title="バージョン履歴" arrow>
              <IconButton onClick={handleOpenVersion} color="inherit" aria-label="バージョン履歴">
                <InfoOutlinedIcon />
              </IconButton>
            </Tooltip>

            {/* 承認バッジ（責任者のみ表示） */}
            {isSupervisor && <ApprovalsInboxButton />}

            {/* ログアウト */}
            <Tooltip title="ログアウト" arrow>
              <IconButton onClick={handleLogin} color="inherit" aria-label="ログアウト">
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </ButtonGroup>
        </Box>
      </StyledBox>

      {/* ▼ 分離したダイアログ */}
      <VersionDialog open={openVersion} onClose={handleCloseVersion} />

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
