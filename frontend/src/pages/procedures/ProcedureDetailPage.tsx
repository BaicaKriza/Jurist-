import React, { useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  Building,
  DollarSign,
  ExternalLink,
  Sparkles,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { procedureService } from '@/services/procedureService'
import { useToast } from '@/hooks/useToast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { DocumentCategory } from '@/types'

function statusBadge(status: string) {
  switch (status) {
    case 'OPEN': return <Badge variant="success">Hapur</Badge>
    case 'CLOSED': return <Badge variant="secondary">Mbyllur</Badge>
    case 'AWARDED': return <Badge variant="info">Dhënë</Badge>
    case 'CANCELLED': return <Badge variant="destructive">Anuluar</Badge>
    default: return <Badge variant="secondary">{status}</Badge>
  }
}

function riskBadge(risk?: string) {
  switch (risk) {
    case 'LOW': return <Badge variant="success">Rrezik i ulët</Badge>
    case 'MEDIUM': return <Badge variant="warning">Rrezik mesatar</Badge>
    case 'HIGH': return <Badge variant="destructive">Rrezik i lartë</Badge>
    default: return null
  }
}

function formatCurrency(value?: number | null, currency = 'ALL') {
  if (!value) return '—'
  return new Intl.NumberFormat('sq-AL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  ADMINISTRATIVE: 'Administrative',
  TECHNICAL: 'Teknike',
  FINANCIAL: 'Financiare',
  PROFESSIONAL: 'Profesionale',
}

const reqSchema = z.object({
  name: z.string().min(2, 'Emri kërkohet'),
  category: z.enum(['ADMINISTRATIVE', 'TECHNICAL', 'FINANCIAL', 'PROFESSIONAL'] as const),
  mandatory: z.boolean().default(true),
  description: z.string().optional(),
})
type ReqForm = z.infer<typeof reqSchema>

function AddRequirementDialog({
  open,
  onClose,
  procedureId,
}: {
  open: boolean
  onClose: () => void
  procedureId: string
}) {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<ReqForm>({
    resolver: zodResolver(reqSchema),
    defaultValues: { mandatory: true, category: 'ADMINISTRATIVE' },
  })

  const mutation = useMutation({
    mutationFn: (d: ReqForm) =>
      procedureService.addRequiredDocument(procedureId, {
        name: d.name,
        category: d.category,
        mandatory: d.mandatory,
        description: d.description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', procedureId] })
      success('Kërkesa u shtua', 'Dokumenti i kërkuar u shtua me sukses.')
      reset()
      onClose()
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Shtimi dështoi.')
    },
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Shto Dokument të Kërkuar</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="req-name">Emri i Dokumentit *</Label>
            <Input id="req-name" {...register('name')} placeholder="p.sh. Certifikatë NIPT" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Kategoria</Label>
            <Select
              value={watch('category')}
              onValueChange={(v) => setValue('category', v as DocumentCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(CATEGORY_LABELS) as [DocumentCategory, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="req-mandatory"
              {...register('mandatory')}
              defaultChecked
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="req-mandatory">I detyrueshëm</Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-description">Përshkrim (opsional)</Label>
            <Input id="req-description" {...register('description')} placeholder="Përshkrim i shkurtër" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>Anulo</Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>Shto</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function ProcedureDetailPage() {
  const { id } = useParams<{ id: string }>()
  const procedureId = id!
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const [addReqOpen, setAddReqOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingFile, setUploadingFile] = useState(false)

  const { data: procedure, isLoading: procLoading } = useQuery({
    queryKey: ['procedure', procedureId],
    queryFn: () => procedureService.getProcedure(procedureId),
    enabled: !!procedureId,
  })

  const { data: analysis } = useQuery({
    queryKey: ['procedure-analysis', procedureId],
    queryFn: () => procedureService.getProcedureAnalysis(procedureId),
    enabled: !!procedureId,
    retry: false,
  })

  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements', procedureId],
    queryFn: () => procedureService.getRequiredDocuments(procedureId),
    enabled: !!procedureId,
  })

  const { data: procDocs = [] } = useQuery({
    queryKey: ['procedure-docs', procedureId],
    queryFn: () => procedureService.getProcedureDocuments(procedureId),
    enabled: !!procedureId,
  })

  const analyzeMutation = useMutation({
    mutationFn: () => procedureService.analyzeProcedure(procedureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedure-analysis', procedureId] })
      queryClient.invalidateQueries({ queryKey: ['requirements', procedureId] })
      success('Analiza u krye', 'Analiza e AI u krye me sukses.')
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Analiza dështoi.')
    },
  })

  const deleteReqMutation = useMutation({
    mutationFn: (reqId: string) => procedureService.deleteRequiredDocument(procedureId, reqId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', procedureId] })
      success('Kërkesa u fshi', '')
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Fshirja dështoi.')
    },
  })

  const appDocs = procDocs.filter((d) => !d.is_uploaded)
  const uploadedDocs = procDocs.filter((d) => d.is_uploaded)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    try {
      await procedureService.uploadProcedureFile(procedureId, file)
      queryClient.invalidateQueries({ queryKey: ['procedure-docs', procedureId] })
      success('Skedari u ngarkua', 'AI po analizon dokumentin...')
    } catch (err: any) {
      error('Gabim', err?.response?.data?.detail ?? 'Ngarkimi dështoi.')
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (procLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!procedure) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-500">Procedura nuk u gjet.</p>
        <Button variant="outline" asChild>
          <Link to="/procedures">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kthehu
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/procedures" className="hover:text-blue-600 flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Procedurat
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 font-medium truncate max-w-md">
          {procedure.object_description ?? procedure.reference_no ?? 'Procedurë'}
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {procedure.reference_no && (
              <span className="text-xs font-mono bg-gray-100 rounded px-2 py-0.5 text-gray-500">
                {procedure.reference_no}
              </span>
            )}
            {statusBadge(procedure.status)}
            {analysis && riskBadge(analysis.risk_level)}
          </div>
          <h1 className="text-xl font-bold text-gray-900 leading-snug max-w-3xl">
            {procedure.object_description ?? '(pa përshkrim)'}
          </h1>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {procedure.source_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={procedure.source_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Hap në APP
              </a>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => analyzeMutation.mutate()}
            loading={analyzeMutation.isPending}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {analysis ? 'Ri-analizo' : 'Analize me AI'}
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {procedure.authority_name && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Building className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">Autoriteti Kontraktues</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 line-clamp-2">{procedure.authority_name}</p>
            </CardContent>
          </Card>
        )}
        {procedure.closing_date && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">Afati Fundor</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {format(parseISO(procedure.closing_date), 'dd MMM yyyy')}
              </p>
            </CardContent>
          </Card>
        )}
        {procedure.fund_limit != null && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">Vlera e Parashikuar</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {formatCurrency(procedure.fund_limit, procedure.currency ?? 'ALL')}
              </p>
            </CardContent>
          </Card>
        )}
        {procedure.procedure_type && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">Lloji</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{procedure.procedure_type}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg"
        onChange={handleFileUpload}
      />

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Detajet</TabsTrigger>
          <TabsTrigger value="requirements">
            Kërkesat ({requirements.length})
          </TabsTrigger>
          <TabsTrigger value="analysis">
            Analiza AI {analysis ? '✓' : ''}
          </TabsTrigger>
          <TabsTrigger value="my-docs">
            Dok. Mia {uploadedDocs.length > 0 ? `(${uploadedDocs.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="documents">
            Dok. APP ({appDocs.length})
          </TabsTrigger>
        </TabsList>

        {/* Details */}
        <TabsContent value="details">
          <Card>
            <CardContent className="p-6 space-y-4">
              {procedure.cpv_code && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Kodi CPV</h3>
                  <Badge variant="outline">{procedure.cpv_code}</Badge>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {procedure.publication_date && (
                  <div>
                    <span className="text-gray-500">Botuar:</span>{' '}
                    <span className="font-medium">
                      {format(parseISO(String(procedure.publication_date)), 'dd MMM yyyy')}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Shtuar:</span>{' '}
                  <span className="font-medium">
                    {format(parseISO(procedure.created_at), 'dd MMM yyyy')}
                  </span>
                </div>
                {procedure.contract_type && (
                  <div>
                    <span className="text-gray-500">Lloji kontratës:</span>{' '}
                    <span className="font-medium">{procedure.contract_type}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Burimi:</span>{' '}
                  <span className="font-medium">{procedure.source_name}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requirements */}
        <TabsContent value="requirements">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">Dokumentet e Kërkuara</CardTitle>
              <Button size="sm" onClick={() => setAddReqOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Shto Kërkesë
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {requirements.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-gray-400">
                  <FileText className="h-10 w-10 mb-3 text-gray-300" />
                  <p className="text-sm">Nuk ka kërkesa. Analizoni procedurën ose shtoni manualisht.</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => setAddReqOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Shto Kërkesë
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {requirements.map((req) => (
                    <li key={req.id} className="flex items-start justify-between px-6 py-4 hover:bg-gray-50">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">{req.name}</span>
                          {req.mandatory ? (
                            <Badge variant="destructive" className="text-[10px]">I detyrueshëm</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Opsional</Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {CATEGORY_LABELS[req.category as DocumentCategory] ?? req.category}
                          </Badge>
                        </div>
                        {req.description && (
                          <p className="text-xs text-gray-500">{req.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-400 hover:text-red-600 shrink-0"
                        onClick={() => {
                          if (window.confirm(`Fshini "${req.name}"?`))
                            deleteReqMutation.mutate(req.id)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis */}
        <TabsContent value="analysis">
          {!analysis ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-gray-400">
                <BarChart2 className="h-10 w-10 mb-3 text-gray-300" />
                <p className="text-sm">Nuk ka analizë për këtë procedurë.</p>
                <Button size="sm" className="mt-4" onClick={() => analyzeMutation.mutate()} loading={analyzeMutation.isPending}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Fillo Analizën
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    Përmbledhje
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary ?? '—'}</p>
                  <p className="text-xs text-gray-400 mt-3">
                    Lloji: {analysis.analysis_type} · Analizuar:{' '}
                    {format(parseISO(String(analysis.created_at)), 'dd MMM yyyy HH:mm')}
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.legal_notes && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Kërkesat Ligjore</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{analysis.legal_notes}</p>
                    </CardContent>
                  </Card>
                )}
                {analysis.technical_notes && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Kërkesat Teknike</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{analysis.technical_notes}</p>
                    </CardContent>
                  </Card>
                )}
                {analysis.financial_notes && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Kërkesat Financiare</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{analysis.financial_notes}</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {analysis.recommended_action && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader><CardTitle className="text-sm text-blue-800">Rekomandim</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-blue-900">{analysis.recommended_action}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* My uploaded documents */}
        <TabsContent value="my-docs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">Dokumentet e Ngarkuara</CardTitle>
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                loading={uploadingFile}
                disabled={uploadingFile}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {uploadingFile ? 'Duke ngarkuar...' : 'Ngarko Skedar'}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {uploadedDocs.length === 0 ? (
                <div
                  className="flex flex-col items-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg mx-6 mb-6 cursor-pointer hover:border-blue-400 hover:text-blue-400 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-10 w-10 mb-3 text-gray-300" />
                  <p className="text-sm font-medium">Kliko ose zvarrit skedarin këtu</p>
                  <p className="text-xs mt-1">PDF, DOCX, XLSX, JPG, PNG – maks 50 MB</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {uploadedDocs.map((doc) => (
                    <li key={doc.id} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <FileText className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {doc.title ?? doc.file_name ?? 'Dokument'}
                            </p>
                            {doc.mime_type && (
                              <p className="text-xs text-gray-400 mb-1">{doc.mime_type}</p>
                            )}
                            {doc.ai_summary && (
                              <div className="mt-1.5 p-2.5 bg-violet-50 rounded-md border border-violet-100">
                                <p className="text-xs font-semibold text-violet-700 mb-1 flex items-center gap-1">
                                  <Sparkles className="h-3 w-3" />
                                  Analizë AI
                                </p>
                                <p className="text-xs text-violet-900 leading-relaxed line-clamp-4">{doc.ai_summary}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        {doc.download_url && (
                          <Button variant="outline" size="sm" asChild className="shrink-0">
                            <a href={doc.download_url} target="_blank" rel="noopener noreferrer">
                              Shkarko
                            </a>
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {uploadedDocs.length > 0 && (
                <div className="px-6 pb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Shto skedar tjetër
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Procedure documents (from APP) */}
        <TabsContent value="documents">
          <Card>
            <CardContent className="p-0">
              {appDocs.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-gray-400">
                  <FileText className="h-10 w-10 mb-3 text-gray-300" />
                  <p className="text-sm">Nuk ka dokumente të APP-it.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {appDocs.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {doc.title ?? doc.file_name ?? 'Dokument'}
                          </p>
                          {doc.mime_type && (
                            <p className="text-xs text-gray-400">{doc.mime_type}</p>
                          )}
                        </div>
                      </div>
                      {doc.document_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={doc.document_url} target="_blank" rel="noopener noreferrer">
                            Hap
                          </a>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddRequirementDialog
        open={addReqOpen}
        onClose={() => setAddReqOpen(false)}
        procedureId={procedureId}
      />
    </div>
  )
}
