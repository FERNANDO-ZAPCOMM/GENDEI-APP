"""WhatsApp Flows endpoint route."""

from __future__ import annotations

import json
import logging
from typing import Any, Callable, Dict, Tuple

from fastapi import Request  # type: ignore

logger = logging.getLogger(__name__)

GetFlowsHandler = Callable[[], Any]
HandleEncryptedFlowRequest = Callable[[bytes], Tuple[Dict[str, Any], Any, Any, bool]]
PrepareFlowResponse = Callable[[Dict[str, Any], Any, Any, bool], Any]
RequireEncryptedFlowRequest = Callable[[bool], None]
ParseFlowToken = Callable[[str], Dict[str, Any]]


def register_flow_routes(
    app: Any,
    *,
    get_flows_handler: GetFlowsHandler,
    handle_encrypted_flow_request: HandleEncryptedFlowRequest,
    prepare_flow_response: PrepareFlowResponse,
    require_encrypted_flow_request: RequireEncryptedFlowRequest,
    parse_flow_token: ParseFlowToken,
) -> None:
    """Register WhatsApp Flows endpoint."""

    @app.post("/flows")
    async def flows_endpoint(request: Request):
        aes_key = None
        initial_vector = None
        is_encrypted = False

        try:
            raw_body = await request.body()
            body, aes_key, initial_vector, is_encrypted = handle_encrypted_flow_request(raw_body)
            require_encrypted_flow_request(is_encrypted)

            if "error" in body:
                error_response = {"data": {"error_message": "Erro de criptografia"}}
                return prepare_flow_response(error_response, aes_key, initial_vector, is_encrypted)

            if is_encrypted:
                logger.info("🔐 Encrypted flow request received and decrypted")
            else:
                logger.info("📱 Flow request received: %s", json.dumps(body)[:500])

            action = body.get("action", "")
            screen = body.get("screen")
            data = body.get("data", {})
            flow_token = body.get("flow_token", "")

            if action == "ping":
                response = {"data": {"status": "active"}}
                return prepare_flow_response(response, aes_key, initial_vector, is_encrypted)

            if action == "error":
                logger.error("Flow error: %s", data)
                response = {"data": {"acknowledged": True}}
                return prepare_flow_response(response, aes_key, initial_vector, is_encrypted)

            clinic_id = ""
            patient_phone = ""

            if flow_token:
                try:
                    token_data = parse_flow_token(flow_token)
                    clinic_id = token_data.get("clinic_id", "")
                    patient_phone = token_data.get("phone", "")
                except ValueError as exc:
                    logger.error("Invalid flow token: %s", exc)
                    response = {"data": {"error_message": "Token de fluxo inválido"}}
                    return prepare_flow_response(response, aes_key, initial_vector, is_encrypted)

            if not clinic_id:
                clinic_id = data.get("clinic_id", "")

            if not clinic_id:
                logger.error("No clinic_id in flow request")
                response = {"data": {"error_message": "Erro: clínica não identificada"}}
                return prepare_flow_response(response, aes_key, initial_vector, is_encrypted)

            data["patient_phone"] = patient_phone

            flows_handler = get_flows_handler()
            if flows_handler:
                result = await flows_handler.handle_request(
                    action=action,
                    screen=screen,
                    data=data,
                    flow_token=flow_token,
                    clinic_id=clinic_id,
                )
                logger.info("📤 Flow response: %s", json.dumps(result)[:500])
                return prepare_flow_response(result, aes_key, initial_vector, is_encrypted)

            logger.error("Flows handler not initialized")
            response = {"data": {"error_message": "Erro interno"}}
            return prepare_flow_response(response, aes_key, initial_vector, is_encrypted)
        except Exception as exc:
            logger.error("❌ Flow endpoint error: %s", exc)
            response = {"data": {"error_message": "Erro ao processar solicitação"}}
            return prepare_flow_response(response, aes_key, initial_vector, is_encrypted)
