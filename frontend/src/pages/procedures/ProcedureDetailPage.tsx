import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Search,
  BarChart2,
  Calendar,
  Building,
  DollarSign,
  ExternalLink,
  Download,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { procedureService } from '@/services/procedureService'
import { useToast } from '@/hooks/useToast'
import type { ProcedureStatus, AnalysisStatus } from '@/types'

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
  }
}

function formatCurrency(value?: number, currency = 'ALL') {
  if (!value) return '—'
  return new Intl.NumberFormat('sq-AL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

const TYPE_LABELS: Record<string, string> = {
  open_tender: 'Procedurë e hapur',
  restricted_tender: 'Procedurë e kufizuar',
  negotiated: 'Me negocim',
  direct: 'Direkte',
  framework: 'Kornizë',
  other: 'Tjetër',
}

export default function ProcedureDetailPage() {
  const { id } = useParams<{ id: string }>()
  const procedureId = Number(id)
  const queryClient = useQueryClient()
  const { success, error } = useToast()

  const { data: procedure, isLoading: procLoading } = useQuery({
    queryKey: ['procedure', procedureId],
    queryFn: () => procedureService.getProcedure(procedureId),
    enabled: !!procedureId,
  })

  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['procedure-analysis', procedureId],
    queryFn: () => procedureService.getAnalysis(procedureId),
    enabled: !!procedureId && procedure?.analysis_status === 'completed',
    retry: false,
  })

  const analyzeMutation = useMutation({
    mutationFn: () => procedureService.analyzeProcedure(procedureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procedure', procedureId] })
      queryClient.invalidateQueries({ queryKey: ['procedure-analysis', procedureId] })
      success('Analiza u krye', 'Analiza e AI u krye me sukses.')
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Analiza dështoi.')
    },
  })

  const downloadDocsMutation = useMutation({
    mutationFn: () => procedureService.downloadProcedureDocuments(procedureId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['procedure', procedureId] })
      success('Shkarkimi u krye', `U shkarkuan ${result.downloaded} dokumente.`)
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Shkarkimi dështoi.')
    },
  })

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
        <Search className="h-10 w-10 text-gray-300" />
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

  const docs = procedure.documents ?? []

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/procedures" className="hover:text-blue-600 flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Procedurat
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 font-medium truncate max-w-md">{procedure.title}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-mono bg-gray-100 rounded px-2 py-0.5 text-gray-500">
              {procedure.reference_number}
            </span>
            {statusBadge(procedure.status)}
            {analysisBadge(procedure.analysis_status)}
          </div>
          <h1 className="text-xl font-bold text-gray-900 leading-snug max-w-3xl">
            {procedure.title}
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
          {docs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadDocsMutation.mutate()}
              loading={downloadDocsMutation.isPending}
            >
              <Download className="h-4 w-4 mr-2" />
              Shkarko Dokumentet
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => analyzeMutation.mutate()}
            loading={analyzeMutation.isPending}
            disabled={procedure.analysis_status === 'processing'}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {procedure.analysis_status === 'completed' ? 'Ri-analizo' : 'Analize me AI'}
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">Autoriteti Kontraktues</span>
            </div>
            <p className="text-sm font-semibold text-gray-900 line-clamp-2">
              {procedure.contracting_authority}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">Afati Fundor</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {format(parseISO(procedure.deadline), 'dd MMM yyyy')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">Vlera e Parashikuar</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(procedure.estimated_value, procedure.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">Lloji</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {TYPE_LABELS[procedure.procedure_type] ?? procedure.procedure_type}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Detajet</TabsTrigger>
          <TabsTrigger value="analysis" disabled={procedure.analysis_status !== 'completed'}>
            Analiza AI
          </TabsTrigger>
          <TabsTrigger value="documents">
            Dokumentet ({docs.length})
          </TabsTrigger>
        </TabsList>

        {/* Details */}
        <TabsContent value="details">
          <Card>
            <CardContent className="p-6 space-y-4">
              {procedure.description && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Përshkrim</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{procedure.description}</p>
                </div>
              )}
              {procedure.cpv_codes && procedure.cpv_codes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Kode CPV</h3>
                  <div className="flex flex-wrap gap-2">
                    {procedure.cpv_codes.map((code) => (
                      <Badge key={code} variant="outline">{code}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Botuar më:</span>{' '}
                  <span className="font-medium text-gray-900">
                    {format(parseISO(procedure.publication_date), 'dd MMM yyyy')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Shtuar më:</span>{' '}
                  <span className="font-medium text-gray-900">
                    {format(parseISO(procedure.created_at), 'dd MMM yyyy')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis */}
        <TabsContent value="analysis">
          {analysisLoading ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner />
            </div>
          ) : !analysis ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-gray-400">
                <BarChart2 className="h-10 w-10 mb-3 text-gray-300" />
                <p className="text-sm">Nuk ka analizë për këtë procedurë.</p>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => analyzeMutation.mutate()}
                  loading={analyzeMutation.isPending}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Fillo Analizën
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    Përmbledhje e Analizës
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</p>
                  <p className="text-xs text-gray-400 mt-3">
                    Model: {analysis.model_used} · Analizuar:{' '}
                    {format(parseISO(analysis.analyzed_at), 'dd MMM yyyy HH:mm')}
                  </p>
                </CardContent>
              </Card>

              {/* Requirements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Kërkesat Ligjore</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                      {analysis.legal_requirements}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Kërkesat Teknike</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                      {analysis.technical_requirements}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Kërkesat Financiare</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                      {analysis.financial_requirements}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Vlerësimi i Riskut</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                      {analysis.risk_assessment}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Recommendation */}
              <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader>
                  <CardTitle className="text-sm text-blue-800">Rekomandim</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-blue-900 leading-relaxed">{analysis.recommendation}</p>
                </CardContent>
              </Card>

              {/* Required documents */}
              {analysis.required_documents && analysis.required_documents.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Dokumentet e Kërkuara ({analysis.required_documents.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-gray-100">
                      {analysis.required_documents.map((reqDoc) => (
                        <li key={reqDoc.id} className="px-6 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {reqDoc.document_name}
                                </span>
                                {reqDoc.is_mandatory ? (
                                  <Badge variant="destructive" className="text-[10px]">I detyrueshëm</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px]">Opsional</Badge>
                                )}
                                <Badge variant="outline" className="text-[10px]">{reqDoc.category}</Badge>
                              </div>
                              <p className="text-xs text-gray-500 leading-relaxed">
                                {reqDoc.document_description}
                              </p>
                              {reqDoc.legal_basis && (
                                <p className="text-xs text-blue-600 mt-1">
                                  Baza ligjore: {reqDoc.legal_basis}
                                </p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card>
            <CardContent className="p-0">
              {docs.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-gray-400">
                  <FileText className="h-10 w-10 mb-3 text-gray-300" />
                  <p className="text-sm">Nuk ka dokumente të bashkangjitura.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {docs.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {doc.file_name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {doc.file_type} ·{' '}
                            {doc.downloaded ? (
                              <span className="text-green-600">Shkarkuar</span>
                            ) : (
                              <span className="text-gray-400">Pa shkarkuar</span>
                            )}
                          </p>
                        </div>
                      </div>
                      {doc.file_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                            Shkarko
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
    </div>
  )
}
