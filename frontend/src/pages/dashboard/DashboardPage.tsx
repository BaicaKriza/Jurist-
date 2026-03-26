import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Building2,
  FileText,
  Search,
  BarChart2,
  AlertTriangle,
  Clock,
  TrendingUp,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import api from '@/lib/api'
import type { DashboardStats, Document, Procedure } from '@/types'

async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get('/dashboard/stats')
  return data
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  description,
}: {
  title: string
  value: number | string
  icon: React.ElementType
  color: string
  description?: string
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
            {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function documentStatusBadge(status: string) {
  switch (status) {
    case 'valid':
      return <Badge variant="success">Valid</Badge>
    case 'expiring_soon':
      return <Badge variant="warning">Skadon së shpejti</Badge>
    case 'expired':
      return <Badge variant="destructive">Skaduar</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function procedureStatusBadge(status: string) {
  switch (status) {
    case 'open':
      return <Badge variant="success">Hapur</Badge>
    case 'closed':
      return <Badge variant="secondary">Mbyllur</Badge>
    case 'awarded':
      return <Badge variant="info">Dhënë</Badge>
    case 'cancelled':
      return <Badge variant="destructive">Anuluar</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function DashboardPage() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
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
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="text-gray-500">Gabim në ngarkimin e të dhënave.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ballina</h1>
        <p className="text-sm text-gray-500 mt-1">Pasqyra e përgjithshme e sistemit</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          title="Kompani Aktive"
          value={stats.active_companies}
          icon={Building2}
          color="bg-blue-100 text-blue-600"
          description="Kompani në sistem"
        />
        <StatCard
          title="Dokumente Gjithsej"
          value={stats.total_documents}
          icon={FileText}
          color="bg-emerald-100 text-emerald-600"
          description="Dokumente të ngarkuara"
        />
        <StatCard
          title="Skadojnë Së Shpejti"
          value={stats.expiring_soon}
          icon={AlertTriangle}
          color="bg-amber-100 text-amber-600"
          description="Brenda 30 ditëve"
        />
        <StatCard
          title="Procedura Sot"
          value={stats.new_procedures_today}
          icon={Search}
          color="bg-violet-100 text-violet-600"
          description="Të reja nga APP"
        />
        <StatCard
          title="Dokumente Skaduar"
          value={stats.expired_documents}
          icon={XCircle}
          color="bg-red-100 text-red-600"
          description="Kërkojnë vëmendje"
        />
        <StatCard
          title="Analiza në Pritje"
          value={stats.pending_analyses}
          icon={BarChart2}
          color="bg-sky-100 text-sky-600"
          description="Procedura pa analizë"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiring documents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Dokumente Që Skadojnë
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/documents?status=expiring_soon" className="flex items-center gap-1 text-xs text-blue-600">
                Shiko të gjitha <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {stats.recent_expiring_documents.length === 0 ? (
              <div className="flex items-center gap-2 px-6 py-8 text-sm text-gray-400">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Nuk ka dokumente që skadojnë së shpejti.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {stats.recent_expiring_documents.slice(0, 6).map((doc: Document) => (
                  <li key={doc.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Skadon:{' '}
                        {doc.expiry_date
                          ? format(parseISO(doc.expiry_date), 'dd MMM yyyy')
                          : '—'}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0">{documentStatusBadge(doc.status)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent procedures */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Procedurat e Fundit
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/procedures" className="flex items-center gap-1 text-xs text-blue-600">
                Shiko të gjitha <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {stats.recent_procedures.length === 0 ? (
              <div className="px-6 py-8 text-sm text-gray-400">
                Nuk ka procedura të fundit.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {stats.recent_procedures.slice(0, 6).map((proc: Procedure) => (
                  <li key={proc.id} className="px-6 py-3 hover:bg-gray-50 transition-colors">
                    <Link to={`/procedures/${proc.id}`} className="block">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate pr-4">
                          {proc.title}
                        </p>
                        <div className="shrink-0">{procedureStatusBadge(proc.status)}</div>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {proc.contracting_authority}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
