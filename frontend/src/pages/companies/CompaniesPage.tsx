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
  MoreVertical,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { companyService } from '@/services/companyService'
import { useToast } from '@/hooks/useToast'
import type { Company, CompanyFormData, CompanyStatus } from '@/types'

const companySchema = z.object({
  name: z.string().min(2, 'Emri duhet të jetë të paktën 2 karaktere'),
  nipt: z.string().min(3, 'NIPT-i është i detyrueshëm'),
  administrator_name: z.string().min(2, 'Administratori është i detyrueshëm'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email i pavlefshëm').optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'suspended'] as const),
  notes: z.string().optional(),
})

type CompanyFormValues = z.infer<typeof companySchema>

function statusBadge(status: string | undefined) {
  switch (status) {
    case 'active':
      return <Badge variant="success">Aktiv</Badge>
    case 'inactive':
      return <Badge variant="secondary">Joaktiv</Badge>
    case 'suspended':
      return <Badge variant="destructive">Pezulluar</Badge>
  }
}

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
    setValue,
    watch,
    formState: { errors },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: editCompany
      ? {
          name: editCompany.name,
          nipt: editCompany.nipt,
          administrator_name: editCompany.administrator_name,
          address: editCompany.address ?? '',
          phone: editCompany.phone ?? '',
          email: editCompany.email ?? '',
          status: editCompany.status ? 'active' : 'inactive',
          notes: editCompany.notes ?? '',
        }
      : { status: 'active' },
  })

  const statusValue = watch('status')

  const createMutation = useMutation({
    mutationFn: (data: CompanyFormData) => companyService.createCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      success('Kompania u krijua', 'Kompania u shtua me sukses.')
      reset()
      onClose()
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Krijimi dështoi.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: CompanyFormData) => companyService.updateCompany(editCompany!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      success('Kompania u përditësua', 'Ndryshimet u ruajtën me sukses.')
      onClose()
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Përditësimi dështoi.')
    },
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function onSubmit(values: CompanyFormValues) {
    const payload: CompanyFormData = {
      name: values.name,
      nipt: values.nipt,
      administrator_name: values.administrator_name,
      address: values.address || undefined,
      phone: values.phone || undefined,
      email: values.email || undefined,
      is_active: values.status === 'active',
      notes: values.notes || undefined,
    }
    if (editCompany) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editCompany ? 'Edito Kompaninë' : 'Shto Kompani të Re'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="name">Emri i Kompanisë *</Label>
              <Input id="name" {...register('name')} placeholder="Emri i plotë" />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nipt">NIPT *</Label>
              <Input id="nipt" {...register('nipt')} placeholder="Kodi NIPT" />
              {errors.nipt && <p className="text-xs text-red-600">{errors.nipt.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Statusi *</Label>
              <Select
                value={statusValue}
                onValueChange={(v) => setValue('status', v as CompanyStatus)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="inactive">Joaktiv</SelectItem>
                  <SelectItem value="suspended">Pezulluar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="administrator">Administratori *</Label>
              <Input id="administrator" {...register('administrator_name')} placeholder="Emri i administratorit" />
              {errors.administrator_name && <p className="text-xs text-red-600">{errors.administrator_name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} placeholder="info@kompania.al" />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" {...register('phone')} placeholder="+355 XX XXX XXXX" />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="address">Adresa</Label>
              <Input id="address" {...register('address')} placeholder="Adresa e kompanisë" />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="notes">Shënime</Label>
              <Input id="notes" {...register('notes')} placeholder="Shënime shtesë (opsionale)" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Anulo
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {editCompany ? 'Ruaj Ndryshimet' : 'Shto Kompaninë'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function CompaniesPage() {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editCompany, setEditCompany] = useState<Company | null>(null)
  const queryClient = useQueryClient()
  const { success, error } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search],
    queryFn: () => companyService.getCompanies({ search: search || undefined, page_size: 50 }),
    staleTime: 30000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companyService.deactivateCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      success('Kompania u çaktivizua', 'Kompania u çaktivizua me sukses.')
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Çaktivizimi dështoi.')
    },
  })

  function handleDelete(company: Company) {
    if (window.confirm(`A jeni i sigurt që doni të çaktivizoni "${company.name}"?`)) {
      deleteMutation.mutate(company.id)
    }
  }

  const companies = data?.items ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kompanite</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data?.total ?? 0} kompani në total
          </p>
        </div>
        <Button onClick={() => { setEditCompany(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Shto Kompani
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Kërko kompani..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            onClick={() => setSearch('')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Companies grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-gray-400">
            <Building2 className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium">Nuk u gjetën kompani</p>
            <p className="text-xs mt-1">
              {search ? 'Provoni kërkim tjetër' : 'Shtoni kompaninë e parë'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {companies.map((company) => (
            <Card key={company.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Building2 className="h-4.5 w-4.5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">
                        {company.name}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">NIPT: {company.nipt}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {statusBadge(company.status)}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => { setEditCompany(company); setDialogOpen(true) }}
                      title="Edito"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(company)}
                      title="Fshi"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-gray-500 mb-4">
                  <p>
                    <span className="font-medium text-gray-700">Administrator: </span>
                    {company.administrator_name}
                  </p>
                  {company.email && (
                    <p>
                      <span className="font-medium text-gray-700">Email: </span>
                      {company.email}
                    </p>
                  )}
                  {company.phone && (
                    <p>
                      <span className="font-medium text-gray-700">Tel: </span>
                      {company.phone}
                    </p>
                  )}
                </div>

                <Link
                  to={`/companies/${company.id}`}
                  className="flex items-center justify-between w-full rounded-lg bg-gray-50 hover:bg-blue-50 px-3 py-2 transition-colors"
                >
                  <span className="text-xs font-medium text-gray-700 hover:text-blue-700">
                    Shiko detajet
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CompanyFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editCompany={editCompany}
      />
    </div>
  )
}
