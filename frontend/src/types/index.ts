// ─── User & Auth ──────────────────────────────────────────────────────────────

export type UserRole = 'superadmin' | 'admin' | 'manager' | 'viewer'

export interface User {
  id: string
  email: string
  full_name: string
  roles: string[]
  is_active: boolean
  is_superadmin: boolean
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
  id: string
  name: string
  nipt: string
  legal_form?: string
  administrator_name?: string
  address?: string
  phone?: string
  email?: string
  is_active: boolean
  status?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface CompanyStats {
  company_id: string
  company_name?: string
  total_documents: number
  active_documents: number
  expired_documents: number
  review_required?: number
  active_certificates?: number
  expiring_soon: number
  expired: number
  total_folders: number
  last_sync?: string
}

// ─── Folder ───────────────────────────────────────────────────────────────────

export interface Folder {
  id: number
  company_id: string
  company_name?: string
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

export type DocumentStatus = 'ACTIVE' | 'EXPIRED' | 'ARCHIVED' | 'REVIEW_REQUIRED'
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
  id: string
  company_id: string
  folder_id?: string
  title: string
  doc_type?: string
  status: string
  file_name: string
  file_size?: number
  mime_type?: string
  issuer?: string
  issue_date?: string
  expiry_date?: string
  reference_no?: string
  metadata_json?: object
  created_by?: string
  created_at: string
  updated_at: string
  download_url?: string
  company?: { id: string; name: string }
  folder?: Folder
}

// ─── Procedure ────────────────────────────────────────────────────────────────

export type ProcedureStatus = 'OPEN' | 'CLOSED' | 'CANCELLED' | 'AWARDED' | 'UNKNOWN'
export type ProcedureType =
  | 'open_tender'
  | 'restricted_tender'
  | 'negotiated'
  | 'direct'
  | 'framework'
  | 'other'

export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ProcedureDocument {
  id: string
  procedure_id: string
  title?: string
  document_url?: string
  file_name?: string
  file_path?: string
  mime_type?: string
  checksum?: string
  ai_summary?: string
  is_uploaded: boolean
  download_url?: string
  created_at: string
}

export interface Procedure {
  id: string
  source_name: string
  source_url?: string
  reference_no?: string
  notice_no?: string
  authority_name?: string
  object_description?: string
  procedure_type?: string
  contract_type?: string
  cpv_code?: string
  cpv_codes?: string[]
  fund_limit?: number
  currency?: string
  publication_date?: string
  opening_date?: string
  closing_date?: string
  status: string
  document_count?: number
  created_at: string
  updated_at: string
  documents?: ProcedureDocument[]
  analysis_status?: AnalysisStatus
  title?: string
  description?: string
  reference_number?: string
  contracting_authority?: string
  estimated_value?: number
  deadline?: string
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

export type MatchStatus = 'FOUND_VALID' | 'FOUND_EXPIRED' | 'FOUND_PARTIAL' | 'MISSING' | 'REVIEW_REQUIRED'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type MatchingStatus =
  | 'FOUND_VALID'
  | 'FOUND_EXPIRING'
  | 'FOUND_EXPIRED'
  | 'MISSING'
  | 'NOT_APPLICABLE'

export interface RequiredDocumentItem {
  id: string
  procedure_id: string
  name: string
  document_name?: string
  document_description?: string
  category: string
  description?: string
  mandatory: boolean
  is_mandatory?: boolean
  legal_basis?: string
  issuer_type?: string
  source_hint?: string
  validity_rule?: string
  notes?: string
  created_at?: string
}

export interface ProcedureAnalysis {
  id: string
  procedure_id: string
  analysis_type: string
  summary?: string
  legal_notes?: string
  technical_notes?: string
  financial_notes?: string
  risk_level: string
  risk_assessment?: string
  recommendation?: string
  recommended_action?: string
  legal_requirements?: string
  technical_requirements?: string
  financial_requirements?: string
  ai_output_json?: object
  created_at: string
  analyzed_at?: string
  model_used?: string
  required_documents?: RequiredDocumentItem[]
  procedure?: Procedure
}

// ─── Matching ─────────────────────────────────────────────────────────────────

export interface MatchingResult {
  id: string
  procedure_id: string
  company_id: string
  required_document_item_id: string
  matched_document_id?: string
  match_status: string
  confidence_score?: number
  notes?: string
  created_at: string
  required_document_name?: string
  required_document?: RequiredDocumentItem
  matched_document?: Document
  matched_document_title?: string
  status?: MatchingStatus
}

export interface MatchingReport {
  procedure_id: string
  company_id: string
  company_name?: string
  procedure_reference?: string
  authority_name?: string
  total_required: number
  found_valid: number
  found_expired: number
  found_partial: number
  missing: number
  review_required?: number
  total_found?: number
  total_missing?: number
  total_expiring?: number
  total_expired?: number
  readiness_score: number
  items: MatchingReportItem[]
  generated_at: string
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
  total_companies: number
  active_companies: number
  total_documents: number
  total_procedures: number
  total_analyses: number
  total_users?: number
  active_users: number
  expired_documents?: number
  expiring_soon?: number
  new_procedures_today?: number
  pending_analyses?: number
  recent_expiring_documents?: Document[]
  recent_procedures?: Procedure[]
}

// ─── Form Types ───────────────────────────────────────────────────────────────

export interface CompanyFormData {
  name: string
  nipt: string
  legal_form?: string
  administrator_name?: string
  address?: string
  phone?: string
  email?: string
  is_active: boolean
  notes?: string
}

export interface DocumentUploadData {
  company_id: number | string
  folder_id?: number | string
  title: string
  doc_type?: string
  document_type?: DocumentType
  issuer?: string
  issue_date?: string
  expiry_date?: string
  reference_no?: string
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
  company_id?: number | string
  document_type?: DocumentType
  doc_type?: string
  status?: string
  folder_id?: number | string
  search?: string
  expiry_from?: string
  expiry_to?: string
  page?: number
  page_size?: number
}

export interface ProcedureFilters {
  procedure_type?: ProcedureType | string
  authority?: string
  authority_name?: string
  status?: ProcedureStatus | string
  analysis_status?: AnalysisStatus
  source_name?: string
  cpv_code?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  page_size?: number
}

export type DocumentCategory = 'ADMINISTRATIVE' | 'TECHNICAL' | 'FINANCIAL' | 'PROFESSIONAL'

export interface ProcedureCreate { source_name?: string; source_url?: string; reference_no?: string; notice_no?: string; authority_name?: string; object_description?: string; procedure_type?: string; contract_type?: string; cpv_code?: string; fund_limit?: number; currency?: string; publication_date?: string; opening_date?: string; closing_date?: string; status?: string }

export interface RequiredDocumentCreate { name: string; category?: string; description?: string; mandatory?: boolean; issuer_type?: string; source_hint?: string; validity_rule?: string }

export interface DocumentUploadResponse { id: string; title: string; file_name: string; file_size?: number; mime_type?: string; status: string; message?: string }
