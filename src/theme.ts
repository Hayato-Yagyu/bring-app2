// src/theme.ts
import { createTheme, alpha } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";
import { pink } from "@mui/material/colors";

// 1) ベーステーマ（さらに薄いピンクへ）
let theme = createTheme({
  palette: {
    primary: {
      main: pink[300], // ← 400 → 300 にトーンダウン（例: #F06292）
      dark: pink[500], // 例: #E91E63（ボタンの濃色に使いたい場合に備え保持）
      light: pink[100], // 例: #F8BBD0
      contrastText: "#fff", // 文字が見えにくければ "#212121" に変更可（下記参照）
    },
    background: { default: "#fff" },
  },
  components: {
    MuiButton: { defaultProps: { color: "primary", variant: "contained" } },
    MuiIconButton: { defaultProps: { color: "primary" } },
  },
});

// 2) DataGrid の見た目を統一（ヘッダ=薄グレー、行=さらに薄いピンク）
theme = createTheme(theme, {
  components: {
    MuiDataGrid: {
      styleOverrides: {
        // v7/環境差分に強い: root からの子孫セレクタでヘッダ背景を固定
        root: {
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: theme.palette.grey[100], // 例: #f5f5f5
          },
          "& .MuiDataGrid-container--top [role='row']": {
            backgroundColor: theme.palette.grey[100],
          },
          "& .MuiDataGrid-pinnedColumns, & .MuiDataGrid-pinnedRows": {
            backgroundColor: theme.palette.grey[100],
          },
        },

        // 見出し文字は太字
        columnHeaderTitle: { fontWeight: 600 },

        // 行：さらに薄いピンク（以前より α を軽めに）
        row: {
          backgroundColor: alpha(theme.palette.primary.main, 0.06),
          "&.Mui-hovered": {
            backgroundColor: `${alpha(theme.palette.primary.main, 0.1)} !important`,
          },
          "&.Mui-selected": {
            backgroundColor: `${alpha(theme.palette.primary.main, 0.16)} !important`,
            "&:hover": {
              backgroundColor: `${alpha(theme.palette.primary.main, 0.2)} !important`,
            },
          },
        },
      },
    },
  },
});

export default theme;
