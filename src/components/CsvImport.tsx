import React from "react";
import { Tooltip, IconButton, LinearProgress, Box, Typography } from "@mui/material";
import FileUploadIcon from "@mui/icons-material/FileUpload";

type Props = {
  importing: boolean;
  progress: number;
  message: string | null;
  onPick: (file: File) => void;
};

export const CsvImport: React.FC<Props> = ({ importing, progress, message, onPick }) => {
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  return (
    <>
      <Tooltip title="CSVからインポート（全件置換）" arrow>
        <span>
          <IconButton color="primary" size="large" onClick={() => fileRef.current?.click()} disabled={importing}>
            <FileUploadIcon />
          </IconButton>
        </span>
      </Tooltip>
      <input
        type="file"
        ref={fileRef}
        hidden
        accept=".csv,text/csv"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0] || null;
          e.currentTarget.value = "";
          if (f) onPick(f);
        }}
      />
      {importing && (
        <Box sx={{ px: 2, pb: 1 }}>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="caption">
            {progress}% {message ?? ""}
          </Typography>
        </Box>
      )}
      {!importing && message && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Typography variant="caption">{message}</Typography>
        </Box>
      )}
    </>
  );
};
