import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart2,
  Search,
  Sparkles,
  ChevronRight,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
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
import type { ProcedureFilters } from '@/types'

const PAGE_SIZE = 15

export default function AnalysesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Fetch procedures that have completed analyses
  const filters: ProcedureFilters = {
    search: search || undefined,
    analysis_status: 'completed',
    page,
    page_size: PAGE_SIZE,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['analyses', filters],
    queryFn: () => procedureService.getProcedures(filters),
    staleTime: 30000,
  })

  const procedures = data?.items ?? []
  const totalPages = data?.total_pages ?? 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analizat AI</h1>
        <p className="text-sm text-gray-500 mt-1">
          Procedurat me analiza të kryera nga AI · {data?.total ?? 0} gjithsej
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Kërko analizë..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="pl-9"
        />
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : procedures.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-gray-400">
            <BarChart2 className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium">Nuk u gjetën analiza</p>
            {search ? (
              <Button variant="link" size="sm" onClick={() => setSearch('')} className="mt-2">
                Pastro kërkimin
              </Button>
            ) : (
              <p className="text-xs mt-1">Analizoni procedura nga seksioni Procedurat APP</p>
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
                    <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-violet-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-400">
                          {proc.reference_number}
                        </span>
                        <Badge variant="success">Analizuar</Badge>
                        {proc.status === 'open' ? (
                          <Badge variant="success">Hapur</Badge>
                        ) : (
                          <Badge variant="secondary">{proc.status}</Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-2">
                        {proc.title}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>{proc.contracting_authority}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Afati: {format(parseISO(proc.deadline), 'dd MMM yyyy')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Shtuar: {format(parseISO(proc.updated_at), 'dd MMM yyyy')}
                        </span>
                      </div>
                    </div>

                    <Button size="sm" variant="outline" asChild className="shrink-0">
                      <Link to={`/procedures/${proc.id}`}>
                        Shiko Analizën
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Faqja {page} nga {totalPages}
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
