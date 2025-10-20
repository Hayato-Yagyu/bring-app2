/* eslint-env node */
module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: ["eslint:recommended", "plugin:import/errors", "plugin:import/warnings", "plugin:import/typescript", "google", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // ビルド生成物を無視
    "/generated/**/*", // 自動生成物を無視
  ],
  plugins: ["@typescript-eslint", "import"],
  rules: {
    // 既存の方針を踏襲
    "quotes": ["error", "double", {avoidEscape: true}],
    "indent": ["error", 2, {SwitchCase: 1}],
    "import/no-unresolved": "off",

    // ここから追加の上書き —— デプロイで詰まりやすいところを緩和/明示
    // Google 既定は 80 桁。実運用で少し余裕を持たせる
    "max-len": [
      "error",
      {
        code: 100,
        tabWidth: 2,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
      },
    ],

    // JSDoc 強制は無効化（google 拡張が有効にしていることが多い）
    "require-jsdoc": "off",
    "valid-jsdoc": "off",

    // import {x, y} のスペース有無（本プロジェクトは “なし” に統一）
    "object-curly-spacing": ["error", "never"],

    // Windows 混在環境での改行コード差異によるノイズを避ける
    "linebreak-style": "off",
  },
};
