'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClinicWhatsAppPreview } from '@/components/chat/ClinicWhatsAppPreview';
import { useClinic } from '@/hooks/use-clinic';

/**
 * WhatsApp Preview Card - ZapComm-style preview showing how the clinic
 * appears to patients in WhatsApp conversations
 */
export function WhatsAppPreviewCard() {
  const t = useTranslations();
  const { currentClinic } = useClinic();

  const clinicPreviewData = {
    name: currentClinic?.name || '',
    phone: currentClinic?.phone,
    email: currentClinic?.email,
    openingHours: currentClinic?.openingHours,
    address: currentClinic?.address,
    addressData: currentClinic?.addressData,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('settings.whatsapp.preview.title') || 'Prévia do WhatsApp'}
        </CardTitle>
        <CardDescription>
          {t('settings.whatsapp.preview.description') || 'Como sua clínica aparece para os pacientes'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center py-6">
        <ClinicWhatsAppPreview clinicData={clinicPreviewData} />
      </CardContent>
    </Card>
  );
}
