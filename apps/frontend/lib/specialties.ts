// Medical Specialties for Gendei Clinic Platform
// MVP: Top 10 medical specialties for Brazilian healthcare clinics

export interface Specialty {
  id: string;
  name: string;
  description: string;
}

export const specialties: Specialty[] = [
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
