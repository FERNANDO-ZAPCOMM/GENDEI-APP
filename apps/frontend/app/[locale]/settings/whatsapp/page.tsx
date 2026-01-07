'use client';

import { useTranslations } from 'next-intl';
import { Settings } from 'lucide-react';
import { WhatsAppSettingsContent } from '@/components/whatsapp/WhatsAppSettingsContent';

export default function WhatsAppSettingsPage() {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">
            {t('settings.whatsapp.title') || 'WhatsApp Settings'}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('settings.whatsapp.description') ||
              'Manage your WhatsApp Business Account connection and settings'}
          </p>
        </div>
      </div>

      {/* Shared WhatsApp Settings Content */}
      <WhatsAppSettingsContent />
    </div>
  );
}
