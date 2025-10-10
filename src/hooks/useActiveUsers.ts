import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { UserDoc } from "../types/equipment";
import { isActiveToday } from "../utils/users";

export const useActiveUsers = () => {
  const [options, setOptions] = useState<Array<{ key: string; label: string }>>([]);
  const [raws, setRaws] = useState<UserDoc[]>([]);

  useEffect(() => {
    const qUsers = query(collection(db, "users"), orderBy("staffcode", "asc"));
    const unsub = onSnapshot(qUsers, (snap) => {
      const today = new Date();
      const items: Array<{ key: string; label: string }> = [];
      const arr: UserDoc[] = [];

      snap.docs.forEach((d) => {
        const u = d.data() as UserDoc;
        if (!isActiveToday(u, today)) return;

        const staff = (u.staffcode ?? "").trim();
        const name = (u.displayName ?? "").trim();
        const email = (u.email ?? "").trim();

        const label = [staff, name].filter(Boolean).join(" ") + (email ? `（${email}）` : "");
        const key = name || email || staff || "";
        if (key) {
          items.push({ key, label });
          arr.push({ staffcode: staff, displayName: name, email, startDate: u.startDate ?? null, endDate: u.endDate ?? null });
        }
      });

      setOptions(items);
      setRaws(arr);
    });
    return () => unsub();
  }, []);

  return { activeUsers: options, activeUserRaw: raws };
};
