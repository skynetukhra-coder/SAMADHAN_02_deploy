import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import axios from 'axios'

// Axios interceptor to rewrite absolute local URLs to relative paths (works with Vite proxy in dev)
axios.interceptors.request.use((config) => {
  if (config.url && (config.url.startsWith('http://localhost:5000') || config.url.startsWith('http://localhost:5001'))) {
    config.url = config.url.replace(/http:\/\/localhost:500[01]/, '');
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
