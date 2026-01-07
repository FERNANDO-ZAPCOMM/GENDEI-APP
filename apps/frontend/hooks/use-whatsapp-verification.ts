import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import type {
  RequestVerificationRequest,
  RequestVerificationResponse,
  RegisterNumberRequest,
  RegisterNumberResponse,
} from '@/lib/types';

/**
 * Hook for WhatsApp phone number verification flow
 * Handles both SMS/Voice code request and number registration
 */
export function useWhatsAppVerification() {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  /**
   * Request verification code (SMS or Voice)
   */
  const requestCode = useMutation({
    mutationFn: async (data: RequestVerificationRequest): Promise<RequestVerificationResponse> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/whatsapp/request-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to request verification code');
      }

      return response.json();
    },
  });

  /**
   * Register phone number with verification code
   */
  const registerNumber = useMutation({
    mutationFn: async (data: RegisterNumberRequest): Promise<RegisterNumberResponse> => {
      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/whatsapp/register-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Invalid verification code');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate meta status to refresh UI
      queryClient.invalidateQueries({ queryKey: ['meta-status'] });
    },
  });

  return {
    requestCode: requestCode.mutate,
    requestCodeAsync: requestCode.mutateAsync,
    isRequestingCode: requestCode.isPending,
    requestCodeError: requestCode.error,

    registerNumber: registerNumber.mutate,
    registerNumberAsync: registerNumber.mutateAsync,
    isRegisteringNumber: registerNumber.isPending,
    registerNumberError: registerNumber.error,
  };
}
