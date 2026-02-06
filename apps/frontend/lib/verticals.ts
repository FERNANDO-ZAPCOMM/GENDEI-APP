// Gendei Vertical Configuration
// Each subdomain (nutri.gendei.app, dental.gendei.app, etc.) maps to a vertical
// that customizes the entire platform experience for that specialty.
//
// Based on Doctoralia Brazil market research (2024/2025):
// - Demand tiers from 9.5M monthly bookings
// - Pricing from FENAM/CBHPM + market data
// - Convênio patterns from ANS regulations

import type { ServiceTemplate } from './clinic-categories';

// ─── Types ───────────────────────────────────────────────────────────────────

export type VerticalSlug =
  | 'med'
  | 'dental'
  | 'psi'
  | 'nutri'
  | 'fisio'
  | 'dermato'
  | 'oftalmo'
  | 'pediatra'
  | 'fono'
  | 'estetica'
  | 'geral';

export type ConvenioAcceptance = 'very_high' | 'high' | 'medium' | 'low' | 'separate_plan';

export type AppointmentPattern = 'consultation' | 'session' | 'procedure';

export type RecurringPattern = 'weekly' | 'episodic' | 'series';

export interface VerticalConfig {
  slug: VerticalSlug;
  name: string;                          // Platform name (e.g., "Gendei Med")
  tagline: string;                       // Short description for landing/signup
  categoryId: string;                    // Maps to clinic-categories.ts
  council: string;                       // Professional council (CRM, CRO, CRP, CRN, etc.)
  specialties: string[];                 // Specialty IDs from specialties.ts
  defaultServices: ServiceTemplate[];    // Pre-filled services on onboarding
  defaultDurationFirst: number;          // Default first visit duration (minutes)
  defaultDurationFollowup: number;       // Default follow-up duration (minutes)
  defaultPriceRange: { min: number; max: number; typical: number }; // BRL
  convenioAcceptance: ConvenioAcceptance;
  appointmentPattern: AppointmentPattern;
  recurringPattern: RecurringPattern;

  // Feature flags - what to show/hide in the UI
  features: {
    showConvenio: boolean;               // Show convênio config in settings
    showDeposit: boolean;                 // Show deposit/signal config
    showTelemedicine: boolean;            // Show online modality option
    showSpecialtyPicker: boolean;        // Show specialty dropdown (false = single specialty)
    showProfessionalBio: boolean;        // Show bio field for professionals
    showBeforeAfterPhotos: boolean;      // Show before/after gallery
    showTherapyApproach: boolean;        // Show therapy approach field (CBT, psychoanalysis, etc.)
    showDietaryPlan: boolean;            // Show dietary plan features
    showProcedureList: boolean;          // Show procedures vs consultations
  };

  // Branding
  theme: {
    primary: string;                     // Primary color hex
    icon: string;                        // Lucide icon name
  };
}

// ─── Vertical Definitions ────────────────────────────────────────────────────

