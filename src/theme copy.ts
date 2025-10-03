// src/theme.ts
import { createTheme, alpha } from "@mui/material/styles";
import type {} from "@mui/x-data-grid/themeAugmentation";

let theme = createTheme({
  palette: {
    primary: { main: "#00BF4F", dark: "#009640", light: "#4CFF89", contrastText: "#fff" },
    background: { default: "#fff" },
  },
  components: {
    MuiButton: { defaultProps: { color: "primary", variant: "contained" } },
    MuiIconButton: { defaultProps: { color: "primary" } },
  },
});

theme = createTheme(theme, {
  components: {
    MuiDataGrid: {
      styleOverrides: {
        // ★ v7/環境差分に強い “root からの子孫セレクタ” でヘッダ背景を薄グレーに
        root: {
          // 旧来のヘッダコンテナ
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: theme.palette.grey[100],
          },
          // v7 で使われるトップコンテナ行（こちらが優先される環境あり）
          "& .MuiDataGrid-container--top [role='row']": {
            backgroundColor: theme.palette.grey[100],
          },
          // ピン留め領域（列/行）も同系色に
          "& .MuiDataGrid-pinnedColumns, & .MuiDataGrid-pinnedRows": {
            backgroundColor: theme.palette.grey[100],
          },
        },

        // 見出し文字は太字に
        columnHeaderTitle: { fontWeight: 600 },

        // 行：うっすら緑 → ホバー/選択で段階的に濃く
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
