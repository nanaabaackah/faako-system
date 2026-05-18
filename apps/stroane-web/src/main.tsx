import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { UiSystemProvider } from '@faako/ui'
import '@faako/ui/compat.css'
import './index.css'
import App from './App.tsx'
import { CartProvider } from './context/CartContext.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import appSystem from '../appSystem.js'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiSystemProvider appSystem={appSystem}>
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    </UiSystemProvider>
  </StrictMode>,
)
