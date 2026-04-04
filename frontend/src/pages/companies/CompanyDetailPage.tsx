import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Building2, FolderOpen, FolderClosed, FileText, Shield,
  Upload, Download, Trash2, ChevronRight, ChevronDown, AlertTriangle, Calendar, Plus,
} from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { companyService } from '@/services/companyService'
import { documentService } from '@/services/documentService'
import { useToast } from '@/hooks/useToast'
import type { Document, DocumentStatus, FolderTree } from '@/types'

function docStatusBadge(status: string) {
  switch (status) {
    case 'ACTIVE':          return <Badge variant="success">Aktiv</Badge>
    case 'EXPIRED':         return <Badge variant="destructive">Skaduar</Badge>
    case 'ARCHIVED':        return <Badge variant="secondary">Arkivuar</Badge>
    case 'REVIEW_REQUIRED': return <Badge variant="warning">Shqyrtim</Badge>
    default:                return <Badge variant="secondary">{status}</Badge>
  }
}

interface UploadDialogProps { open: boolean; onClose: () => void; companyId: string; folderId?: string }
function UploadDialog({ open, onClose, companyId, folderId }: UploadDialogProps) {
  const qc = useQueryClient()
  const { success, error } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('certificate')
  const [expiryDate, setExpiryDate] = useState('')
  const [issuer, setIssuer] = useState('')
  const [referenceNo, setReferenceNo] = useState('')

  const uploadMutation = useMutation({
    mutationFn: () => documentService.uploadDocument({
      company_id: companyId, folder_id: folderId, title,
      doc_type: docType || undefined, expiry_date: expiryDate || undefined,
      issuer: issuer || undefined, reference_no: referenceNo || undefined, file: file!,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-docs', companyId] })
      qc.invalidateQueries({ queryKey: ['company-stats', companyId] })
      success('Dokumenti u ngarkua', 'U shtua me sukses.')
      setFile(null); setTitle(''); setDocType('certificate'); setExpiryDate(''); setIssuer(''); setReferenceNo('')
      onClose()
    },
    onError: (err: any) => error('Gabim', err?.response?.data?.detail ?? 'Ngarkimi dështoi.'),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Ngarko Dokument</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Fajlli *</Label>
            <Input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, '')) } }} />
          </div>
          <div className="space-y-1.5">
            <Label>Titulli *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titulli i dokumentit" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Lloji</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['certificate','license','permit','registration','financial','legal','technical','other'].map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data Skadencës</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Lëshues</Label>
              <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Institucioni" />
            </div>
            <div className="space-y-1.5">
              <Label>Nr. Reference</Label>
              <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Opsionale" />
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Anulo</Button>
          <Button onClick={() => uploadMutation.mutate()} disabled={!file || !title || uploadMutation.isPending}>
            <Upload className="h-4 w-4 mr-2" />{uploadMutation.isPending ? 'Duke ngarkuar...' : 'Ngarko'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FolderNode({ folder, selectedFolderId, onSelect }: { folder: FolderTree; selectedFolderId?: string; onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = folder.children && folder.children.length > 0
  const isSelected = selectedFolderId === folder.id
  return (
    <div>
      <button
        className={`flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-gray-50 ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
        onClick={() => { onSelect(folder.id); if (hasChildren) setExpanded(v => !v) }}
      >
        {hasChildren ? (expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />) : <span className="w-3.5" />}
        {expanded ? <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" /> : <FolderClosed className="h-4 w-4 shrink-0 text-amber-500" />}
        <span className="truncate flex-1">{folder.name}</span>
        <span className="text-xs text-gray-400 shrink-0">{folder.document_count}</span>
      </button>
      {expanded && hasChildren && (
        <div className="ml-4 border-l border-gray-100 pl-1 mt-0.5 space-y-0.5">
          {folder.children.map(child => <FolderNode key={child.id} folder={child} selectedFolderId={selectedFolderId} onSelect={onSelect} />)}
        </div>
      )}
    </div>
  )
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const companyId = id!
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>()
  const qc = useQueryClient()
  const { success, error } = useToast()

  const { data: company, isLoading: companyLoading } = useQuery({ queryKey: ['company', companyId], queryFn: () => companyService.getCompany(companyId), enabled: !!companyId })
  const { data: stats } = useQuery({ queryKey: ['company-stats', companyId], queryFn: () => companyService.getCompanyStats(companyId), enabled: !!companyId })
  const { data: folders, isLoading: foldersLoading } = useQuery({ queryKey: ['company-folders', companyId], queryFn: () => companyService.getCompanyFolders(companyId), enabled: !!companyId })
  const { data: docsData, isLoading: docsLoading } = useQuery({ queryKey: ['company-docs', companyId, selectedFolderId], queryFn: () => documentService.getDocuments(companyId, { folder_id: selectedFolderId }), enabled: !!companyId })
  const { data: expiredData } = useQuery({ queryKey: ['company-docs', companyId, 'expired'], queryFn: () => documentService.getDocuments(companyId, { status: 'EXPIRED' }), enabled: !!companyId })

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => documentService.deleteDocument(docId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company-docs', companyId] }); qc.invalidateQueries({ queryKey: ['company-stats', companyId] }); success('Dokumenti u fshi', '') },
    onError: (err: any) => error('Gabim', err?.response?.data?.detail ?? 'Fshirja dështoi.'),
  })

  function openDownload(doc: Document) {
    const url = doc.download_url || documentService.getDownloadUrl(doc.id)
    window.open(url, '_blank')
  }

  if (companyLoading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
  if (!company) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Building2 className="h-10 w-10 text-gray-300" />
      <p className="text-gray-500">Kompania nuk u gjet.</p>
      <Button variant="outline" asChild><Link to="/companies"><ArrowLeft className="h-4 w-4 mr-2" />Kthehu</Link></Button>
    </div>
  )

  const docs = docsData?.items ?? []
  const expiredDocs = expiredData?.items ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/companies" className="hover:text-blue-600 flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" />Kompanite</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 font-medium">{company.name}</span>
      </div>

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
        <Button variant="outline" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />Ngarko Dokument
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {([
            { label: 'Dokumente', value: stats.total_documents, icon: FileText },
            { label: 'Aktive', value: stats.active_documents, icon: Shield },
            { label: 'Skadojnë', value: stats.expiring_soon, icon: AlertTriangle },
            { label: 'Skaduar', value: stats.expired_documents, icon: Calendar },
          ] as const).map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xl font-bold text-gray-900">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="folders">
        <TabsList>
          <TabsTrigger value="overview">Info</TabsTrigger>
          <TabsTrigger value="folders">Dosjet & Dokumente</TabsTrigger>
          <TabsTrigger value="expired">Skaduar ({expiredDocs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader><CardTitle>Informacion</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div><dt className="text-gray-500">Emri</dt><dd className="mt-0.5 font-medium">{company.name}</dd></div>
                <div><dt className="text-gray-500">NIPT</dt><dd className="mt-0.5 font-mono">{company.nipt}</dd></div>
                {company.legal_form && <div><dt className="text-gray-500">Forma Ligjore</dt><dd className="mt-0.5">{company.legal_form}</dd></div>}
                {company.administrator_name && <div><dt className="text-gray-500">Administrator</dt><dd className="mt-0.5">{company.administrator_name}</dd></div>}
                <div><dt className="text-gray-500">Statusi</dt><dd className="mt-0.5">{company.is_active ? <Badge variant="success">Aktiv</Badge> : <Badge variant="secondary">Joaktiv</Badge>}</dd></div>
                {company.email && <div><dt className="text-gray-500">Email</dt><dd className="mt-0.5">{company.email}</dd></div>}
                {company.phone && <div><dt className="text-gray-500">Telefon</dt><dd className="mt-0.5">{company.phone}</dd></div>}
                {company.address && <div className="sm:col-span-2"><dt className="text-gray-500">Adresa</dt><dd className="mt-0.5">{company.address}</dd></div>}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="folders">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-1">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Dosjet</CardTitle></CardHeader>
              <CardContent>
                {foldersLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : !folders?.length ? (
                  <div className="text-center py-8 text-sm text-gray-400"><FolderOpen className="h-8 w-8 mx-auto mb-2 text-gray-300" />Nuk ka dosje</div>
                ) : (
                  <div className="space-y-0.5">
                    <button className={`flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-gray-50 ${!selectedFolderId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`} onClick={() => setSelectedFolderId(undefined)}>
                      <FolderOpen className="h-4 w-4 text-amber-500" /><span>Të gjitha</span>
                    </button>
                    {folders.map(f => <FolderNode key={f.id} folder={f} selectedFolderId={selectedFolderId} onSelect={setSelectedFolderId} />)}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">{selectedFolderId ? 'Dokumentet në Dosje' : 'Të gjitha Dokumentet'}</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Ngarko</Button>
              </CardHeader>
              <CardContent className="p-0">
                {docsLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : docs.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-sm text-gray-400">
                    <FileText className="h-8 w-8 mb-2 text-gray-300" /><p>Nuk ka dokumente</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setUploadOpen(true)}><Upload className="h-3.5 w-3.5 mr-1.5" />Ngarko</Button>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {docs.map(doc => (
                      <li key={doc.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                        <div className="min-w-0 flex items-center gap-3">
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {doc.doc_type}{doc.expiry_date && ` · ${format(parseISO(doc.expiry_date), 'dd MMM yyyy')}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          {docStatusBadge(doc.status)}
                          <Button variant="ghost" size="icon-sm" onClick={() => openDownload(doc)}><Download className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon-sm" className="text-red-500 hover:text-red-700" onClick={() => { if (window.confirm('Fshi dokumentin?')) deleteMutation.mutate(doc.id) }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="expired">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" />Dokumentet e Skaduara</CardTitle></CardHeader>
            <CardContent className="p-0">
              {expiredDocs.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-sm text-gray-400"><Shield className="h-8 w-8 mb-2 text-gray-300" />Nuk ka dokumente të skaduara</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {expiredDocs.map(doc => {
                    const daysAgo = doc.expiry_date ? differenceInDays(new Date(), parseISO(doc.expiry_date)) : null
                    return (
                      <li key={doc.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{doc.issuer && `${doc.issuer} · `}{doc.expiry_date && `Skadoi: ${format(parseISO(doc.expiry_date), 'dd MMM yyyy')}`}</p>
                        </div>
                        <div className="ml-4 flex items-center gap-3 shrink-0">
                          {daysAgo !== null && daysAgo > 0 && <span className="text-xs font-semibold text-red-600">{daysAgo} ditë</span>}
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

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} companyId={companyId} folderId={selectedFolderId} />
    </div>
  )
}
