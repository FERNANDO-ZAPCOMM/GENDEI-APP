'use client';

import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
} from 'firebase/firestore';
import { getFirestoreDb } from './firebase';

// Types
export interface Clinic {
  id: string;
  name: string;
  ownerId: string;
  email?: string;
  phone?: string;
  address?: string;
  whatsappConnected?: boolean;
  whatsappPhoneNumberId?: string;
  depositPercentage?: number;
  plan?: string;
  status?: 'active' | 'suspended' | 'pending';
  createdAt: string;
  updatedAt?: string;
}

export interface Professional {
  id: string;
  clinicId: string;
  name: string;
  specialty?: string;
  email?: string;
  phone?: string;
  active: boolean;
  createdAt?: string;
}

export interface Patient {
  id: string;
  clinicId: string;
  name: string;
  phone: string;
  email?: string;
  createdAt?: string;
}

export interface Appointment {
  id: string;
  clinicId: string;
  clinicName?: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  professionalId: string;
  professionalName: string;
  serviceName?: string;
  date: string;
  time: string;
  duration: number;
  status: 'pending' | 'confirmed' | 'awaiting_confirmation' | 'confirmed_presence' | 'completed' | 'cancelled' | 'no_show';
  depositAmount?: number;
  depositPaid?: boolean;
  depositPaidAt?: string;
  createdAt: string;
}

export interface PlatformStats {
  totalClinics: number;
  activeClinics: number;
  totalAppointments: number;
  todayAppointments: number;
  weekAppointments: number;
  totalRevenue: number;
  pendingDeposits: number;
  whatsappConnectedCount: number;
  whatsappConnectedRate: number;
  noShowCount: number;
  noShowRate: number;
  totalProfessionals: number;
  totalPatients: number;
}

// Helper to convert Firestore timestamp
function toDateString(timestamp: any): string {
  if (!timestamp) return new Date().toISOString();
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toISOString();
  }
  return timestamp;
}

// Fetch all clinics
export async function fetchAllClinics(): Promise<Clinic[]> {
  const db = getFirestoreDb();
  const clinicsRef = collection(db, 'clinics');
  const q = query(clinicsRef, orderBy('createdAt', 'desc'), limit(100));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: toDateString(doc.data().createdAt),
    updatedAt: doc.data().updatedAt ? toDateString(doc.data().updatedAt) : undefined,
  })) as Clinic[];
}

// Fetch single clinic by ID
export async function fetchClinicById(clinicId: string): Promise<Clinic | null> {
  const db = getFirestoreDb();
  const clinicRef = doc(db, 'clinics', clinicId);
  const clinicDoc = await getDoc(clinicRef);

  if (!clinicDoc.exists()) return null;

  return {
    id: clinicDoc.id,
    ...clinicDoc.data(),
    createdAt: toDateString(clinicDoc.data().createdAt),
  } as Clinic;
}

// Fetch professionals for a clinic
export async function fetchClinicProfessionals(clinicId: string): Promise<Professional[]> {
  const db = getFirestoreDb();
  const professionalsRef = collection(db, 'clinics', clinicId, 'professionals');
  const snapshot = await getDocs(professionalsRef);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    clinicId,
    ...doc.data(),
  })) as Professional[];
}

// Fetch patients for a clinic
export async function fetchClinicPatients(clinicId: string): Promise<Patient[]> {
  const db = getFirestoreDb();
  const patientsRef = collection(db, 'clinics', clinicId, 'patients');
  const q = query(patientsRef, limit(50));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    clinicId,
    ...doc.data(),
  })) as Patient[];
}

// Fetch appointments for a clinic
export async function fetchClinicAppointments(clinicId: string, limitCount = 20): Promise<Appointment[]> {
  const db = getFirestoreDb();
  const appointmentsRef = collection(db, 'clinics', clinicId, 'appointments');
  const q = query(appointmentsRef, orderBy('createdAt', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    clinicId,
    ...doc.data(),
    createdAt: toDateString(doc.data().createdAt),
  })) as Appointment[];
}

// Fetch all appointments across all clinics
export async function fetchAllAppointments(limitCount = 50): Promise<Appointment[]> {
  const clinics = await fetchAllClinics();
  const allAppointments: Appointment[] = [];

  for (const clinic of clinics) {
    const appointments = await fetchClinicAppointments(clinic.id, 20);
    allAppointments.push(
      ...appointments.map(apt => ({
        ...apt,
        clinicName: clinic.name,
      }))
    );
  }

  // Sort by createdAt descending and limit
  return allAppointments
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limitCount);
}

// Calculate platform stats
export async function fetchPlatformStats(): Promise<PlatformStats> {
  const clinics = await fetchAllClinics();

  let totalAppointments = 0;
  let todayAppointments = 0;
  let weekAppointments = 0;
  let totalRevenue = 0;
  let pendingDeposits = 0;
  let noShowCount = 0;
  let totalProfessionals = 0;
  let totalPatients = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  for (const clinic of clinics) {
    // Fetch appointments
    const appointments = await fetchClinicAppointments(clinic.id, 100);
    totalAppointments += appointments.length;

    for (const apt of appointments) {
      if (apt.date === todayStr) todayAppointments++;
      if (apt.date >= weekAgoStr) weekAppointments++;
      if (apt.depositPaid && apt.depositAmount) {
        totalRevenue += apt.depositAmount;
      }
      if (!apt.depositPaid && apt.depositAmount) {
        pendingDeposits += apt.depositAmount;
      }
      if (apt.status === 'no_show') noShowCount++;
    }

    // Fetch professionals
    const professionals = await fetchClinicProfessionals(clinic.id);
    totalProfessionals += professionals.filter(p => p.active).length;

    // Fetch patients
    const patients = await fetchClinicPatients(clinic.id);
    totalPatients += patients.length;
  }

  const activeClinics = clinics.filter(c => c.status !== 'suspended').length;
  const whatsappConnectedCount = clinics.filter(c => c.whatsappConnected).length;

  return {
    totalClinics: clinics.length,
    activeClinics,
    totalAppointments,
    todayAppointments,
    weekAppointments,
    totalRevenue,
    pendingDeposits,
    whatsappConnectedCount,
    whatsappConnectedRate: clinics.length > 0 ? (whatsappConnectedCount / clinics.length) * 100 : 0,
    noShowCount,
    noShowRate: totalAppointments > 0 ? (noShowCount / totalAppointments) * 100 : 0,
    totalProfessionals,
    totalPatients,
  };
}
