import api from '@/lib/api'
import type {
  Company,
  CompanyStats,
  CompanyFormData,
  PaginatedResponse,
  Document,
  FolderTree,
} from '@/types'

export const companyService = {
  async getCompanies(params?: {
    search?: string
    status?: string
    page?: number
    page_size?: number
  }): Promise<PaginatedResponse<Company>> {
    const { data } = await api.get('/companies', { params })
    return data
  },

  async getCompany(id: string): Promise<Company> {
    const { data } = await api.get(`/companies/${id}`)
    return data
  },

  async createCompany(payload: CompanyFormData): Promise<Company> {
    const { data } = await api.post('/companies', payload)
    return data
  },

  async updateCompany(id: string, payload: Partial<CompanyFormData>): Promise<Company> {
    const { data } = await api.put(`/companies/${id}`, payload)
    return data
  },

  async deleteCompany(id: string): Promise<void> {
    await api.delete(`/companies/${id}`)
  },

  async deactivateCompany(id: string): Promise<Company> {
    const { data } = await api.patch(`/companies/${id}/deactivate`)
    return data
  },

  async activateCompany(id: string): Promise<Company> {
    const { data } = await api.patch(`/companies/${id}/activate`)
    return data
  },

  async getCompanyStats(id: string): Promise<CompanyStats> {
    const { data } = await api.get(`/companies/${id}/stats`)
    return data
  },

  async getCompanyDocuments(
    id: string,
    params?: { folder_id?: number; document_type?: string; status?: string; page?: number }
  ): Promise<PaginatedResponse<Document>> {
    const { data } = await api.get(`/companies/${id}/documents`, { params })
    return data
  },

  async getCompanyFolders(id: number): Promise<FolderTree[]> {
    const { data } = await api.get(`/companies/${id}/folders`)
    return data
  },
}
