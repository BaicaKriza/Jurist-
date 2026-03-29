// ─── User & Auth ──────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'viewer' | 'operator'

export interface User {
  id: string
  email: string
  full_name: string
  roles: UserRole[]
  is_active: boolean
  is_superadmin: boolean
  created_at: string
  updated_at: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

// ─── Company ──────────────────────────────────────────────────────────────────

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
  notes?: string
  created_at: string
  updated_at: string
}

export interface CompanyListItem {
  id: string
  name: string
  nipt: string
  legal_form?: string
  administrator_name?: string
  is_active: boolean
  created_at: string
  document_count: number
  expired_count: number
}

export interface CompanyStats {
  company_id: string
  company_name: string
  total_documents: number
  active_documents: number
  expired_documents: number
  review_required: number
  expiring_soon: number
  total_folders: number
}

// ─── Folder ───────────────────────────────────────────────────────────────────

export interface Folder {
  id: string
  company_id: string
  name: string
  parent_id?: string
  path: string
  document_count: number
  children?: Folder[]
  created_at: string
}

export interface FolderTree extends Folder {
  children: FolderTree[]
}

// ─── Document ─────────────────────────────────────────────────────────────────

// Backend statuses: ACTIVE, EXPIRED, ARCHIVED, REVIEW_REQUIRED
export type DocumentStatus = 'ACTIVE' | 'EXPIRED' | 'ARCHIVED' | 'REVIEW_REQUIRED'

export interface Document {
  id: string
  company_id: string
  folder_id?: string
  title: string
  doc_type?: string
  status: DocumentStatus
  file_name: string
  file_size: number
  mime_type: string
  issuer?: string
  issue_date?: string
  expiry_date?: string
  reference_no?: string
  checksum?: string
  version_no: number
  ai_summary?: string
  metadata_json?: Record<string, unknown>
  created_by?: string
  created_at: string
  updated_at: string
  download_url?: string
}

export interface DocumentUploadResponse {
  id: string
  title: string
  file_name: string
  file_size: number
  mime_type: string
  status: DocumentStatus
}

// ─── Procedure ────────────────────────────────────────────────────────────────

export type ProcedureStatus = 'OPEN' | 'CLOSED' | 'AWARDED' | 'CANCELLED' | 'UNKNOWN'
export type ProcedureSource = 'CONTRACT_NOTICE' | 'SMALL_VALUE'

export interface Procedure {
  id: string
  source_name: ProcedureSource
  source_url?: string
  reference_no?: string
  notice_no?: string
  authority_name?: string
  object_description?: string
  procedure_type?: string
  contract_type?: string
  cpv_code?: string
  fund_limit?: number
  currency?: string
  publication_date?: string
  opening_date?: string
  closing_date?: string
  status: ProcedureStatus
  document_count: number
  created_at: string
  updated_at: string
}

export interface ProcedureCreate {
  source_name: ProcedureSource
  reference_no?: string
  notice_no?: string
  authority_name: string
  object_description: string
  procedure_type?: string
  contract_type?: string
  cpv_code?: string
  fund_limit?: number
  currency?: string
  publication_date?: string
  closing_date?: string
  status?: ProcedureStatus
  source_url?: string
}

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
  is_uploaded?: boolean
  download_url?: string
  created_at: string
}

// ─── Requirements ─────────────────────────────────────────────────────────────

export type DocumentCategory = 'ADMINISTRATIVE' | 'TECHNICAL' | 'FINANCIAL' | 'PROFESSIONAL'

export interface RequiredDocumentItem {
  id: string
  procedure_id: string
  name: string
  category: DocumentCategory
  description?: string
  mandatory: boolean
  issuer_type?: string
  source_hint?: string
  validity_rule?: string
}

export interface RequiredDocumentCreate {
  name: string
  category: DocumentCategory
  description?: string
  mandatory: boolean
  issuer_type?: string
  source_hint?: string
  validity_rule?: string
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface ProcedureAnalysis {
  id: string
  procedure_id: string
  analysis_type: string
  summary?: string
  legal_notes?: string
  technical_notes?: string
  financial_notes?: string
  risk_level?: RiskLevel
  recommended_action?: string
  ai_output_json?: Record<string, unknown>
  created_at: string
}

// ─── Matching ─────────────────────────────────────────────────────────────────

export type MatchStatus =
  | 'FOUND_VALID'
  | 'FOUND_EXPIRED'
  | 'FOUND_PARTIAL'
  | 'MISSING'
  | 'REVIEW_REQUIRED'

export interface MatchingResult {
  id: string
  procedure_id: string
  company_id: string
  required_document_item_id: string
  matched_document_id?: string
  match_status: MatchStatus
  confidence_score: number
  notes?: string
  created_at: string
  required_document_name?: string
  required_document_category?: string
  matched_document_title?: string
}

export interface MatchingReportItem {
  required_document_id: string
  required_document_name: string
  category: DocumentCategory
  mandatory: boolean
  match_status: MatchStatus
  confidence_score: number
  matched_document_id?: string
  matched_document_title?: string
  notes?: string
  retrieval_guide?: string
}

export interface MatchingReport {
  procedure_id: string
  company_id: string
  company_name: string
  procedure_reference?: string
  authority_name?: string
  total_required: number
  found_valid: number
  found_expired: number
  found_partial: number
  missing: number
  review_required: number
  readiness_score: number
  items: MatchingReportItem[]
  generated_at: string
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_companies: number
  active_companies: number
  total_documents: number
  total_procedures: number
  total_analyses: number
  total_users: number
  active_users: number
}

// Alias for backward compat
export type MatchingStatus = MatchStatus

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
  company_id: string
  folder_id?: string
  title: string
  doc_type?: string
  issuer?: string
  issue_date?: string
  expiry_date?: string
  reference_no?: string
  file: File
}

export interface UserFormData {
  email: string
  full_name: string
  role_names: UserRole[]
  password?: string
  is_active: boolean
  is_superadmin: boolean
}

// ─── Filter Types ─────────────────────────────────────────────────────────────

export interface DocumentFilters {
  company_id?: string
  status?: DocumentStatus
  folder_id?: string
  search?: string
  page?: number
  page_size?: number
}

export interface ProcedureFilters {
  source_name?: ProcedureSource
  authority_name?: string
  status?: ProcedureStatus
  search?: string
  page?: number
  page_size?: number
}
