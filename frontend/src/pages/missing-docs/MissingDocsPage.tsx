import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Search,
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
import type { MatchStatus } from '@/types'

function matchingStatusIcon(status: MatchStatus) {
  switch (status) {
    case 'FOUND_VALID':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />
    case 'FOUND_PARTIAL':
      return <Clock className="h-4 w-4 text-amber-500" />
    case 'FOUND_EXPIRED':
      return <AlertTriangle className="h-4 w-4 text-red-500" />
    case 'MISSING':
      return <XCircle className="h-4 w-4 text-red-600" />
    case 'REVIEW_REQUIRED':
      return <AlertCircle className="h-4 w-4 text-amber-400" />
    default:
      return <AlertCircle className="h-4 w-4 text-gray-400" />
  }
}

function matchingBadge(status: MatchStatus) {
  switch (status) {
    case 'FOUND_VALID':
      return <Badge variant="success">Valid</Badge>
    case 'FOUND_PARTIAL':
      return <Badge variant="warning">Pjesërisht</Badge>
    case 'FOUND_EXPIRED':
      return <Badge variant="destructive">Skaduar</Badge>
    case 'MISSING':
      return <Badge variant="destructive">Mungon</Badge>
    case 'REVIEW_REQUIRED':
      return <Badge variant="warning">Kërkon vëmendje</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function MissingDocsPage() {
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [selectedProcedure, setSelectedProcedure] = useState<string>('')
  const { success, error } = useToast()

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies-all'],
    queryFn: () => companyService.getCompanies({ page_size: 200 }),
    staleTime: 60000,
  })

  const { data: proceduresData, isLoading: proceduresLoading } = useQuery({
    queryKey: ['procedures-all'],
    queryFn: () => procedureService.getProcedures({ page_size: 200 }),
    staleTime: 60000,
  })

  const {
    data: report,
    isLoading: reportLoading,
    refetch: refetchReport,
  } = useQuery({
    queryKey: ['matching-report', selectedCompany, selectedProcedure],
    queryFn: () => procedureService.getMatchingReport(selectedProcedure, selectedCompany),
    enabled: !!selectedCompany && !!selectedProcedure,
    retry: false,
  })

  const matchMutation = useMutation({
    mutationFn: () => procedureService.runMatching(selectedProcedure, selectedCompany),
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
    ? report.found_valid + report.found_expired + report.found_partial
    : 0
  const completionPercent =
    report && report.total_required > 0
      ? Math.round((report.found_valid / report.total_required) * 100)
      : 0

  return (
    <div className="space-y-6">
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
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Procedura</label>
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
                    <SelectItem key={p.id} value={p.id}>
                      {p.reference_no && (
                        <span className="font-mono text-xs text-gray-500 mr-2">{p.reference_no}</span>
                      )}
                      {(p.object_description ?? '(pa titull)').slice(0, 60)}
                      {(p.object_description?.length ?? 0) > 60 ? '…' : ''}
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
            <p className="text-xs mt-1">Analiza do të identifikojë dokumentet që mungojnë</p>
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
            <Button onClick={() => matchMutation.mutate()} loading={matchMutation.isPending} size="sm">
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
                <p className="text-xs text-gray-500 mb-1">Gatishmëria</p>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {Math.round(report.readiness_score)}%
                  </span>
                  <span className="text-xs text-gray-400 mb-1">
                    ({report.found_valid}/{report.total_required} valid)
                  </span>
                </div>
                <Progress value={Math.round(report.readiness_score)} className="h-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-xs text-gray-500">Valid</p>
                  <p className="text-2xl font-bold text-green-700">{report.found_valid}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-xs text-gray-500">Mungojnë</p>
                  <p className="text-2xl font-bold text-red-700">{report.missing}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-xs text-gray-500">Skaduar/Pjesë</p>
                  <p className="text-2xl font-bold text-amber-700">
                    {report.found_expired + report.found_partial}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                Detajet e Krahasimit ({report.items.length} kërkesa)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-gray-100">
                {report.items.map((item) => (
                  <li
                    key={item.required_document_id}
                    className="px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {matchingStatusIcon(item.match_status as MatchStatus)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {item.required_document_name}
                          </span>
                          {item.mandatory && (
                            <Badge variant="destructive" className="text-[10px]">
                              I detyrueshëm
                            </Badge>
                          )}
                          {matchingBadge(item.match_status as MatchStatus)}
                          <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                        </div>
                        {item.matched_document_title && (
                          <div className="mt-2 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                            <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span className="text-xs text-gray-700 truncate">
                              {item.matched_document_title}
                            </span>
                            {item.confidence_score != null && (
                              <span className="ml-auto text-xs text-gray-400 shrink-0">
                                {Math.round(item.confidence_score * 100)}% match
                              </span>
                            )}
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-xs text-amber-700 mt-1">{item.notes}</p>
                        )}
                        {item.retrieval_guide && item.match_status === 'MISSING' && (
                          <p className="text-xs text-blue-600 mt-1">
                            Si ta sigurosh: {item.retrieval_guide}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <p className="text-xs text-gray-400 text-right">
            Raport gjeneruar:{' '}
            {report.generated_at
              ? format(parseISO(String(report.generated_at)), 'dd MMM yyyy HH:mm')
              : '—'}
          </p>
        </div>
      )}
    </div>
  )
}
