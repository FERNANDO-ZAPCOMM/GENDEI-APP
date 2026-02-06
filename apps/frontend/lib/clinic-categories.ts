// Clinic Categories for Gendei Platform
// Maps to verticals - each vertical has a corresponding category

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
      'clinico_geral', 'pediatria', 'ginecologia', 'cardiologia',
      'dermatologia', 'ortopedia', 'neurologia', 'psiquiatria',
      'endocrinologia', 'gastroenterologia', 'urologia',
      'otorrinolaringologia', 'reumatologia', 'pneumologia',
      'nefrologia', 'geriatria', 'mastologia', 'proctologia',
      'angiologia', 'infectologia', 'hematologia',
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
    specialties: [
      'odontologia_geral', 'ortodontia', 'implantodontia', 'endodontia',
      'periodontia', 'odontopediatria', 'protese_dentaria',
      'cirurgia_bucomaxilofacial', 'dentistica', 'harmonizacao_orofacial',
    ],
    suggestedServices: [
      { name: 'Avaliação Odontológica', duration: 30, price: 0 },
      { name: 'Limpeza Dental (Profilaxia)', duration: 45, price: 0 },
      { name: 'Restauração', duration: 45, price: 0 },
      { name: 'Clareamento Dental', duration: 60, price: 0 },
      { name: 'Extração', duration: 30, price: 0 },
    ],
  },
  {
    id: 'psicologia',
    name: 'Clínica de Psicologia',
    description: 'Atendimento psicológico e psicoterapia',
    specialties: [
      'psicologia', 'neuropsicologia', 'psicanalise',
      'terapia_cognitivo_comportamental', 'psicologia_infantil',
      'terapia_de_casal', 'psicopedagogia',
    ],
    suggestedServices: [
      { name: 'Sessão de Psicoterapia', duration: 50, price: 0 },
      { name: 'Avaliação Psicológica', duration: 60, price: 0 },
      { name: 'Terapia de Casal', duration: 60, price: 0 },
      { name: 'Terapia Infantil', duration: 50, price: 0 },
      { name: 'Orientação Vocacional', duration: 50, price: 0 },
    ],
  },
  {
    id: 'nutricao',
    name: 'Consultório de Nutrição',
    description: 'Atendimento nutricional e planejamento alimentar',
    specialties: [
      'nutricao_clinica', 'nutricao_esportiva', 'nutricao_funcional',
      'nutricao_materno_infantil', 'nutricao_comportamental',
      'nutricao_oncologica',
    ],
    suggestedServices: [
      { name: 'Consulta Nutricional', duration: 50, price: 0 },
      { name: 'Retorno Nutricional', duration: 30, price: 0 },
      { name: 'Avaliação Corporal (Bioimpedância)', duration: 40, price: 0 },
      { name: 'Plano Alimentar Personalizado', duration: 50, price: 0 },
    ],
  },
  {
    id: 'fisioterapia',
    name: 'Clínica de Fisioterapia',
    description: 'Reabilitação física e tratamentos musculoesqueléticos',
    specialties: [
      'fisioterapia_ortopedica', 'fisioterapia_neurologica',
      'fisioterapia_respiratoria', 'fisioterapia_esportiva',
      'pilates_clinico', 'fisioterapia_pelvica',
      'rpg', 'acupuntura_fisioterapia',
    ],
    suggestedServices: [
      { name: 'Avaliação Fisioterapêutica', duration: 60, price: 0 },
      { name: 'Sessão de Fisioterapia', duration: 50, price: 0 },
      { name: 'Pilates Clínico', duration: 50, price: 0 },
      { name: 'RPG (Reeducação Postural)', duration: 50, price: 0 },
    ],
  },
  {
    id: 'dermatologia',
    name: 'Clínica de Dermatologia',
    description: 'Dermatologia clínica e estética',
    specialties: [
      'dermatologia_clinica', 'dermatologia_estetica',
      'dermatologia_cirurgica', 'tricologia',
    ],
    suggestedServices: [
      { name: 'Consulta Dermatológica', duration: 25, price: 0 },
      { name: 'Retorno', duration: 15, price: 0 },
      { name: 'Botox', duration: 30, price: 0 },
      { name: 'Preenchimento Facial', duration: 45, price: 0 },
      { name: 'Peeling Químico', duration: 30, price: 0 },
      { name: 'Limpeza de Pele', duration: 60, price: 0 },
    ],
  },
  {
    id: 'oftalmologia',
    name: 'Clínica de Oftalmologia',
    description: 'Exames e tratamentos de doenças oculares',
    specialties: [
      'oftalmologia_geral', 'retina', 'glaucoma',
      'catarata', 'cirurgia_refrativa', 'oftalmopediatria',
    ],
    suggestedServices: [
      { name: 'Consulta Oftalmológica', duration: 30, price: 0 },
      { name: 'Exame de Vista', duration: 20, price: 0 },
      { name: 'Retorno', duration: 20, price: 0 },
      { name: 'Fundo de Olho', duration: 15, price: 0 },
    ],
  },
  {
    id: 'pediatria',
    name: 'Clínica Pediátrica',
    description: 'Cuidados médicos para bebês, crianças e adolescentes',
    specialties: [
      'pediatria_geral', 'neonatologia', 'neuropediatria',
      'alergia_pediatrica', 'gastropediatria',
    ],
    suggestedServices: [
      { name: 'Consulta Pediátrica', duration: 25, price: 0 },
      { name: 'Puericultura', duration: 30, price: 0 },
      { name: 'Retorno', duration: 15, price: 0 },
      { name: 'Consulta de Urgência', duration: 20, price: 0 },
    ],
  },
  {
    id: 'fonoaudiologia',
    name: 'Clínica de Fonoaudiologia',
    description: 'Atendimento fonoaudiológico e audiologia',
    specialties: [
      'fonoaudiologia_clinica', 'audiologia', 'linguagem',
      'motricidade_orofacial', 'voz', 'disfagia',
    ],
    suggestedServices: [
      { name: 'Avaliação Fonoaudiológica', duration: 50, price: 0 },
      { name: 'Sessão de Fonoterapia', duration: 40, price: 0 },
      { name: 'Exame Audiológico', duration: 30, price: 0 },
      { name: 'Terapia da Fala', duration: 40, price: 0 },
    ],
  },
  {
    id: 'estetica',
    name: 'Clínica de Estética',
    description: 'Tratamentos estéticos faciais e corporais',
    specialties: [
      'estetica', 'harmonizacao_facial', 'dermatologia_estetica',
      'cirurgia_plastica', 'medicina_estetica',
    ],
    suggestedServices: [
      { name: 'Avaliação Estética', duration: 30, price: 0 },
      { name: 'Botox', duration: 30, price: 0 },
      { name: 'Preenchimento Facial', duration: 45, price: 0 },
      { name: 'Limpeza de Pele', duration: 60, price: 0 },
      { name: 'Peeling', duration: 45, price: 0 },
      { name: 'Drenagem Linfática', duration: 60, price: 0 },
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

  const specialtySet = new Set<string>();

  categoryIds.forEach((catId) => {
    const category = getCategoryById(catId);
    if (category) {
      category.specialties.forEach((s) => specialtySet.add(s));
    }
  });

  return Array.from(specialtySet);
}