export const VERTICALS: Record<VerticalSlug, VerticalConfig> = {

  // ──────────────────────────────────────────────
  // CLÍNICA MÉDICA (General Medical)
  // Demand: Tier 1 | Convênio: Very High
  // ──────────────────────────────────────────────
  med: {
    slug: 'med',
    name: 'Gendei Med',
    tagline: 'Plataforma para clínicas médicas e consultórios',
    categoryId: 'clinica_medica',
    council: 'CRM',
    specialties: [
      'clinico_geral', 'pediatria', 'ginecologia', 'cardiologia',
      'dermatologia', 'ortopedia', 'neurologia', 'psiquiatria',
      'endocrinologia', 'gastroenterologia', 'urologia',
      'otorrinolaringologia', 'reumatologia', 'pneumologia',
      'nefrologia', 'geriatria', 'mastologia', 'proctologia',
      'angiologia', 'infectologia', 'hematologia',
    ],
    defaultServices: [
      { name: 'Consulta Médica', duration: 30, price: 0 },
      { name: 'Retorno', duration: 20, price: 0 },
      { name: 'Check-up Geral', duration: 60, price: 0 },
      { name: 'Consulta de Emergência', duration: 30, price: 0 },
    ],
    defaultDurationFirst: 30,
    defaultDurationFollowup: 20,
    defaultPriceRange: { min: 200, max: 500, typical: 300 },
    convenioAcceptance: 'very_high',
    appointmentPattern: 'consultation',
    recurringPattern: 'episodic',
    features: {
      showConvenio: true,
      showDeposit: true,
      showTelemedicine: true,
      showSpecialtyPicker: true,
      showProfessionalBio: true,
      showBeforeAfterPhotos: false,
      showTherapyApproach: false,
      showDietaryPlan: false,
      showProcedureList: false,
    },
    theme: { primary: '#2563eb', icon: 'Stethoscope' },
  },

  // ──────────────────────────────────────────────
  // ODONTOLOGIA (Dentistry)
  // Demand: Tier 1 | Convênio: Separate Plan (odontológico)
  // ──────────────────────────────────────────────
  dental: {
    slug: 'dental',
    name: 'Gendei Dental',
    tagline: 'Plataforma para dentistas e clínicas odontológicas',
    categoryId: 'odontologia',
    council: 'CRO',
    specialties: [
      'odontologia_geral', 'ortodontia', 'implantodontia', 'endodontia',
      'periodontia', 'odontopediatria', 'protese_dentaria',
      'cirurgia_bucomaxilofacial', 'dentistica', 'harmonizacao_orofacial',
    ],
    defaultServices: [
      { name: 'Avaliação Odontológica', duration: 30, price: 0 },
      { name: 'Limpeza Dental (Profilaxia)', duration: 45, price: 0 },
      { name: 'Restauração', duration: 45, price: 0 },
      { name: 'Clareamento Dental', duration: 60, price: 0 },
      { name: 'Extração', duration: 30, price: 0 },
    ],
    defaultDurationFirst: 30,
    defaultDurationFollowup: 30,
    defaultPriceRange: { min: 100, max: 300, typical: 150 },
    convenioAcceptance: 'separate_plan',
    appointmentPattern: 'procedure',
    recurringPattern: 'series',
    features: {
      showConvenio: false,
      showDeposit: true,
      showTelemedicine: false,
      showSpecialtyPicker: true,
      showProfessionalBio: true,
      showBeforeAfterPhotos: true,
      showTherapyApproach: false,
      showDietaryPlan: false,
      showProcedureList: true,
    },
    theme: { primary: '#0891b2', icon: 'SmilePlus' },
  },

  // ──────────────────────────────────────────────
  // PSICOLOGIA (Psychology)
  // Demand: Tier 1 (highest for telemedicine!) | Convênio: Medium
  // ──────────────────────────────────────────────
  psi: {
    slug: 'psi',
    name: 'Gendei Psi',
    tagline: 'Plataforma para psicólogos e clínicas de psicologia',
    categoryId: 'psicologia',
    council: 'CRP',
    specialties: [
      'psicologia', 'neuropsicologia', 'psicanalise',
      'terapia_cognitivo_comportamental', 'psicologia_infantil',
      'terapia_de_casal', 'psicopedagogia',
    ],
    defaultServices: [
      { name: 'Sessão de Psicoterapia', duration: 50, price: 0 },
      { name: 'Avaliação Psicológica', duration: 60, price: 0 },
      { name: 'Terapia de Casal', duration: 60, price: 0 },
      { name: 'Terapia Infantil', duration: 50, price: 0 },
      { name: 'Orientação Vocacional', duration: 50, price: 0 },
    ],
    defaultDurationFirst: 50,
    defaultDurationFollowup: 50,
    defaultPriceRange: { min: 100, max: 400, typical: 200 },
    convenioAcceptance: 'medium',
    appointmentPattern: 'session',
    recurringPattern: 'weekly',
    features: {
      showConvenio: true,
      showDeposit: false,
      showTelemedicine: true,
      showSpecialtyPicker: true,
      showProfessionalBio: true,
      showBeforeAfterPhotos: false,
      showTherapyApproach: true,
      showDietaryPlan: false,
      showProcedureList: false,
    },
    theme: { primary: '#7c3aed', icon: 'Brain' },
  },

  // ──────────────────────────────────────────────
  // NUTRIÇÃO (Nutrition)
  // Demand: Tier 2 (high telemedicine) | Convênio: Medium-Low
  // ──────────────────────────────────────────────
  nutri: {
    slug: 'nutri',
    name: 'Gendei Nutri',
    tagline: 'Plataforma para nutricionistas e consultórios de nutrição',
    categoryId: 'nutricao',
    council: 'CRN',
    specialties: [
      'nutricao_clinica', 'nutricao_esportiva', 'nutricao_funcional',
      'nutricao_materno_infantil', 'nutricao_comportamental',
      'nutricao_oncologica',
    ],
    defaultServices: [
      { name: 'Consulta Nutricional', duration: 50, price: 0 },
      { name: 'Retorno Nutricional', duration: 30, price: 0 },
      { name: 'Avaliação Corporal (Bioimpedância)', duration: 40, price: 0 },
      { name: 'Plano Alimentar Personalizado', duration: 50, price: 0 },
    ],
    defaultDurationFirst: 50,
    defaultDurationFollowup: 30,
    defaultPriceRange: { min: 100, max: 300, typical: 180 },
    convenioAcceptance: 'low',
    appointmentPattern: 'consultation',
    recurringPattern: 'series',
    features: {
      showConvenio: false,
      showDeposit: false,
      showTelemedicine: true,
      showSpecialtyPicker: true,
      showProfessionalBio: true,
      showBeforeAfterPhotos: false,
      showTherapyApproach: false,
      showDietaryPlan: true,
      showProcedureList: false,
    },
    theme: { primary: '#16a34a', icon: 'Apple' },
  },

  // ──────────────────────────────────────────────
  // FISIOTERAPIA (Physiotherapy)
  // Demand: Tier 2 | Convênio: Medium
  // ──────────────────────────────────────────────
  fisio: {
    slug: 'fisio',
    name: 'Gendei Fisio',
    tagline: 'Plataforma para fisioterapeutas e clínicas de fisioterapia',
    categoryId: 'fisioterapia',
    council: 'CREFITO',
    specialties: [
      'fisioterapia_ortopedica', 'fisioterapia_neurologica',
      'fisioterapia_respiratoria', 'fisioterapia_esportiva',
      'pilates_clinico', 'fisioterapia_pelvica',
      'rpg', 'acupuntura_fisioterapia',
    ],
    defaultServices: [
      { name: 'Avaliação Fisioterapêutica', duration: 60, price: 0 },
      { name: 'Sessão de Fisioterapia', duration: 50, price: 0 },
      { name: 'Pilates Clínico', duration: 50, price: 0 },
      { name: 'RPG (Reeducação Postural)', duration: 50, price: 0 },
    ],
    defaultDurationFirst: 60,
    defaultDurationFollowup: 50,
    defaultPriceRange: { min: 100, max: 250, typical: 150 },
    convenioAcceptance: 'medium',
    appointmentPattern: 'session',
    recurringPattern: 'series',
    features: {
      showConvenio: true,
      showDeposit: false,
      showTelemedicine: false,
      showSpecialtyPicker: true,
      showProfessionalBio: true,
      showBeforeAfterPhotos: false,
      showTherapyApproach: false,
      showDietaryPlan: false,
      showProcedureList: false,
    },
    theme: { primary: '#ea580c', icon: 'Activity' },
  },

  // ──────────────────────────────────────────────
  // DERMATOLOGIA (Dermatology)
  // Demand: Tier 1 | Convênio: High (but premium derms are particular-only)
  // ──────────────────────────────────────────────
  dermato: {
    slug: 'dermato',
    name: 'Gendei Dermato',
    tagline: 'Plataforma para dermatologistas e clínicas de dermatologia',
    categoryId: 'dermatologia',
    council: 'CRM',
    specialties: [
      'dermatologia_clinica', 'dermatologia_estetica',
      'dermatologia_cirurgica', 'tricologia',
    ],
    defaultServices: [
      { name: 'Consulta Dermatológica', duration: 25, price: 0 },
      { name: 'Retorno', duration: 15, price: 0 },
      { name: 'Botox', duration: 30, price: 0 },
      { name: 'Preenchimento Facial', duration: 45, price: 0 },
      { name: 'Peeling Químico', duration: 30, price: 0 },
      { name: 'Limpeza de Pele', duration: 60, price: 0 },
    ],
    defaultDurationFirst: 25,
    defaultDurationFollowup: 15,
    defaultPriceRange: { min: 250, max: 800, typical: 400 },
    convenioAcceptance: 'high',
    appointmentPattern: 'consultation',
    recurringPattern: 'episodic',
    features: {
      showConvenio: true,
      showDeposit: true,
      showTelemedicine: true,
      showSpecialtyPicker: false,
      showProfessionalBio: true,
      showBeforeAfterPhotos: true,
      showTherapyApproach: false,
      showDietaryPlan: false,
      showProcedureList: true,
    },
    theme: { primary: '#ec4899', icon: 'Sparkles' },
  },

  // ──────────────────────────────────────────────
  // OFTALMOLOGIA (Ophthalmology)
  // Demand: Tier 1 | Convênio: Very High
  // ──────────────────────────────────────────────
  oftalmo: {
    slug: 'oftalmo',
    name: 'Gendei Oftalmo',
    tagline: 'Plataforma para oftalmologistas e clínicas de oftalmologia',
    categoryId: 'oftalmologia',
    council: 'CRM',
    specialties: [
      'oftalmologia_geral', 'retina', 'glaucoma',
      'catarata', 'cirurgia_refrativa', 'oftalmopediatria',
    ],
    defaultServices: [
      { name: 'Consulta Oftalmológica', duration: 30, price: 0 },
      { name: 'Exame de Vista', duration: 20, price: 0 },
      { name: 'Retorno', duration: 20, price: 0 },
      { name: 'Fundo de Olho', duration: 15, price: 0 },
      { name: 'Tonometria', duration: 15, price: 0 },
    ],
    defaultDurationFirst: 30,
    defaultDurationFollowup: 20,
    defaultPriceRange: { min: 200, max: 500, typical: 350 },
    convenioAcceptance: 'very_high',
    appointmentPattern: 'consultation',
    recurringPattern: 'episodic',
    features: {
      showConvenio: true,
      showDeposit: true,
      showTelemedicine: false,
      showSpecialtyPicker: false,
      showProfessionalBio: true,
      showBeforeAfterPhotos: false,
      showTherapyApproach: false,
      showDietaryPlan: false,
      showProcedureList: true,
    },
    theme: { primary: '#0d9488', icon: 'Eye' },
  },

  // ──────────────────────────────────────────────
  // PEDIATRIA (Pediatrics)
  // Demand: Tier 2 | Convênio: Very High
  // ──────────────────────────────────────────────
  pediatra: {
    slug: 'pediatra',
    name: 'Gendei Pediatra',
    tagline: 'Plataforma para pediatras e clínicas pediátricas',
    categoryId: 'pediatria',
    council: 'CRM',
    specialties: [
      'pediatria_geral', 'neonatologia', 'neuropediatria',
      'alergia_pediatrica', 'gastropediatria',
    ],
    defaultServices: [
      { name: 'Consulta Pediátrica', duration: 25, price: 0 },
      { name: 'Puericultura', duration: 30, price: 0 },
      { name: 'Retorno', duration: 15, price: 0 },
      { name: 'Consulta de Urgência', duration: 20, price: 0 },
    ],
    defaultDurationFirst: 25,
    defaultDurationFollowup: 15,
    defaultPriceRange: { min: 200, max: 400, typical: 280 },
    convenioAcceptance: 'very_high',
    appointmentPattern: 'consultation',
    recurringPattern: 'episodic',
    features: {
      showConvenio: true,
      showDeposit: false,
      showTelemedicine: true,
      showSpecialtyPicker: false,
      showProfessionalBio: true,
      showBeforeAfterPhotos: false,
      showTherapyApproach: false,
      showDietaryPlan: false,
      showProcedureList: false,
    },
    theme: { primary: '#f59e0b', icon: 'Baby' },
  },

  // ──────────────────────────────────────────────
  // FONOAUDIOLOGIA (Speech Therapy)
  // Demand: Tier 3 | Convênio: Medium
  // ──────────────────────────────────────────────
  fono: {
    slug: 'fono',
    name: 'Gendei Fono',
    tagline: 'Plataforma para fonoaudiólogos e clínicas de fonoaudiologia',
    categoryId: 'fonoaudiologia',
    council: 'CRFa',
    specialties: [
      'fonoaudiologia_clinica', 'audiologia', 'linguagem',
      'motricidade_orofacial', 'voz', 'disfagia',
    ],
    defaultServices: [
      { name: 'Avaliação Fonoaudiológica', duration: 50, price: 0 },
      { name: 'Sessão de Fonoterapia', duration: 40, price: 0 },
      { name: 'Exame Audiológico', duration: 30, price: 0 },
      { name: 'Terapia da Fala', duration: 40, price: 0 },
    ],
    defaultDurationFirst: 50,
    defaultDurationFollowup: 40,
    defaultPriceRange: { min: 120, max: 300, typical: 180 },
    convenioAcceptance: 'medium',
    appointmentPattern: 'session',
    recurringPattern: 'series',
    features: {
      showConvenio: true,
      showDeposit: false,
      showTelemedicine: true,
      showSpecialtyPicker: true,
      showProfessionalBio: true,
      showBeforeAfterPhotos: false,
      showTherapyApproach: false,
      showDietaryPlan: false,
      showProcedureList: false,
    },
    theme: { primary: '#8b5cf6', icon: 'Mic' },
  },

  // ──────────────────────────────────────────────
  // ESTÉTICA (Aesthetics)
  // Demand: Tier 2 | Convênio: Low (cosmetic = particular only)
  // ──────────────────────────────────────────────
  estetica: {
    slug: 'estetica',
    name: 'Gendei Estética',
    tagline: 'Plataforma para clínicas de estética e harmonização',
    categoryId: 'estetica',
    council: 'CRM',
    specialties: [
      'estetica', 'harmonizacao_facial', 'dermatologia_estetica',
      'cirurgia_plastica', 'medicina_estetica',
    ],
    defaultServices: [
      { name: 'Avaliação Estética', duration: 30, price: 0 },
      { name: 'Botox', duration: 30, price: 0 },
      { name: 'Preenchimento Facial', duration: 45, price: 0 },
      { name: 'Limpeza de Pele', duration: 60, price: 0 },
      { name: 'Peeling', duration: 45, price: 0 },
      { name: 'Drenagem Linfática', duration: 60, price: 0 },
    ],
    defaultDurationFirst: 30,
    defaultDurationFollowup: 30,
    defaultPriceRange: { min: 150, max: 800, typical: 350 },
    convenioAcceptance: 'low',
    appointmentPattern: 'procedure',
    recurringPattern: 'series',
    features: {
      showConvenio: false,
      showDeposit: true,
      showTelemedicine: false,
      showSpecialtyPicker: true,
      showProfessionalBio: true,
      showBeforeAfterPhotos: true,
      showTherapyApproach: false,
      showDietaryPlan: false,
      showProcedureList: true,
    },
    theme: { primary: '#e11d48', icon: 'Sparkles' },
  },

  // ──────────────────────────────────────────────
  // GERAL (Generic - app.gendei.app or no subdomain)
  // Fallback for clinics that don't fit a specific vertical
  // ──────────────────────────────────────────────
  geral: {
    slug: 'geral',
    name: 'Gendei',
    tagline: 'Plataforma de agendamento para clínicas e consultórios',
    categoryId: '',
    council: '',
    specialties: [], // Empty = show all specialties
    defaultServices: [
      { name: 'Consulta', duration: 30, price: 0 },
      { name: 'Retorno', duration: 20, price: 0 },
      { name: 'Avaliação', duration: 45, price: 0 },
    ],
    defaultDurationFirst: 30,
    defaultDurationFollowup: 20,
    defaultPriceRange: { min: 100, max: 500, typical: 250 },
    convenioAcceptance: 'high',
    appointmentPattern: 'consultation',
    recurringPattern: 'episodic',
    features: {
      showConvenio: true,
      showDeposit: true,
      showTelemedicine: true,
      showSpecialtyPicker: true,
      showProfessionalBio: true,
      showBeforeAfterPhotos: false,
      showTherapyApproach: false,
      showDietaryPlan: false,
      showProcedureList: false,
    },
    theme: { primary: '#2563eb', icon: 'Building2' },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get vertical config by slug. Falls back to 'geral' if not found. */
export function getVertical(slug: string | undefined | null): VerticalConfig {
  if (!slug) return VERTICALS.geral;
  return VERTICALS[slug as VerticalSlug] || VERTICALS.geral;
}

/** Get vertical slug from hostname (e.g., "nutri.gendei.app" → "nutri"). */
export function getVerticalFromHostname(hostname: string): VerticalSlug {
  // Extract subdomain: "nutri.gendei.app" → "nutri"
  const parts = hostname.split('.');

  // localhost or IP → geral
  if (hostname.includes('localhost') || hostname.match(/^\d/)) {
    // Allow ?vertical=xxx override in development
    return 'geral';
  }

  // "nutri.gendei.app" → parts = ["nutri", "gendei", "app"]
  // "app.gendei.app" → parts = ["app", "gendei", "app"]  (treat "app" as geral)
  // "gendei.app" → parts = ["gendei", "app"]  (no subdomain = geral)
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (subdomain in VERTICALS && subdomain !== 'geral') {
      return subdomain as VerticalSlug;
    }
  }

  return 'geral';
}

/** Get all vertical slugs (for admin/analytics filtering). */
export function getAllVerticalSlugs(): VerticalSlug[] {
  return Object.keys(VERTICALS) as VerticalSlug[];
}

/** Get all verticals as an array (for listings). */
export function getAllVerticals(): VerticalConfig[] {
  return Object.values(VERTICALS);
}

/** Get verticals suitable for display (excludes 'geral'). */
export function getDisplayVerticals(): VerticalConfig[] {
  return Object.values(VERTICALS).filter(v => v.slug !== 'geral');
}
