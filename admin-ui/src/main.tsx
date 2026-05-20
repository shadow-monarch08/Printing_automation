import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ModalProvider } from './context/ModalContext';
import { ToastProvider } from './context/ToastContext';
import App from './App.tsx'

import './styles/reset.css'
import './styles/theme.css'
import './styles/components.css'
import './styles/modal.css'
import './styles/toast.css'
import './styles/animations.css'
import './styles/responsive.css'

import { sseService } from './services/sseService'

sseService.connect();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ModalProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ModalProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
