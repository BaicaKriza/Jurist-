import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/useToast'
import { procedureService } from '@/services/procedureService'
import type { ProcedureFilters, ProcedureStatus } from '@/types'

const STATUS_LABELS: Record<ProcedureStatus, string> = {
  OPEN: 'Hapur',
  CLOSED: 'Mbyllur',
  AWARDED: 'Dhene',
  CANCELLED: 'Anuluar',
  UNKNOWN: 'I panjohur',
}

function statusBadge(status: ProcedureStatus) {
  switch (status) {
    case 'OPEN':
      return <Badge variant="success">Hapur</Badge>
    case 'CLOSED':
      return <Badge variant="secondary">Mbyllur</Badge>
    case 'AWARDED':
      return <Badge variant="info">Dhene</Badge>
    case 'CANCELLED':
      return <Badge variant="destructive">Anuluar</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function formatCurrency(value?: number | null, currency = 'ALL') {
  if (value == null) return '—'
  return new Intl.NumberFormat('sq-AL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

const createSchema = z.object({
  authority_name: z.string().min(2, 'Autoriteti kerkohet'),
  object_description: z.string().min(2, 'Pershkrimi kerkohet'),
  reference_no: z.string().optional(),
  procedure_type: z.string().optional(),
  cpv_code: z.string().optional(),
  currency: z.string().trim().min(3).max(10).default('ALL'),
  fund_limit: z.preprocess(
    (value) => (value === '' || value == null ? undefined : Number(value)),
    z.number().nonnegative().optional(),
  ),
  closing_date: z.string().optional(),
})

type CreateForm = z.infer<typeof createSchema>

function CreateProcedureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      currency: 'ALL',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: CreateForm) =>
      procedureService.createProcedure({
        source_name: 'CONTRACT_NOTICE',
        authority_name: data.authority_name,
        object_description: data.object_description,
        reference_no: data.reference_no || undefined,
        procedure_type: data.procedure_type || undefined,
        cpv_code: data.cpv_code || undefined,
        currency: data.currency || 'ALL',
        fund_limit: data.fund_limit,
        closing_date: data.closing_date || undefined,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['procedures'] })
      success('Procedura u krijua', 'Procedura u shtua me sukses.')
      reset()
      onClose()
      navigate(`/procedures/${created.id}`)
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Krijimi deshtoi.')
    },
  })

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) {
        reset()
        onClose()
      }
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Procedure e Re</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="authority_name">Autoriteti Kontraktues *</Label>
            <Input id="authority_name" {...register('authority_name')} placeholder="Emri i autoritetit" />
            {errors.authority_name && <p className="text-xs text-red-500">{errors.authority_name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="object_description">Pershkrimi i Objektit *</Label>
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
              <Input id="procedure_type" {...register('procedure_type')} placeholder="open_tender" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cpv_code">Kodi CPV</Label>
              <Input id="cpv_code" {...register('cpv_code')} placeholder="45000000-7" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Monedha</Label>
              <Input id="currency" {...register('currency')} placeholder="ALL" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fund_limit">Vlera</Label>
              <Input id="fund_limit" type="number" step="0.01" {...register('fund_limit')} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="closing_date">Afati</Label>
              <Input id="closing_date" type="date" {...register('closing_date')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              reset()
              onClose()
            }}>
              Anulo
            </Button>
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
      success('Sinkronizim i suksesshem', `U sinkronizuan ${result.synced_count} procedura.`)
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Sinkronizimi deshtoi.')
    },
  })

  const hasActiveFilters = Boolean(search) || statusFilter !== 'all'
  const procedures = data?.items ?? []
  const totalPages = data?.pages ?? 1

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procedurat APP</h1>
          <p className="mt-1 text-sm text-gray-500">{data?.total ?? 0} procedura gjithsej</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Procedure e Re
          </Button>
          <Button variant="outline" onClick={() => syncMutation.mutate()} loading={syncMutation.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sinkronizo me APP
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Kerko procedure..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={(value) => {
              setStatusFilter(value)
              setPage(1)
            }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Statusi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Te gjitha</SelectItem>
                {(Object.entries(STATUS_LABELS) as [ProcedureStatus, string][]).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={() => {
                setSearch('')
                setStatusFilter('all')
                setPage(1)
              }}>
                <X className="mr-1.5 h-4 w-4" />
                Pastro
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : procedures.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-gray-400">
            <Search className="mb-3 h-12 w-12 text-gray-300" />
            <p className="text-sm font-medium">Nuk u gjeten procedura</p>
            {hasActiveFilters && (
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('all')
                  setPage(1)
                }}
                className="mt-2"
              >
                Pastro filtrat
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {procedures.map((procedure) => (
              <Card key={procedure.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {procedure.reference_no && (
                          <span className="text-xs font-mono text-gray-400">{procedure.reference_no}</span>
                        )}
                        {statusBadge(procedure.status)}
                      </div>

                      <h3 className="mb-2 text-sm font-semibold leading-snug text-gray-900">
                        {procedure.object_description ?? '(pa pershkrim)'}
                      </h3>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        {procedure.authority_name && (
                          <span className="flex items-center gap-1">
                            <Building className="h-3.5 w-3.5" />
                            {procedure.authority_name}
                          </span>
                        )}
                        {procedure.closing_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Afati: {format(parseISO(procedure.closing_date), 'dd MMM yyyy')}
                          </span>
                        )}
                        {procedure.fund_limit != null && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            {formatCurrency(procedure.fund_limit, procedure.currency ?? 'ALL')}
                          </span>
                        )}
                        {procedure.procedure_type && (
                          <span className="flex items-center gap-1">
                            <BarChart2 className="h-3.5 w-3.5" />
                            {procedure.procedure_type}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {procedure.source_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={procedure.source_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            APP
                          </a>
                        </Button>
                      )}
                      <Button size="sm" asChild>
                        <Link to={`/procedures/${procedure.id}`}>
                          Detajet
                          <ChevronRight className="ml-1 h-3.5 w-3.5" />
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
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  Prapa
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
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
