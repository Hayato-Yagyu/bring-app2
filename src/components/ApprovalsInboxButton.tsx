// src/components/ApprovalsInboxButton.tsx
import React from "react";
import { Badge, IconButton, Tooltip } from "@mui/material";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useUser } from "./UserContext";

const ADMIN_EMAIL = "hayato.yagyu@digitalsoft.co.jp";

const ApprovalsInboxButton: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [count, setCount] = React.useState<number>(0);

  React.useEffect(() => {
    if (!user?.email) {
      setCount(0);
      return;
    }
    const approvalsRef = collection(db, "approvals");
    const q = user.email === ADMIN_EMAIL ? query(approvalsRef, where("status", "==", "pending")) : query(approvalsRef, where("status", "==", "pending"), where("assigneeEmail", "==", user.email));

    const unsub = onSnapshot(
      q,
      (snap) => setCount(snap.size),
      (err) => {
        console.error("approvals badge onSnapshot error:", err);
        setCount(0);
      }
    );
    return () => unsub();
  }, [user?.email]);

  const handleClick = () => {
    // ★ BringList へ遷移しつつ、「到着したら承認ダイアログを開いてね」というフラグを渡す
    navigate("/BringList", { state: { approvalsOpen: true } });
  };

  return (
    <Tooltip title="承認依頼ボックス" arrow>
      <span>
        <IconButton color="inherit" aria-label="承認依頼ボックス" onClick={handleClick}>
          <Badge badgeContent={count} color="secondary" max={99}>
            <MailOutlineIcon />
          </Badge>
        </IconButton>
      </span>
    </Tooltip>
  );
};

export default ApprovalsInboxButton;
