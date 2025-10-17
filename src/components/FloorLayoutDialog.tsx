import React from "react";
import { Dialog, DialogTitle, DialogContent, IconButton, Box } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

type Props = {
  open: boolean;
  onClose: () => void;
  /** public配下 or 取得URL */
  src: string;
};

export const FloorLayoutDialog: React.FC<Props> = ({ open, onClose, src }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        フロアレイアウト
        <IconButton aria-label="close" onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box component="img" src={src} alt="フロアレイアウト" sx={{ width: "100%", height: "auto", display: "block" }} />
      </DialogContent>
    </Dialog>
  );
};
