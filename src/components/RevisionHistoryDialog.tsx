import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Box, MenuItem } from "@mui/material";

type FormValue = {
  no: string;
  content: string;
  createdAtYmd: string; // "YYYY-MM-DD"
  author: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: FormValue) => void;
  // 編集時のみ渡す
  initial?: Partial<FormValue> | null;
  // 記載者の候補（ユーザー一覧）
  authors?: Array<{ key: string; label: string }>;
};

const isNonEmpty = (v: unknown) => typeof v === "string" && v.trim().length > 0;

export const RevisionHistoryDialog: React.FC<Props> = ({ open, onClose, onSubmit, initial, authors = [] }) => {
  const [v, setV] = useState<FormValue>({
    no: "",
    content: "",
    createdAtYmd: "",
    author: "",
  });

  useEffect(() => {
    if (open) {
      setV({
        no: initial?.no ?? "", // ★ 編集時・新規どちらも読み取り専用
        content: initial?.content ?? "",
        createdAtYmd: initial?.createdAtYmd ?? "",
        author: initial?.author ?? "",
      });
    }
  }, [open, initial]);

  const errors = useMemo(
    () => ({
      // ★ No.は自動採番なので必須チェックは不要（false固定）
      no: false,
      content: !isNonEmpty(v.content),
      createdAtYmd: !isNonEmpty(v.createdAtYmd),
      author: !isNonEmpty(v.author),
    }),
    [v]
  );

  const isValid = useMemo(() => Object.values(errors).every((x) => !x), [errors]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{initial ? "改訂履歴の編集" : "改訂履歴の追加"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1}>
          <Box display="flex" gap={2}>
            {/* 🔹 No.は自動採番・読み取り専用 */}
            <TextField label="No.（自動採番）" value={v.no} size="small" fullWidth InputProps={{ readOnly: true }} helperText="自動で割り振られます" />
            <TextField
              label="制定日"
              type="date"
              value={v.createdAtYmd}
              onChange={(e) => setV((p) => ({ ...p, createdAtYmd: e.target.value }))}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              error={errors.createdAtYmd}
              helperText={errors.createdAtYmd ? "必須です" : ""}
            />
            <TextField
              label="記載者"
              select
              value={v.author}
              onChange={(e) => setV((p) => ({ ...p, author: e.target.value }))}
              size="small"
              fullWidth
              error={errors.author}
              helperText={errors.author ? "必須です" : ""}
            >
              {authors.length
                ? authors.map((u) => (
                    <MenuItem key={u.key} value={u.label}>
                      {u.label}
                    </MenuItem>
                  ))
                : null}
            </TextField>
          </Box>
          <TextField
            label="内容"
            value={v.content}
            onChange={(e) => setV((p) => ({ ...p, content: e.target.value }))}
            multiline
            rows={8}
            fullWidth
            size="small"
            error={errors.content}
            helperText={errors.content ? "必須です" : ""}
            placeholder="改訂内容を入力してください"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={() => isValid && onSubmit(v)} variant="contained" disabled={!isValid}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};
