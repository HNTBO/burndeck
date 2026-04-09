import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Variant1 from './pages/Variant1'
import './styles.css'
import './variants.css'

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/1" replace />} />
        <Route path="/1" element={<Variant1 />} />
        <Route path="*" element={<Navigate to="/1" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
