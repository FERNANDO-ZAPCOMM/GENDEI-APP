'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { teamApi, TeamInvitation, getRoleName, getRoleColor } from '@/lib/team-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Mail, Building2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function AcceptInvitationPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, getIdToken } = useAuth();

  const [invitation, setInvitation] = useState<TeamInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token');

  // Load invitation details
  useEffect(() => {
    const loadInvitation = async () => {
      if (!token) {
        setError(t('team.invitation.errors.noToken'));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        const response = await fetch(`${API_URL}/team/invitation/${token}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to load invitation');
        }

        const data = await response.json();
        setInvitation(data);
      } catch (err: any) {
        console.error('Failed to load invitation:', err);
        setError(err.message || t('team.invitation.errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadInvitation();
  }, [token, t]);

  // Handle accepting the invitation
  const handleAccept = async () => {
    if (!token || !invitation) return;

    // Check if user is authenticated
    if (!currentUser) {
      toast.error(t('team.invitation.errors.mustSignIn'));
      // Redirect to sign in with return URL
      router.push(`/signin?returnUrl=${encodeURIComponent(`/team/accept?token=${token}`)}`);
      return;
    }

    // Check if email matches
    if (currentUser.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      toast.error(t('team.invitation.errors.emailMismatch'));
      return;
    }

    try {
      setAccepting(true);
      const authToken = await getIdToken();
      if (!authToken) {
        throw new Error('Not authenticated');
      }

      await teamApi.acceptInvitation(authToken, { token });

      toast.success(t('team.invitation.success'));

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: any) {
      console.error('Failed to accept invitation:', err);
      toast.error(err.message || t('team.invitation.errors.acceptFailed'));
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">{t('team.invitation.loading')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-center">{t('team.invitation.errors.title')}</CardTitle>
            <CardDescription className="text-center">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push('/dashboard')}
              variant="outline"
              className="w-full"
            >
              {t('team.invitation.goToDashboard')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <UserCheck className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-center text-2xl">
            {t('team.invitation.title')}
          </CardTitle>
          <CardDescription className="text-center">
            {t('team.invitation.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="space-y-4">
            {/* Creator Name */}
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">{t('team.invitation.organization')}</p>
                <p className="font-medium">{invitation.creatorName}</p>
              </div>
            </div>

            {/* Role */}
            <div className="flex items-start gap-3">
              <UserCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">{t('team.invitation.roleAssigned')}</p>
                <Badge className={getRoleColor(invitation.role)}>
                  {getRoleName(invitation.role)}
                </Badge>
              </div>
            </div>

            {/* Invited By */}
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">{t('team.invitation.invitedBy')}</p>
                <p className="font-medium">{invitation.invitedByEmail}</p>
              </div>
            </div>

            {/* Expires At */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">
                {t('team.invitation.expiresAt')}{' '}
                <span className="font-medium text-foreground">
                  {new Date(invitation.expiresAt).toLocaleDateString()}
                </span>
              </p>
            </div>
          </div>

          {/* User Authentication Status */}
          {currentUser ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">
                {t('team.invitation.signedInAs')} <span className="font-medium">{currentUser.email}</span>
              </p>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                {t('team.invitation.mustSignInMessage')}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full"
              size="lg"
            >
              {accepting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {accepting ? t('team.invitation.accepting') : t('team.invitation.accept')}
            </Button>
            <Button
              onClick={() => router.push('/dashboard')}
              variant="outline"
              className="w-full"
            >
              {t('team.invitation.decline')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
