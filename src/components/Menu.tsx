import * as React from "react";
import styled from "@emotion/styled";
import { Tooltip, IconButton, ButtonGroup, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import DownloadIcon from "@mui/icons-material/Download";

// BringList から受け取る
type MenuProps = {
  csvData?: any[]; // 必要なら行型に合わせて厳密型に
};

export const Menu: React.FC<MenuProps> = ({ csvData = [] }) => {
  const navigate = useNavigate();

  const handleLogin = () => navigate("/");
  const handleNewPost = () => navigate("/NewPost");
  const handleLogoClick = () => navigate("/BringList");

  // CSVダウンロード処理（BOM付き：Excel文字化け対策）
  const handleExportCsv = () => {
    if (!csvData.length) return;

    const headers = Object.keys(csvData[0] ?? {});
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      const needsQuote = /[",\r\n]/.test(s);
      const body = s.replace(/"/g, '""');
      return needsQuote ? `"${body}"` : body;
    };

    const rows = [headers.map(esc).join(","), ...csvData.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\r\n");

    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, rows], { type: "text/csv;charset=utf-8;" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "BringList.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
            bgcolor: "#00BF4F", // あなたが選んだ少し濃い鮮やかな緑
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          {/* 左：ロゴ */}
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Tooltip title="KDSbring" arrow>
              <Box component="img" src={`${process.env.PUBLIC_URL}/KDSbring_title.png`} alt="KDSbring" sx={{ height: 36, cursor: "pointer", userSelect: "none" }} onClick={handleLogoClick} />
            </Tooltip>
          </Box>

          {/* 右：アイコン群 */}
          <ButtonGroup size="large" aria-label="Large button group">
            {/* 新規登録 */}
            <Tooltip title="新規登録" arrow>
              <IconButton onClick={handleNewPost}>
                <NoteAddIcon sx={{ color: "white" }} />
              </IconButton>
            </Tooltip>

            {/* CSVダウンロード */}
            <Tooltip title="CSV出力" arrow>
              <span>
                <IconButton onClick={handleExportCsv} disabled={!csvData.length}>
                  <DownloadIcon sx={{ color: "white" }} />
                </IconButton>
              </span>
            </Tooltip>

            {/* ログアウト */}
            <Tooltip title="ログアウト" arrow>
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
    text-align: left;
  }
`;
