import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart2,
  Search,
  Sparkles,
  ChevronRight,
  Clock,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { procedureService } from '@/services/procedureService'

function riskBadge(risk?: string | null) {
  switch (risk) {
    case 'LOW': return <Badge variant="success">Rrezik i ulët</Badge>
    case 'MEDIUM': return <Badge variant="warning">Rrezik mesatar</Badge>
    case 'HIGH': return <Badge variant="destructive">Rrezik i lartë</Badge>
    default: return <Badge variant="secondary">{risk ?? '—'}</Badge>
  }
}

const PAGE_SIZE = 15

export default function AnalysesPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['analyses', { page }],
    queryFn: () => procedureService.getAnalyses({ page, page_size: PAGE_SIZE }),
    staleTime: 30000,
  })

  const analyses = data?.items ?? []
  const totalPages = data?.pages ?? 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analizat AI</h1>
        <p className="text-sm text-gray-500 mt-1">
          Analiza të kryera nga AI · {data?.total ?? 0} gjithsej
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : analyses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-gray-400">
            <BarChart2 className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium">Nuk ka analiza ende</p>
            <p className="text-xs mt-1">Analizoni procedura nga seksioni Procedurat APP</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {analyses.map((analysis) => (
              <Card key={analysis.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-violet-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="success">Analizuar</Badge>
                        {riskBadge(analysis.risk_level)}
                        <span className="text-xs text-gray-400">{analysis.analysis_type}</span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                        {analysis.summary ?? '(pa përmbledhje)'}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3.5 w-3.5" />
                        {format(parseISO(String(analysis.created_at)), 'dd MMM yyyy HH:mm')}
                      </div>
                    </div>

                    <Button size="sm" variant="outline" asChild className="shrink-0">
                      <Link to={`/procedures/${analysis.procedure_id}`}>
                        Shiko Procedurën
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
              <p className="text-xs text-gray-500">Faqja {page} nga {totalPages}</p>
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
    </div>
  )
}
