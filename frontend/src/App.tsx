import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { PageLoader } from '@/components/common/LoadingSpinner'
import Layout from '@/components/layout/Layout'
import { ChatWidget } from '@/components/chat/ChatWidget'

// Pages
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import CompaniesPage from '@/pages/companies/CompaniesPage'
import CompanyDetailPage from '@/pages/companies/CompanyDetailPage'
import DocumentsPage from '@/pages/documents/DocumentsPage'
import ProceduresPage from '@/pages/procedures/ProceduresPage'
import ProcedureDetailPage from '@/pages/procedures/ProcedureDetailPage'
import AnalysesPage from '@/pages/analyses/AnalysesPage'
import MissingDocsPage from '@/pages/missing-docs/MissingDocsPage'
import AdminPage from '@/pages/admin/AdminPage'
import SettingsPage from '@/pages/settings/SettingsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <>{children}</>
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth()

  if (isLoading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.is_superadmin && !user?.roles?.includes('admin')) return <Navigate to="/" replace />

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="companies/:id" element={<CompanyDetailPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="procedures" element={<ProceduresPage />} />
          <Route path="procedures/:id" element={<ProcedureDetailPage />} />
          <Route path="analyses" element={<AnalysesPage />} />
          <Route path="missing-docs" element={<MissingDocsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="admin"
            element={
              <SuperAdminRoute>
                <AdminPage />
              </SuperAdminRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ChatWidget />
    </>
  )
}
