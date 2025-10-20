// src/components/VersionDialog.tsx
import * as React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TableContainer, Paper, Table, TableHead, TableRow, TableCell, TableBody } from "@mui/material";
import { versionHistory } from "../versionHistory";

type Props = {
  open: boolean;
  onClose: () => void;
};

const VersionDialog: React.FC<Props> = ({ open, onClose }) => {
  // ▼ version を昇順（古い順）にソート
  const sortedHistory = React.useMemo(() => {
    return [...versionHistory].sort((a, b) => {
      // version 文字列（例: "1.2.0"）を数値配列にして比較
      const parse = (v: string) => v.split(".").map((n) => parseInt(n, 10));
      const [a1, a2 = 0, a3 = 0] = parse(a.version);
      const [b1, b2 = 0, b3 = 0] = parse(b.version);
      if (a1 !== b1) return a1 - b1;
      if (a2 !== b2) return a2 - b2;
      return a3 - b3;
    });
  }, []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>バージョン履歴</DialogTitle>
      <DialogContent dividers>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="version history table" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, width: 120 }}>Version</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 140 }}>変更日</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>変更内容</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedHistory.map((row, idx) => (
                <TableRow key={`${row.version}-${idx}`} hover>
                  {/* ▼ ここを上寄せ */}
                  <TableCell sx={{ verticalAlign: "top" }}>{row.version}</TableCell>
                  {/* ▼ ここも上寄せ */}
                  <TableCell sx={{ verticalAlign: "top" }}>{row.date}</TableCell>
                  <TableCell sx={{ whiteSpace: "pre-wrap", verticalAlign: "top" }}>{row.changes}</TableCell>
                </TableRow>
              ))}
              {sortedHistory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>まだ履歴がありません。</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus>
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VersionDialog;
