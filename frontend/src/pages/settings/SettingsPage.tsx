import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Settings,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  Bell,
  Shield,
  Info,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { authService } from '@/services/authService'

// ---- Change password form ----

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Fjalëkalimi aktual është i detyrueshëm'),
    new_password: z
      .string()
      .min(8, 'Fjalëkalimi i ri duhet të jetë të paktën 8 karaktere'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Fjalëkalimet nuk përputhen',
    path: ['confirm_password'],
  })

type PasswordFormValues = z.infer<typeof passwordSchema>

function ChangePasswordForm() {
  const { success, error } = useToast()
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  })

  const mutation = useMutation({
    mutationFn: ({ current_password, new_password }: { current_password: string; new_password: string }) =>
      authService.changePassword(current_password, new_password),
    onSuccess: () => {
      success('Fjalëkalimi u ndryshua', 'Fjalëkalimi juaj u ndryshua me sukses.')
      reset()
    },
    onError: (err: any) => {
      error('Gabim', err?.response?.data?.detail ?? 'Ndryshimi i fjalëkalimit dështoi.')
    },
  })

  function onSubmit(values: PasswordFormValues) {
    mutation.mutate({
      current_password: values.current_password,
      new_password: values.new_password,
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-sm">
      <div className="space-y-1.5">
        <Label htmlFor="current_password">Fjalëkalimi Aktual</Label>
        <div className="relative">
          <Input
            id="current_password"
            type={showCurrent ? 'text' : 'password'}
            placeholder="••••••••"
            {...register('current_password')}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            tabIndex={-1}
          >
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.current_password && (
          <p className="text-xs text-red-600">{errors.current_password.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new_password">Fjalëkalimi i Ri</Label>
        <div className="relative">
          <Input
            id="new_password"
            type={showNew ? 'text' : 'password'}
            placeholder="Minimum 8 karaktere"
            {...register('new_password')}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            tabIndex={-1}
          >
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.new_password && (
          <p className="text-xs text-red-600">{errors.new_password.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm_password">Konfirmo Fjalëkalimin</Label>
        <Input
          id="confirm_password"
          type="password"
          placeholder="Ripërsërit fjalëkalimin e ri"
          {...register('confirm_password')}
        />
        {errors.confirm_password && (
          <p className="text-xs text-red-600">{errors.confirm_password.message}</p>
        )}
      </div>

      <Button type="submit" loading={mutation.isPending}>
        <Lock className="h-4 w-4 mr-2" />
        Ndrysho Fjalëkalimin
      </Button>
    </form>
  )
}

// ---- Main page ----

export default function SettingsPage() {
  const { user } = useAuth()

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrator',
    manager: 'Menaxher',
    viewer: 'Shikues',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cilësimet</h1>
        <p className="text-sm text-gray-500 mt-1">Menaxho preferencat e llogarisë tënde</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <UserIcon className="h-4 w-4 mr-2" />
            Profili
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="h-4 w-4 mr-2" />
            Siguria
          </TabsTrigger>
          <TabsTrigger value="about">
            <Info className="h-4 w-4 mr-2" />
            Rreth
          </TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Informacioni i Profilit</CardTitle>
              <CardDescription>Shiko të dhënat e llogarisë tënde</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user && (
                <div className="flex items-start gap-6">
                  <div className="h-16 w-16 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                    <span className="text-white text-xl font-bold">
                      {user.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 text-sm">
                    <div>
                      <p className="text-gray-500 font-medium">Emri i Plotë</p>
                      <p className="text-gray-900 mt-0.5">{user.full_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Email</p>
                      <p className="text-gray-900 mt-0.5">{user.email}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Roli</p>
                      <div className="mt-0.5">
                        {user.role === 'admin' ? (
                          <Badge variant="destructive">Administrator</Badge>
                        ) : user.role === 'manager' ? (
                          <Badge variant="info">Menaxher</Badge>
                        ) : (
                          <Badge variant="secondary">Shikues</Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Statusi</p>
                      <div className="mt-0.5">
                        {user.is_active ? (
                          <Badge variant="success">Aktiv</Badge>
                        ) : (
                          <Badge variant="secondary">Joaktiv</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Për të ndryshuar informacionin e profilit, kontaktoni administratorin e sistemit.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Ndryshimi i Fjalëkalimit</CardTitle>
              <CardDescription>
                Sigurohuni që fjalëkalimi juaj të jetë i fortë dhe unik
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </TabsContent>

        {/* About */}
        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>Rreth Jurist Pro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-600">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-base">Jurist Pro</p>
                  <p className="text-gray-500 text-xs">Sistemi i Menaxhimit Ligjor</p>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-gray-500 font-medium">Versioni</dt>
                  <dd className="text-gray-900 mt-0.5">1.0.0</dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">Teknologjia</dt>
                  <dd className="text-gray-900 mt-0.5">React + FastAPI</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-gray-500 font-medium">Përshkrim</dt>
                  <dd className="text-gray-900 mt-0.5 leading-relaxed">
                    Jurist Pro është një platformë e avancuar për menaxhimin e dokumenteve juridike,
                    procedurave të prokurimit publik dhe analizave me inteligjencë artificiale.
                  </dd>
                </div>
              </dl>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400">
                  © {new Date().getFullYear()} Jurist Pro. Të gjitha të drejtat e rezervuara.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
