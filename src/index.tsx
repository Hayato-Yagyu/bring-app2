// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRoutes } from './Routes';
import { BrowserRouter } from 'react-router-dom' // 追加する

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>
);

