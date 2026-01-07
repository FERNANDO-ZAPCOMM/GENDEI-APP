import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';

export interface WhatsAppBusinessProfile {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  profile_picture_url?: string;
  vertical?: string;
  websites?: string[];
}

/**
 * Hook for managing WhatsApp Business Profile
 * Allows fetching and updating business profile information
 */
export function useWhatsAppBusinessProfile(phoneNumberId: string | undefined) {
  const { getIdToken } = useAuth();
  const queryClient = useQueryClient();

  /**
   * Fetch current business profile
   */
  const profileQuery = useQuery({
    queryKey: ['whatsapp-business-profile', phoneNumberId],
    queryFn: async (): Promise<WhatsAppBusinessProfile> => {
      if (!phoneNumberId) throw new Error('Phone number ID is required');

      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `/api/whatsapp/business-profile?phoneNumberId=${phoneNumberId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch business profile');
      }

      return response.json();
    },
    enabled: !!phoneNumberId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  /**
   * Update business profile
   */
  const updateProfile = useMutation({
    mutationFn: async (profile: Partial<WhatsAppBusinessProfile>): Promise<void> => {
      if (!phoneNumberId) throw new Error('Phone number ID is required');

      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/whatsapp/business-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phoneNumberId,
          profile,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update business profile');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-business-profile', phoneNumberId] });
    },
  });

  /**
   * Upload and set profile picture
   */
  const uploadPicture = useMutation({
    mutationFn: async (file: File): Promise<void> => {
      if (!phoneNumberId) throw new Error('Phone number ID is required');

      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      // Convert file to base64
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/whatsapp/business-profile/picture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phoneNumberId,
          imageBase64,
          mimeType: file.type,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload profile picture');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-business-profile', phoneNumberId] });
    },
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    refetch: profileQuery.refetch,

    updateProfile: updateProfile.mutate,
    updateProfileAsync: updateProfile.mutateAsync,
    isUpdating: updateProfile.isPending,
    updateError: updateProfile.error,

    uploadPicture: uploadPicture.mutate,
    uploadPictureAsync: uploadPicture.mutateAsync,
    isUploading: uploadPicture.isPending,
    uploadError: uploadPicture.error,
  };
}
