import api from '@/lib/api'
import type { Document, DocumentUploadData, DocumentFilters, PaginatedResponse } from '@/types'

export const documentService = {
  async uploadDocument(payload: DocumentUploadData): Promise<Document> {
    const formData = new FormData()
    formData.append('file', payload.file)
    formData.append('company_id', String(payload.company_id))
    formData.append('title', payload.title)
    formData.append('document_type', payload.document_type)
    if (payload.folder_id) formData.append('folder_id', String(payload.folder_id))
    if (payload.issuer) formData.append('issuer', payload.issuer)
    if (payload.issue_date) formData.append('issue_date', payload.issue_date)
    if (payload.expiry_date) formData.append('expiry_date', payload.expiry_date)
    if (payload.reference_number) formData.append('reference_number', payload.reference_number)
    if (payload.notes) formData.append('notes', payload.notes)

    const { data } = await api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  async getDocuments(filters?: DocumentFilters): Promise<PaginatedResponse<Document>> {
    const { data } = await api.get('/documents', { params: filters })
    return data
  },

  async getDocument(id: number): Promise<Document> {
    const { data } = await api.get(`/documents/${id}`)
    return data
  },

  async updateDocument(id: number, payload: Partial<Document>): Promise<Document> {
    const { data } = await api.put(`/documents/${id}`, payload)
    return data
  },

  async deleteDocument(id: number): Promise<void> {
    await api.delete(`/documents/${id}`)
  },

  async downloadDocument(id: number): Promise<Blob> {
    const { data } = await api.get(`/documents/${id}/download`, { responseType: 'blob' })
    return data
  },

  async getExpiringDocuments(days = 30): Promise<Document[]> {
    const { data } = await api.get('/documents/expiring', { params: { days } })
    return data
  },

  async reanalyzeDocument(id: number): Promise<Document> {
    const { data } = await api.post(`/documents/${id}/reanalyze`)
    return data
  },
}
