"""
Gendei Clinic Tool Definitions
Provider-agnostic tool definitions for clinic scheduling agents.
"""

from typing import List, Dict, Any


# Tool definitions for clinic scheduling
TOOL_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "send_text_message": {
        "name": "send_text_message",
        "description": "Send a text message to the patient via WhatsApp. This is the primary tool for communicating with patients.",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Patient phone number in E.164 format (e.g., +5511999999999).",
                "required": True,
            },
            {
                "name": "text",
                "type": "string",
                "description": "Message text to send. Supports WhatsApp formatting (*bold*, _italic_).",
                "required": True,
            }
        ],
    },

    "get_clinic_info": {
        "name": "get_clinic_info",
        "description": "Get information about the clinic including address, opening hours, phone, and payment options.",
        "parameters": [],
    },

    "get_professionals": {
        "name": "get_professionals",
        "description": "Get list of professionals at the clinic. Can filter by service if specified.",
        "parameters": [
            {
                "name": "service_id",
                "type": "string",
                "description": "Optional service ID to filter professionals.",
                "required": False,
            }
        ],
    },

    "get_services": {
        "name": "get_services",
        "description": "Get list of services offered by the clinic with duration and price.",
        "parameters": [],
    },

    "get_available_slots": {
        "name": "get_available_slots",
        "description": "Get available appointment slots for a professional.",
        "parameters": [
            {
                "name": "professional_id",
                "type": "string",
                "description": "ID of the professional.",
                "required": True,
            },
            {
                "name": "date",
                "type": "string",
                "description": "Optional specific date (YYYY-MM-DD format).",
                "required": False,
            },
            {
                "name": "days_ahead",
                "type": "integer",
                "description": "Number of days to look ahead (default 7).",
                "required": False,
                "default": 7,
            }
        ],
    },

    "create_appointment": {
        "name": "create_appointment",
        "description": "Create a new appointment for a patient.",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Patient phone number in E.164 format.",
                "required": True,
            },
            {
                "name": "professional_id",
                "type": "string",
                "description": "ID of the professional.",
                "required": True,
            },
            {
                "name": "date",
                "type": "string",
                "description": "Appointment date in YYYY-MM-DD format.",
                "required": True,
            },
            {
                "name": "time",
                "type": "string",
                "description": "Appointment time in HH:MM format.",
                "required": True,
            },
            {
                "name": "patient_name",
                "type": "string",
                "description": "Full name of the patient.",
                "required": True,
            },
            {
                "name": "patient_email",
                "type": "string",
                "description": "Patient email address (if available).",
                "required": False,
            },
            {
                "name": "service_id",
                "type": "string",
                "description": "Optional ID of the service.",
                "required": False,
            },
            {
                "name": "payment_type",
                "type": "string",
                "description": "Payment type - 'particular' or 'convenio'.",
                "required": False,
                "default": "particular",
            },
            {
                "name": "convenio_name",
                "type": "string",
                "description": "Name of the health insurance (if convenio).",
                "required": False,
            },
            {
                "name": "convenio_number",
                "type": "string",
                "description": "Health insurance card number (if convenio).",
                "required": False,
            }
        ],
    },

    "send_appointment_confirmation": {
        "name": "send_appointment_confirmation",
        "description": "Send appointment confirmation message to the patient.",
        "parameters": [
            {
                "name": "appointment_id",
                "type": "string",
                "description": "ID of the appointment to confirm.",
                "required": True,
            }
        ],
    },

    "get_patient_appointments": {
        "name": "get_patient_appointments",
        "description": "Get patient's upcoming appointments.",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Patient phone number in E.164 format.",
                "required": True,
            }
        ],
    },

    "cancel_appointment": {
        "name": "cancel_appointment",
        "description": "Cancel an appointment.",
        "parameters": [
            {
                "name": "appointment_id",
                "type": "string",
                "description": "ID of the appointment to cancel.",
                "required": True,
            },
            {
                "name": "reason",
                "type": "string",
                "description": "Optional reason for cancellation.",
                "required": False,
                "default": "",
            }
        ],
    },

    "reschedule_appointment": {
        "name": "reschedule_appointment",
        "description": "Reschedule an appointment to a new date and time.",
        "parameters": [
            {
                "name": "appointment_id",
                "type": "string",
                "description": "ID of the appointment to reschedule.",
                "required": True,
            },
            {
                "name": "new_date",
                "type": "string",
                "description": "New date in YYYY-MM-DD format.",
                "required": True,
            },
            {
                "name": "new_time",
                "type": "string",
                "description": "New time in HH:MM format.",
                "required": True,
            }
        ],
    },

    "enable_human_takeover": {
        "name": "enable_human_takeover",
        "description": "Enable human takeover for a conversation when the AI cannot handle the request. Use when patient explicitly asks to speak with a human, complex complaint, or medical questions.",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Patient phone number to enable human takeover for.",
                "required": True,
            },
            {
                "name": "reason",
                "type": "string",
                "description": "Brief description of why human takeover is needed.",
                "required": True,
            }
        ],
    },
}


# Tool groups for different agent types
AGENT_TOOL_GROUPS: Dict[str, List[str]] = {
    # Greeter - welcomes patients
    "greeter_agent": [
        "send_text_message",
    ],

    # Clinic Info - answers questions about the clinic
    "clinic_info_agent": [
        "send_text_message",
        "get_clinic_info",
        "get_professionals",
        "get_services",
    ],

    # Scheduling - handles appointment booking
    "scheduling_agent": [
        "send_text_message",
        "get_services",
        "get_professionals",
        "get_available_slots",
        "create_appointment",
        "send_appointment_confirmation",
    ],

    # Appointment Manager - view/cancel/reschedule
    "appointment_manager_agent": [
        "send_text_message",
        "get_patient_appointments",
        "cancel_appointment",
        "reschedule_appointment",
    ],

    # Support - human escalation
    "support_agent": [
        "send_text_message",
        "enable_human_takeover",
    ],

    # Triage - routes to other agents
    "triage_agent": [
        "send_text_message",
    ],
}


def get_tools_for_agent(agent_name: str) -> List[str]:
    """Get tool names for an agent type."""
    return AGENT_TOOL_GROUPS.get(agent_name, ["send_text_message"])
