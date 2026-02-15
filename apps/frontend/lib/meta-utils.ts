/**
 * Meta Embedded Signup Utilities
 * Helper functions for popup handling and phone number validation
 */

/**
 * Embedded Signup response from postMessage
 */
export interface EmbeddedSignupResult {
  type: 'success' | 'cancel' | 'error';
  wabaId?: string;
  phoneNumberId?: string;
  code?: string;
  error?: string;
}

/**
 * Open Meta Embedded Signup popup window
 * @param launchUrl - URL returned from /meta/embedded-signup/start
 * @param onResult - Callback with signup result (including WABA info from postMessage)
 * @returns Window object or null if blocked
 */
export function openEmbeddedSignupPopup(
  launchUrl: string,
  onResult: (result: EmbeddedSignupResult) => void
): Window | null {
  const width = 600;
  const height = 800;
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;

  const popup = window.open(
    launchUrl,
    'Meta Embedded Signup',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
  );

  if (!popup) {
    return null; // Popup blocked
  }

  let resultReceived = false;

  // Listen for postMessage from the popup (Embedded Signup sends WABA info this way)
  const messageHandler = (event: MessageEvent) => {

    // Parse the message - Embedded Signup sends data in various formats
    let data = event.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        // Not JSON, might be a different message
        return;
      }
    }

    if (!data || typeof data !== 'object') {
      return;
    }

    // Check if this is from our OAuth callback page
    if (data.type === 'META_OAUTH_CALLBACK') {
      resultReceived = true;
      window.removeEventListener('message', messageHandler);

      if (data.status === 'success') {
        onResult({
          type: 'success',
          wabaId: data.wabaId,
          phoneNumberId: data.phoneNumberId,
        });
      } else {
        onResult({
          type: 'error',
          error: data.error || 'Connection failed',
        });
      }
      return;
    }

    // Only accept WABA info messages from Facebook domains
    if (!event.origin.includes('facebook.com') && !event.origin.includes('fb.com')) {
      return;
    }

    // Check if this is an Embedded Signup response
    // The response contains waba_id and phone_number_id
    if (data.type === 'WA_EMBEDDED_SIGNUP' || data.waba_id || data.phone_number_id) {
      resultReceived = true;
      window.removeEventListener('message', messageHandler);

      onResult({
        type: 'success',
        wabaId: data.waba_id || data.wabaId,
        phoneNumberId: data.phone_number_id || data.phoneNumberId,
        code: data.code,
      });
    }
  };

  window.addEventListener('message', messageHandler);

  // IMPORTANT: We do NOT poll for popup.closed because cross-origin popups
  // (like business.facebook.com) return incorrect "closed" status during navigation.
  // This caused false positives where the popup was detected as "closed" while the
  // user was still completing the signup flow.
  //
  // Instead, we rely ONLY on postMessage from the callback page:
  // - Success: callback page sends META_OAUTH_CALLBACK with status=success
  // - Error: callback page sends META_OAUTH_CALLBACK with status=error
  // - Cancel: User manually closes popup - no message sent, user can retry
  //
  // Optional: Set a very long timeout (15 minutes) as a safety net to clean up
  // the message listener if the user abandons the flow entirely.
  const safetyTimeout = setTimeout(() => {
    if (!resultReceived) {
      window.removeEventListener('message', messageHandler);
      // Don't call onResult - just silently clean up
    }
  }, 15 * 60 * 1000); // 15 minutes

  // Store cleanup function on the popup object so caller can cancel if needed
  (popup as any).__cleanupEmbeddedSignup = () => {
    clearTimeout(safetyTimeout);
    window.removeEventListener('message', messageHandler);
  };

  // Focus the popup
  popup.focus();

  return popup;
}

/**
 * Validate E.164 phone number format
 * @param phone - Phone number to validate
 * @returns true if valid E.164 format
 */
export function validateE164(phone: string): boolean {
  // E.164 format: +[country code][number]
  // Length: 1-15 digits (including country code)
  // Example: +1234567890, +5511987654321
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

/**
 * Format phone number for display
 * @param phone - E.164 phone number
 * @returns Formatted phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';

  // Remove non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // If it starts with +1 (US/Canada)
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    const digits = cleaned.slice(2);
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // If it starts with +55 (Brazil)
  if (cleaned.startsWith('+55') && cleaned.length >= 12) {
    const digits = cleaned.slice(3);
    return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  // For other countries, just add spaces
  if (cleaned.startsWith('+')) {
    const countryCode = cleaned.slice(0, cleaned.length - 10);
    const number = cleaned.slice(cleaned.length - 10);
    return `${countryCode} ${number.slice(0, 5)} ${number.slice(5)}`;
  }

  return cleaned;
}

/**
 * Parse and clean phone number input
 * Removes formatting and ensures E.164 format
 * @param input - User input phone number
 * @returns Cleaned E.164 format or original if invalid
 */
export function cleanPhoneNumber(input: string): string {
  // Remove all non-digit characters except +
  const cleaned = input.replace(/[^\d+]/g, '');

  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    return `+${cleaned}`;
  }

  return cleaned;
}

