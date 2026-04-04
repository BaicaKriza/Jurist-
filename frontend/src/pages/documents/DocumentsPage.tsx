import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, Search, Download, X, AlertTriangle, CheckCircle2, Archive } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { documentService } from '@/services/documentService'
import { companyService } from '@/services/companyService'
import { useToast } from '@/hooks/useToast'
import type { DocumentStatus } from '@/types'

function statusBadge(status: string) {
  switch (status) {
    case 'ACTIVE':          return <Badge variant="success">Aktiv</Badge>
    case 'EXPIRED':         return <Badge variant="destructive">Skaduar</Badge>
    case 'ARCHIVED':        return <Badge variant="secondary">Arkivuar</Badge>
    case 'REVIEW_REQUIRED': return <Badge variant="warning">Shqyrtim</Badge>
    default:                return <Badge variant="secondary">{status}</Badge>
  }
}

const PAGE_SIZE = 20

export default function DocumentsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [page, setPage] = useState(1)
  const { error } = useToast()

  const { data: companiesData } = useQuery({
    queryKey: ['companies', 'all'],
    queryFn: () => companyService.getCompanies({ page_size: 200 }),
    staleTime: 60000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['documents-all', { search, statusFilter, companyFilter, page }],
    queryFn: () =>
      documentService.getAllDocuments({
        search: search || undefined,
        status: statusFilter !== 'all' ? (statusFilter as DocumentStatus) : undefined,
        company_id: companyFilter !== 'all' ? companyFilter : undefined,
        page,
        page_size: PAGE_SIZE,
      }),
    staleTime: 30000,
  })

  function openDownload(doc: { id: string; download_url?: string }) {
    const url = doc.download_url || documentService.getDownloadUrl(doc.id)
    window.open(url, '_blank')
  }

  const docs = data?.items ?? []
  const totalPages = data?.pages ?? 1
  const hasFilters = search || statusFilter !== 'all' || companyFilter !== 'all'
  const companies = companiesData?.items ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dokumentet</h1>
        <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} dokumente gjithsej</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Kërko dokument..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Statusi" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Të gjitha statuset</SelectItem>
                <SelectItem value="ACTIVE">Aktiv</SelectItem>
                <SelectItem value="EXPIRED">Skaduar</SelectItem>
                <SelectItem value="ARCHIVED">Arkivuar</SelectItem>
                <SelectItem value="REVIEW_REQUIRED">Shqyrtim</SelectItem>
              </SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setPage(1) }}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Kompania" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Të gjitha kompanite</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter('all'); setCompanyFilter('all'); setPage(1) }}>
                <X className="h-4 w-4 mr-1.5" />Pastro
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <FileText className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-sm font-medium">Nuk u gjetën dokumente</p>
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
                    {docs.map(doc => (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                            <span className="font-medium text-gray-900 max-w-xs truncate">{doc.title}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-600">
                          <Link to={`/companies/${doc.company_id}`} className="hover:text-blue-600 hover:underline text-xs">{doc.company_id.slice(0, 8)}…</Link>
                        </td>
                        <td className="py-3 px-3 text-gray-500 text-xs">{doc.doc_type ?? '—'}</td>
                        <td className="py-3 px-3 text-gray-500 text-xs">{doc.issuer ?? '—'}</td>
                        <td className="py-3 px-3 text-gray-500 text-xs">
                          {doc.expiry_date ? (
                            <span className={doc.status === 'EXPIRED' ? 'text-red-600 font-medium' : ''}>
                              {format(parseISO(doc.expiry_date), 'dd MMM yyyy')}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-3">{statusBadge(doc.status)}</td>
                        <td className="py-3 px-3">
                          <Button variant="ghost" size="icon-sm" onClick={() => openDownload(doc)} title="Shkarko">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">Faqja {page} nga {totalPages} · {data?.total}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prapa</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Para</Button>
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
