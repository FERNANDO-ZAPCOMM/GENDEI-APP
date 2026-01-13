'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { WhatsAppSettingsContent } from '@/components/whatsapp/WhatsAppSettingsContent';
import { getNextStepUrl } from '@/hooks/use-onboarding';

function WhatsAppSettingsPageContent() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'pt-BR';

  const handleWhatsAppConnected = () => {
    // Redirect to dashboard when WhatsApp is connected
    router.push(getNextStepUrl('whatsapp', locale));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-semibold">
          {t('settings.whatsapp.title') || 'WhatsApp Settings'}
        </h1>
        <p className="text-gray-600 mt-2">
          {t('settings.whatsapp.description') ||
            'Manage your WhatsApp Business Account connection and settings'}
        </p>
      </div>

      {/* Shared WhatsApp Settings Content */}
      <WhatsAppSettingsContent onConnected={handleWhatsAppConnected} />
    </div>
  );
}

export default function WhatsAppSettingsPage() {
  return (
    <PermissionGuard permission="canManageSettings">
      <WhatsAppSettingsPageContent />
    </PermissionGuard>
  );
}
