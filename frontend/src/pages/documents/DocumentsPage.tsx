import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  FileText,
  Search,
  Download,
  Filter,
  X,
  AlertTriangle,
  CheckCircle2,
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
import { documentService } from '@/services/documentService'
import { companyService } from '@/services/companyService'
import { useToast } from '@/hooks/useToast'
import type { DocumentFilters, DocumentStatus, DocumentType } from '@/types'

const STATUS_LABELS: Record<DocumentStatus, string> = {
  valid: 'Valid',
  expiring_soon: 'Skadon',
  expired: 'Skaduar',
  pending: 'Në pritje',
  invalid: 'I pavlefshëm',
}

const TYPE_LABELS: Record<DocumentType, string> = {
  certificate: 'Certifikatë',
  license: 'Licencë',
  permit: 'Leje',
  registration: 'Regjistrim',
  financial: 'Financiare',
  legal: 'Juridike',
  technical: 'Teknike',
  other: 'Tjetër',
}

function statusBadge(status: DocumentStatus) {
  switch (status) {
    case 'valid':
      return <Badge variant="success">Valid</Badge>
    case 'expiring_soon':
      return <Badge variant="warning">Skadon</Badge>
    case 'expired':
      return <Badge variant="destructive">Skaduar</Badge>
    case 'pending':
      return <Badge variant="info">Në pritje</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

const PAGE_SIZE = 20

export default function DocumentsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const { error } = useToast()

  const { data: companiesData } = useQuery({
    queryKey: ['companies', 'all'],
    queryFn: () => companyService.getCompanies({ page_size: 200 }),
    staleTime: 60000,
  })

  const filters: DocumentFilters = {
    search: search || undefined,
    status: statusFilter !== 'all' ? (statusFilter as DocumentStatus) : undefined,
    document_type: typeFilter !== 'all' ? (typeFilter as DocumentType) : undefined,
    company_id: companyFilter !== 'all' ? Number(companyFilter) : undefined,
    page,
    page_size: PAGE_SIZE,
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['documents', filters],
    queryFn: () => documentService.getDocuments(filters),
    staleTime: 30000,
  })

  function resetFilters() {
    setSearch('')
    setStatusFilter('all')
    setTypeFilter('all')
    setCompanyFilter('all')
    setPage(1)
  }

  const hasActiveFilters =
    search || statusFilter !== 'all' || typeFilter !== 'all' || companyFilter !== 'all'

  async function handleDownload(docId: number, fileName: string) {
    try {
      const blob = await documentService.downloadDocument(docId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      error('Gabim', 'Shkarkimi dështoi.')
    }
  }

  const documents = data?.items ?? []
  const totalPages = data?.total_pages ?? 1
  const companies = companiesData?.items ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dokumentet</h1>
        <p className="text-sm text-gray-500 mt-1">
          {data?.total ?? 0} dokumente gjithsej
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Kërko dokument..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Statusi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Të gjitha statuset</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type filter */}
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Lloji" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Të gjitha llojet</SelectItem>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Company filter */}
            <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setPage(1) }}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Kompania" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Të gjitha kompanite</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <FileText className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-sm font-medium">Nuk u gjetën dokumente</p>
              {hasActiveFilters && (
                <Button variant="link" size="sm" onClick={resetFilters} className="mt-2">
                  Pastro filtrat
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left py-3 px-5 font-medium text-gray-600">Titulli</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600">Kompania</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600">Lloji</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600">Lëshues</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600">Skadon</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600">Statusi</th>
                      <th className="py-3 px-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                            <span className="font-medium text-gray-900 max-w-xs truncate">
                              {doc.title}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-600">
                          {doc.company ? (
                            <Link
                              to={`/companies/${doc.company_id}`}
                              className="hover:text-blue-600 hover:underline"
                            >
                              {doc.company.name}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-3 text-gray-500">
                          {TYPE_LABELS[doc.document_type] ?? doc.document_type}
                        </td>
                        <td className="py-3 px-3 text-gray-500">{doc.issuer ?? '—'}</td>
                        <td className="py-3 px-3 text-gray-500">
                          {doc.expiry_date ? (
                            <span
                              className={
                                doc.status === 'expired'
                                  ? 'text-red-600 font-medium'
                                  : doc.status === 'expiring_soon'
                                  ? 'text-amber-600 font-medium'
                                  : ''
                              }
                            >
                              {format(parseISO(doc.expiry_date), 'dd MMM yyyy')}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-3">{statusBadge(doc.status)}</td>
                        <td className="py-3 px-3">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDownload(doc.id, doc.file_name)}
                            title="Shkarko"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Faqja {page} nga {totalPages} · {data?.total} dokumente
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
        </CardContent>
      </Card>
    </div>
  )
}
