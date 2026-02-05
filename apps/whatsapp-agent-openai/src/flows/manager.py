"""
WhatsApp Flows Manager for Gendei
Handles flow creation, update, and sending via Meta Graph API
"""

import os
import json
import logging
from typing import Any, Dict, Optional
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)

META_API_VERSION = os.getenv("META_API_VERSION", "v24.0")
META_GRAPH_URL = f"https://graph.facebook.com/{META_API_VERSION}"


class FlowsManager:
    """Manages WhatsApp Flows creation and sending."""

    def __init__(self, waba_id: str, access_token: str):
        """
        Initialize the FlowsManager.

        Args:
            waba_id: WhatsApp Business Account ID
            access_token: Meta API access token
        """
        self.waba_id = waba_id
        self.access_token = access_token

    async def create_flow(
        self,
        name: str,
        categories: list = None,
        endpoint_uri: str = None,
    ) -> Optional[str]:
        """
        Create a new WhatsApp Flow.

        Args:
            name: Flow name
            categories: Flow categories (e.g., ["APPOINTMENT_BOOKING"])
            endpoint_uri: Data endpoint URL for dynamic flows

        Returns:
            Flow ID if successful, None otherwise
        """
        if categories is None:
            categories = ["APPOINTMENT_BOOKING"]

        url = f"{META_GRAPH_URL}/{self.waba_id}/flows"

        payload = {
            "name": name,
            "categories": categories,
        }

        if endpoint_uri:
            payload["endpoint_uri"] = endpoint_uri
            payload["data_api_version"] = "3.0"

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                data = response.json()

                if "id" in data:
                    logger.info(f"✅ Created flow: {data['id']}")
                    return data["id"]
                else:
                    logger.error(f"❌ Failed to create flow: {data}")
                    return None

        except Exception as e:
            logger.error(f"❌ Error creating flow: {e}")
            return None

    async def update_flow_json(
        self,
        flow_id: str,
        flow_json: Dict[str, Any],
    ) -> bool:
        """
        Update a flow's JSON structure.

        Args:
            flow_id: Flow ID
            flow_json: Flow JSON structure

        Returns:
            True if successful
        """
        url = f"{META_GRAPH_URL}/{flow_id}/assets"

        # WhatsApp Flows requires the JSON to be uploaded as a file
        files = {
            "file": ("flow.json", json.dumps(flow_json), "application/json"),
            "name": (None, "flow.json"),
            "asset_type": (None, "FLOW_JSON"),
        }

        headers = {
            "Authorization": f"Bearer {self.access_token}",
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, files=files, headers=headers)
                data = response.json()

                if data.get("success"):
                    logger.info(f"✅ Updated flow JSON: {flow_id}")
                    return True
                else:
                    logger.error(f"❌ Failed to update flow JSON: {data}")
                    return False

        except Exception as e:
            logger.error(f"❌ Error updating flow JSON: {e}")
            return False

    async def publish_flow(self, flow_id: str) -> bool:
        """
        Publish a flow to make it available.

        Args:
            flow_id: Flow ID

        Returns:
            True if successful
        """
        url = f"{META_GRAPH_URL}/{flow_id}/publish"

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers)
                data = response.json()

                if data.get("success"):
                    logger.info(f"✅ Published flow: {flow_id}")
                    return True
                else:
                    logger.error(f"❌ Failed to publish flow: {data}")
                    return False

        except Exception as e:
            logger.error(f"❌ Error publishing flow: {e}")
            return False

    async def get_flow(self, flow_id: str) -> Optional[Dict[str, Any]]:
        """
        Get flow details.

        Args:
            flow_id: Flow ID

        Returns:
            Flow details dict
        """
        url = f"{META_GRAPH_URL}/{flow_id}"

        headers = {
            "Authorization": f"Bearer {self.access_token}",
        }

        params = {
            "fields": "id,name,status,categories,endpoint_uri,json_version"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, params=params)
                return response.json()

        except Exception as e:
            logger.error(f"❌ Error getting flow: {e}")
            return None

    async def list_flows(self) -> list:
        """
        List all flows for the WABA.

        Returns:
            List of flows
        """
        url = f"{META_GRAPH_URL}/{self.waba_id}/flows"

        headers = {
            "Authorization": f"Bearer {self.access_token}",
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers)
                data = response.json()
                return data.get("data", [])

        except Exception as e:
            logger.error(f"❌ Error listing flows: {e}")
            return []


