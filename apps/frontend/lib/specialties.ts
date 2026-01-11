// Professional Specialties for Gendei Clinic Platform
// Organized by clinic category type

export interface Specialty {
  id: string;
  name: string;
  description: string;
}

export const specialties: Specialty[] = [
  // === MEDICINA ===
  {
    id: 'clinico_geral',
    name: 'Clínico Geral',
    description: 'Atendimento médico geral e preventivo para adultos',
  },
  {
    id: 'pediatria',
    name: 'Pediatria',
    description: 'Cuidados médicos para bebês, crianças e adolescentes',
  },
  {
    id: 'ginecologia',
    name: 'Ginecologia e Obstetrícia',
    description: 'Saúde da mulher, pré-natal e acompanhamento gestacional',
  },
  {
    id: 'cardiologia',
    name: 'Cardiologia',
    description: 'Diagnóstico e tratamento de doenças do coração',
  },
  {
    id: 'dermatologia',
    name: 'Dermatologia',
    description: 'Tratamento de doenças da pele, cabelos e unhas',
  },
  {
    id: 'ortopedia',
    name: 'Ortopedia',
    description: 'Tratamento de ossos, músculos, articulações e ligamentos',
  },
  {
    id: 'neurologia',
    name: 'Neurologia',
    description: 'Diagnóstico e tratamento de doenças do sistema nervoso',
  },
  {
    id: 'psiquiatria',
    name: 'Psiquiatria',
    description: 'Tratamento de transtornos mentais e emocionais',
  },
  {
    id: 'endocrinologia',
    name: 'Endocrinologia',
    description: 'Tratamento de diabetes, tireoide e hormônios',
  },
  {
    id: 'gastroenterologia',
    name: 'Gastroenterologia',
    description: 'Tratamento do sistema digestivo',
  },

  // === ODONTOLOGIA ===
  {
    id: 'odontologia_geral',
    name: 'Odontologia Geral',
    description: 'Atendimento odontológico geral e preventivo',
  },
  {
    id: 'ortodontia',
    name: 'Ortodontia',
    description: 'Correção de dentes e arcadas dentárias',
  },
  {
    id: 'implantodontia',
    name: 'Implantodontia',
    description: 'Implantes dentários e próteses',
  },
  {
    id: 'endodontia',
    name: 'Endodontia',
    description: 'Tratamento de canal e polpa dentária',
  },

  // === SAÚDE MENTAL ===
  {
    id: 'psicologia',
    name: 'Psicologia',
    description: 'Atendimento psicológico e psicoterapia',
  },

  // === OUTRAS ÁREAS ===
  {
    id: 'fisioterapia',
    name: 'Fisioterapia',
    description: 'Reabilitação física e tratamentos musculares',
  },
  {
    id: 'nutricao',
    name: 'Nutrição',
    description: 'Acompanhamento nutricional e planejamento alimentar',
  },
  {
    id: 'oftalmologia',
    name: 'Oftalmologia',
    description: 'Exames e tratamentos de doenças oculares',
  },
  {
    id: 'estetica',
    name: 'Estética',
    description: 'Tratamentos estéticos faciais e corporais',
  },

  // === CATCH-ALL ===
  {
    id: 'outro',
    name: 'Outra Especialidade',
    description: 'Especialidade não listada',
  },
];

// Helper function to get specialty by id
export function getSpecialtyById(id: string): Specialty | undefined {
  return specialties.find((s) => s.id === id);
}

// Helper function to get specialty name by id
export function getSpecialtyName(id: string): string {
  const specialty = getSpecialtyById(id);
  return specialty?.name || id;
}

// Filter specialties by allowed IDs (for clinic category filtering)
export function filterSpecialties(allowedIds: string[]): Specialty[] {
  // If no filter, return all specialties
  if (!allowedIds || allowedIds.length === 0) {
    return specialties;
  }

  // Always include "outro" option
  return specialties.filter((s) => allowedIds.includes(s.id) || s.id === 'outro');
}
