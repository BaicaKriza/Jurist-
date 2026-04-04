import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  Search,
  X,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, parseISO } from 'date-fns'
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
import api from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import type { User, UserFormData, UserRole } from '@/types'

// ---- API calls ----

const ROLE_MAP: Record<UserRole, string> = {
  superadmin: 'SUPER_ADMIN',
  admin: 'ADMIN',
  manager: 'OPERATOR',
  viewer: 'VIEWER',
}

const API_ROLE_MAP: Record<string, UserRole> = {
  SUPER_ADMIN: 'superadmin',
  ADMIN: 'admin',
  OPERATOR: 'manager',
  VIEWER: 'viewer',
}

async function getUsers(): Promise<User[]> {
  const { data } = await api.get('/admin/users', { params: { page: 1, page_size: 100 } })
  return data.items
}

async function createUser(payload: UserFormData): Promise<User> {
  const request = {
    full_name: payload.full_name,
    email: payload.email,
    password: payload.password || 'TempPass123!',
    is_superadmin: payload.role === 'superadmin',
    role_names: payload.role ? [ROLE_MAP[payload.role]] : [],
  }
  const { data } = await api.post('/admin/users', request)
  return data
}

async function updateUser(id: string, payload: Partial<UserFormData>): Promise<User> {
  const request: any = {
    full_name: payload.full_name,
    email: payload.email,
    is_superadmin: payload.role === 'superadmin',
    role_names: payload.role ? [ROLE_MAP[payload.role]] : undefined,
  }
  if (payload.password) {
    request.password = payload.password
  }
  const { data } = await api.patch(`/admin/users/${id}`, request)
  return data
}

async function deleteUser(id: string): Promise<void> {
  await api.delete(`/admin/users/${id}`)
}

// ---- Form schema ----

const userSchema = z.object({
  email: z.string().email('Email i pavlefshëm'),
  full_name: z.string().min(2, 'Emri duhet të paktën 2 karaktere'),
  role: z.enum(['admin', 'manager', 'viewer'] as const),
  password: z.string().min(8, 'Fjalëkalimi duhet të paktën 8 karaktere').optional().or(z.literal('')),
  is_active: z.boolean(),
})

type UserFormValues = z.infer<typeof userSchema>

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  manager: 'Menaxher',
  viewer: 'Shikues',
}

function roleBadge(role: UserRole) {
  switch (role) {
    case 'superadmin':
      return <Badge variant="destructive">Superadmin</Badge>
    case 'admin':
      return <Badge variant="destructive">Administrator</Badge>
    case 'manager':
      return <Badge variant="info">Menaxher</Badge>
    case 'viewer':
      return <Badge variant="secondary">Shikues</Badge>
  }
}

// ---- User form dialog ----

interface UserFormDialogProps {
  open: boolean
  onClose: () => void
  editUser?: User | null
}

