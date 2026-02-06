// Gendei Vertical Terminology
// Minimal vertical config for Cloud Functions (reminders, notifications)
// Full config lives in the frontend (lib/verticals.ts) and Python agent (vertical_config.py)

interface VerticalTerms {
  appointmentTerm: string;
  professionalEmoji: string;
  showArriveEarlyTip: boolean;
}

const VERTICAL_TERMS: Record<string, VerticalTerms> = {
  med: { appointmentTerm: 'consulta', professionalEmoji: '👨‍⚕️', showArriveEarlyTip: true },
  dental: { appointmentTerm: 'consulta', professionalEmoji: '🦷', showArriveEarlyTip: true },
  psi: { appointmentTerm: 'sessão', professionalEmoji: '🧠', showArriveEarlyTip: false },
  nutri: { appointmentTerm: 'consulta', professionalEmoji: '🥗', showArriveEarlyTip: false },
  fisio: { appointmentTerm: 'sessão', professionalEmoji: '💪', showArriveEarlyTip: true },
  dermato: { appointmentTerm: 'consulta', professionalEmoji: '✨', showArriveEarlyTip: true },
  oftalmo: { appointmentTerm: 'consulta', professionalEmoji: '👁️', showArriveEarlyTip: true },
  pediatra: { appointmentTerm: 'consulta', professionalEmoji: '👶', showArriveEarlyTip: true },
  fono: { appointmentTerm: 'sessão', professionalEmoji: '🗣️', showArriveEarlyTip: false },
  estetica: { appointmentTerm: 'procedimento', professionalEmoji: '💎', showArriveEarlyTip: false },
};

const DEFAULT_TERMS: VerticalTerms = {
  appointmentTerm: 'consulta',
  professionalEmoji: '👨‍⚕️',
  showArriveEarlyTip: true,
};

export function getVerticalTerms(verticalSlug?: string | null): VerticalTerms {
  if (!verticalSlug || verticalSlug === 'geral') {
    return DEFAULT_TERMS;
  }
  return VERTICAL_TERMS[verticalSlug] || DEFAULT_TERMS;
}
