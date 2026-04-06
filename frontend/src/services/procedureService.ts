import api from '@/lib/api'
import type {
    Procedure,
    ProcedureCreate,
    ProcedureFilters,
    ProcedureDocument,
    PaginatedResponse,
    ProcedureAnalysis,
    RequiredDocumentItem,
    RequiredDocumentCreate,
    MatchingReport,
    MatchingResult,
} from '@/types'

export interface UploadedProcedureDocument {
    id: string
    title: string
    file_name: string
    doc_type: string
    file_size: number | null
    ai_summary: string | null
    download_url: string
    created_at: string | null
}

export const procedureService = {
    // ── Procedures ────────────────────────────────────────────────────────────
    async getProcedures(filters?: ProcedureFilters): Promise<PaginatedResponse<Procedure>> {
          const { data } = await api.get('/procedures', { params: filters })
          return data
    },

    async getProcedure(id: string): Promise<Procedure> {
          const { data } = await api.get(`/procedures/${id}`)
          return data
    },

    async createProcedure(payload: ProcedureCreate): Promise<Procedure> {
          const { data } = await api.post('/procedures', payload)
          return data
    },

    async syncProcedures(params?: {
          source?: string
          max_pages?: number
          force_refresh?: boolean
    }): Promise<{ synced_count: number; updated_count: number; errors: number; message: string }> {
          const { data } = await api.post('/procedures/sync', params ?? {})
          return data
    },

    async analyzeProcedure(id: string): Promise<ProcedureAnalysis> {
          const { data } = await api.post(`/procedures/${id}/analyze`)
          return data
    },

    async getProcedureDocuments(id: string): Promise<ProcedureDocument[]> {
          const { data } = await api.get(`/procedures/${id}/documents`)
          return data
    },

    // ── Uploaded Documents (user-uploaded files) ──────────────────────────────
    async getUploadedDocuments(procedureId: string): Promise<UploadedProcedureDocument[]> {
          const { data } = await api.get(`/procedures/${procedureId}/upload`)
          return data
    },

    async uploadProcedureDocument(
          procedureId: string,
          file: File,
          title: string,
          docType: string
        ): Promise<UploadedProcedureDocument> {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('title', title)
          formData.append('doc_type', docType)
          const { data } = await api.post(`/procedures/${procedureId}/upload`, formData, {
                  headers: { 'Content-Type': 'multipart/form-data' },
          })
          return data
    },

    async deleteUploadedDocument(procedureId: string, docId: string): Promise<void> {
          await api.delete(`/procedures/${procedureId}/upload/${docId}`)
    },

    // ── Requirements ──────────────────────────────────────────────────────────
    async getRequiredDocuments(procedureId: string): Promise<RequiredDocumentItem[]> {
          const { data } = await api.get(`/analyses/procedures/${procedureId}/required-documents`)
          return data
    },

    async addRequiredDocument(
          procedureId: string,
          payload: RequiredDocumentCreate
        ): Promise<RequiredDocumentItem> {
          const { data } = await api.post(`/procedures/${procedureId}/requirements`, payload)
          return data
    },

    async deleteRequiredDocument(procedureId: string, requirementId: string): Promise<void> {
          await api.delete(`/procedures/${procedureId}/requirements/${requirementId}`)
    },

    // ── Analysis ──────────────────────────────────────────────────────────────
    async getAnalyses(params?: {
          page?: number
          page_size?: number
    }): Promise<PaginatedResponse<ProcedureAnalysis>> {
          const { data } = await api.get('/analyses', { params })
          return data
    },

    async getProcedureAnalysis(procedureId: string): Promise<ProcedureAnalysis> {
          const { data } = await api.get(`/analyses/procedures/${procedureId}/analysis`)
          return data
    },

    // ── Matching ──────────────────────────────────────────────────────────────
    async runMatching(procedureId: string, companyId: string): Promise<MatchingResult[]> {
          const { data } = await api.post('/matching/run', {
                  procedure_id: procedureId,
                  company_id: companyId,
          })
          return data
    },

    async getMatchingReport(procedureId: string, companyId: string): Promise<MatchingReport> {
          const { data } = await api.get(`/matching/report/${procedureId}/${companyId}`)
          return data
    },
}
