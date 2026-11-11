import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App.jsx'
import ErrorBoundary, { CrashScreen } from './components/ErrorBoundary.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary fallback={<CrashScreen />}>
      <App />
    </ErrorBoundary>
    <Analytics />
  </StrictMode>,
)
