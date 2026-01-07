'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react';
import { getWhatsAppStatusColor, getWhatsAppStatusText } from '@/lib/meta-utils';
import type { WhatsAppStatus } from '@/lib/types';

interface WhatsAppStatusBadgeProps {
  status: WhatsAppStatus['whatsappStatus'];
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function WhatsAppStatusBadge({
  status,
  size = 'md',
  showIcon = true,
}: WhatsAppStatusBadgeProps) {
  const t = useTranslations();

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const getIcon = () => {
    if (!showIcon) return null;

    const iconClass = `${iconSizes[size]} mr-1.5`;

    switch (status) {
      case 'READY':
        return <CheckCircle2 className={iconClass} />;
      case 'NEEDS_VERIFICATION':
        return <AlertCircle className={iconClass} />;
      case 'CONNECTED':
        return <Clock className={iconClass} />;
      case 'DISCONNECTED':
        return <XCircle className={iconClass} />;
    }
  };

  const getText = () => {
    const key = `settings.whatsapp.status.${status.toLowerCase()}`;
    return t(key) || getWhatsAppStatusText(status);
  };

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${getWhatsAppStatusColor(status)}
        ${sizeClasses[size]}
      `}
    >
      {getIcon()}
      {getText()}
    </span>
  );
}
