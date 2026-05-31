import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { UiSystemProvider } from '@faako/ui'
import '@faako/ui/ui.css'
import '@faako/ui/compat.css'
import './index.css'
import App from './App.tsx'
import appSystem from '../appSystem.js'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiSystemProvider appSystem={appSystem}>
      <App />
    </UiSystemProvider>
  </StrictMode>,
)
