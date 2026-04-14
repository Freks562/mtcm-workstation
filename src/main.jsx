import React from 'react'
import ReactDOM from 'react-dom/client'
import { Providers } from './app/providers.jsx'
import './shared/styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Providers />
  </React.StrictMode>
)
