// src/hooks/useSeatMasters.ts
import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

export type SeatMaster = {
  id: string; // doc id (文字列 "1"〜"26")
  number: number; // 数値 1〜26
  label: string; // 表示 "1"〜"26"
  enabled?: boolean;
  note?: string;
  zone?: string;
};

export const useSeatMasters = () => {
  const [seats, setSeats] = useState<SeatMaster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const q = query(collection(db, "seatMasters"), orderBy("number", "asc"));
        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SeatMaster, "id">),
        }));
        setSeats(rows);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return { seats, loading };
};
