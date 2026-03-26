// ─── User & Auth ──────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'viewer'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
  last_login?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

// ─── Company ──────────────────────────────────────────────────────────────────

export type CompanyStatus = 'active' | 'inactive' | 'suspended'

export interface Company {
  id: number
  name: string
  nipt: string
  administrator: string
  address?: string
  phone?: string
  email?: string
  status: CompanyStatus
  notes?: string
  created_at: string
  updated_at: string
}

export interface CompanyStats {
  company_id: number
  total_documents: number
  active_certificates: number
  expiring_soon: number
  expired: number
  total_folders: number
  last_sync?: string
}

// ─── Folder ───────────────────────────────────────────────────────────────────

export interface Folder {
  id: number
  company_id: number
  name: string
  parent_id?: number
  path: string
  document_count: number
  children?: Folder[]
  created_at: string
}

export interface FolderTree extends Folder {
  children: FolderTree[]
}

// ─── Document ─────────────────────────────────────────────────────────────────

export type DocumentStatus = 'valid' | 'expiring_soon' | 'expired' | 'pending' | 'invalid'
export type DocumentType =
  | 'certificate'
  | 'license'
  | 'permit'
  | 'registration'
  | 'financial'
  | 'legal'
  | 'technical'
  | 'other'

export interface Document {
  id: number
  company_id: number
  folder_id?: number
  title: string
  document_type: DocumentType
  status: DocumentStatus
  file_name: string
  file_size: number
  file_path: string
  mime_type: string
  issuer?: string
  issue_date?: string
  expiry_date?: string
  reference_number?: string
  notes?: string
  tags?: string[]
  uploaded_by: number
  created_at: string
  updated_at: string
  company?: Company
  folder?: Folder
}

// ─── Procedure ────────────────────────────────────────────────────────────────

export type ProcedureStatus = 'open' | 'closed' | 'cancelled' | 'awarded' | 'pending'
export type ProcedureType =
  | 'open_tender'
  | 'restricted_tender'
  | 'negotiated'
  | 'direct'
  | 'framework'
  | 'other'

export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ProcedureDocument {
  id: number
  procedure_id: number
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  downloaded: boolean
  downloaded_at?: string
}

export interface Procedure {
  id: number
  reference_number: string
  title: string
  contracting_authority: string
  procedure_type: ProcedureType
  estimated_value?: number
  currency: string
  deadline: string
  publication_date: string
  status: ProcedureStatus
  description?: string
  cpv_codes?: string[]
  source_url?: string
  documents?: ProcedureDocument[]
  analysis_status: AnalysisStatus
  created_at: string
  updated_at: string
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

export type MatchingStatus =
  | 'FOUND_VALID'
  | 'FOUND_EXPIRING'
  | 'FOUND_EXPIRED'
  | 'MISSING'
  | 'NOT_APPLICABLE'

export interface RequiredDocumentItem {
  id: number
  analysis_id: number
  document_name: string
  document_description: string
  legal_basis?: string
  is_mandatory: boolean
  category: string
  notes?: string
}

export interface ProcedureAnalysis {
  id: number
  procedure_id: number
  summary: string
  legal_requirements: string
  technical_requirements: string
  financial_requirements: string
  risk_assessment: string
  recommendation: string
  required_documents: RequiredDocumentItem[]
  analyzed_at: string
  model_used: string
  procedure?: Procedure
}

// ─── Matching ─────────────────────────────────────────────────────────────────

export interface MatchingResult {
  id: number
  report_id: number
  required_document_id: number
  required_document: RequiredDocumentItem
  matched_document_id?: number
  matched_document?: Document
  status: MatchingStatus
  confidence_score?: number
  notes?: string
}

export interface MatchingReport {
  id: number
  procedure_id: number
  company_id: number
  company: Company
  procedure: Procedure
  results: MatchingResult[]
  total_required: number
  total_found: number
  total_missing: number
  total_expiring: number
  total_expired: number
  created_at: string
  updated_at: string
}

export interface RetrievalGuide {
  id: number
  document_name: string
  issuing_institution: string
  website_url?: string
  required_documents: string
  procedure_steps: string
  estimated_days: number
  cost?: string
  notes?: string
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'upload'
  | 'download'
  | 'login'
  | 'logout'
  | 'sync'
  | 'analyze'

export interface AuditLog {
  id: number
  user_id: number
  user?: User
  company_id?: number
  action: AuditAction
  resource_type: string
  resource_id?: number
  description: string
  ip_address?: string
  created_at: string
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  active_companies: number
  total_documents: number
  expiring_soon: number
  new_procedures_today: number
  expired_documents: number
  pending_analyses: number
  recent_expiring_documents: Document[]
  recent_procedures: Procedure[]
}

// ─── Form Types ───────────────────────────────────────────────────────────────

export interface CompanyFormData {
  name: string
  nipt: string
  administrator: string
  address?: string
  phone?: string
  email?: string
  status: CompanyStatus
  notes?: string
}

export interface DocumentUploadData {
  company_id: number
  folder_id?: number
  title: string
  document_type: DocumentType
  issuer?: string
  issue_date?: string
  expiry_date?: string
  reference_number?: string
  notes?: string
  file: File
}

export interface UserFormData {
  email: string
  full_name: string
  role: UserRole
  password?: string
  is_active: boolean
}

// ─── Filter Types ─────────────────────────────────────────────────────────────

export interface DocumentFilters {
  company_id?: number
  document_type?: DocumentType
  status?: DocumentStatus
  folder_id?: number
  search?: string
  expiry_from?: string
  expiry_to?: string
  page?: number
  page_size?: number
}

export interface ProcedureFilters {
  procedure_type?: ProcedureType
  authority?: string
  status?: ProcedureStatus
  analysis_status?: AnalysisStatus
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  page_size?: number
}
