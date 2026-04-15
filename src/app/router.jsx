import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '../auth/ProtectedRoute.jsx'
import { LoginPage } from '../auth/LoginPage.jsx'
import { AppShell } from '../shared/components/layout/AppShell.jsx'
import CommandCenterPage from '../modules/command-center/page.jsx'
import CrmPage from '../modules/crm/page.jsx'
import TelemarketingPage from '../modules/telemarketing/page.jsx'
import DotmailPage from '../modules/dotmail/page.jsx'
import AnalyticsPage from '../modules/analytics/page.jsx'
import FreksFramePage from '../modules/freksframe/page.jsx'

export function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/command-center" replace />} />
            <Route path="/command-center" element={<CommandCenterPage />} />
            <Route path="/crm" element={<CrmPage />} />
            <Route path="/telemarketing" element={<TelemarketingPage />} />
            <Route path="/dotmail" element={<DotmailPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/freksframe" element={<FreksFramePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
