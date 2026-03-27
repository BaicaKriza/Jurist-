import api from '@/lib/api'
import type {
  Document,
  DocumentUploadData,
  DocumentUploadResponse,
  DocumentFilters,
  PaginatedResponse,
} from '@/types'

export const documentService = {
  async uploadDocument(payload: DocumentUploadData): Promise<DocumentUploadResponse> {
    const formData = new FormData()
    formData.append('file', payload.file)
    formData.append('title', payload.title)
    if (payload.doc_type) formData.append('doc_type', payload.doc_type)
    if (payload.folder_id) formData.append('folder_id', payload.folder_id)
    if (payload.issuer) formData.append('issuer', payload.issuer)
    if (payload.issue_date) formData.append('issue_date', payload.issue_date)
    if (payload.expiry_date) formData.append('expiry_date', payload.expiry_date)
    if (payload.reference_no) formData.append('reference_no', payload.reference_no)

    const { data } = await api.post(
      `/companies/${payload.company_id}/documents/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return data
  },

  async getDocuments(
    companyId: string,
    filters?: Omit<DocumentFilters, 'company_id'>
  ): Promise<PaginatedResponse<Document>> {
    const { data } = await api.get(`/companies/${companyId}/documents`, { params: filters })
    return data
  },

  async getDocument(id: string): Promise<Document> {
    const { data } = await api.get(`/documents/${id}`)
    return data
  },

  async updateDocument(id: string, payload: Partial<Document>): Promise<Document> {
    const { data } = await api.patch(`/documents/${id}`, payload)
    return data
  },

  async deleteDocument(id: string): Promise<void> {
    await api.delete(`/documents/${id}`)
  },

  async getDownloadUrl(id: string): Promise<string> {
    // Returns redirect – just return the URL to open directly
    return `${api.defaults.baseURL}/documents/${id}/download`
  },

  async getAllDocuments(filters?: DocumentFilters): Promise<PaginatedResponse<Document>> {
    const { data } = await api.get('/documents', { params: filters })
    return data
  },

  async getExpiringDocuments(days = 30, companyId?: string): Promise<Document[]> {
    const { data } = await api.get('/expiring', {
      params: { days, company_id: companyId },
    })
    return data
  },
}
