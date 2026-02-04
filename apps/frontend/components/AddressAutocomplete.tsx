'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClinicAddress } from '@/lib/clinic-types';

// Google Maps Places API types
declare global {
  interface Window {
    google: typeof google;
    initGoogleMaps: () => void;
  }
}

interface AddressAutocompleteProps {
  value: string;
  addressData?: ClinicAddress;
  onChange: (address: string, addressData: ClinicAddress | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Google Maps API key from environment
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function AddressAutocomplete({
  value,
  addressData,
  onChange,
  placeholder = 'Digite o endereço...',
  className,
  disabled = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState(value);

  // Load Google Maps Script
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('Google Maps API key not configured. Address autocomplete disabled.');
      return;
    }

    // Check if already loaded
    if (window.google?.maps?.places) {
      setIsGoogleLoaded(true);
      return;
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => setIsGoogleLoaded(true));
      return;
    }

    // Load the script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=pt-BR&region=BR`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // Check if Google Maps actually initialized properly
      if (window.google?.maps?.places) {
        setIsGoogleLoaded(true);
      } else {
        setLoadError('Google Maps loaded but Places API not available. Check if Places API is enabled.');
      }
    };
    script.onerror = (e) => {
      console.error('Failed to load Google Maps API:', e);
      setLoadError('Failed to load Google Maps. Check API key and enabled APIs in Google Cloud Console.');
    };
    document.head.appendChild(script);

    // Also listen for Google Maps error callback
    const originalConsoleError = console.error;
    const errorHandler = (...args: unknown[]) => {
      const message = args.join(' ');
      if (message.includes('Google Maps') || message.includes('RefererNotAllowedMapError') || message.includes('ApiNotActivatedMapError')) {
        setLoadError(message);
      }
      originalConsoleError.apply(console, args);
    };
    console.error = errorHandler;

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  // Initialize Autocomplete
  useEffect(() => {
    if (!isGoogleLoaded || !inputRef.current || autocompleteRef.current) return;

    try {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'br' },
        fields: ['address_components', 'formatted_address', 'geometry', 'place_id'],
        types: ['address'],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (!place || !place.formatted_address) return;

        setIsLoading(true);

        // Parse address components
        const addressComponents = place.address_components || [];
        const getComponent = (type: string): string => {
          const component = addressComponents.find((c) => c.types.includes(type));
          return component?.long_name || '';
        };
        const getComponentShort = (type: string): string => {
          const component = addressComponents.find((c) => c.types.includes(type));
          return component?.short_name || '';
        };

        const newAddressData: ClinicAddress = {
          formatted: place.formatted_address,
          street: `${getComponent('route')}, ${getComponent('street_number')}`.replace(/, $/, ''),
          neighborhood: getComponent('sublocality_level_1') || getComponent('sublocality'),
          city: getComponent('administrative_area_level_2') || getComponent('locality'),
          state: getComponentShort('administrative_area_level_1'),
          postalCode: getComponent('postal_code'),
          country: getComponent('country'),
          latitude: place.geometry?.location?.lat(),
          longitude: place.geometry?.location?.lng(),
          placeId: place.place_id,
        };

        setInputValue(place.formatted_address);
        onChange(place.formatted_address, newAddressData);
        setIsLoading(false);
      });
    } catch (error) {
      console.error('Error initializing Google Places Autocomplete:', error);
    }
  }, [isGoogleLoaded, onChange]);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Handle manual input
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      // Only update parent if user is typing manually (not selecting from autocomplete)
      // We clear addressData when typing manually since coordinates won't be valid
      onChange(newValue, undefined);
    },
    [onChange]
  );

  // If no API key or error, show simple input with optional error message
  if (!GOOGLE_MAPS_API_KEY || loadError) {
    return (
      <div className="space-y-2">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            className={cn('pl-10', className)}
            disabled={disabled}
          />
        </div>
        {loadError && (
          <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
            Autocomplete indisponível: {loadError}
            <br />
            <span className="text-muted-foreground">
              Verifique se as APIs estão habilitadas no Google Cloud Console: Places API, Maps JavaScript API
            </span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        placeholder={isGoogleLoaded ? placeholder : 'Carregando...'}
        className={cn('pl-10 pr-10', className)}
        disabled={disabled || !isGoogleLoaded}
      />
      {isLoading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
      )}
      {addressData?.latitude && addressData?.longitude && !isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-2 h-2 bg-green-500 rounded-full" title="Localização confirmada" />
        </div>
      )}
    </div>
  );
}

// Helper component to display address details with map preview
export function AddressDetails({ addressData, showMap = true }: { addressData?: ClinicAddress; showMap?: boolean }) {
  if (!addressData) return null;

  const hasCoordinates = addressData.latitude && addressData.longitude;

  return (
    <div className="space-y-3 mt-2">
      {/* Address details */}
      <div className="text-xs text-muted-foreground space-y-1 p-2 bg-muted/50 rounded">
        {addressData.street && <p><strong>Rua:</strong> {addressData.street}</p>}
        {addressData.neighborhood && <p><strong>Bairro:</strong> {addressData.neighborhood}</p>}
        {addressData.city && addressData.state && (
          <p><strong>Cidade:</strong> {addressData.city} - {addressData.state}</p>
        )}
        {addressData.postalCode && <p><strong>CEP:</strong> {addressData.postalCode}</p>}
        {hasCoordinates && (
          <p className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
            <strong>Coordenadas:</strong> {addressData.latitude!.toFixed(6)}, {addressData.longitude!.toFixed(6)}
          </p>
        )}
      </div>

      {/* Map Preview */}
      {showMap && hasCoordinates && GOOGLE_MAPS_API_KEY && (
        <div className="rounded-lg overflow-hidden border">
          <iframe
            width="100%"
            height="300"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${addressData.latitude},${addressData.longitude}&zoom=16`}
          />
        </div>
      )}
    </div>
  );
}
