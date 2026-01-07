import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from './use-auth';

interface GenerateDescriptionPayload {
  title?: string;
  fileUrl: string;
  language?: string;
  tone?: string;
  audience?: string;
}

interface GenerateDescriptionResponse {
  description: string;
  highlights?: string[];
  detectedLanguage?: string;
}

export function useAiProductDescription(creatorId: string) {
  const { getIdToken } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateDescription = useCallback(
    async (payload: GenerateDescriptionPayload): Promise<GenerateDescriptionResponse> => {
      if (!creatorId) {
        throw new Error('Creator ID is required');
      }

      const token = await getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      try {
        setIsGenerating(true);
        return await apiClient<GenerateDescriptionResponse>(
          `/products/creator/${creatorId}/description`,
          {
            method: 'POST',
            body: JSON.stringify(payload),
            token,
            suppressErrorLog: true,
          },
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [getIdToken, creatorId],
  );

  return {
    generateDescription,
    isGenerating,
  };
}
