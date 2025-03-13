import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import * as Sentry from '@sentry/react'
import { initializeImageCache } from './stores/imageCache.ts'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
})

// アプリケーション起動時にイメージキャッシュを初期化
initializeImageCache()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
