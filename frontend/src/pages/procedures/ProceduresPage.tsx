import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  RefreshCw,
  ExternalLink,
  Filter,
  X,
  ChevronRight,
  Calendar,
  Building,
  DollarSign,
  BarChart2,
  Clock,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { procedureService } from '@/services/procedureService'
import { useToast } from '@/hooks/useToast'
import type { ProcedureFilters, ProcedureStatus, ProcedureType, AnalysisStatus } from '@/types'

const STATUS_LABELS: Record<ProcedureStatus, string> = {
  open: 'Hapur',
  closed: 'Mbyllur',
  cancelled: 'Anuluar',
  awarded: 'Dhënë',
  pending: 'Në pritje',
}

const TYPE_LABELS: Record<ProcedureType, string> = {
  open_tender: 'Procedurë e hapur',
  restricted_tender: 'Procedurë e kufizuar',
  negotiated: 'Me negocim',
  direct: 'Direkte',
  framework: 'Kornizë',
  other: 'Tjetër',
}

const ANALYSIS_LABELS: Record<AnalysisStatus, string> = {
  pending: 'Pa analizë',
  processing: 'Duke analizuar',
  completed: 'Analizuar',
  failed: 'Dështoi',
}

function statusBadge(status: ProcedureStatus) {
  switch (status) {
    case 'open':
      return <Badge variant="success">Hapur</Badge>
    case 'closed':
      return <Badge variant="secondary">Mbyllur</Badge>
    case 'awarded':
      return <Badge variant="info">Dhënë</Badge>
    case 'cancelled':
      return <Badge variant="destructive">Anuluar</Badge>
    case 'pending':
      return <Badge variant="warning">Në pritje</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function analysisBadge(status: AnalysisStatus) {
  switch (status) {
    case 'completed':
      return <Badge variant="success">Analizuar</Badge>
    case 'processing':
      return <Badge variant="info">Duke u analizuar</Badge>
    case 'pending':
      return <Badge variant="secondary">Pa analizë</Badge>
    case 'failed':
      return <Badge variant="destructive">Dështoi</Badge>
    default:
      return null
  }
}

function formatCurrency(value?: number, currency = 'ALL') {
  if (!value) return '—'
  return new Intl.NumberFormat('sq-AL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

const PAGE_SIZE = 15

export default function ProceduresPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [analysisFilter, setAnalysisFilter] = useState('all')
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const { success, error } = useToast()

  const filters: ProcedureFilters = {
    search: search || undefined,
    status: statusFilter !== 'all' ? (statusFilter as ProcedureStatus) : undefined,
    procedure_type: typeFilter !== 'all' ? (typeFilter as ProcedureType) : undefined,
    analysis_status: analysisFilter !== 'all' ? (analysisFilter as AnalysisStatus) : undefined,
    page,
    page_size: PAGE_SIZE,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['procedures', filters],
    queryFn: () => procedureService.getProcedures(filters),
    staleTime: 30000,
  })

  const syncMutation = useMutation({
    mutationFn: () => procedureService.syncProcedures(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['procedures'] })
      success('Sinkronizim i suksesshëm', `U sinkronizuan ${result.synced} procedura.`)
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Sinkronizimi dështoi.')
    },
  })

  function resetFilters() {
    setSearch('')
    setStatusFilter('all')
    setTypeFilter('all')
    setAnalysisFilter('all')
    setPage(1)
  }

  const hasActiveFilters =
    search || statusFilter !== 'all' || typeFilter !== 'all' || analysisFilter !== 'all'
  const procedures = data?.items ?? []
  const totalPages = data?.total_pages ?? 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procedurat APP</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data?.total ?? 0} procedura gjithsej
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => syncMutation.mutate()}
          loading={syncMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          Sinkronizo me APP
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Kërko procedurë..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Statusi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Të gjitha</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Lloji" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Të gjitha llojet</SelectItem>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={analysisFilter} onValueChange={(v) => { setAnalysisFilter(v); setPage(1) }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Analiza" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Të gjitha</SelectItem>
                {Object.entries(ANALYSIS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={resetFilters} className="shrink-0">
                <X className="h-4 w-4 mr-1.5" />
                Pastro
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : procedures.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-gray-400">
            <Search className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium">Nuk u gjetën procedura</p>
            {hasActiveFilters && (
              <Button variant="link" size="sm" onClick={resetFilters} className="mt-2">
                Pastro filtrat
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {procedures.map((proc) => (
              <Card key={proc.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-400">{proc.reference_number}</span>
                        {statusBadge(proc.status)}
                        {analysisBadge(proc.analysis_status)}
                      </div>
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-2">
                        {proc.title}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building className="h-3.5 w-3.5" />
                          {proc.contracting_authority}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Afati: {format(parseISO(proc.deadline), 'dd MMM yyyy')}
                        </span>
                        {proc.estimated_value && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            {formatCurrency(proc.estimated_value, proc.currency)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <BarChart2 className="h-3.5 w-3.5" />
                          {TYPE_LABELS[proc.procedure_type] ?? proc.procedure_type}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {proc.source_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={proc.source_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            APP
                          </a>
                        </Button>
                      )}
                      <Button size="sm" asChild>
                        <Link to={`/procedures/${proc.id}`}>
                          Detajet
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Faqja {page} nga {totalPages} · {data?.total} procedura
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prapa
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Para
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
