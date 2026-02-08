// Gendei Clinic Types

import type { VerticalSlug } from './verticals';

// Workflow mode determines how the WhatsApp bot behaves
export type WorkflowMode = 'booking' | 'info';

// Structured address data for Google Maps integration and WhatsApp location messages
export interface ClinicAddress {
  formatted: string;        // Full formatted address string
  street?: string;          // Street name and number
  neighborhood?: string;    // Bairro
  city?: string;            // City
  state?: string;           // State abbreviation (SP, RJ, etc)
  postalCode?: string;      // CEP
  country?: string;         // Country
  latitude?: number;        // For WhatsApp location messages
  longitude?: number;       // For WhatsApp location messages
  placeId?: string;         // Google Place ID for reference
}

export interface Clinic {
  id: string;
  name: string;
  ownerId: string;
  adminIds?: string[];
  vertical?: VerticalSlug;           // Vertical this clinic belongs to (med, dental, psi, etc)
  category?: string;                // Clinic category (clinica_medica, odontologia, etc)
  address?: string;                 // Legacy: simple address string
  addressData?: ClinicAddress;      // New: structured address with coordinates
  phone?: string;
  email?: string;
  openingHours?: string;
  timezone?: string;
  whatsappConnected?: boolean;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  depositPercentage?: number; // 0-100, percentage required as deposit
  workflowMode?: WorkflowMode;      // WhatsApp bot behavior mode
  workflowWelcomeMessage?: string;
  workflowCta?: string;
  workflowFaqs?: Array<{ question: string; answer: string }>;
  paymentSettings?: PaymentSettings; // Payment settings including convenio, particular, etc.
  createdAt?: string;
  updatedAt?: string;
}

export interface Professional {
  id: string;
  clinicId: string;
  name: string;
  specialty?: string; // Deprecated: use specialties instead (kept for backward compatibility)
  specialties?: string[]; // Array of specialty IDs (e.g., ['clinico_geral', 'pediatria'])
  email?: string;
  phone?: string;
  photoUrl?: string;
  bio?: string; // Brief description/summary about the professional
  active: boolean;
  workingHours?: WorkingHoursBackend;
  appointmentDuration?: number; // Default duration in minutes
  consultationPrice?: number; // Consultation price in BRL (R$)
  createdAt?: string;
  updatedAt?: string;
}

// Legacy format with day names (frontend display)
export interface WorkingHours {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

// Backend format: numeric keys where 0=Monday, 1=Tuesday, ..., 6=Sunday
// Format: { "0": [{ "start": "09:00", "end": "18:00" }], ... }
export interface WorkingHoursBackend {
  [day: string]: Array<{ start: string; end: string }>;
}

export interface DaySchedule {
  start: string; // HH:MM format
  end: string;   // HH:MM format
  breakStart?: string;
  breakEnd?: string;
}

export interface Service {
  id: string;
  clinicId: string;
  name: string;
  description?: string;
  duration: number; // Duration in minutes
  price: number;
  active: boolean;
  modality?: 'presencial' | 'online' | 'ambos'; // Service modality
  professionalIds?: string[]; // Professionals who can perform this service
  requiresDeposit?: boolean;
  depositAmount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Patient {
  id: string;
  clinicId: string;
  name: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  notes?: string;
  tags?: string[];
  totalAppointments?: number;
  lastAppointmentAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'awaiting_confirmation'
  | 'confirmed_presence'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Appointment {
  id: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  professionalId: string;
  professionalName: string;
  serviceId?: string;
  serviceName?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  duration: number;
  status: AppointmentStatus;
  paymentType?: 'particular' | 'convenio' | string;
  totalCents?: number;
  signalCents?: number;
  signalPaid?: boolean;
  signalPaidAt?: string;
  signalPaymentId?: string;
  cancellationReason?: string;
  notes?: string;
  depositAmount?: number;
  depositPaid?: boolean;
  depositPaidAt?: string;
  reminder24hSent?: boolean;
  reminder24hAt?: string;
  reminder2hSent?: boolean;
  reminder2hAt?: string;
  createdAt?: string | Date | Record<string, unknown>;
  updatedAt?: string | Date | Record<string, unknown>;
}

export interface TimeSlot {
  time: string;
  available: boolean;
  appointmentId?: string;
}

export interface DayAvailability {
  date: string;
  slots: TimeSlot[];
}

// Dashboard stats
export interface ClinicStats {
  todayAppointments: number;
  weekAppointments: number;
  totalPatients: number;
  newPatientsThisMonth: number;
  confirmedToday: number;
  pendingToday: number;
}

// Payment settings for the clinic
export interface PaymentSettings {
  acceptsConvenio: boolean;         // Accepts health insurance
  convenioList: string[];           // List of accepted convenios
  acceptsParticular: boolean;       // Accepts private payment
  requiresDeposit: boolean;         // Requires deposit for appointments
  depositPercentage: number;        // 0-100, percentage required
  pixKey?: string;                  // PIX key for payments
  pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
}

// Extended clinic with payment settings
export interface ClinicWithPayment extends Clinic {
  paymentSettings?: PaymentSettings;
}

export interface PaymentTransaction {
  id: string;
  clinicId: string;
  appointmentId?: string;
  patientPhone?: string;
  patientName?: string;
  amountCents: number;
  paymentStatus: string;
  paymentMethod: 'card' | 'pix' | string;
  paymentSource: string;
  transferMode: 'automatic' | 'manual' | string;
  paymentId?: string;
  createdAt?: string | Date | Record<string, unknown>;
  updatedAt?: string | Date | Record<string, unknown>;
  paidAt?: string | Date | Record<string, unknown>;
}