async def send_whatsapp_flow(
    phone_number_id: str,
    to: str,
    flow_id: str,
    flow_token: str,
    flow_cta: str,
    header_text: str,
    body_text: str,
    access_token: str,
    flow_action: str = "data_exchange",
    initial_screen: str = "SELECT_PROFESSIONAL",
    initial_data: Dict[str, Any] = None,
    mode: str = "published",  # "published" for published flows, "draft" for unpublished
) -> bool:
    """
    Send a WhatsApp Flow message to a user.

    Args:
        phone_number_id: WhatsApp phone number ID
        to: Recipient phone number
        flow_id: Flow ID
        flow_token: Unique token for this flow session (clinic_id:phone:timestamp)
        flow_cta: Call-to-action button text
        header_text: Header text
        body_text: Body text
        access_token: Meta API access token
        flow_action: "navigate" or "data_exchange"
        initial_screen: Screen to show first
        initial_data: Initial data to pass to the flow

    Returns:
        True if successful
    """
    url = f"{META_GRAPH_URL}/{phone_number_id}/messages"

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to.replace("+", ""),
        "type": "interactive",
        "interactive": {
            "type": "flow",
            "header": {
                "type": "text",
                "text": header_text
            },
            "body": {
                "text": body_text
            },
            "footer": {
                "text": "Powered by Gendei"
            },
            "action": {
                "name": "flow",
                "parameters": {
                    "flow_message_version": "3",
                    "flow_token": flow_token,
                    "flow_id": flow_id,
                    "flow_cta": flow_cta,
                    "flow_action": flow_action,
                    "mode": mode,
                }
            }
        }
    }

    # Add initial screen and data for navigate/data_exchange flows
    # Both actions support flow_action_payload with screen and data
    if initial_screen:
        payload["interactive"]["action"]["parameters"]["flow_action_payload"] = {
            "screen": initial_screen,
            "data": initial_data or {}
        }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            data = response.json()

            if "messages" in data:
                logger.info(f"✅ Sent flow to {to}")
                return True
            else:
                logger.error(f"❌ Failed to send flow: {data}")
                return False

    except Exception as e:
        logger.error(f"❌ Error sending flow: {e}")
        return False


def generate_flow_token(clinic_id: str, phone: str, extra_data: str = "") -> str:
    """
    Generate a unique flow token for session tracking.

    Format: clinic_id:phone:timestamp or clinic_id:phone:timestamp:extra_data
    """
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    base_token = f"{clinic_id}:{phone}:{timestamp}"
    if extra_data:
        return f"{base_token}:{extra_data}"
    return base_token


async def send_booking_flow(
    phone_number_id: str,
    to: str,
    flow_id: str,
    flow_token: str,
    access_token: str,
    professional_id: str,
    professional_name: str,
    specialty_name: str,
    patient_name: str,
    patient_email: str,
    available_times: list,
    min_date: str,
    max_date: str,
    mode: str = "published",  # "published" for published flows
) -> bool:
    """
    Send the Booking Flow (Flow 2) after Patient Info flow completes.

    Args:
        phone_number_id: WhatsApp phone number ID
        to: Recipient phone number
        flow_id: Booking flow ID
        flow_token: Session token
        access_token: Meta API access token
        professional_id: Selected professional ID
        professional_name: Professional's name
        specialty_name: Specialty name
        patient_name: Patient's name
        patient_email: Patient's email
        available_times: List of available time slots
        min_date: Minimum selectable date (YYYY-MM-DD)
        max_date: Maximum selectable date (YYYY-MM-DD)

    Returns:
        True if successful
    """
    initial_data = {
        "professional_id": professional_id,
        "doctor_name": professional_name,
        "specialty_name": specialty_name,
        "patient_name": patient_name,
        "patient_email": patient_email,
        "available_times": available_times,
        "min_date": min_date,
        "max_date": max_date,
        "error_message": ""
    }

    return await send_whatsapp_flow(
        phone_number_id=phone_number_id,
        to=to,
        flow_id=flow_id,
        flow_token=flow_token,
        flow_cta="Escolher Horário",
        header_text="Escolher Horário",
        body_text=f"Selecione a data e horário com {professional_name}",
        access_token=access_token,
        flow_action="navigate",  # "navigate" for client-side flows
        initial_screen="BOOKING",
        initial_data=initial_data,
        mode=mode,
    )
