// Clinic Categories for Gendei Platform
// Each category maps to relevant professional specialties

export interface ClinicCategory {
  id: string;
  name: string;
  description: string;
  specialties: string[]; // IDs from specialties.ts
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
  },
  {
    id: 'odontologia',
    name: 'Consultório Odontológico',
    description: 'Clínicas e consultórios de odontologia',
    specialties: ['odontologia_geral', 'ortodontia', 'implantodontia', 'endodontia'],
  },
  {
    id: 'estetica',
    name: 'Clínica de Estética',
    description: 'Tratamentos estéticos faciais e corporais',
    specialties: ['estetica', 'dermatologia'],
  },
  {
    id: 'fisioterapia',
    name: 'Clínica de Fisioterapia',
    description: 'Reabilitação física e tratamentos musculares',
    specialties: ['fisioterapia'],
  },
  {
    id: 'psicologia',
    name: 'Clínica de Psicologia',
    description: 'Atendimento psicológico e psicoterapia',
    specialties: ['psicologia', 'psiquiatria'],
  },
  {
    id: 'nutricao',
    name: 'Consultório de Nutrição',
    description: 'Acompanhamento nutricional e dietas',
    specialties: ['nutricao'],
  },
  {
    id: 'oftalmologia',
    name: 'Clínica de Oftalmologia',
    description: 'Exames e tratamentos oculares',
    specialties: ['oftalmologia'],
  },
  {
    id: 'outro',
    name: 'Outro Tipo',
    description: 'Tipo de estabelecimento não listado',
    specialties: [], // Empty means all specialties are available
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
