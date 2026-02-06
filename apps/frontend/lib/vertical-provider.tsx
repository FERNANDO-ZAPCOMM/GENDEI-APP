'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { getVertical, getVerticalFromHostname, type VerticalConfig, type VerticalSlug } from './verticals';
import { setApiVerticalSlug } from './api';

const VerticalContext = createContext<VerticalConfig | null>(null);

interface VerticalProviderProps {
  children: ReactNode;
  /** Override slug (for testing or server-side injection). */
  forcedSlug?: VerticalSlug;
}

export function VerticalProvider({ children, forcedSlug }: VerticalProviderProps) {
  const vertical = useMemo(() => {
    if (forcedSlug) return getVertical(forcedSlug);

    // Client-side: detect from window.location or URL search params
    if (typeof window !== 'undefined') {
      // Dev mode: ?vertical=nutri
      const params = new URLSearchParams(window.location.search);
      const paramVertical = params.get('vertical');
      if (paramVertical) return getVertical(paramVertical);

      // Production: subdomain detection
      return getVertical(getVerticalFromHostname(window.location.hostname));
    }

    return getVertical(null);
  }, [forcedSlug]);

  // Keep API client vertical header in sync
  useEffect(() => {
    setApiVerticalSlug(vertical.slug);
  }, [vertical.slug]);

  return (
    <VerticalContext.Provider value={vertical}>
      {children}
    </VerticalContext.Provider>
  );
}

/**
 * Access the current vertical configuration.
 * Returns the full VerticalConfig for the active subdomain.
 *
 * Usage:
 *   const vertical = useVertical();
 *   if (vertical.features.showConvenio) { ... }
 */
export function useVertical(): VerticalConfig {
  const ctx = useContext(VerticalContext);
  if (!ctx) {
    // Fallback: detect from hostname if provider not mounted yet
    if (typeof window !== 'undefined') {
      return getVertical(getVerticalFromHostname(window.location.hostname));
    }
    return getVertical(null);
  }
  return ctx;
}
