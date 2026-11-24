import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminPage } from './admin/AdminPage';
import { Designer } from './designer/Designer';
import { SharedView } from './designer/SharedView';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Designer />} />
        <Route path="/view" element={<SharedView />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Designer />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
