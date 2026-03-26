import api from '@/lib/api'
import type {
  Company,
  CompanyListItem,
  CompanyStats,
  CompanyFormData,
  PaginatedResponse,
  FolderTree,
} from '@/types'

export const companyService = {
  async getCompanies(params?: {
    search?: string
    is_active?: boolean
    page?: number
    page_size?: number
  }): Promise<PaginatedResponse<CompanyListItem>> {
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
    const { data } = await api.patch(`/companies/${id}`, payload)
    return data
  },

  async deleteCompany(id: string): Promise<void> {
    await api.delete(`/companies/${id}`)
  },

  async getCompanyStats(id: string): Promise<CompanyStats> {
    const { data } = await api.get(`/companies/${id}/stats`)
    return data
  },

  async getCompanyFolders(id: string): Promise<FolderTree[]> {
    const { data } = await api.get(`/companies/${id}/folders`)
    return data
  },
}
