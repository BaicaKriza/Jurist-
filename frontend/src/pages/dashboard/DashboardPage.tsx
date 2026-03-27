import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Building2,
  FileText,
  Search,
  BarChart2,
  Users,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import api from '@/lib/api'
import type { DashboardStats } from '@/types'

async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get('/admin/stats')
  return data
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  href,
}: {
  title: string
  value: number
  icon: React.ElementType
  color: string
  href?: string
}) {
  const content = (
    <Card className={href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value.toLocaleString()}</p>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return href ? <Link to={href}>{content}</Link> : content
}

export default function DashboardPage() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (isError || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-500">
        <BarChart2 className="h-10 w-10 text-gray-300" />
        <p>Statistikat nuk u ngarkuan. Kontrolloni lidhjen me serverin.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ballina</h1>
        <p className="text-sm text-gray-500 mt-1">Pasqyra e përgjithshme e sistemit</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          title="Kompani Aktive"
          value={stats.active_companies}
          icon={Building2}
          color="bg-blue-100 text-blue-600"
          href="/companies"
        />
        <StatCard
          title="Dokumente"
          value={stats.total_documents}
          icon={FileText}
          color="bg-emerald-100 text-emerald-600"
          href="/documents"
        />
        <StatCard
          title="Procedura"
          value={stats.total_procedures}
          icon={Search}
          color="bg-violet-100 text-violet-600"
          href="/procedures"
        />
        <StatCard
          title="Analiza AI"
          value={stats.total_analyses}
          icon={BarChart2}
          color="bg-sky-100 text-sky-600"
          href="/analyses"
        />
        <StatCard
          title="Kompani Gjithsej"
          value={stats.total_companies}
          icon={Building2}
          color="bg-gray-100 text-gray-600"
        />
        <StatCard
          title="Përdorues Aktivë"
          value={stats.active_users}
          icon={Users}
          color="bg-pink-100 text-pink-600"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
        <Link to="/missing-docs" className="block">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <TrendingUp className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="font-semibold text-gray-900">Dokumentet që Mungojnë</p>
              <p className="text-xs text-gray-500 mt-1">
                Kontrollo gatishmërinë për procedura
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/procedures" className="block">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <Search className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <p className="font-semibold text-gray-900">Sinkronizo Procedurat</p>
              <p className="text-xs text-gray-500 mt-1">
                Merr procedurat e fundit nga APP
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/analyses" className="block">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <BarChart2 className="h-8 w-8 text-violet-500 mx-auto mb-2" />
              <p className="font-semibold text-gray-900">Analizat AI</p>
              <p className="text-xs text-gray-500 mt-1">
                Shiko analizat e kryera
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
