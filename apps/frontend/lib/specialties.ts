// Medical Specialties for Gendei Clinic Platform
// Comprehensive list for Brazilian healthcare clinics

export interface Specialty {
  id: string;
  name: string;
  description: string;
  category: SpecialtyCategory;
}

export type SpecialtyCategory =
  | 'medical'
  | 'dental'
  | 'therapy'
  | 'aesthetics'
  | 'nutrition'
  | 'veterinary'
  | 'other';

export const specialtyCategories: Record<SpecialtyCategory, string> = {
  medical: 'Medicina',
  dental: 'Odontologia',
  therapy: 'Terapias',
  aesthetics: 'Estética',
  nutrition: 'Nutrição',
  veterinary: 'Veterinária',
  other: 'Outros',
};

export const specialties: Specialty[] = [
  // MEDICAL SPECIALTIES
  {
    id: 'clinico_geral',
    name: 'Clínico Geral',
    description: 'Atendimento médico geral e preventivo para adultos',
    category: 'medical',
  },
  {
    id: 'pediatria',
    name: 'Pediatria',
    description: 'Cuidados médicos para bebês, crianças e adolescentes',
    category: 'medical',
  },
  {
    id: 'ginecologia',
    name: 'Ginecologia e Obstetrícia',
    description: 'Saúde da mulher, pré-natal e acompanhamento gestacional',
    category: 'medical',
  },
  {
    id: 'cardiologia',
    name: 'Cardiologia',
    description: 'Diagnóstico e tratamento de doenças do coração',
    category: 'medical',
  },
  {
    id: 'dermatologia',
    name: 'Dermatologia',
    description: 'Tratamento de doenças da pele, cabelos e unhas',
    category: 'medical',
  },
  {
    id: 'ortopedia',
    name: 'Ortopedia',
    description: 'Tratamento de ossos, músculos, articulações e ligamentos',
    category: 'medical',
  },
  {
    id: 'oftalmologia',
    name: 'Oftalmologia',
    description: 'Cuidados com a visão e saúde dos olhos',
    category: 'medical',
  },
  {
    id: 'otorrinolaringologia',
    name: 'Otorrinolaringologia',
    description: 'Tratamento de ouvido, nariz e garganta',
    category: 'medical',
  },
  {
    id: 'neurologia',
    name: 'Neurologia',
    description: 'Diagnóstico e tratamento de doenças do sistema nervoso',
    category: 'medical',
  },
  {
    id: 'psiquiatria',
    name: 'Psiquiatria',
    description: 'Tratamento de transtornos mentais e emocionais',
    category: 'medical',
  },
  {
    id: 'endocrinologia',
    name: 'Endocrinologia',
    description: 'Tratamento de diabetes, tireoide e hormônios',
    category: 'medical',
  },
  {
    id: 'gastroenterologia',
    name: 'Gastroenterologia',
    description: 'Tratamento do sistema digestivo',
    category: 'medical',
  },
  {
    id: 'urologia',
    name: 'Urologia',
    description: 'Saúde do sistema urinário e reprodutor masculino',
    category: 'medical',
  },
  {
    id: 'pneumologia',
    name: 'Pneumologia',
    description: 'Tratamento de doenças respiratórias e pulmonares',
    category: 'medical',
  },
  {
    id: 'reumatologia',
    name: 'Reumatologia',
    description: 'Tratamento de artrite, lupus e doenças autoimunes',
    category: 'medical',
  },
  {
    id: 'geriatria',
    name: 'Geriatria',
    description: 'Cuidados médicos para idosos',
    category: 'medical',
  },
  {
    id: 'medicina_esportiva',
    name: 'Medicina Esportiva',
    description: 'Prevenção e tratamento de lesões em atletas',
    category: 'medical',
  },
  {
    id: 'angiologia',
    name: 'Angiologia',
    description: 'Tratamento de veias e artérias',
    category: 'medical',
  },
  {
    id: 'mastologia',
    name: 'Mastologia',
    description: 'Saúde das mamas e prevenção do câncer de mama',
    category: 'medical',
  },
  {
    id: 'proctologia',
    name: 'Proctologia',
    description: 'Tratamento de doenças do intestino grosso e reto',
    category: 'medical',
  },
  {
    id: 'alergologia',
    name: 'Alergologia e Imunologia',
    description: 'Tratamento de alergias e doenças imunológicas',
    category: 'medical',
  },
  {
    id: 'infectologia',
    name: 'Infectologia',
    description: 'Tratamento de doenças infecciosas',
    category: 'medical',
  },
  {
    id: 'nefrologia',
    name: 'Nefrologia',
    description: 'Tratamento de doenças dos rins',
    category: 'medical',
  },
  {
    id: 'hematologia',
    name: 'Hematologia',
    description: 'Tratamento de doenças do sangue',
    category: 'medical',
  },
  {
    id: 'oncologia',
    name: 'Oncologia',
    description: 'Diagnóstico e tratamento do câncer',
    category: 'medical',
  },
  {
    id: 'medicina_do_trabalho',
    name: 'Medicina do Trabalho',
    description: 'Saúde ocupacional e exames admissionais',
    category: 'medical',
  },
  {
    id: 'nutrologia',
    name: 'Nutrologia',
    description: 'Diagnóstico e tratamento de distúrbios nutricionais',
    category: 'medical',
  },
  {
    id: 'acupuntura',
    name: 'Acupuntura',
    description: 'Tratamento com técnicas da medicina tradicional chinesa',
    category: 'medical',
  },
  {
    id: 'homeopatia',
    name: 'Homeopatia',
    description: 'Tratamento com medicamentos homeopáticos',
    category: 'medical',
  },

  // DENTAL SPECIALTIES
  {
    id: 'odontologia_geral',
    name: 'Odontologia Geral',
    description: 'Tratamentos dentários gerais e preventivos',
    category: 'dental',
  },
  {
    id: 'ortodontia',
    name: 'Ortodontia',
    description: 'Correção de dentes e arcadas com aparelhos',
    category: 'dental',
  },
  {
    id: 'implantodontia',
    name: 'Implantodontia',
    description: 'Implantes dentários e próteses sobre implante',
    category: 'dental',
  },
  {
    id: 'endodontia',
    name: 'Endodontia',
    description: 'Tratamento de canal e doenças da polpa dentária',
    category: 'dental',
  },
  {
    id: 'periodontia',
    name: 'Periodontia',
    description: 'Tratamento de gengivas e estruturas de suporte dos dentes',
    category: 'dental',
  },
  {
    id: 'odontopediatria',
    name: 'Odontopediatria',
    description: 'Odontologia especializada em crianças',
    category: 'dental',
  },
  {
    id: 'protese_dentaria',
    name: 'Prótese Dentária',
    description: 'Confecção de próteses fixas e removíveis',
    category: 'dental',
  },
  {
    id: 'cirurgia_bucomaxilofacial',
    name: 'Cirurgia Bucomaxilofacial',
    description: 'Cirurgias de boca, face e maxilares',
    category: 'dental',
  },
  {
    id: 'estetica_dental',
    name: 'Estética Dental',
    description: 'Clareamento, facetas e procedimentos estéticos',
    category: 'dental',
  },
  {
    id: 'harmonizacao_orofacial',
    name: 'Harmonização Orofacial',
    description: 'Procedimentos estéticos faciais por dentistas',
    category: 'dental',
  },

  // THERAPY SPECIALTIES
  {
    id: 'psicologia',
    name: 'Psicologia',
    description: 'Psicoterapia e acompanhamento psicológico',
    category: 'therapy',
  },
  {
    id: 'fisioterapia',
    name: 'Fisioterapia',
    description: 'Reabilitação física e tratamento de lesões',
    category: 'therapy',
  },
  {
    id: 'fonoaudiologia',
    name: 'Fonoaudiologia',
    description: 'Tratamento de fala, voz e audição',
    category: 'therapy',
  },
  {
    id: 'terapia_ocupacional',
    name: 'Terapia Ocupacional',
    description: 'Reabilitação para atividades do dia a dia',
    category: 'therapy',
  },
  {
    id: 'psicopedagogia',
    name: 'Psicopedagogia',
    description: 'Tratamento de dificuldades de aprendizagem',
    category: 'therapy',
  },
  {
    id: 'neuropsicologia',
    name: 'Neuropsicologia',
    description: 'Avaliação e reabilitação cognitiva',
    category: 'therapy',
  },
  {
    id: 'quiropraxia',
    name: 'Quiropraxia',
    description: 'Tratamento da coluna e sistema musculoesquelético',
    category: 'therapy',
  },
  {
    id: 'osteopatia',
    name: 'Osteopatia',
    description: 'Terapia manual para dores e disfunções',
    category: 'therapy',
  },
  {
    id: 'pilates',
    name: 'Pilates',
    description: 'Exercícios para fortalecimento e flexibilidade',
    category: 'therapy',
  },
  {
    id: 'rpg',
    name: 'RPG - Reeducação Postural Global',
    description: 'Correção postural e alívio de dores',
    category: 'therapy',
  },

  // AESTHETICS SPECIALTIES
  {
    id: 'estetica_facial',
    name: 'Estética Facial',
    description: 'Tratamentos faciais, limpeza de pele e rejuvenescimento',
    category: 'aesthetics',
  },
  {
    id: 'estetica_corporal',
    name: 'Estética Corporal',
    description: 'Tratamentos para celulite, gordura localizada e flacidez',
    category: 'aesthetics',
  },
  {
    id: 'biomedicina_estetica',
    name: 'Biomedicina Estética',
    description: 'Procedimentos estéticos avançados',
    category: 'aesthetics',
  },
  {
    id: 'harmonizacao_facial',
    name: 'Harmonização Facial',
    description: 'Botox, preenchimento e procedimentos injetáveis',
    category: 'aesthetics',
  },
  {
    id: 'depilacao_laser',
    name: 'Depilação a Laser',
    description: 'Remoção definitiva de pelos',
    category: 'aesthetics',
  },
  {
    id: 'micropigmentacao',
    name: 'Micropigmentação',
    description: 'Sobrancelhas, lábios e olhos',
    category: 'aesthetics',
  },
  {
    id: 'massoterapia',
    name: 'Massoterapia',
    description: 'Massagens terapêuticas e relaxantes',
    category: 'aesthetics',
  },
  {
    id: 'podologia',
    name: 'Podologia',
    description: 'Cuidados com os pés e unhas',
    category: 'aesthetics',
  },

  // NUTRITION
  {
    id: 'nutricao_clinica',
    name: 'Nutrição Clínica',
    description: 'Dietas e acompanhamento nutricional para saúde',
    category: 'nutrition',
  },
  {
    id: 'nutricao_esportiva',
    name: 'Nutrição Esportiva',
    description: 'Alimentação para performance e atletas',
    category: 'nutrition',
  },
  {
    id: 'nutricao_funcional',
    name: 'Nutrição Funcional',
    description: 'Abordagem funcional e integrativa',
    category: 'nutrition',
  },
  {
    id: 'nutricao_materno_infantil',
    name: 'Nutrição Materno-Infantil',
    description: 'Alimentação para gestantes, bebês e crianças',
    category: 'nutrition',
  },
  {
    id: 'nutricao_comportamental',
    name: 'Nutrição Comportamental',
    description: 'Mudança de hábitos e relação com a comida',
    category: 'nutrition',
  },

  // VETERINARY
  {
    id: 'veterinaria_geral',
    name: 'Veterinária Geral',
    description: 'Atendimento clínico para animais de estimação',
    category: 'veterinary',
  },
  {
    id: 'veterinaria_cirurgia',
    name: 'Cirurgia Veterinária',
    description: 'Procedimentos cirúrgicos em animais',
    category: 'veterinary',
  },
  {
    id: 'veterinaria_dermatologia',
    name: 'Dermatologia Veterinária',
    description: 'Tratamento de pele e pelos de animais',
    category: 'veterinary',
  },
  {
    id: 'veterinaria_cardiologia',
    name: 'Cardiologia Veterinária',
    description: 'Tratamento cardíaco em animais',
    category: 'veterinary',
  },
  {
    id: 'veterinaria_ortopedia',
    name: 'Ortopedia Veterinária',
    description: 'Tratamento de ossos e articulações em animais',
    category: 'veterinary',
  },

  // OTHER
  {
    id: 'educacao_fisica',
    name: 'Educação Física',
    description: 'Personal trainer e avaliação física',
    category: 'other',
  },
  {
    id: 'enfermagem',
    name: 'Enfermagem',
    description: 'Cuidados de enfermagem e procedimentos',
    category: 'other',
  },
  {
    id: 'farmacia',
    name: 'Farmácia',
    description: 'Orientação farmacêutica e manipulação',
    category: 'other',
  },
  {
    id: 'assistencia_social',
    name: 'Assistência Social',
    description: 'Apoio e orientação social',
    category: 'other',
  },
  {
    id: 'outro',
    name: 'Outra Especialidade',
    description: 'Especialidade não listada',
    category: 'other',
  },
];

// Helper function to get specialties by category
export function getSpecialtiesByCategory(category: SpecialtyCategory): Specialty[] {
  return specialties.filter((s) => s.category === category);
}

// Helper function to get specialty by id
export function getSpecialtyById(id: string): Specialty | undefined {
  return specialties.find((s) => s.id === id);
}

// Helper function to get specialty name by id
export function getSpecialtyName(id: string): string {
  const specialty = getSpecialtyById(id);
  return specialty?.name || id;
}

// Group specialties by category for dropdown display
export function getGroupedSpecialties(): Record<SpecialtyCategory, Specialty[]> {
  return specialties.reduce((acc, specialty) => {
    if (!acc[specialty.category]) {
      acc[specialty.category] = [];
    }
    acc[specialty.category].push(specialty);
    return acc;
  }, {} as Record<SpecialtyCategory, Specialty[]>);
}
