'use client';

import { useTranslations } from 'next-intl';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { WhatsAppSettingsContent } from '@/components/whatsapp/WhatsAppSettingsContent';

function WhatsAppSettingsPageContent() {
  const t = useTranslations();

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
      <WhatsAppSettingsContent />
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
