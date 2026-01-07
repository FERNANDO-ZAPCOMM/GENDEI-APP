'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Unplug, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface DisconnectButtonProps {
  onDisconnect: () => Promise<void>;
  isDisconnecting?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function DisconnectButton({
  onDisconnect,
  isDisconnecting = false,
  variant = 'outline',
  size = 'default',
  className = '',
}: DisconnectButtonProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  const handleDisconnect = async () => {
    try {
      await onDisconnect();
      toast.success(
        t('settings.whatsapp.disconnect.success') ||
          'WhatsApp Business Account disconnected successfully'
      );
      setOpen(false);
    } catch (error: any) {
      toast.error(
        error.message ||
          t('settings.whatsapp.disconnect.error') ||
          'Failed to disconnect WhatsApp Business Account'
      );
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={isDisconnecting}
        >
          {isDisconnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('settings.whatsapp.disconnect.disconnecting') ||
                'Disconnecting...'}
            </>
          ) : (
            <>
              <Unplug className="mr-2 h-4 w-4" />
              {t('settings.whatsapp.disconnect.button') ||
                'Disconnect WhatsApp'}
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <AlertDialogTitle>
              {t('settings.whatsapp.disconnect.title') ||
                'Disconnect WhatsApp Business Account?'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <p>
              {t('settings.whatsapp.disconnect.description') ||
                'This will disconnect your WhatsApp Business Account from this application.'}
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-900 font-medium mb-2">
                {t('settings.whatsapp.disconnect.warningTitle') ||
                  'What happens when you disconnect:'}
              </p>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>
                  {t('settings.whatsapp.disconnect.warning1') ||
                    'You will no longer receive messages from customers'}
                </li>
                <li>
                  {t('settings.whatsapp.disconnect.warning2') ||
                    'You will not be able to send messages'}
                </li>
                <li>
                  {t('settings.whatsapp.disconnect.warning3') ||
                    'Your phone number verification will be removed'}
                </li>
                <li>
                  {t('settings.whatsapp.disconnect.warning4') ||
                    'You can reconnect anytime, but will need to verify again'}
                </li>
              </ul>
            </div>
            <p className="text-sm text-gray-600">
              {t('settings.whatsapp.disconnect.confirmation') ||
                'Are you sure you want to continue?'}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDisconnecting}>
            {t('common.cancel') || 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDisconnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('settings.whatsapp.disconnect.disconnecting') ||
                  'Disconnecting...'}
              </>
            ) : (
              <>
                <Unplug className="mr-2 h-4 w-4" />
                {t('settings.whatsapp.disconnect.confirm') ||
                  'Yes, Disconnect'}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