function UserFormDialog({ open, onClose, editUser }: UserFormDialogProps) {
  const queryClient = useQueryClient()
  const { success, error } = useToast()

  const initialRole = editUser?.roles?.[0] ? API_ROLE_MAP[editUser.roles[0]] : 'viewer'

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: editUser
      ? {
          email: editUser.email,
          full_name: editUser.full_name,
          role: initialRole,
          password: '',
          is_active: editUser.is_active,
        }
      : { role: 'viewer', is_active: true, password: '' },
  })

  const roleValue = watch('role')
  const isActiveValue = watch('is_active')

  const createMutation = useMutation({
    mutationFn: (data: UserFormData) => createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      success('Përdoruesi u krijua', 'Llogaria e re u krijua me sukses.')
      reset()
      onClose()
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Krijimi dështoi.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<UserFormData>) => updateUser(editUser!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      success('Përditësuar', 'Të dhënat e përdoruesit u ruajtën.')
      onClose()
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Përditësimi dështoi.')
    },
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  function onSubmit(values: UserFormValues) {
    const payload: UserFormData = {
      email: values.email,
      full_name: values.full_name,
      role: values.role,
      is_active: values.is_active,
      password: values.password || undefined,
    }

    if (editUser) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editUser ? 'Edito Përdoruesin' : 'Shto Përdorues të Ri'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Emri i Plotë *</Label>
            <Input id="full_name" {...register('full_name')} placeholder="Emri i plotë" />
            {errors.full_name && (
              <p className="text-xs text-red-600">{errors.full_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" {...register('email')} placeholder="email@shembull.al" />
            {errors.email && (
              <p className="text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">
              Fjalëkalimi {editUser ? '(lini bosh për të mos ndryshuar)' : '*'}
            </Label>
            <Input
              id="password"
              type="password"
              {...register('password')}
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Roli *</Label>
              <Select value={roleValue} onValueChange={(v) => setValue('role', v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="manager">Menaxher</SelectItem>
                  <SelectItem value="viewer">Shikues</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Statusi</Label>
              <Select
                value={String(isActiveValue)}
                onValueChange={(v) => setValue('is_active', v === 'true')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Aktiv</SelectItem>
                  <SelectItem value="false">Joaktiv</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Anulo
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {editUser ? 'Ruaj Ndryshimet' : 'Krijo Llogarinë'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---- Main page ----

export default function AdminPage() {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const queryClient = useQueryClient()
  const { success, error } = useToast()

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
    staleTime: 30000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      success('Përdoruesi u çaktivizua', 'Llogaria u çaktivizua me sukses.')
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Çaktivizimi dështoi.')
    },
  })

  const filteredUsers = (users ?? []).filter(
    (u) =>
      !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  )

  const activeCount = (users ?? []).filter((u) => u.is_active).length
  const adminCount = (users ?? []).filter((u) => u.role === 'admin').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administrimi</h1>
          <p className="text-sm text-gray-500 mt-1">Menaxhimi i përdoruesve dhe aksesit</p>
        </div>
        <Button onClick={() => { setEditUser(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Shto Përdorues
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="h-4.5 w-4.5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Gjithsej</p>
              <p className="text-xl font-bold text-gray-900">{users?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center">
              <UserCheck className="h-4.5 w-4.5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Aktivë</p>
              <p className="text-xl font-bold text-gray-900">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
              <ShieldCheck className="h-4.5 w-4.5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Adminë</p>
              <p className="text-xl font-bold text-gray-900">{adminCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Kërko përdorues..."
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

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-gray-400">
              <Users className="h-10 w-10 mb-3 text-gray-300" />
              <p className="text-sm">Nuk u gjetën përdorues</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-5 font-medium text-gray-600">Emri</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-600">Email</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-600">Roli</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-600">Statusi</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-600">Kyçje e fundit</th>
                  <th className="py-3 px-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                          <span className="text-white text-xs font-semibold">
                            {user.full_name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">{user.full_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{user.email}</td>
                    <td className="py-3 px-3">
                      {user.is_superadmin ? <Badge variant="destructive">Superadmin</Badge> : user.roles?.map((r) => (
                        <Badge key={r} variant="secondary" className="mr-1">{r}</Badge>
                      ))}
                    </td>
                    <td className="py-3 px-3">
                      {user.is_active ? (
                        <Badge variant="success">Aktiv</Badge>
                      ) : (
                        <Badge variant="secondary">Joaktiv</Badge>
                      )}
                    </td>
                    <td className="py-3 px-3 text-gray-500 text-xs">
                      {user.last_login
                        ? format(parseISO(user.last_login), 'dd MMM yyyy HH:mm')
                        : 'Kurrë'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => { setEditUser(user); setDialogOpen(true) }}
                          title="Edito"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            if (window.confirm(`A doni të çaktivizoni "${user.full_name}"?`)) {
                              deleteMutation.mutate(user.id)
                            }
                          }}
                          title="Çaktivizo"
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

      <UserFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editUser={editUser}
      />
    </div>
  )
}
