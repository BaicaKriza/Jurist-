import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Building2,
  FolderOpen,
  FileText,
  Shield,
  Upload,
  Download,
  Trash2,
  ChevronRight,
  ChevronDown,
  FolderClosed,
  AlertTriangle,
  Calendar,
  Plus,
} from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { companyService } from '@/services/companyService'
import { documentService } from '@/services/documentService'
import { useToast } from '@/hooks/useToast'
import type { Document, DocumentType, FolderTree } from '@/types'

// ---- Status helpers ----

function docStatusBadge(status: string) {
  switch (status) {
    case 'valid':
      return <Badge variant="success">Valid</Badge>
    case 'expiring_soon':
      return <Badge variant="warning">Skadon</Badge>
    case 'expired':
      return <Badge variant="destructive">Skaduar</Badge>
    case 'pending':
      return <Badge variant="info">Në pritje</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function docTypeName(type: DocumentType) {
  const map: Record<DocumentType, string> = {
    certificate: 'Certifikatë',
    license: 'Licencë',
    permit: 'Leje',
    registration: 'Regjistrim',
    financial: 'Financiare',
    legal: 'Juridike',
    technical: 'Teknike',
    other: 'Tjetër',
  }
  return map[type] ?? type
}

// ---- Upload dialog ----

interface UploadDialogProps {
  open: boolean
  onClose: () => void
  companyId: number
  folderId?: number
}

function UploadDialog({ open, onClose, companyId, folderId }: UploadDialogProps) {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState<DocumentType>('certificate')
  const [expiryDate, setExpiryDate] = useState('')
  const [issuer, setIssuer] = useState('')

  const uploadMutation = useMutation({
    mutationFn: () =>
      documentService.uploadDocument({
        company_id: companyId,
        folder_id: folderId,
        title,
        document_type: docType,
        expiry_date: expiryDate || undefined,
        issuer: issuer || undefined,
        file: file!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-docs', companyId] })
      queryClient.invalidateQueries({ queryKey: ['company-stats', companyId] })
      success('Dokumenti u ngarkua', 'Dokumenti u shtua me sukses.')
      setFile(null)
      setTitle('')
      setDocType('certificate')
      setExpiryDate('')
      setIssuer('')
      onClose()
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Ngarkimi dështoi.')
    },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ngarko Dokument</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Fajlli *</Label>
            <Input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx,.jpg,.png" />
          </div>
          <div className="space-y-1.5">
            <Label>Titulli *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titulli i dokumentit"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Lloji i Dokumentit</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="certificate">Certifikatë</SelectItem>
                <SelectItem value="license">Licencë</SelectItem>
                <SelectItem value="permit">Leje</SelectItem>
                <SelectItem value="registration">Regjistrim</SelectItem>
                <SelectItem value="financial">Financiare</SelectItem>
                <SelectItem value="legal">Juridike</SelectItem>
                <SelectItem value="technical">Teknike</SelectItem>
                <SelectItem value="other">Tjetër</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Lëshuar Nga</Label>
            <Input
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="Institucioni lëshues"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Data e Skadencës</Label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Anulo
          </Button>
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={!file || !title}
            loading={uploadMutation.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            Ngarko
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---- Folder tree ----

function FolderNode({
  folder,
  selectedFolderId,
  onSelect,
}: {
  folder: FolderTree
  selectedFolderId?: number
  onSelect: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = folder.children && folder.children.length > 0
  const isSelected = selectedFolderId === folder.id

  return (
    <div>
      <button
        className={`flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-gray-50 transition-colors ${
          isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
        }`}
        onClick={() => {
          onSelect(folder.id)
          if (hasChildren) setExpanded((v) => !v)
        }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          )
        ) : (
          <span className="w-3.5" />
        )}
        {expanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
        ) : (
          <FolderClosed className="h-4 w-4 shrink-0 text-amber-500" />
        )}
        <span className="truncate flex-1">{folder.name}</span>
        <span className="text-xs text-gray-400 shrink-0">{folder.document_count}</span>
      </button>
      {expanded && hasChildren && (
        <div className="ml-4 border-l border-gray-100 pl-1 mt-0.5 space-y-0.5">
          {folder.children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Main page ----

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const companyId = Number(id)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<number | undefined>()
  const queryClient = useQueryClient()
  const { success, error } = useToast()

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => companyService.getCompany(companyId),
    enabled: !!companyId,
  })

  const { data: stats } = useQuery({
    queryKey: ['company-stats', companyId],
    queryFn: () => companyService.getCompanyStats(companyId),
    enabled: !!companyId,
  })

  const { data: folders, isLoading: foldersLoading } = useQuery({
    queryKey: ['company-folders', companyId],
    queryFn: () => companyService.getCompanyFolders(companyId),
    enabled: !!companyId,
  })

  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ['company-docs', companyId, selectedFolderId],
    queryFn: () =>
      companyService.getCompanyDocuments(companyId, {
        folder_id: selectedFolderId,
        page_size: 100,
      }),
    enabled: !!companyId,
  })

  const { data: expiringDocs } = useQuery({
    queryKey: ['company-docs', companyId, 'expiring'],
    queryFn: () =>
      companyService.getCompanyDocuments(companyId, { status: 'expiring_soon', page_size: 50 }),
    enabled: !!companyId,
  })

  const deleteMutation = useMutation({
    mutationFn: (docId: number) => documentService.deleteDocument(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-docs', companyId] })
      success('Dokumenti u fshi', 'Dokumenti u fshi me sukses.')
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Fshirja dështoi.')
    },
  })

  async function handleDownload(doc: Document) {
    try {
      const blob = await documentService.downloadDocument(doc.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.file_name
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      error('Gabim', 'Shkarkimi dështoi.')
    }
  }

  if (companyLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Building2 className="h-10 w-10 text-gray-300" />
        <p className="text-gray-500">Kompania nuk u gjet.</p>
        <Button variant="outline" asChild>
          <Link to="/companies">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kthehu
          </Link>
        </Button>
      </div>
    )
  }

  const docs = docsData?.items ?? []
  const certDocs = expiringDocs?.items ?? []

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/companies" className="hover:text-blue-600 flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Kompanite
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 font-medium">{company.name}</span>
      </div>

      {/* Company header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <Building2 className="h-7 w-7 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">NIPT: {company.nipt}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Ngarko Dokument
          </Button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Dokumente</p>
                <p className="text-xl font-bold text-gray-900">{stats.total_documents}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Certifikata Aktive</p>
                <p className="text-xl font-bold text-gray-900">{stats.active_certificates}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Skadojnë</p>
                <p className="text-xl font-bold text-gray-900">{stats.expiring_soon}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <Calendar className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Skaduar</p>
                <p className="text-xl font-bold text-gray-900">{stats.expired}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Pasqyra</TabsTrigger>
          <TabsTrigger value="folders">Dosjet</TabsTrigger>
          <TabsTrigger value="documents">Dokumentet</TabsTrigger>
          <TabsTrigger value="certificates">Certifikata</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Informacion i Kompanisë</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div>
                  <dt className="text-gray-500 font-medium">Emri</dt>
                  <dd className="text-gray-900 mt-0.5">{company.name}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">NIPT</dt>
                  <dd className="text-gray-900 mt-0.5 font-mono">{company.nipt}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">Administrator</dt>
                  <dd className="text-gray-900 mt-0.5">{company.administrator}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">Statusi</dt>
                  <dd className="mt-0.5">
                    {company.status === 'active' ? (
                      <Badge variant="success">Aktiv</Badge>
                    ) : company.status === 'inactive' ? (
                      <Badge variant="secondary">Joaktiv</Badge>
                    ) : (
                      <Badge variant="destructive">Pezulluar</Badge>
                    )}
                  </dd>
                </div>
                {company.email && (
                  <div>
                    <dt className="text-gray-500 font-medium">Email</dt>
                    <dd className="text-gray-900 mt-0.5">{company.email}</dd>
                  </div>
                )}
                {company.phone && (
                  <div>
                    <dt className="text-gray-500 font-medium">Telefon</dt>
                    <dd className="text-gray-900 mt-0.5">{company.phone}</dd>
                  </div>
                )}
                {company.address && (
                  <div className="sm:col-span-2">
                    <dt className="text-gray-500 font-medium">Adresa</dt>
                    <dd className="text-gray-900 mt-0.5">{company.address}</dd>
                  </div>
                )}
                {company.notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-gray-500 font-medium">Shënime</dt>
                    <dd className="text-gray-900 mt-0.5">{company.notes}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500 font-medium">Krijuar më</dt>
                  <dd className="text-gray-900 mt-0.5">
                    {format(parseISO(company.created_at), 'dd MMM yyyy')}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Folders tab */}
        <TabsContent value="folders">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Folder tree */}
            <Card className="md:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Struktura e Dosjeve</CardTitle>
              </CardHeader>
              <CardContent>
                {foldersLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : !folders || folders.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">
                    <FolderOpen className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    Nuk ka dosje
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <button
                      className={`flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-gray-50 transition-colors ${
                        !selectedFolderId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                      }`}
                      onClick={() => setSelectedFolderId(undefined)}
                    >
                      <FolderOpen className="h-4 w-4 text-amber-500" />
                      <span>Të gjitha</span>
                    </button>
                    {folders.map((folder) => (
                      <FolderNode
                        key={folder.id}
                        folder={folder}
                        selectedFolderId={selectedFolderId}
                        onSelect={setSelectedFolderId}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documents in folder */}
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">
                  {selectedFolderId ? 'Dokumentet në Dosje' : 'Të gjitha Dokumentet'}
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUploadOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Ngarko
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {docsLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : docs.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    Nuk ka dokumente
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {docs.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between px-5 py-3 hover:bg-gray-50"
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {doc.title}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {docTypeName(doc.document_type)}
                              {doc.expiry_date &&
                                ` · Skadon: ${format(parseISO(doc.expiry_date), 'dd MMM yyyy')}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          {docStatusBadge(doc.status)}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDownload(doc)}
                            title="Shkarko"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              if (window.confirm('A doni të fshini këtë dokument?'))
                                deleteMutation.mutate(doc.id)
                            }}
                            title="Fshi"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Documents tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Të gjitha Dokumentet</CardTitle>
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Ngarko
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {docsLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : docs.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-sm text-gray-400">
                  <FileText className="h-10 w-10 mb-3 text-gray-300" />
                  Nuk ka dokumente
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-y border-gray-100">
                    <tr>
                      <th className="text-left py-2.5 px-5 font-medium text-gray-600">Titulli</th>
                      <th className="text-left py-2.5 px-3 font-medium text-gray-600">Lloji</th>
                      <th className="text-left py-2.5 px-3 font-medium text-gray-600">Lëshues</th>
                      <th className="text-left py-2.5 px-3 font-medium text-gray-600">Skadon</th>
                      <th className="text-left py-2.5 px-3 font-medium text-gray-600">Statusi</th>
                      <th className="py-2.5 px-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {docs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="py-3 px-5 font-medium text-gray-900 max-w-xs truncate">
                          {doc.title}
                        </td>
                        <td className="py-3 px-3 text-gray-500">
                          {docTypeName(doc.document_type)}
                        </td>
                        <td className="py-3 px-3 text-gray-500">{doc.issuer ?? '—'}</td>
                        <td className="py-3 px-3 text-gray-500">
                          {doc.expiry_date
                            ? format(parseISO(doc.expiry_date), 'dd MMM yyyy')
                            : '—'}
                        </td>
                        <td className="py-3 px-3">{docStatusBadge(doc.status)}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDownload(doc)}
                              title="Shkarko"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => {
                                if (window.confirm('A doni të fshini këtë dokument?'))
                                  deleteMutation.mutate(doc.id)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Certificates tab */}
        <TabsContent value="certificates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Certifikata që Skadojnë
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {certDocs.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-sm text-gray-400">
                  <Shield className="h-10 w-10 mb-3 text-gray-300" />
                  Nuk ka certifikata që skadojnë
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {certDocs.map((doc) => {
                    const daysLeft = doc.expiry_date
                      ? differenceInDays(parseISO(doc.expiry_date), new Date())
                      : null
                    return (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {doc.issuer && `${doc.issuer} · `}
                            {doc.expiry_date
                              ? `Skadon ${format(parseISO(doc.expiry_date), 'dd MMM yyyy')}`
                              : ''}
                          </p>
                        </div>
                        <div className="ml-4 flex items-center gap-3 shrink-0">
                          {daysLeft !== null && (
                            <span
                              className={`text-xs font-semibold ${
                                daysLeft <= 0
                                  ? 'text-red-600'
                                  : daysLeft <= 7
                                  ? 'text-red-500'
                                  : daysLeft <= 30
                                  ? 'text-amber-600'
                                  : 'text-gray-500'
                              }`}
                            >
                              {daysLeft <= 0 ? 'Skaduar' : `${daysLeft} ditë`}
                            </span>
                          )}
                          {docStatusBadge(doc.status)}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        companyId={companyId}
        folderId={selectedFolderId}
      />
    </div>
  )
}
