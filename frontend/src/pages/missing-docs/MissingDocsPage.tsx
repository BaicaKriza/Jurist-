import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Building2,
  Search,
  ChevronRight,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { companyService } from '@/services/companyService'
import { procedureService } from '@/services/procedureService'
import { useToast } from '@/hooks/useToast'
import type { MatchingStatus } from '@/types'

const MATCHING_LABELS: Record<MatchingStatus, string> = {
  FOUND_VALID: 'Gjendur - Valid',
  FOUND_EXPIRING: 'Gjendur - Skadon',
  FOUND_EXPIRED: 'Gjendur - Skaduar',
  MISSING: 'Mungon',
  NOT_APPLICABLE: 'Nuk kërkohet',
}

function matchingStatusIcon(status: MatchingStatus) {
  switch (status) {
    case 'FOUND_VALID':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />
    case 'FOUND_EXPIRING':
      return <Clock className="h-4 w-4 text-amber-500" />
    case 'FOUND_EXPIRED':
      return <AlertTriangle className="h-4 w-4 text-red-500" />
    case 'MISSING':
      return <XCircle className="h-4 w-4 text-red-600" />
    case 'NOT_APPLICABLE':
      return <CheckCircle2 className="h-4 w-4 text-gray-400" />
  }
}

function matchingBadge(status: MatchingStatus) {
  switch (status) {
    case 'FOUND_VALID':
      return <Badge variant="success">Valid</Badge>
    case 'FOUND_EXPIRING':
      return <Badge variant="warning">Skadon</Badge>
    case 'FOUND_EXPIRED':
      return <Badge variant="destructive">Skaduar</Badge>
    case 'MISSING':
      return <Badge variant="destructive">Mungon</Badge>
    case 'NOT_APPLICABLE':
      return <Badge variant="secondary">Nuk kërkohet</Badge>
  }
}

export default function MissingDocsPage() {
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [selectedProcedure, setSelectedProcedure] = useState<string>('')
  const { success, error } = useToast()

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies', 'all'],
    queryFn: () => companyService.getCompanies({ page_size: 200, status: 'active' }),
    staleTime: 60000,
  })

  const { data: proceduresData, isLoading: proceduresLoading } = useQuery({
    queryKey: ['procedures-analyzed'],
    queryFn: () =>
      procedureService.getProcedures({ analysis_status: 'completed', page_size: 200 }),
    staleTime: 60000,
  })

  // Existing report (if any)
  const {
    data: report,
    isLoading: reportLoading,
    refetch: refetchReport,
  } = useQuery({
    queryKey: ['matching-report', selectedCompany, selectedProcedure],
    queryFn: () =>
      procedureService.getMatchingReport(Number(selectedProcedure), Number(selectedCompany)),
    enabled: !!selectedCompany && !!selectedProcedure,
    retry: false,
  })

  const matchMutation = useMutation({
    mutationFn: () =>
      procedureService.runMatching(Number(selectedProcedure), Number(selectedCompany)),
    onSuccess: () => {
      refetchReport()
      success('Krahasimi u krye', 'Raporti i dokumenteve u gjenerua me sukses.')
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Krahasimi dështoi.')
    },
  })

  const companies = companiesData?.items ?? []
  const procedures = proceduresData?.items ?? []
  const canRun = !!selectedCompany && !!selectedProcedure

  const foundCount = report
    ? report.results.filter((r) =>
        r.status === 'FOUND_VALID' || r.status === 'FOUND_EXPIRING' || r.status === 'FOUND_EXPIRED'
      ).length
    : 0
  const completionPercent = report && report.total_required > 0
    ? Math.round((report.total_found / report.total_required) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dokumentet që Mungojnë</h1>
        <p className="text-sm text-gray-500 mt-1">
          Krahaso dokumentet e kompanisë me kërkesat e një procedure
        </p>
      </div>

      {/* Selectors */}
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Kompania</label>
              <Select
                value={selectedCompany}
                onValueChange={setSelectedCompany}
                disabled={companiesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Zgjidhni kompaninë..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Procedura (e analizuar)</label>
              <Select
                value={selectedProcedure}
                onValueChange={setSelectedProcedure}
                disabled={proceduresLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Zgjidhni procedurën..." />
                </SelectTrigger>
                <SelectContent>
                  {procedures.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      <span className="font-mono text-xs text-gray-500 mr-2">
                        {p.reference_number}
                      </span>
                      {p.title.length > 60 ? p.title.slice(0, 60) + '…' : p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button
              onClick={() => matchMutation.mutate()}
              disabled={!canRun}
              loading={matchMutation.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Gjenero Raportin
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report */}
      {!selectedCompany || !selectedProcedure ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-gray-400">
            <AlertCircle className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium">Zgjidhni kompaninë dhe procedurën</p>
            <p className="text-xs mt-1">
              Analiza do të identifikojë dokumentet që mungojnë
            </p>
          </CardContent>
        </Card>
      ) : reportLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner size="lg" />
        </div>
      ) : !report ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-gray-400">
            <Search className="h-10 w-10 mb-3 text-gray-300" />
            <p className="text-sm font-medium">Nuk ka raport për këtë kombinim</p>
            <p className="text-xs mt-1 mb-4">Klikoni "Gjenero Raportin" për të filluar</p>
            <Button
              onClick={() => matchMutation.mutate()}
              loading={matchMutation.isPending}
              size="sm"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Gjenero Tani
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="md:col-span-2">
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 mb-1">Plotësia e Dokumentacionit</p>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-bold text-gray-900">{completionPercent}%</span>
                  <span className="text-xs text-gray-400 mb-1">
                    ({report.total_found}/{report.total_required})
                  </span>
                </div>
                <Progress value={completionPercent} className="h-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-xs text-gray-500">Gjendur</p>
                  <p className="text-2xl font-bold text-green-700">{report.total_found}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-xs text-gray-500">Mungojnë</p>
                  <p className="text-2xl font-bold text-red-700">{report.total_missing}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-xs text-gray-500">Skadojnë</p>
                  <p className="text-2xl font-bold text-amber-700">{report.total_expiring}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                Detajet e Krahasimit
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-gray-100">
                {report.results.map((result) => (
                  <li key={result.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{matchingStatusIcon(result.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {result.required_document.document_name}
                          </span>
                          {result.required_document.is_mandatory && (
                            <Badge variant="destructive" className="text-[10px]">
                              I detyrueshëm
                            </Badge>
                          )}
                          {matchingBadge(result.status)}
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {result.required_document.document_description}
                        </p>
                        {result.matched_document && (
                          <div className="mt-2 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                            <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span className="text-xs text-gray-700 truncate">
                              {result.matched_document.title}
                            </span>
                            {result.confidence_score !== undefined && (
                              <span className="ml-auto text-xs text-gray-400 shrink-0">
                                {Math.round(result.confidence_score * 100)}% match
                              </span>
                            )}
                          </div>
                        )}
                        {result.status === 'MISSING' && result.required_document.legal_basis && (
                          <p className="text-xs text-amber-700 mt-1">
                            Baza ligjore: {result.required_document.legal_basis}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Footer info */}
          <p className="text-xs text-gray-400 text-right">
            Raport gjeneruar:{' '}
            {report.created_at ? format(parseISO(report.created_at), 'dd MMM yyyy HH:mm') : '—'}
          </p>
        </div>
      )}
    </div>
  )
}
