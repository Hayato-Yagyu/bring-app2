// src/versionHistory.ts
export type VersionItem = {
  version: string; // 例: "1.2.0"
  date: string; // 例: "2025-10-20"（表示したいフォーマットでOK）
  changes: string; // 変更内容（自由記述、改行は \n でOK）
};

// ここを更新していくだけで、メニューのバージョン表に反映されます
export const versionHistory: VersionItem[] = [
  { version: "1.0.0", date: "2024-05-07", changes: "初回リリース" },
  {
    version: "2.0.0",
    date: "2025-10-21",
    changes: `全面リニューアル
       ①アプリ名をKDSbringに変更
       ②UIの改善
       ③承認業務の改善
       ④機器台帳管理の機能追加
       ⑤バージョン履歴ダイアログを追加`,
  },
];
