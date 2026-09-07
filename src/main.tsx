import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { RootLayout } from '@/app/root-layout'
import { AppRouter } from '@/app/router'
import { dismissAppSplash } from '@/lib/app-splash'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootLayout>
      <HashRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AppRouter />
      </HashRouter>
    </RootLayout>
  </React.StrictMode>,
)

requestAnimationFrame(() => {
  dismissAppSplash()
})

window.electronAPI?.onMainProcessMessage?.((message) => {
  console.log('[main]', message)
})
