// Clinic Categories for Gendei Platform
// MVP: Top 10 clinic types for Brazilian healthcare

export interface ClinicCategory {
  id: string;
  name: string;
  description: string;
}

export const clinicCategories: ClinicCategory[] = [
  {
    id: 'clinica_medica',
    name: 'Clínica Médica',
    description: 'Consultórios e clínicas com atendimento médico geral',
  },
  {
    id: 'consultorio_odontologico',
    name: 'Consultório Odontológico',
    description: 'Clínicas e consultórios de odontologia',
  },
  {
    id: 'clinica_estetica',
    name: 'Clínica de Estética',
    description: 'Tratamentos estéticos faciais e corporais',
  },
  {
    id: 'fisioterapia',
    name: 'Clínica de Fisioterapia',
    description: 'Reabilitação física e tratamentos musculares',
  },
  {
    id: 'psicologia',
    name: 'Clínica de Psicologia',
    description: 'Atendimento psicológico e psicoterapia',
  },
  {
    id: 'nutricao',
    name: 'Consultório de Nutrição',
    description: 'Acompanhamento nutricional e dietas',
  },
  {
    id: 'oftalmologia',
    name: 'Clínica de Oftalmologia',
    description: 'Exames e tratamentos oculares',
  },
  {
    id: 'laboratorio',
    name: 'Laboratório de Análises',
    description: 'Exames laboratoriais e análises clínicas',
  },
  {
    id: 'clinica_imagem',
    name: 'Clínica de Imagem',
    description: 'Raio-X, ultrassom, tomografia e ressonância',
  },
  {
    id: 'outro',
    name: 'Outro Tipo',
    description: 'Tipo de estabelecimento não listado',
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
