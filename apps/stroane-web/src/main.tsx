import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { UiSystemProvider } from '@faako/ui'
import './index.css'
import App from './App.tsx'
import AuthGate from './components/AuthGate.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { CartProvider } from './context/CartContext.tsx'
import appSystem from '../appSystem.js'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiSystemProvider appSystem={appSystem}>
      <AuthProvider>
        <AuthGate>
          <CartProvider>
            <App />
          </CartProvider>
        </AuthGate>
      </AuthProvider>
    </UiSystemProvider>
  </StrictMode>,
)
