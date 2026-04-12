import React from 'react'
import ReactDOM from 'react-dom/client'
import { UiSystemProvider } from '@faako/ui'
import App from './App.jsx'
import appSystem from '../appSystem.js'
import './index.css'
import '@faako/ui/compat.css'
import {
  normalizeLegacySessionToken,
} from './utils/authSession'
import { installApiFetchInterceptor } from './api/client'
import { syncMobileBrowserChrome } from './utils/mobileBrowserChrome'

installApiFetchInterceptor()
normalizeLegacySessionToken()
syncMobileBrowserChrome({ fallbackColor: '#f6f1e8' })

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UiSystemProvider appSystem={appSystem}>
      <App />
    </UiSystemProvider>
  </React.StrictMode>,
)
