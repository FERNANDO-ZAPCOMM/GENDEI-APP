'use client';

import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { WhatsAppStatus } from '@/lib/types';

interface ConnectionAlertsProps {
  status: WhatsAppStatus;
  locale: string;
}

export function ConnectionAlerts({ status, locale }: ConnectionAlertsProps) {
  const t = useTranslations();
  const router = useRouter();

  const navigateToWhatsApp = () => {
    router.push(`/${locale}/dashboard/whatsapp`);
  };

  // DISCONNECTED: No connection at all
  if (status.whatsappStatus === 'DISCONNECTED') {
    return (
      <Alert className="border-orange-300 bg-orange-50">
        <XCircle className="h-5 w-5 text-orange-600" />
        <AlertTitle className="text-orange-900">
          {t('dashboard.alerts.disconnected.title') || 'WhatsApp Business Account Not Connected'}
        </AlertTitle>
        <AlertDescription className="text-orange-800">
          <p className="mb-3">
            {t('dashboard.alerts.disconnected.description') ||
              'Connect your WhatsApp Business Account to start receiving and sending messages to your customers.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={navigateToWhatsApp}
            className="border-orange-400 text-orange-700 hover:bg-orange-100"
          >
            {t('dashboard.alerts.disconnected.action') || 'Connect Now'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // CONNECTED or NEEDS_VERIFICATION: Connected but not verified
  if (status.whatsappStatus === 'CONNECTED' || status.whatsappStatus === 'NEEDS_VERIFICATION') {
    return (
      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
        <AlertTitle className="text-yellow-900">
          {t('dashboard.alerts.needsVerification.title') || 'Phone Number Verification Required'}
        </AlertTitle>
        <AlertDescription className="text-yellow-800">
          <p className="mb-3">
            {t('dashboard.alerts.needsVerification.description') ||
              'Your WhatsApp Business Account is connected, but your phone number needs to be verified before you can send messages.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={navigateToWhatsApp}
            className="border-yellow-300 text-yellow-900 hover:bg-yellow-100"
          >
            {t('dashboard.alerts.needsVerification.action') || 'Verify Phone Number'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // READY: All good, but show quality rating if not GREEN
  if (
    status.whatsappStatus === 'READY' &&
    status.meta?.qualityRating &&
    status.meta.qualityRating !== 'GREEN'
  ) {
    const isRed = status.meta.qualityRating === 'RED';
    const alertColor = isRed ? 'red' : 'yellow';

    return (
      <Alert className={`border-${alertColor}-200 bg-${alertColor}-50`}>
        <AlertTriangle className={`h-5 w-5 text-${alertColor}-600`} />
        <AlertTitle className={`text-${alertColor}-900`}>
          {isRed
            ? t('dashboard.alerts.qualityRed.title') || 'WhatsApp Quality Rating: Poor'
            : t('dashboard.alerts.qualityYellow.title') || 'WhatsApp Quality Rating: Medium'}
        </AlertTitle>
        <AlertDescription className={`text-${alertColor}-800`}>
          <p className="mb-3">
            {isRed
              ? t('dashboard.alerts.qualityRed.description') ||
                'Your WhatsApp phone number has a poor quality rating. This may limit your ability to send messages. Please review your messaging practices.'
              : t('dashboard.alerts.qualityYellow.description') ||
                'Your WhatsApp phone number has a medium quality rating. Consider improving your messaging practices to maintain a good quality score.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={navigateToWhatsApp}
            className={`border-${alertColor}-300 text-${alertColor}-900 hover:bg-${alertColor}-100`}
          >
            {t('dashboard.alerts.qualityIssue.action') || 'View Details'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // READY: All good, no alert needed (user can see status in the cards)
  // No alert for unknown states
  return null;
}
