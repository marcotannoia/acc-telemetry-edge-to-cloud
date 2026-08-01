import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './sfondoDocumento.css'
import Applicazione from './Applicazione.jsx'
// questo file sarebbe quello che permettere a react di rappresentare la mia pp
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Applicazione />
  </StrictMode>,
)
