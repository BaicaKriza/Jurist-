import api from '@/lib/api'
import type {
  Procedure,
  ProcedureFilters,
  PaginatedResponse,
  ProcedureAnalysis,
  MatchingReport,
  RetrievalGuide,
} from '@/types'

export const procedureService = {
  async getProcedures(filters?: ProcedureFilters): Promise<PaginatedResponse<Procedure>> {
    const { data } = await api.get('/procedures', { params: filters })
    return data
  },

  async getProcedure(id: number): Promise<Procedure> {
    const { data } = await api.get(`/procedures/${id}`)
    return data
  },

  async syncProcedures(): Promise<{ synced: number; message: string }> {
    const { data } = await api.post('/procedures/sync')
    return data
  },

  async analyzeProcedure(id: number): Promise<ProcedureAnalysis> {
    const { data } = await api.post(`/procedures/${id}/analyze`)
    return data
  },

  async getAnalysis(procedureId: number): Promise<ProcedureAnalysis> {
    const { data } = await api.get(`/procedures/${procedureId}/analysis`)
    return data
  },

  async downloadProcedureDocuments(id: number): Promise<{ downloaded: number }> {
    const { data } = await api.post(`/procedures/${id}/download-documents`)
    return data
  },

  async runMatching(procedureId: number, companyId: number): Promise<MatchingReport> {
    const { data } = await api.post(`/procedures/${procedureId}/match`, {
      company_id: companyId,
    })
    return data
  },

  async getMatchingReport(procedureId: number, companyId: number): Promise<MatchingReport> {
    const { data } = await api.get(`/procedures/${procedureId}/match/${companyId}`)
    return data
  },

  async getRetrievalGuides(): Promise<RetrievalGuide[]> {
    const { data } = await api.get('/retrieval-guides')
    return data
  },

  async createRetrievalGuide(payload: Partial<RetrievalGuide>): Promise<RetrievalGuide> {
    const { data } = await api.post('/retrieval-guides', payload)
    return data
  },

  async updateRetrievalGuide(
    id: number,
    payload: Partial<RetrievalGuide>
  ): Promise<RetrievalGuide> {
    const { data } = await api.put(`/retrieval-guides/${id}`, payload)
    return data
  },

  async deleteRetrievalGuide(id: number): Promise<void> {
    await api.delete(`/retrieval-guides/${id}`)
  },
}
