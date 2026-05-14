import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { UiSystemProvider } from '@faako/ui'
import './index.css'
import App from './App.tsx'
import { CartProvider } from './context/CartContext.tsx'
import appSystem from '../appSystem.js'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiSystemProvider appSystem={appSystem}>
      <CartProvider>
        <App />
      </CartProvider>
    </UiSystemProvider>
  </StrictMode>,
)
