// src/components/Menu.tsx
import * as React from "react";
import styled from "@emotion/styled";
import { Tooltip, IconButton, ButtonGroup, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import ListAltIcon from "@mui/icons-material/ListAlt"; // BringList へ
import DevicesOtherIcon from "@mui/icons-material/DevicesOther"; // 機器台帳管理
import ApprovalsInboxButton from "./ApprovalsInboxButton"; // 承認バッジボタン

// ユーザ情報と Firestore
import { useEffect, useState } from "react";
import { useUser } from "./UserContext";
import { db } from "../firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

export const Menu: React.FC = () => {
  const navigate = useNavigate();

  // ログインユーザ
  const { user } = useUser();
  const userEmail = (user?.email ?? "").trim();

  // 権限フラグ
  const [isSupervisor, setIsSupervisor] = useState(false); // supervising_responsible
  const [canManageEquipment, setCanManageEquipment] = useState(false); // equipmentManagement || supervising_responsible

  // users コレクションから権限をリアルタイム購読
  useEffect(() => {
    // 未ログイン時は非表示
    if (!userEmail) {
      setIsSupervisor(false);
      setCanManageEquipment(false);
      return;
    }

    const usersRef = collection(db, "users");
    // ★ email 完全一致で全件購読（limit(1)は付けない）
    const q = query(usersRef, where("email", "==", userEmail));

    const unsub = onSnapshot(
      q,
      (snap) => {
        // 同一メールの複数ドキュメントを集計して OR 判定
        let supervisor = false;
        let equip = false;

        snap.docs.forEach((d) => {
          const v = d.data() as { supervising_responsible?: boolean; equipmentManagement?: boolean };
          if (v?.supervising_responsible) supervisor = true;
          if (v?.equipmentManagement) equip = true;
        });

        setIsSupervisor(supervisor);
        setCanManageEquipment(supervisor || equip);
      },
      (err) => {
        console.error("users load error:", err);
        setIsSupervisor(false);
        setCanManageEquipment(false);
      }
    );

    return () => unsub();
  }, [userEmail]);

  // ルーティング
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
            <Tooltip title="媒体等持込持出一覧" arrow>
              <IconButton onClick={handleLogoClick} color="inherit" aria-label="媒体等持込持出一覧">
                <ListAltIcon />
              </IconButton>
            </Tooltip>

            {/* supervising_responsible = true のときだけ表示：ユーザ管理 */}
            {isSupervisor && (
              <Tooltip title="ユーザ管理" arrow>
                <IconButton onClick={handleUserMgmt} color="inherit" aria-label="ユーザ管理">
                  <PersonAddAlt1Icon />
                </IconButton>
              </Tooltip>
            )}

            {/* ★ 追加：ユーザ管理の次に表示（equipmentManagement または supervising_responsible が true） */}
            {canManageEquipment && (
              <Tooltip title="機器台帳管理" arrow>
                <IconButton onClick={handleEquipmentMgmt} color="inherit" aria-label="機器台帳管理">
                  <DevicesOtherIcon />
                </IconButton>
              </Tooltip>
            )}

            {/* supervising_responsible = true のときだけ承認バッジを表示 */}
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
