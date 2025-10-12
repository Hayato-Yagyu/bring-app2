import React, { useRef } from "react";
import { IconButton, Tooltip, LinearProgress, Typography, Box, Stack } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useAssetCategories } from "../hooks/useAssetCategories"; // ← これでOK（一覧用は useAssetCategoryList）

export const AssetCategoryImportButton: React.FC = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { importing, progress, message, importCategoryCsv } = useAssetCategories();

  const handlePick = async (file: File) => {
    await importCategoryCsv(file);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: 140 }}>
      <Tooltip title="対象機器一覧をCSVからインポート" arrow>
        <IconButton color="primary" onClick={() => inputRef.current?.click()} disabled={importing} size="small">
          <UploadFileIcon />
        </IconButton>
      </Tooltip>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handlePick(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />

      {importing && (
        <Stack spacing={0.5} sx={{ width: 140 }}>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="caption" color="text.secondary" align="right">
            {progress}%
          </Typography>
        </Stack>
      )}
      {message && (
        <Typography variant="caption" color="primary" align="right" sx={{ mt: 0.25 }}>
          {message}
        </Typography>
      )}
    </Box>
  );
};