/**
 * Get quality rating badge color
 * @param rating - Quality rating from Meta
 * @returns Tailwind color classes
 */
export function getQualityRatingColor(rating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'): string {
  switch (rating) {
    case 'GREEN':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'YELLOW':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'RED':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

/**
 * Get WhatsApp status badge color
 * @param status - WhatsApp connection status
 * @returns Tailwind color classes
 */
export function getWhatsAppStatusColor(
  status: 'DISCONNECTED' | 'CONNECTED' | 'NEEDS_VERIFICATION' | 'READY'
): string {
  switch (status) {
    case 'READY':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'NEEDS_VERIFICATION':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'CONNECTED':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'DISCONNECTED':
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

/**
 * Get user-friendly status text
 * @param status - WhatsApp connection status
 * @returns Display text for status
 */
export function getWhatsAppStatusText(
  status: 'DISCONNECTED' | 'CONNECTED' | 'NEEDS_VERIFICATION' | 'READY'
): string {
  switch (status) {
    case 'READY':
      return 'Active';
    case 'NEEDS_VERIFICATION':
      return 'Needs Verification';
    case 'CONNECTED':
      return 'Connected';
    case 'DISCONNECTED':
      return 'Not Connected';
  }
}

/**
 * Check if user can send test messages
 * @param status - WhatsApp connection status
 * @returns true if test messages can be sent
 */
export function canSendTestMessage(
  status?: 'DISCONNECTED' | 'CONNECTED' | 'NEEDS_VERIFICATION' | 'READY'
): boolean {
  return status === 'READY';
}

/**
 * Check if user needs to verify phone number
 * @param status - WhatsApp connection status
 * @returns true if verification is needed
 */
export function needsVerification(
  status?: 'DISCONNECTED' | 'CONNECTED' | 'NEEDS_VERIFICATION' | 'READY'
): boolean {
  return status === 'NEEDS_VERIFICATION' || status === 'CONNECTED';
}

/**
 * Format verification code for display (XXX-XXX)
 * @param code - 6-digit verification code
 * @returns Formatted code
 */
export function formatVerificationCode(code: string): string {
  const cleaned = code.replace(/\D/g, '').slice(0, 6);
  if (cleaned.length >= 3) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  }
  return cleaned;
}

/**
 * Validate verification code
 * @param code - Verification code to validate
 * @returns true if valid (6 digits)
 */
export function validateVerificationCode(code: string): boolean {
  const cleaned = code.replace(/\D/g, '');
  return cleaned.length === 6;
}

/**
 * Get conversation state badge color matching funnel colors
 * @param state - Conversation state
 * @returns Tailwind color classes
 */
/**
 * Map any agent workflow state to its booking journey category.
 * The WhatsApp agent writes granular states (general_chat, selecting_slot, etc.)
 * but the dashboard groups them into journey categories.
 */
export function getFunnelCategory(state: string): string {
  const NOVO_STATES = ['novo', 'new', 'general_chat', 'idle', 'greeting', 'awaiting_greeting_response', 'escalated'];
  const EM_ATENDIMENTO_STATES = ['em_atendimento', 'qualificado', 'engaged', 'selecting_slot', 'in_patient_info_flow', 'awaiting_professional_after_availability'];
  const AGENDANDO_STATES = [
    'agendando', 'negociando', 'negotiating', 'in_booking_flow', 'scheduling',
    'selecting_product', 'workflow_ativo',
    'awaiting_appointment_action', 'rescheduling', 'cancellation_requested',
  ];
  const CONFIRMANDO_STATES = ['confirmando', 'checkout', 'confirming', 'awaiting_payment_type', 'awaiting_payment_method'];
  const CONCLUIDO_STATES = ['concluido', 'fechado', 'closed', 'purchased'];

  if (NOVO_STATES.includes(state)) return 'novo';
  if (EM_ATENDIMENTO_STATES.includes(state)) return 'em_atendimento';
  if (AGENDANDO_STATES.includes(state)) return 'agendando';
  if (CONFIRMANDO_STATES.includes(state)) return 'confirmando';
  if (CONCLUIDO_STATES.includes(state)) return 'concluido';
  return 'novo'; // default unmapped states to novo
}

export function getConversationStateColor(state: string): string {
  const category = getFunnelCategory(state);
  switch (category) {
    case 'novo':
      return 'bg-blue-50 text-blue-600 border-blue-200';
    case 'em_atendimento':
      return 'bg-yellow-50 text-yellow-600 border-yellow-200';
    case 'agendando':
      return 'bg-orange-50 text-orange-600 border-orange-200';
    case 'confirmando':
      return 'bg-purple-50 text-purple-600 border-purple-200';
    case 'concluido':
      return 'bg-green-50 text-green-600 border-green-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}
