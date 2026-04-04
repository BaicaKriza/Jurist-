import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  RefreshCw,
  ExternalLink,
  X,
  ChevronRight,
  Calendar,
  Building,
  DollarSign,
  BarChart2,
  Plus,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { procedureService } from '@/services/procedureService'
import { useToast } from '@/hooks/useToast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ProcedureStatus, ProcedureFilters } from '@/types'

const STATUS_LABELS: Record<ProcedureStatus, string> = {
  OPEN: 'Hapur',
  CLOSED: 'Mbyllur',
  AWARDED: 'Dhënë',
  CANCELLED: 'Anuluar',
  UNKNOWN: 'I panjohur',
}

function statusBadge(status: string) {
  switch (status) {
    case 'OPEN':
      return <Badge variant="success">Hapur</Badge>
    case 'CLOSED':
      return <Badge variant="secondary">Mbyllur</Badge>
    case 'AWARDED':
      return <Badge variant="info">Dhënë</Badge>
    case 'CANCELLED':
      return <Badge variant="destructive">Anuluar</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function formatCurrency(value?: number | null, currency = 'ALL') {
  if (!value) return '—'
  return new Intl.NumberFormat('sq-AL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

const createSchema = z.object({
  authority_name: z.string().min(2, 'Autoriteti kërkohet'),
  object_description: z.string().min(2, 'Përshkrimi kërkohet'),
  reference_no: z.string().optional(),
  procedure_type: z.string().optional(),
  fund_limit: z.coerce.number().optional(),
  closing_date: z.string().optional(),
})
type CreateForm = z.infer<typeof createSchema>

function CreateProcedureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  })

  const mutation = useMutation({
    mutationFn: (d: CreateForm) => procedureService.createProcedure({
      source_name: 'CONTRACT_NOTICE',
      authority_name: d.authority_name,
      object_description: d.object_description,
      reference_no: d.reference_no || undefined,
      procedure_type: d.procedure_type || undefined,
      fund_limit: d.fund_limit || undefined,
      closing_date: d.closing_date || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedures'] })
      success('Procedura u krijua', 'Procedura u shtua me sukses.')
      reset()
      onClose()
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Krijimi dështoi.')
    },
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Procedurë e Re</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="authority_name">Autoriteti Kontraktues *</Label>
            <Input id="authority_name" {...register('authority_name')} placeholder="Emri i autoritetit" />
            {errors.authority_name && <p className="text-xs text-red-500">{errors.authority_name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="object_description">Përshkrimi i Objektit *</Label>
            <Input id="object_description" {...register('object_description')} placeholder="Objekti i prokurimit" />
            {errors.object_description && <p className="text-xs text-red-500">{errors.object_description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reference_no">Nr. Referimi</Label>
              <Input id="reference_no" {...register('reference_no')} placeholder="REF-..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="procedure_type">Lloji</Label>
              <Input id="procedure_type" {...register('procedure_type')} placeholder="open_tender..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fund_limit">Vlera (ALL)</Label>
              <Input id="fund_limit" type="number" {...register('fund_limit')} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="closing_date">Afati</Label>
              <Input id="closing_date" type="date" {...register('closing_date')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>Anulo</Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>Krijo</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const PAGE_SIZE = 15

export default function ProceduresPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const queryClient = useQueryClient()
  const { success, error } = useToast()

  const filters: ProcedureFilters = {
    search: search || undefined,
    status: statusFilter !== 'all' ? (statusFilter as ProcedureStatus) : undefined,
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
      success('Sinkronizim i suksesshëm', `U sinkronizuan ${result.synced_count} procedura.`)
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Sinkronizimi dështoi.')
    },
  })

  const hasActiveFilters = search || statusFilter !== 'all'
  const procedures = data?.items ?? []
  const totalPages = data?.pages ?? 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procedurat APP</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} procedura gjithsej</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Procedurë e Re
          </Button>
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            loading={syncMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sinkronizo me APP
          </Button>
        </div>
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
                {(Object.entries(STATUS_LABELS) as [ProcedureStatus, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter('all'); setPage(1) }}>
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
              <Button variant="link" size="sm" onClick={() => { setSearch(''); setStatusFilter('all') }} className="mt-2">
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
                        {proc.reference_no && (
                          <span className="text-xs font-mono text-gray-400">{proc.reference_no}</span>
                        )}
                        {statusBadge(proc.status)}
                      </div>
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-2">
                        {proc.object_description ?? '(pa përshkrim)'}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        {proc.authority_name && (
                          <span className="flex items-center gap-1">
                            <Building className="h-3.5 w-3.5" />
                            {proc.authority_name}
                          </span>
                        )}
                        {proc.closing_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Afati: {format(parseISO(proc.closing_date), 'dd MMM yyyy')}
                          </span>
                        )}
                        {proc.fund_limit != null && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            {formatCurrency(proc.fund_limit, proc.currency ?? 'ALL')}
                          </span>
                        )}
                        {proc.procedure_type && (
                          <span className="flex items-center gap-1">
                            <BarChart2 className="h-3.5 w-3.5" />
                            {proc.procedure_type}
                          </span>
                        )}
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Faqja {page} nga {totalPages} · {data?.total} procedura
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Prapa
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Para
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <CreateProcedureDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
