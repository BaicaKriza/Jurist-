import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { PageLoader } from '@/components/common/LoadingSpinner'
import Layout from '@/components/layout/Layout'

// Lazy-loaded pages — each page loads only when first visited (code splitting)
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const CompaniesPage = lazy(() => import('@/pages/companies/CompaniesPage'))
const CompanyDetailPage = lazy(() => import('@/pages/companies/CompanyDetailPage'))
const DocumentsPage = lazy(() => import('@/pages/documents/DocumentsPage'))
const ProceduresPage = lazy(() => import('@/pages/procedures/ProceduresPage'))
const ProcedureDetailPage = lazy(() => import('@/pages/procedures/ProcedureDetailPage'))
const AnalysesPage = lazy(() => import('@/pages/analyses/AnalysesPage'))
const MissingDocsPage = lazy(() => import('@/pages/missing-docs/MissingDocsPage'))
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'))

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
  if (user?.role !== 'admin') return <Navigate to="/" replace />

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>
  )
}
