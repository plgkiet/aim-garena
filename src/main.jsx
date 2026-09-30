import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/lexend/300.css'
import '@fontsource/lexend/400.css'
import '@fontsource/lexend/500.css'
import App from './App'
import { applyTheme, readStoredTheme } from './lib/theme'

applyTheme(readStoredTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
