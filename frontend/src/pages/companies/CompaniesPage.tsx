import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Search,
  Building2,
  FileText,
  AlertTriangle,
  ChevronRight,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { companyService } from '@/services/companyService'
import { useToast } from '@/hooks/useToast'
import type { Company, CompanyFormData } from '@/types'

const companySchema = z.object({
  name: z.string().min(2, 'Emri duhet të jetë të paktën 2 karaktere'),
  nipt: z.string().min(3, 'NIPT-i është i detyrueshëm'),
  legal_form: z.string().optional(),
  administrator_name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email i pavlefshëm').optional().or(z.literal('')),
  is_active: z.boolean().default(true),
  notes: z.string().optional(),
})

type CompanyFormValues = z.infer<typeof companySchema>

interface CompanyFormDialogProps {
  open: boolean
  onClose: () => void
  editCompany?: Company | null
}

function CompanyFormDialog({ open, onClose, editCompany }: CompanyFormDialogProps) {
  const queryClient = useQueryClient()
  const { success, error } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: editCompany
      ? {
          name: editCompany.name,
          nipt: editCompany.nipt,
          legal_form: editCompany.legal_form ?? '',
          administrator_name: editCompany.administrator_name ?? '',
          address: editCompany.address ?? '',
          phone: editCompany.phone ?? '',
          email: editCompany.email ?? '',
          is_active: editCompany.is_active,
          notes: editCompany.notes ?? '',
        }
      : { is_active: true },
  })

  const mutation = useMutation({
    mutationFn: (data: CompanyFormValues) => {
      const payload: CompanyFormData = {
        name: data.name,
        nipt: data.nipt,
        legal_form: data.legal_form || undefined,
        administrator_name: data.administrator_name || undefined,
        address: data.address || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        is_active: data.is_active,
        notes: data.notes || undefined,
      }
      return editCompany
        ? companyService.updateCompany(editCompany.id, payload)
        : companyService.createCompany(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      success(
        editCompany ? 'Kompania u përditësua' : 'Kompania u krijua',
        editCompany ? 'Ndryshimet u ruajtën.' : 'Kompania e re u shtua me sukses.'
      )
      reset()
      onClose()
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Operacioni dështoi.')
    },
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editCompany ? 'Edito Kompaninë' : 'Kompani e Re'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Emri *</Label>
              <Input id="name" {...register('name')} placeholder="Emri i kompanisë" />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nipt">NIPT *</Label>
              <Input id="nipt" {...register('nipt')} placeholder="L12345678A" />
              {errors.nipt && <p className="text-xs text-red-500">{errors.nipt.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="administrator_name">Administrator</Label>
              <Input id="administrator_name" {...register('administrator_name')} placeholder="Emri i administratorit" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="legal_form">Forma Ligjore</Label>
              <Input id="legal_form" {...register('legal_form')} placeholder="SH.P.K., S.A. ..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} placeholder="info@kompania.al" />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" {...register('phone')} placeholder="+355 ..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Adresa</Label>
            <Input id="address" {...register('address')} placeholder="Adresa e kompanisë" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Shënime</Label>
            <Input id="notes" {...register('notes')} placeholder="Shënime opsionale" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>
              Anulo
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {editCompany ? 'Ruaj Ndryshimet' : 'Krijo Kompaninë'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const PAGE_SIZE = 20

export default function CompaniesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [editCompany, setEditCompany] = useState<Company | null>(null)
  const queryClient = useQueryClient()
  const { success, error } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['companies', { search, page }],
    queryFn: () => companyService.getCompanies({ search: search || undefined, page, page_size: PAGE_SIZE }),
    staleTime: 30000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companyService.deleteCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      success('Kompania u fshi', 'Kompania u fshi nga sistemi.')
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Fshirja dështoi.')
    },
  })

  const companies = data?.items ?? []
  const totalPages = data?.pages ?? 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kompanite</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} kompani gjithsej</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Kompani e Re
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Kërko sipas emrit ose NIPT..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            {search && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(''); setPage(1) }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-gray-400">
            <Building2 className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium">
              {search ? 'Nuk u gjet asnjë kompani' : 'Nuk ka kompani ende'}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Shto Kompaninë e Parë
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {companies.map((company) => (
              <Card key={company.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <Link
                      to={`/companies/${company.id}`}
                      className="flex items-center gap-4 min-w-0 flex-1 group"
                    >
                      <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 truncate">
                            {company.name}
                          </h3>
                          {company.is_active ? (
                            <Badge variant="success">Aktiv</Badge>
                          ) : (
                            <Badge variant="secondary">Joaktiv</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-0.5 text-xs text-gray-500">
                          <span className="font-mono">{company.nipt}</span>
                          {company.administrator_name && (
                            <span>{company.administrator_name}</span>
                          )}
                        </div>
                      </div>
                    </Link>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Doc counts */}
                      <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          {company.document_count}
                        </span>
                        {company.expired_count > 0 && (
                          <span className="flex items-center gap-1 text-red-500">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {company.expired_count} skaduar
                          </span>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditCompany(company as unknown as Company)}
                        title="Edito"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => {
                          if (window.confirm(`A doni të fshini "${company.name}"?`))
                            deleteMutation.mutate(company.id)
                        }}
                        title="Fshi"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Link to={`/companies/${company.id}`}>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Faqja {page} nga {totalPages} · {data?.total} kompani
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Prapa
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Para
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <CompanyFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {editCompany && (
        <CompanyFormDialog
          open={!!editCompany}
          onClose={() => setEditCompany(null)}
          editCompany={editCompany}
        />
      )}
    </div>
  )
}
