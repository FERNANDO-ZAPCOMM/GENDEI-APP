// Professional Specialties for Gendei Clinic Platform
// Organized by clinic category type

export interface Specialty {
  id: string;
  name: string;
  description: string;
}

export const specialties: Specialty[] = [
  // === MEDICINA GERAL ===
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
    id: 'urologia',
    name: 'Urologia',
    description: 'Tratamento do sistema urinário e reprodutor masculino',
  },
  {
    id: 'otorrinolaringologia',
    name: 'Otorrinolaringologia',
    description: 'Tratamento de ouvido, nariz e garganta',
  },
  {
    id: 'reumatologia',
    name: 'Reumatologia',
    description: 'Tratamento de doenças reumáticas e autoimunes',
  },
  {
    id: 'pneumologia',
    name: 'Pneumologia',
    description: 'Tratamento de doenças do sistema respiratório',
  },
  {
    id: 'nefrologia',
    name: 'Nefrologia',
    description: 'Tratamento de doenças renais',
  },
  {
    id: 'geriatria',
    name: 'Geriatria',
    description: 'Cuidados médicos para idosos',
  },
  {
    id: 'mastologia',
    name: 'Mastologia',
    description: 'Diagnóstico e tratamento de doenças da mama',
  },
  {
    id: 'proctologia',
    name: 'Proctologia',
    description: 'Tratamento de doenças do intestino grosso e reto',
  },
  {
    id: 'angiologia',
    name: 'Angiologia',
    description: 'Tratamento de doenças vasculares e circulatórias',
  },
  {
    id: 'infectologia',
    name: 'Infectologia',
    description: 'Diagnóstico e tratamento de doenças infecciosas',
  },
  {
    id: 'hematologia',
    name: 'Hematologia',
    description: 'Tratamento de doenças do sangue e sistema linfático',
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
    description: 'Implantes dentários e reabilitação oral',
  },
  {
    id: 'endodontia',
    name: 'Endodontia',
    description: 'Tratamento de canal e polpa dentária',
  },
  {
    id: 'periodontia',
    name: 'Periodontia',
    description: 'Tratamento de gengivas e estruturas de suporte dental',
  },
  {
    id: 'odontopediatria',
    name: 'Odontopediatria',
    description: 'Odontologia para crianças e adolescentes',
  },
  {
    id: 'protese_dentaria',
    name: 'Prótese Dentária',
    description: 'Confecção e adaptação de próteses dentárias',
  },
  {
    id: 'cirurgia_bucomaxilofacial',
    name: 'Cirurgia Bucomaxilofacial',
    description: 'Cirurgias da face, mandíbula e região oral',
  },
  {
    id: 'dentistica',
    name: 'Dentística',
    description: 'Restaurações estéticas e funcionais dos dentes',
  },
  {
    id: 'harmonizacao_orofacial',
    name: 'Harmonização Orofacial',
    description: 'Procedimentos estéticos da região orofacial',
  },

  // === PSICOLOGIA ===
  {
    id: 'psicologia',
    name: 'Psicologia',
    description: 'Atendimento psicológico e psicoterapia',
  },
  {
    id: 'neuropsicologia',
    name: 'Neuropsicologia',
    description: 'Avaliação e reabilitação de funções cognitivas',
  },
  {
    id: 'psicanalise',
    name: 'Psicanálise',
    description: 'Terapia psicanalítica e investigação do inconsciente',
  },
  {
    id: 'terapia_cognitivo_comportamental',
    name: 'Terapia Cognitivo-Comportamental (TCC)',
    description: 'Terapia focada em pensamentos e comportamentos',
  },
  {
    id: 'psicologia_infantil',
    name: 'Psicologia Infantil',
    description: 'Atendimento psicológico para crianças',
  },
  {
    id: 'terapia_de_casal',
    name: 'Terapia de Casal',
    description: 'Acompanhamento terapêutico para casais',
  },
  {
    id: 'psicopedagogia',
    name: 'Psicopedagogia',
    description: 'Avaliação e intervenção em dificuldades de aprendizagem',
  },

  // === NUTRIÇÃO ===
  {
    id: 'nutricao',
    name: 'Nutrição',
    description: 'Acompanhamento nutricional e planejamento alimentar',
  },
  {
    id: 'nutricao_clinica',
    name: 'Nutrição Clínica',
    description: 'Tratamento nutricional de patologias e condições clínicas',
  },
  {
    id: 'nutricao_esportiva',
    name: 'Nutrição Esportiva',
    description: 'Nutrição para atletas e praticantes de atividade física',
  },
  {
    id: 'nutricao_funcional',
    name: 'Nutrição Funcional',
    description: 'Abordagem funcional e integrativa da alimentação',
  },
  {
    id: 'nutricao_materno_infantil',
    name: 'Nutrição Materno-Infantil',
    description: 'Nutrição para gestantes, lactantes e crianças',
  },
  {
    id: 'nutricao_comportamental',
    name: 'Nutrição Comportamental',
    description: 'Abordagem comportamental da relação com a comida',
  },
  {
    id: 'nutricao_oncologica',
    name: 'Nutrição Oncológica',
    description: 'Suporte nutricional para pacientes oncológicos',
  },

  // === FISIOTERAPIA ===
  {
    id: 'fisioterapia',
    name: 'Fisioterapia',
    description: 'Reabilitação física e tratamentos musculares',
  },
  {
    id: 'fisioterapia_ortopedica',
    name: 'Fisioterapia Ortopédica',
    description: 'Reabilitação de lesões ósseas, musculares e articulares',
  },
  {
    id: 'fisioterapia_neurologica',
    name: 'Fisioterapia Neurológica',
    description: 'Reabilitação de pacientes com doenças neurológicas',
  },
  {
    id: 'fisioterapia_respiratoria',
    name: 'Fisioterapia Respiratória',
    description: 'Tratamento de doenças e condições respiratórias',
  },
  {
    id: 'fisioterapia_esportiva',
    name: 'Fisioterapia Esportiva',
    description: 'Prevenção e tratamento de lesões esportivas',
  },
  {
    id: 'pilates_clinico',
    name: 'Pilates Clínico',
    description: 'Pilates aplicado à reabilitação e saúde',
  },
  {
    id: 'fisioterapia_pelvica',
    name: 'Fisioterapia Pélvica',
    description: 'Tratamento de disfunções do assoalho pélvico',
  },
  {
    id: 'rpg',
    name: 'RPG (Reeducação Postural Global)',
    description: 'Método de tratamento postural global',
  },
  {
    id: 'acupuntura_fisioterapia',
    name: 'Acupuntura (Fisioterapia)',
    description: 'Acupuntura aplicada à fisioterapia',
  },

  // === DERMATOLOGIA (sub-especialidades) ===
  {
    id: 'dermatologia_clinica',
    name: 'Dermatologia Clínica',
    description: 'Diagnóstico e tratamento de doenças da pele',
  },
  {
    id: 'dermatologia_estetica',
    name: 'Dermatologia Estética',
    description: 'Procedimentos estéticos dermatológicos',
  },
  {
    id: 'dermatologia_cirurgica',
    name: 'Dermatologia Cirúrgica',
    description: 'Cirurgias dermatológicas e remoção de lesões',
  },
  {
    id: 'tricologia',
    name: 'Tricologia',
    description: 'Tratamento de doenças do cabelo e couro cabeludo',
  },

  // === OFTALMOLOGIA (sub-especialidades) ===
  {
    id: 'oftalmologia',
    name: 'Oftalmologia',
    description: 'Exames e tratamentos de doenças oculares',
  },
  {
    id: 'oftalmologia_geral',
    name: 'Oftalmologia Geral',
    description: 'Atendimento oftalmológico geral e preventivo',
  },
  {
    id: 'retina',
    name: 'Retina e Vítreo',
    description: 'Diagnóstico e tratamento de doenças da retina',
  },
  {
    id: 'glaucoma',
    name: 'Glaucoma',
    description: 'Diagnóstico e tratamento do glaucoma',
  },
  {
    id: 'catarata',
    name: 'Catarata',
    description: 'Cirurgia e tratamento de catarata',
  },
  {
    id: 'cirurgia_refrativa',
    name: 'Cirurgia Refrativa',
    description: 'Correção cirúrgica de miopia, hipermetropia e astigmatismo',
  },
  {
    id: 'oftalmopediatria',
    name: 'Oftalmopediatria',
    description: 'Oftalmologia para crianças e adolescentes',
  },

  // === PEDIATRIA (sub-especialidades) ===
  {
    id: 'pediatria_geral',
    name: 'Pediatria Geral',
    description: 'Acompanhamento pediátrico geral e puericultura',
  },
  {
    id: 'neonatologia',
    name: 'Neonatologia',
    description: 'Cuidados médicos para recém-nascidos',
  },
  {
    id: 'neuropediatria',
    name: 'Neuropediatria',
    description: 'Neurologia pediátrica e desenvolvimento infantil',
  },
  {
    id: 'alergia_pediatrica',
    name: 'Alergia Pediátrica',
    description: 'Diagnóstico e tratamento de alergias em crianças',
  },
  {
    id: 'gastropediatria',
    name: 'Gastropediatria',
    description: 'Gastroenterologia pediátrica',
  },

  // === FONOAUDIOLOGIA ===
  {
    id: 'fonoaudiologia_clinica',
    name: 'Fonoaudiologia Clínica',
    description: 'Atendimento fonoaudiológico geral',
  },
  {
    id: 'audiologia',
    name: 'Audiologia',
    description: 'Avaliação e reabilitação auditiva',
  },
  {
    id: 'linguagem',
    name: 'Linguagem',
    description: 'Tratamento de distúrbios de linguagem oral e escrita',
  },
  {
    id: 'motricidade_orofacial',
    name: 'Motricidade Orofacial',
    description: 'Tratamento de funções orofaciais (mastigação, deglutição, fala)',
  },
  {
    id: 'voz',
    name: 'Voz',
    description: 'Tratamento de distúrbios vocais e reabilitação da voz',
  },
  {
    id: 'disfagia',
    name: 'Disfagia',
    description: 'Tratamento de dificuldades de deglutição',
  },

  // === ESTÉTICA ===
  {
    id: 'estetica',
    name: 'Estética',
    description: 'Tratamentos estéticos faciais e corporais',
  },
  {
    id: 'harmonizacao_facial',
    name: 'Harmonização Facial',
    description: 'Procedimentos de harmonização e equilíbrio facial',
  },
  {
    id: 'cirurgia_plastica',
    name: 'Cirurgia Plástica',
    description: 'Cirurgias plásticas estéticas e reparadoras',
  },
  {
    id: 'medicina_estetica',
    name: 'Medicina Estética',
    description: 'Procedimentos médicos com finalidade estética',
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

// Helper function to get multiple specialty names joined
export function getSpecialtyNames(ids: string[] | undefined, separator: string = ', '): string {
  if (!ids || ids.length === 0) return '';
  return ids.map(id => getSpecialtyName(id)).join(separator);
}

// Helper to get specialties from a professional (handles both old and new format)
export function getProfessionalSpecialties(professional: { specialty?: string; specialties?: string[] }): string[] {
  // Prefer new specialties array, fallback to old specialty field
  if (professional.specialties && professional.specialties.length > 0) {
    return professional.specialties;
  }
  if (professional.specialty) {
    return [professional.specialty];
  }
  return [];
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
