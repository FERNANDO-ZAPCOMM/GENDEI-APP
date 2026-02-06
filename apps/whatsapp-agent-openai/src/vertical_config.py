"""
Vertical Configuration for Gendei WhatsApp Agent
Defines per-vertical terminology, features, and specialty mappings.

Each clinic belongs to a vertical (med, dental, psi, nutri, etc.)
which determines how the bot communicates and what features it offers.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class VerticalTerminology:
    """Terminology that changes per vertical."""
    appointment_term: str           # "consulta", "sessão", "atendimento", "procedimento"
    appointment_term_plural: str    # "consultas", "sessões", "atendimentos"
    client_term: str                # "paciente", "cliente"
    professional_term: str          # "médico(a)", "dentista", "psicólogo(a)", "nutricionista"
    professional_term_generic: str  # "profissional" (always works as fallback)
    professional_emoji: str         # emoji for professional in messages
    service_emoji: str              # emoji for services list
    greeting_context: str           # "saúde", "saúde bucal", "bem-estar", "nutrição"
    no_show_emoji: str              # for confirmation messages


@dataclass
class VerticalFeatures:
    """Feature flags per vertical."""
    has_convenio: bool = True       # Show convênio/insurance flow
    has_deposit: bool = True        # Show deposit/signal payment
    has_telemedicine: bool = False  # Online appointment option
    ask_convenio_number: bool = True  # Ask for carteirinha number
    show_arrive_early_tip: bool = True  # "Chegue 15 min antes"


@dataclass
class VerticalConfig:
    """Complete vertical configuration."""
    slug: str
    name: str                       # "Gendei Med", "Gendei Dental"
    terminology: VerticalTerminology
    features: VerticalFeatures
    specialties: Dict[str, str]     # id -> display name mapping
    council: str                    # CRM, CRO, CRP, CRN, CREFITO, etc.


# ─── Specialty Mappings ────────────────────────────────────────────────────

MEDICAL_SPECIALTIES = {
    "clinico_geral": "Clínico Geral",
    "cardiologia": "Cardiologia",
    "dermatologia": "Dermatologia",
    "endocrinologia": "Endocrinologia",
    "gastroenterologia": "Gastroenterologia",
    "geriatria": "Geriatria",
    "ginecologia": "Ginecologia e Obstetrícia",
    "hematologia": "Hematologia",
    "infectologia": "Infectologia",
    "mastologia": "Mastologia",
    "nefrologia": "Nefrologia",
    "neurologia": "Neurologia",
    "oftalmologia": "Oftalmologia",
    "ortopedia": "Ortopedia",
    "otorrinolaringologia": "Otorrinolaringologia",
    "pediatria": "Pediatria",
    "pneumologia": "Pneumologia",
    "proctologia": "Proctologia",
    "psiquiatria": "Psiquiatria",
    "reumatologia": "Reumatologia",
    "urologia": "Urologia",
    "angiologia": "Angiologia",
}

DENTAL_SPECIALTIES = {
    "odontologia_geral": "Odontologia Geral",
    "ortodontia": "Ortodontia",
    "implantodontia": "Implantodontia",
    "endodontia": "Endodontia",
    "periodontia": "Periodontia",
    "odontopediatria": "Odontopediatria",
    "protese_dentaria": "Prótese Dentária",
    "cirurgia_bucomaxilofacial": "Cirurgia Bucomaxilofacial",
    "dentistica": "Dentística",
    "harmonizacao_orofacial": "Harmonização Orofacial",
}

PSYCHOLOGY_SPECIALTIES = {
    "psicologia": "Psicologia",
    "neuropsicologia": "Neuropsicologia",
    "psicanalise": "Psicanálise",
    "terapia_cognitivo_comportamental": "TCC (Cognitivo-Comportamental)",
    "psicologia_infantil": "Psicologia Infantil",
    "terapia_de_casal": "Terapia de Casal",
    "psicopedagogia": "Psicopedagogia",
}

NUTRITION_SPECIALTIES = {
    "nutricao_clinica": "Nutrição Clínica",
    "nutricao_esportiva": "Nutrição Esportiva",
    "nutricao_funcional": "Nutrição Funcional",
    "nutricao_materno_infantil": "Nutrição Materno-Infantil",
    "nutricao_comportamental": "Nutrição Comportamental",
    "nutricao_oncologica": "Nutrição Oncológica",
}

PHYSIO_SPECIALTIES = {
    "fisioterapia_ortopedica": "Fisioterapia Ortopédica",
    "fisioterapia_neurologica": "Fisioterapia Neurológica",
    "fisioterapia_respiratoria": "Fisioterapia Respiratória",
    "fisioterapia_esportiva": "Fisioterapia Esportiva",
    "pilates_clinico": "Pilates Clínico",
    "fisioterapia_pelvica": "Fisioterapia Pélvica",
    "rpg": "RPG (Reeducação Postural)",
    "acupuntura_fisioterapia": "Acupuntura",
}

# Future verticals (uncomment when ready to launch):
# DERMATOLOGY_SPECIALTIES, OPHTHALMOLOGY_SPECIALTIES, PEDIATRICS_SPECIALTIES,
# SPEECH_THERAPY_SPECIALTIES, AESTHETICS_SPECIALTIES

# Merge all active specialties for 'geral' vertical
ALL_SPECIALTIES = {
    **MEDICAL_SPECIALTIES,
    **DENTAL_SPECIALTIES,
    **PSYCHOLOGY_SPECIALTIES,
    **NUTRITION_SPECIALTIES,
    **PHYSIO_SPECIALTIES,
}


# ─── Vertical Definitions ─────────────────────────────────────────────────

VERTICALS: Dict[str, VerticalConfig] = {
    "med": VerticalConfig(
        slug="med",
        name="Gendei Med",
        council="CRM",
        specialties=MEDICAL_SPECIALTIES,
        terminology=VerticalTerminology(
            appointment_term="consulta",
            appointment_term_plural="consultas",
            client_term="paciente",
            professional_term="médico(a)",
            professional_term_generic="profissional",
            professional_emoji="👨‍⚕️",
            service_emoji="🩺",
            greeting_context="saúde",
            no_show_emoji="🏥",
        ),
        features=VerticalFeatures(
            has_convenio=True,
            has_deposit=True,
            has_telemedicine=True,
            ask_convenio_number=True,
            show_arrive_early_tip=True,
        ),
    ),

    "dental": VerticalConfig(
        slug="dental",
        name="Gendei Dental",
        council="CRO",
        specialties=DENTAL_SPECIALTIES,
        terminology=VerticalTerminology(
            appointment_term="consulta",
            appointment_term_plural="consultas",
            client_term="paciente",
            professional_term="dentista",
            professional_term_generic="profissional",
            professional_emoji="🦷",
            service_emoji="🪥",
            greeting_context="saúde bucal",
            no_show_emoji="🦷",
        ),
        features=VerticalFeatures(
            has_convenio=True,
            has_deposit=True,
            has_telemedicine=False,
            ask_convenio_number=True,
            show_arrive_early_tip=True,
        ),
    ),

    "psi": VerticalConfig(
        slug="psi",
        name="Gendei Psi",
        council="CRP",
        specialties=PSYCHOLOGY_SPECIALTIES,
        terminology=VerticalTerminology(
            appointment_term="sessão",
            appointment_term_plural="sessões",
            client_term="cliente",
            professional_term="psicólogo(a)",
            professional_term_generic="profissional",
            professional_emoji="🧠",
            service_emoji="💬",
            greeting_context="saúde mental e bem-estar",
            no_show_emoji="🧠",
        ),
        features=VerticalFeatures(
            has_convenio=False,
            has_deposit=False,
            has_telemedicine=True,
            ask_convenio_number=False,
            show_arrive_early_tip=False,
        ),
    ),

    "nutri": VerticalConfig(
        slug="nutri",
        name="Gendei Nutri",
        council="CRN",
        specialties=NUTRITION_SPECIALTIES,
        terminology=VerticalTerminology(
            appointment_term="consulta",
            appointment_term_plural="consultas",
            client_term="cliente",
            professional_term="nutricionista",
            professional_term_generic="profissional",
            professional_emoji="🥗",
            service_emoji="🍎",
            greeting_context="nutrição",
            no_show_emoji="🥗",
        ),
        features=VerticalFeatures(
            has_convenio=False,
            has_deposit=False,
            has_telemedicine=True,
            ask_convenio_number=False,
            show_arrive_early_tip=False,
        ),
    ),

    "fisio": VerticalConfig(
        slug="fisio",
        name="Gendei Fisio",
        council="CREFITO",
        specialties=PHYSIO_SPECIALTIES,
        terminology=VerticalTerminology(
            appointment_term="sessão",
            appointment_term_plural="sessões",
            client_term="paciente",
            professional_term="fisioterapeuta",
            professional_term_generic="profissional",
            professional_emoji="💪",
            service_emoji="🏋️",
            greeting_context="fisioterapia e reabilitação",
            no_show_emoji="💪",
        ),
        features=VerticalFeatures(
            has_convenio=True,
            has_deposit=False,
            has_telemedicine=False,
            ask_convenio_number=True,
            show_arrive_early_tip=True,
        ),
    ),

    # Future verticals: dermato, oftalmo, pediatra, fono, estetica
}

# Default / fallback (generic clinic)
DEFAULT_VERTICAL = VerticalConfig(
    slug="geral",
    name="Gendei",
    council="",
    specialties=ALL_SPECIALTIES,
    terminology=VerticalTerminology(
        appointment_term="consulta",
        appointment_term_plural="consultas",
        client_term="paciente",
        professional_term="profissional",
        professional_term_generic="profissional",
        professional_emoji="👨‍⚕️",
        service_emoji="🩺",
        greeting_context="saúde",
        no_show_emoji="🏥",
    ),
    features=VerticalFeatures(
        has_convenio=True,
        has_deposit=True,
        has_telemedicine=True,
        ask_convenio_number=True,
        show_arrive_early_tip=True,
    ),
)


def get_vertical_config(vertical_slug: Optional[str]) -> VerticalConfig:
    """Get vertical config by slug. Returns default if not found."""
    if not vertical_slug:
        return DEFAULT_VERTICAL
    return VERTICALS.get(vertical_slug, DEFAULT_VERTICAL)


def get_specialty_name(vertical_slug: Optional[str], specialty_id: str) -> str:
    """Get display name for a specialty within a vertical."""
    config = get_vertical_config(vertical_slug)
    return config.specialties.get(specialty_id, ALL_SPECIALTIES.get(specialty_id, specialty_id))
