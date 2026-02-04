'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useClinic } from '@/hooks/use-clinic';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Save } from 'lucide-react';
import { z } from 'zod';
import { useState } from 'react';

// Profile form schema (for all users)
const ProfileSchema = z.object({
  displayName: z.string().min(1, 'Nome é obrigatório'),
  companyName: z.string().optional(),
});

// Email/Password form schema (only for email/password users)
const CredentialsSchema = z.object({
  newEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  emailPassword: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
});

type ProfileForm = z.infer<typeof ProfileSchema>;
type CredentialsForm = z.infer<typeof CredentialsSchema>;

export default function AccountPage() {
  const t = useTranslations();
  const { currentClinic: clinic, updateClinic } = useClinic();
  const { currentUser, updateProfile, updateEmail, updatePassword } = useAuth();
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);

  // Check if user logged in with Google
  const isGoogleUser = currentUser?.providerData?.[0]?.providerId === 'google.com';

  // Profile form
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      displayName: '',
      companyName: '',
    },
  });

  // Credentials form (email/password only)
  const credentialsForm = useForm<CredentialsForm>({
    resolver: zodResolver(CredentialsSchema),
    defaultValues: {
      newEmail: '',
      emailPassword: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Update profile form values when data loads
  useEffect(() => {
    if (currentUser?.displayName || clinic?.name) {
      profileForm.reset({
        displayName: currentUser?.displayName || '',
        companyName: clinic?.name || '',
      });
    }
  }, [currentUser?.displayName, clinic?.name, profileForm]);

  const handleSaveProfile = async (data: ProfileForm) => {
    setIsSavingProfile(true);
    try {
      // Update display name if changed
      if (data.displayName !== currentUser?.displayName) {
        await updateProfile(data.displayName.trim());
      }

      // Update company name if changed
      if (data.companyName !== clinic?.name) {
        await updateClinic.mutateAsync({ name: data.companyName?.trim() || '' });
      }

      toast.success(t('settings.user.saved') || 'Salvo com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveCredentials = async (data: CredentialsForm) => {
    setIsSavingCredentials(true);
    try {
      // Update email if provided
      if (data.newEmail && data.emailPassword) {
        await updateEmail(data.newEmail.trim(), data.emailPassword);
        credentialsForm.setValue('newEmail', '');
        credentialsForm.setValue('emailPassword', '');
      }

      // Update password if provided
      if (data.currentPassword && data.newPassword) {
        if (data.newPassword !== data.confirmPassword) {
          toast.error('As senhas não coincidem');
          setIsSavingCredentials(false);
          return;
        }
        if (data.newPassword.length < 6) {
          toast.error('A nova senha deve ter pelo menos 6 caracteres');
          setIsSavingCredentials(false);
          return;
        }
        await updatePassword(data.currentPassword, data.newPassword);
        credentialsForm.setValue('currentPassword', '');
        credentialsForm.setValue('newPassword', '');
        credentialsForm.setValue('confirmPassword', '');
      }

      toast.success(t('settings.user.saved') || 'Salvo com sucesso!');
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        toast.error('Senha incorreta');
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error('Este email já está em uso');
      } else {
        toast.error(error.message || 'Erro ao salvar');
      }
    } finally {
      setIsSavingCredentials(false);
    }
  };

  return (
    <div className="space-y-6 page-transition">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t('settings.user.title')}</h1>
        <p className="text-gray-600 mt-1">{t('settings.user.description')}</p>
      </div>

      {/* Profile Card */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t('settings.user.profile') || 'Perfil'}</CardTitle>
          <CardDescription>{t('settings.user.profileDescription') || 'Informações do seu perfil'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit(handleSaveProfile)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">{t('settings.user.name') || 'Nome'}</Label>
              <Input
                id="displayName"
                placeholder="Seu nome"
                {...profileForm.register('displayName')}
                disabled={isSavingProfile}
              />
              {profileForm.formState.errors.displayName && (
                <p className="text-sm text-destructive">{profileForm.formState.errors.displayName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">{t('settings.user.company') || 'Empresa'}</Label>
              <Input
                id="companyName"
                placeholder="Nome da empresa"
                {...profileForm.register('companyName')}
                disabled={isSavingProfile}
              />
            </div>

            {/* Current Email (read-only display) */}
            <div className="space-y-2 pt-4 border-t">
              <Label>{t('settings.user.currentEmail') || 'Email atual'}</Label>
              <p className="text-sm text-muted-foreground">{currentUser?.email || '-'}</p>
              {isGoogleUser && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {t('settings.user.googleAccount') || 'Conectado via Google'}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isSavingProfile}>
              {isSavingProfile ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('common.saving') || 'Salvando...'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t('common.save') || 'Salvar'}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Email & Password Card - Only for non-Google users */}
      {!isGoogleUser && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{t('settings.user.security') || 'Segurança'}</CardTitle>
            <CardDescription>{t('settings.user.securityDescription') || 'Altere seu email ou senha'}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={credentialsForm.handleSubmit(handleSaveCredentials)} className="space-y-6">
              {/* Email Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newEmail">{t('settings.user.newEmail') || 'Novo email'}</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    placeholder="novo@email.com"
                    {...credentialsForm.register('newEmail')}
                    disabled={isSavingCredentials}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailPassword">{t('settings.user.passwordToConfirm') || 'Senha (para confirmar alteração de email)'}</Label>
                  <Input
                    id="emailPassword"
                    type="password"
                    placeholder="Digite sua senha atual"
                    {...credentialsForm.register('emailPassword')}
                    disabled={isSavingCredentials}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('settings.user.emailPasswordHelp') || 'Necessário apenas se alterar o email'}
                  </p>
                </div>
              </div>

              {/* Password Section */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium">{t('settings.user.changePassword') || 'Alterar senha'}</h4>

                <div className="space-y-2">
                  <Label htmlFor="currentPassword">{t('settings.user.currentPassword') || 'Senha atual'}</Label>
                  <Input
                    id="currentPassword"
                    type={showPasswords ? 'text' : 'password'}
                    placeholder="Digite sua senha atual"
                    {...credentialsForm.register('currentPassword')}
                    disabled={isSavingCredentials}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">{t('settings.user.newPassword') || 'Nova senha'}</Label>
                  <Input
                    id="newPassword"
                    type={showPasswords ? 'text' : 'password'}
                    placeholder="Digite a nova senha"
                    {...credentialsForm.register('newPassword')}
                    disabled={isSavingCredentials}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('settings.user.confirmPassword') || 'Confirmar nova senha'}</Label>
                  <Input
                    id="confirmPassword"
                    type={showPasswords ? 'text' : 'password'}
                    placeholder="Confirme a nova senha"
                    {...credentialsForm.register('confirmPassword')}
                    disabled={isSavingCredentials}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {showPasswords ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      {t('settings.user.hidePasswords') || 'Ocultar senhas'}
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      {t('settings.user.showPasswords') || 'Mostrar senhas'}
                    </>
                  )}
                </button>
              </div>

              <Button type="submit" disabled={isSavingCredentials}>
                {isSavingCredentials ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('common.saving') || 'Salvando...'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {t('common.save') || 'Salvar'}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
