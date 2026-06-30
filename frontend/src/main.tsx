import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'

// Apply persisted theme BEFORE React renders — prevents flash of wrong theme on refresh
try {
  const stored = localStorage.getItem('ui-storage')
  const darkMode = stored ? JSON.parse(stored)?.state?.darkMode ?? true : true
  document.documentElement.classList.toggle('dark', darkMode)
  document.documentElement.classList.toggle('light', !darkMode)
} catch {}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
