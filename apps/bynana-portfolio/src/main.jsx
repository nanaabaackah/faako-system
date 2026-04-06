import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { UiSystemProvider } from '@faako/ui'
import App from './App.jsx'
import appSystem from '../appSystem.js'
import './styles/global.css'
import { initializeAnalytics } from './utils/analytics'
import { syncMobileBrowserChrome } from '../../../packages/utils/src/mobileBrowserChrome'

if (!document.documentElement.classList.contains('js')) {
  document.documentElement.classList.add('js')
}

initializeAnalytics()
syncMobileBrowserChrome({ fallbackColor: '#ebe5d4' })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UiSystemProvider appSystem={appSystem}>
      <App />
    </UiSystemProvider>
  </StrictMode>,
)
