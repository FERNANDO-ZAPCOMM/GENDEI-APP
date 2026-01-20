import { useMemo } from 'react';
import { useClinic } from './use-clinic';
import { useProfessionals } from './use-professionals';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { apiClient } from '@/lib/api';

export type NotificationType = 'onboarding' | 'action' | 'alert';

export interface SidebarNotification {
  type: NotificationType;
  count?: number;
  priority: number; // Lower = higher priority (1 = highest)
}

export interface SidebarNotifications {
  // Onboarding indicators
  clinic: SidebarNotification | null;
  payments: SidebarNotification | null;
  whatsapp: SidebarNotification | null;
  professionals: SidebarNotification | null;

  // Action indicators
  appointments: SidebarNotification | null;
  conversations: SidebarNotification | null;
  patients: SidebarNotification | null;

  // Overall onboarding progress
  onboardingComplete: boolean;
  onboardingStep: number; // Current step (1-4)
  totalSteps: number;
}

/**
 * Hook to determine sidebar notification indicators
 * - Tracks onboarding progress (clinic, payments, whatsapp, professionals)
 * - Tracks action items (pending appointments, escalated conversations)
 */
export function useSidebarNotifications(): SidebarNotifications {
  const { currentClinic: clinic } = useClinic();
  const { data: professionals = [] } = useProfessionals(clinic?.id || '');
  const { getIdToken } = useAuth();

  // Fetch pending counts for action indicators
  const { data: pendingCounts } = useQuery({
    queryKey: ['sidebar-pending-counts', clinic?.id],
    queryFn: async () => {
      const token = await getIdToken();
      if (!token) return { pendingAppointments: 0, escalatedConversations: 0 };

      try {
        const result = await apiClient<{
          pendingAppointments: number;
          escalatedConversations: number;
        }>(`/clinics/${clinic?.id}/pending-counts`, {
          token,
          suppressErrorLog: true,
        });
        return result;
      } catch {
        return { pendingAppointments: 0, escalatedConversations: 0 };
      }
    },
    enabled: !!clinic?.id,
    staleTime: 30 * 1000, // Refresh every 30 seconds
    refetchInterval: 30 * 1000,
  });

  const notifications = useMemo<SidebarNotifications>(() => {
    // Type assertion for clinic with extended properties
    const clinicData = clinic as any;

    // Check onboarding steps
    const hasClinicProfile = !!(
      clinicData?.name &&
      clinicData?.name !== 'Nova Clínica' &&
      clinicData?.addressData?.formatted &&
      clinicData?.phone &&
      clinicData?.categories?.length > 0
    );

    const hasPaymentSettings = !!(
      clinicData?.paymentSettings?.pixKey &&
      clinicData?.paymentSettings?.depositPercentage > 0
    );

    const hasWhatsAppConnected = !!(
      clinicData?.whatsappConnected &&
      clinicData?.whatsappPhoneNumberId
    );

    const hasProfessionals = professionals.length > 0;

    // Calculate onboarding progress
    const completedSteps = [
      hasClinicProfile,
      hasPaymentSettings,
      hasWhatsAppConnected,
      hasProfessionals,
    ].filter(Boolean).length;

    const onboardingComplete = completedSteps === 4;

    // Determine current onboarding step (in order)
    let onboardingStep = 1;
    if (hasClinicProfile) onboardingStep = 2;
    if (hasClinicProfile && hasPaymentSettings) onboardingStep = 3;
    if (hasClinicProfile && hasPaymentSettings && hasWhatsAppConnected) onboardingStep = 4;
    if (onboardingComplete) onboardingStep = 5; // All done

    // Build notification objects
    return {
      // Onboarding notifications (only show if not complete)
      clinic: !hasClinicProfile ? { type: 'onboarding', priority: 1 } : null,

      payments: hasClinicProfile && !hasPaymentSettings
        ? { type: 'onboarding', priority: 2 }
        : null,

      whatsapp: hasClinicProfile && hasPaymentSettings && !hasWhatsAppConnected
        ? { type: 'onboarding', priority: 3 }
        : null,

      professionals: hasClinicProfile && hasPaymentSettings && hasWhatsAppConnected && !hasProfessionals
        ? { type: 'onboarding', priority: 4 }
        : null,

      // Action notifications (pending items that need attention)
      appointments: pendingCounts?.pendingAppointments && pendingCounts.pendingAppointments > 0
        ? { type: 'action', count: pendingCounts.pendingAppointments, priority: 1 }
        : null,

      conversations: pendingCounts?.escalatedConversations && pendingCounts.escalatedConversations > 0
        ? { type: 'alert', count: pendingCounts.escalatedConversations, priority: 1 }
        : null,

      patients: null, // Reserved for future use (new patient notifications, etc.)

      // Progress tracking
      onboardingComplete,
      onboardingStep,
      totalSteps: 4,
    };
  }, [clinic, professionals, pendingCounts]);

  return notifications;
}
