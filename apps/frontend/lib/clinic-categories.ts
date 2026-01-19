// Clinic Categories for Gendei Platform
// MVP: 5 core categories covering most common clinic types

export interface ServiceTemplate {
  name: string;
  duration: number; // minutes
  price: number; // suggested price in BRL (0 = user sets)
}

export interface ClinicCategory {
  id: string;
  name: string;
  description: string;
  specialties: string[]; // IDs from specialties.ts
  suggestedServices: ServiceTemplate[]; // Pre-filled service suggestions
}

export const clinicCategories: ClinicCategory[] = [
  {
    id: 'clinica_medica',
    name: 'Clínica Médica',
    description: 'Consultórios e clínicas com atendimento médico',
    specialties: [
      'clinico_geral',
      'pediatria',
      'ginecologia',
      'cardiologia',
      'dermatologia',
      'ortopedia',
      'neurologia',
      'psiquiatria',
      'endocrinologia',
      'gastroenterologia',
    ],
    suggestedServices: [
      { name: 'Consulta Médica', duration: 30, price: 0 },
      { name: 'Retorno', duration: 20, price: 0 },
      { name: 'Check-up Geral', duration: 60, price: 0 },
      { name: 'Consulta de Emergência', duration: 30, price: 0 },
    ],
  },
  {
    id: 'odontologia',
    name: 'Consultório Odontológico',
    description: 'Clínicas e consultórios de odontologia',
    specialties: ['odontologia_geral', 'ortodontia', 'implantodontia', 'endodontia'],
    suggestedServices: [
      { name: 'Avaliação Odontológica', duration: 30, price: 0 },
      { name: 'Limpeza Dental', duration: 45, price: 0 },
      { name: 'Clareamento Dental', duration: 60, price: 0 },
      { name: 'Restauração', duration: 45, price: 0 },
      { name: 'Extração', duration: 30, price: 0 },
    ],
  },
  {
    id: 'estetica',
    name: 'Clínica de Estética',
    description: 'Tratamentos estéticos faciais e corporais',
    specialties: ['estetica', 'dermatologia'],
    suggestedServices: [
      { name: 'Avaliação Estética', duration: 30, price: 0 },
      { name: 'Limpeza de Pele', duration: 60, price: 0 },
      { name: 'Botox', duration: 30, price: 0 },
      { name: 'Preenchimento Facial', duration: 45, price: 0 },
      { name: 'Peeling', duration: 45, price: 0 },
    ],
  },
  {
    id: 'psicologia',
    name: 'Clínica de Psicologia',
    description: 'Atendimento psicológico e psicoterapia',
    specialties: ['psicologia', 'psiquiatria'],
    suggestedServices: [
      { name: 'Sessão de Psicoterapia', duration: 50, price: 0 },
      { name: 'Avaliação Psicológica', duration: 60, price: 0 },
      { name: 'Terapia de Casal', duration: 60, price: 0 },
      { name: 'Orientação Vocacional', duration: 50, price: 0 },
    ],
  },
  {
    id: 'outro',
    name: 'Outro Tipo',
    description: 'Fisioterapia, nutrição, oftalmologia e outros',
    specialties: [], // Empty means all specialties are available
    suggestedServices: [
      { name: 'Consulta', duration: 30, price: 0 },
      { name: 'Avaliação', duration: 45, price: 0 },
      { name: 'Retorno', duration: 20, price: 0 },
    ],
  },
];

// Helper function to get category by id
export function getCategoryById(id: string): ClinicCategory | undefined {
  return clinicCategories.find((c) => c.id === id);
}

// Helper function to get category name by id
export function getCategoryName(id: string): string {
  const category = getCategoryById(id);
  return category?.name || id;
}

// Get suggested services for a clinic category
export function getSuggestedServices(categoryId: string): ServiceTemplate[] {
  const category = getCategoryById(categoryId);
  return category?.suggestedServices || [];
}

// Get all specialty IDs for given clinic categories
export function getSpecialtiesForCategories(categoryIds: string[]): string[] {
  if (!categoryIds || categoryIds.length === 0) {
    return []; // Return empty, will show all specialties
  }

  // If "outro" is selected, return empty (show all)
  if (categoryIds.includes('outro')) {
    return [];
  }

  const specialtySet = new Set<string>();

  categoryIds.forEach((catId) => {
    const category = getCategoryById(catId);
    if (category) {
      category.specialties.forEach((s) => specialtySet.add(s));
    }
  });

  return Array.from(specialtySet);
}
