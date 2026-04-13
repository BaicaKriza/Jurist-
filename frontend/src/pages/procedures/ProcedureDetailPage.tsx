import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BarChart2, Calendar, Building, DollarSign, ExternalLink, Sparkles, FileText, ChevronRight, Plus, Trash2, Upload, Download, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { procedureService } from '@/services/procedureService'
import type { UploadedProcedureDocument } from '@/services/procedureService'
import { useToast } from '@/hooks/useToast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ProcedureStatus, DocumentCategory } from '@/types'

const DOC_TYPES = [
  { value: 'DST', label: 'DST - Dosja e Tenderit' },
  { value: 'NJOFTIM', label: 'Njoftim Kontrate' },
  { value: 'SPECIFIKIME', label: 'Specifikime Teknike' },
  { value: 'KRITERE', label: 'Kritere Kualifikimi' },
  { value: 'KONTRATE', label: 'Draft Kontrate' },
  { value: 'SQARIM', label: 'Sqarim' },
  { value: 'BULETIN', label: 'Buletin APP' },
  { value: 'TJETER', label: 'Tjeter' },
]
const DOC_COLORS: Record<string, string> = {
  DST: 'bg-blue-100 text-blue-800', NJOFTIM: 'bg-purple-100 text-purple-800',
  SPECIFIKIME: 'bg-green-100 text-green-800', KRITERE: 'bg-yellow-100 text-yellow-800',
  KONTRATE: 'bg-red-100 text-red-800', SQARIM: 'bg-orange-100 text-orange-800',
  BULETIN: 'bg-gray-100 text-gray-800', TJETER: 'bg-slate-100 text-slate-800',
}
function statusBadge(status: ProcedureStatus) {
  switch (status) {
    case 'OPEN': return <Badge variant="success">Hapur</Badge>
    case 'CLOSED': return <Badge variant="secondary">Mbyllur</Badge>
    case 'AWARDED': return <Badge variant="info">Dhene</Badge>
    case 'CANCELLED': return <Badge variant="destructive">Anuluar</Badge>
    default: return <Badge variant="secondary">{status}</Badge>
  }
}
function riskBadge(risk?: string) {
  switch (risk) {
    case 'LOW': return <Badge variant="success">Rrezik i ulet</Badge>
    case 'MEDIUM': return <Badge variant="warning">Rrezik mesatar</Badge>
    case 'HIGH': return <Badge variant="destructive">Rrezik i larte</Badge>
    default: return null
  }
}
function formatCurrency(value?: number | null, currency = 'ALL') {
  if (!value) return '\u2014'
  return new Intl.NumberFormat('sq-AL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}
function apiFileUrl(path: string) {
  const rawBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
  const base = rawBase.endsWith('/api') ? rawBase.slice(0, -4) : rawBase
  return `${base}/api${path}`
}
function parseUploadSummary(summary: string | null) {
  if (!summary) return { text: '', aiEnabled: true }
  try {
    const parsed = JSON.parse(summary)
    return {
      text: parsed?.summary ?? summary,
      aiEnabled: parsed?.ai_enabled !== false,
    }
  } catch {
    return { text: summary, aiEnabled: true }
  }
}
const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  ADMINISTRATIVE: 'Administrative', TECHNICAL: 'Teknike',
  FINANCIAL: 'Financiare', PROFESSIONAL: 'Profesionale',
}
const reqSchema = z.object({
  name: z.string().min(2, 'Emri kerkohet'),
  category: z.enum(['ADMINISTRATIVE', 'TECHNICAL', 'FINANCIAL', 'PROFESSIONAL'] as const),
  mandatory: z.boolean().default(true),
  description: z.string().optional(),
})
type ReqForm = z.infer<typeof reqSchema>

function AddRequirementDialog({ open, onClose, procedureId }: { open: boolean; onClose: () => void; procedureId: string }) {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<ReqForm>({
    resolver: zodResolver(reqSchema),
    defaultValues: { mandatory: true, category: 'ADMINISTRATIVE' },
  })
  const mutation = useMutation({
    mutationFn: (d: ReqForm) => procedureService.addRequiredDocument(procedureId, {
      name: d.name, category: d.category, mandatory: d.mandatory, description: d.description || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', procedureId] })
      success('Kerkesa u shtua', '')
      reset()
      onClose()
    },
    onError: (err: any) => { error('Gabim', err?.response?.data?.detail ?? 'Shtimi deshtoi.') },
  })
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Shto Dokument te Kerkuar</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="req-name">Emri *</Label>
            <Input id="req-name" {...register('name')} placeholder="p.sh. Certifikate NIPT" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Kategoria</Label>
            <Select value={watch('category')} onValueChange={(v) => setValue('category', v as DocumentCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(CATEGORY_LABELS) as [DocumentCategory, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="req-mandatory" {...register('mandatory')} defaultChecked className="h-4 w-4 rounded border-gray-300" />
            <Label htmlFor="req-mandatory">I detyrushem</Label>
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
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDocType, setUploadDocType] = useState('DST')
  const [uploading, setUploading] = useState(false)

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
  const { data: uploadedDocs = [], refetch: refetchUploaded } = useQuery({
    queryKey: ['procedure-uploaded-docs', procedureId],
    queryFn: () => procedureService.getUploadedDocuments(procedureId),
    enabled: !!procedureId,
  })

  const analyzeMutation = useMutation({
    mutationFn: () => procedureService.analyzeProcedure(procedureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedure-analysis', procedureId] })
      queryClient.invalidateQueries({ queryKey: ['requirements', procedureId] })
      success('Analiza u krye', '')
    },
    onError: (err: any) => { error('Gabim', err?.response?.data?.detail ?? 'Analiza deshtoi.') },
  })
  const deleteReqMutation = useMutation({
    mutationFn: (reqId: string) => procedureService.deleteRequiredDocument(procedureId, reqId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['requirements', procedureId] }); success('Kerkesa u fshi', '') },
    onError: (err: any) => { error('Gabim', err?.response?.data?.detail ?? 'Fshirja deshtoi.') },
  })

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle.trim()) return
    setUploading(true)
    try {
      await procedureService.uploadProcedureDocument(procedureId, uploadFile, uploadTitle, uploadDocType)
      setUploadOpen(false)
      setUploadFile(null)
      setUploadTitle('')
      setUploadDocType('DST')
      refetchUploaded()
      success('Dokumenti u ngarkua', 'Dokumenti u ruajt dhe eshte gati per shqyrtim.')
    } catch (e: any) {
      error('Gabim', e?.response?.data?.detail ?? 'Ngarkimi deshtoi.')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    if (!window.confirm('Fshini kete dokument?')) return
    try {
      await procedureService.deleteUploadedDocument(procedureId, docId)
      refetchUploaded()
      success('Dokumenti u fshi', '')
    } catch (e: any) {
      error('Gabim', e?.response?.data?.detail ?? 'Fshirja deshtoi.')
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
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/procedures" className="hover:text-blue-600 flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Procedurat
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 font-medium truncate max-w-md">
          {procedure.object_description ?? procedure.reference_no ?? 'Procedure'}
        </span>
      </div>

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
            {procedure.object_description ?? '(pa pershkrim)'}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {procedure.source_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={procedure.source_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Hap ne APP
              </a>
            </Button>
          )}
          <Button size="sm" onClick={() => analyzeMutation.mutate()} loading={analyzeMutation.isPending}>
            <Sparkles className="h-4 w-4 mr-2" />
            {analysis ? 'Ri-analizo' : 'Analize me AI'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {procedure.authority_name && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Building className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">Autoriteti</span>
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
                <span className="text-xs text-gray-500">Vlera</span>
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

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Detajet</TabsTrigger>
          <TabsTrigger value="requirements">Kerkesat ({requirements.length})</TabsTrigger>
          <TabsTrigger value="analysis">Analiza AI {analysis ? '\u2713' : ''}</TabsTrigger>
          <TabsTrigger value="documents">Dok. APP ({procDocs.length})</TabsTrigger>
          <TabsTrigger value="uploaded">Dokumentet ({uploadedDocs.length})</TabsTrigger>
        </TabsList>

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
                    <span className="text-gray-500">Botuar: </span>
                    <span className="font-medium">{format(parseISO(String(procedure.publication_date)), 'dd MMM yyyy')}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Shtuar: </span>
                  <span className="font-medium">{format(parseISO(procedure.created_at), 'dd MMM yyyy')}</span>
                </div>
                {procedure.contract_type && (
                  <div>
                    <span className="text-gray-500">Lloji kontrates: </span>
                    <span className="font-medium">{procedure.contract_type}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Burimi: </span>
                  <span className="font-medium">{procedure.source_name}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requirements">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">Dokumentet e Kerkuara</CardTitle>
              <Button size="sm" onClick={() => setAddReqOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Shto Kerkese
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {requirements.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-gray-400">
                  <FileText className="h-10 w-10 mb-3 text-gray-300" />
                  <p className="text-sm">Nuk ka kerkesa.</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => setAddReqOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />Shto Kerkese
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {requirements.map((req) => (
                    <li key={req.id} className="flex items-start justify-between px-6 py-4 hover:bg-gray-50">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">{req.name}</span>
                          {req.mandatory
                            ? <Badge variant="destructive" className="text-[10px]">I detyrushem</Badge>
                            : <Badge variant="secondary" className="text-[10px]">Opsional</Badge>
                          }
                          <Badge variant="outline" className="text-[10px]">
                            {CATEGORY_LABELS[req.category as DocumentCategory] ?? req.category}
                          </Badge>
                        </div>
                        {req.description && <p className="text-xs text-gray-500">{req.description}</p>}
                      </div>
                      <Button
                        variant="ghost" size="icon-sm"
                        className="text-red-400 hover:text-red-600 shrink-0"
                        onClick={() => { if (window.confirm('Fshini?')) deleteReqMutation.mutate(req.id) }}
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

        <TabsContent value="analysis">
          {!analysis ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-gray-400">
                <BarChart2 className="h-10 w-10 mb-3 text-gray-300" />
                <p className="text-sm">Nuk ka analize per kete procedure.</p>
                <Button size="sm" className="mt-4" onClick={() => analyzeMutation.mutate()} loading={analyzeMutation.isPending}>
                  <Sparkles className="h-4 w-4 mr-2" />Fillo Analizen
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-violet-500" />Permbledhje
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary ?? '\u2014'}</p>
                  <p className="text-xs text-gray-400 mt-3">
                    Lloji: {analysis.analysis_type} · {format(parseISO(String(analysis.created_at)), 'dd MMM yyyy HH:mm')}
                  </p>
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.legal_notes && (
                  <Card><CardHeader><CardTitle className="text-sm">Kerkesat Ligjore</CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-gray-700 whitespace-pre-line">{analysis.legal_notes}</p></CardContent></Card>
                )}
                {analysis.technical_notes && (
                  <Card><CardHeader><CardTitle className="text-sm">Kerkesat Teknike</CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-gray-700 whitespace-pre-line">{analysis.technical_notes}</p></CardContent></Card>
                )}
                {analysis.financial_notes && (
                  <Card><CardHeader><CardTitle className="text-sm">Kerkesat Financiare</CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-gray-700 whitespace-pre-line">{analysis.financial_notes}</p></CardContent></Card>
                )}
              </div>
              {analysis.recommended_action && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader><CardTitle className="text-sm text-blue-800">Rekomandim</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-blue-900">{analysis.recommended_action}</p></CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="p-0">
              {procDocs.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-gray-400">
                  <FileText className="h-10 w-10 mb-3 text-gray-300" />
                  <p className="text-sm">Nuk ka dokumente te APP-it.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {procDocs.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.title ?? doc.file_name ?? 'Dokument'}</p>
                      </div>
                      {doc.document_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={doc.document_url} target="_blank" rel="noopener noreferrer">Hap</a>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="uploaded" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Dokumentet e Ngarkuara</h3>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />Ngarko Dokument
            </Button>
          </div>
          {uploadedDocs.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-xl border-gray-200">
              <FileText className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Nuk ka dokumente</p>
              <p className="text-gray-400 text-sm mt-1">Ngarko DST, njoftimet ose dokumentet e procedures</p>
            </div>
          ) : (
            <div className="space-y-3">
              {uploadedDocs.map((doc: UploadedProcedureDocument) => (
                <div key={doc.id} className="border rounded-xl p-4 flex items-start gap-4 hover:border-indigo-200 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={'text-xs px-2 py-0.5 rounded-full font-mono font-medium ' + (DOC_COLORS[doc.doc_type] ?? 'bg-gray-100 text-gray-800')}>
                        {doc.doc_type}
                      </span>
                      <span className="font-medium text-gray-900 truncate">{doc.title}</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">
                      {doc.file_name}
                      {doc.file_size != null ? ' · ' + (doc.file_size / 1024).toFixed(0) + ' KB' : ''}
                      {doc.created_at ? ' · ' + format(parseISO(doc.created_at), 'dd MMM yyyy') : ''}
                    </p>
                    {doc.ai_summary ? (
                      <div className="text-sm bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                        <p className="text-xs font-mono text-indigo-600 mb-1">
                          {parseUploadSummary(doc.ai_summary).aiEnabled ? 'Analize AI' : 'Status dokumenti'}
                        </p>
                        <p className="text-gray-700 line-clamp-3">
                          {parseUploadSummary(doc.ai_summary).text}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Duke analizuar me AI...
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" asChild>
                      <a href={apiFileUrl(doc.download_url)} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-50" onClick={() => handleDeleteDoc(doc.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Ngarko Dokument Procedure</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Skedari (PDF ose DOCX) *</Label>
                  <Input
                    type="file"
                    accept=".pdf,.docx,application/pdf"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    className="cursor-pointer"
                  />
                  {uploadFile && <p className="text-xs text-green-600">{uploadFile.name} ({(uploadFile.size / 1024).toFixed(0)} KB)</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Titulli *</Label>
                  <Input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="p.sh. DST - Mirembajtje Sistemesh" />
                </div>
                <div className="space-y-1.5">
                  <Label>Lloji i Dokumentit</Label>
                  <Select value={uploadDocType} onValueChange={setUploadDocType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleUpload} disabled={uploading || !uploadFile || !uploadTitle.trim()}>
                  {uploading
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Duke ngarkuar...</>
                    : <><Upload className="h-4 w-4 mr-2" />Ngarko Dokumentin</>
                  }
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      <AddRequirementDialog open={addReqOpen} onClose={() => setAddReqOpen(false)} procedureId={procedureId} />
    </div>
  )
}
