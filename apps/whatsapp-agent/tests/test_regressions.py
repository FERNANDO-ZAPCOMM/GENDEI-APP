import hashlib
import hmac
import os
import types
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

# Minimal stub so tests can run without external FastAPI dependency.
try:
    import fastapi  # type: ignore  # noqa: F401
except ModuleNotFoundError:
    import sys
    fastapi_stub = types.ModuleType("fastapi")

    class _HTTPException(Exception):
        def __init__(self, status_code=500, detail=""):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    class _Request:
        headers = {}

    fastapi_stub.HTTPException = _HTTPException
    fastapi_stub.Request = _Request
    sys.modules["fastapi"] = fastapi_stub

try:
    import httpx  # type: ignore  # noqa: F401
except ModuleNotFoundError:
    import sys
    httpx_stub = types.ModuleType("httpx")

    class _RequestError(Exception):
        pass

    class _Timeout:
        def __init__(self, *args, **kwargs):
            pass

    class _DummyResponse:
        def __init__(self, status_code=200, text="", payload=None):
            self.status_code = status_code
            self.text = text
            self._payload = payload or {}
            self.content = b""

        def json(self):
            return dict(self._payload)

    class _AsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def request(self, method, url, **kwargs):
            return _DummyResponse()

        async def aclose(self):
            return None

    httpx_stub.RequestError = _RequestError
    httpx_stub.Timeout = _Timeout
    httpx_stub.AsyncClient = _AsyncClient
    httpx_stub.Response = _DummyResponse
    sys.modules["httpx"] = httpx_stub

from src.flows.token import generate_flow_token, parse_flow_token
from src.messages.processor import MessageProcessorDeps, process_incoming_message
from src.utils import payment as payment_utils


class _FakeDb:
    def __init__(self, state=None, human_takeover=False):
        self._state = dict(state or {"state": "idle"})
        self._human_takeover = human_takeover

    def upsert_contact(self, clinic_id, phone, name=None):
        return None

    def log_conversation_message(self, clinic_id, phone, message_type, content, source="patient", phone_number_id=None):
        return True

    def is_human_takeover_enabled(self, clinic_id, phone):
        return self._human_takeover

    def load_conversation_state(self, clinic_id, phone):
        return dict(self._state)

    def save_conversation_state(self, clinic_id, phone, state):
        self._state = dict(state)


def _build_processor_deps(**overrides):
    async def _noop_async(*args, **kwargs):
        return None

    defaults = {
        "db": _FakeDb(),
        "ensure_phone_has_plus": lambda phone: phone if phone.startswith("+") else f"+{phone}",
        "set_current_clinic_id": lambda clinic_id: None,
        "set_current_phone_number_id": lambda phone_number_id: None,
        "mark_message_as_read": _noop_async,
        "get_appointments_by_phone": lambda *args, **kwargs: [],
        "handle_reminder_response": _noop_async,
        "handle_appointment_reschedule": _noop_async,
        "handle_appointment_cancel_request": _noop_async,
        "handle_appointment_question": _noop_async,
        "handle_pending_payment_followup": _noop_async,
        "handle_payment_method_selection": _noop_async,
        "handle_scheduling_intent": _noop_async,
        "handle_greeting_response_duvida": _noop_async,
        "handle_payment_type_selection": _noop_async,
        "escalate_to_human": _noop_async,
        "detect_frustrated_sentiment": lambda _: False,
        "detect_human_escalation_request": lambda _: False,
        "send_whatsapp_location_request": AsyncMock(return_value=True),
        "send_clinic_location_message": AsyncMock(return_value=False),
        "send_whatsapp_message": _noop_async,
        "is_simple_greeting": lambda _: False,
        "send_initial_greeting": _noop_async,
        "run_agent_response": _noop_async,
        "handle_patient_name_response": _noop_async,
        "handle_patient_email_response": _noop_async,
        "handle_patient_confirmation_response": _noop_async,
    }
    defaults.update(overrides)
    return MessageProcessorDeps(**defaults)


class FlowTokenRegressionTests(unittest.TestCase):
    def setUp(self):
        self._old_flow_secret = os.environ.get("FLOW_TOKEN_SECRET")
        self._old_service_secret = os.environ.get("GENDEI_SERVICE_SECRET")
        self._old_app_env = os.environ.get("APP_ENV")
        self._old_allow_legacy = os.environ.get("ALLOW_LEGACY_FLOW_TOKENS")

    def tearDown(self):
        if self._old_flow_secret is None:
            os.environ.pop("FLOW_TOKEN_SECRET", None)
        else:
            os.environ["FLOW_TOKEN_SECRET"] = self._old_flow_secret
        if self._old_service_secret is None:
            os.environ.pop("GENDEI_SERVICE_SECRET", None)
        else:
            os.environ["GENDEI_SERVICE_SECRET"] = self._old_service_secret
        if self._old_app_env is None:
            os.environ.pop("APP_ENV", None)
        else:
            os.environ["APP_ENV"] = self._old_app_env
        if self._old_allow_legacy is None:
            os.environ.pop("ALLOW_LEGACY_FLOW_TOKENS", None)
        else:
            os.environ["ALLOW_LEGACY_FLOW_TOKENS"] = self._old_allow_legacy

    def test_signed_flow_token_round_trip(self):
        os.environ["FLOW_TOKEN_SECRET"] = "test-flow-secret"
        token = generate_flow_token("clinic_123", "+5511999999999", extra_data="booking")
        parsed = parse_flow_token(token)
        self.assertEqual(parsed["clinic_id"], "clinic_123")
        self.assertEqual(parsed["phone"], "+5511999999999")
        self.assertEqual(parsed["extra_data"], "booking")
        self.assertFalse(parsed["is_legacy"])

    def test_legacy_flow_token_still_supported(self):
        parsed = parse_flow_token("clinic_abc:+5511888888888:20260216093000")
        self.assertEqual(parsed["clinic_id"], "clinic_abc")
        self.assertEqual(parsed["phone"], "+5511888888888")
        self.assertTrue(parsed["is_legacy"])

    def test_legacy_token_rejected_in_production(self):
        os.environ["APP_ENV"] = "production"
        os.environ.pop("ALLOW_LEGACY_FLOW_TOKENS", None)
        with self.assertRaises(ValueError):
            parse_flow_token("clinic_abc:+5511888888888:20260216093000")


class PaymentWebhookRegressionTests(unittest.TestCase):
    def setUp(self):
        self._original_secret = payment_utils.PAGSEGURO_WEBHOOK_SECRET
        self._old_app_env = os.environ.get("APP_ENV")
        self._old_allow_insecure = os.environ.get("ALLOW_INSECURE_PAGSEGURO_WEBHOOK")

    def tearDown(self):
        payment_utils.PAGSEGURO_WEBHOOK_SECRET = self._original_secret
        if self._old_app_env is None:
            os.environ.pop("APP_ENV", None)
        else:
            os.environ["APP_ENV"] = self._old_app_env
        if self._old_allow_insecure is None:
            os.environ.pop("ALLOW_INSECURE_PAGSEGURO_WEBHOOK", None)
        else:
            os.environ["ALLOW_INSECURE_PAGSEGURO_WEBHOOK"] = self._old_allow_insecure

    def test_valid_pagseguro_signature(self):
        payment_utils.PAGSEGURO_WEBHOOK_SECRET = "pag_secret"
        payload = '{"event":"PAYMENT.PAID"}'
        signature = hmac.new(b"pag_secret", payload.encode(), hashlib.sha256).hexdigest()
        self.assertTrue(payment_utils.verify_pagseguro_webhook_signature(payload, signature))

    def test_pagseguro_fails_closed_in_production_without_secret(self):
        payment_utils.PAGSEGURO_WEBHOOK_SECRET = ""
        os.environ["APP_ENV"] = "production"
        os.environ.pop("ALLOW_INSECURE_PAGSEGURO_WEBHOOK", None)
        self.assertFalse(
            payment_utils.verify_pagseguro_webhook_signature('{"event":"x"}', "sha256=deadbeef")
        )


class MessageProcessorRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_booking_state_routes_name_collection(self):
        handle_name = AsyncMock()
        deps = _build_processor_deps(
            db=_FakeDb(state={"state": "awaiting_patient_name"}),
            handle_patient_name_response=handle_name,
            run_agent_response=AsyncMock(),
        )

        await process_incoming_message(
            deps=deps,
            clinic_id="clinic_1",
            phone="+5511999999999",
            message="Meu nome é Maria da Silva",
            message_id="wamid.name.1",
            phone_number_id="pnid",
            access_token="token",
        )

        handle_name.assert_awaited_once()

    async def test_reminder_button_routes_to_confirmation_handler(self):
        reminder_handler = AsyncMock()
        appointment = SimpleNamespace(status=SimpleNamespace(value="confirmed"))

        deps = _build_processor_deps(
            handle_reminder_response=reminder_handler,
            get_appointments_by_phone=lambda *args, **kwargs: [appointment],
        )

        await process_incoming_message(
            deps=deps,
            clinic_id="clinic_1",
            phone="+5511999999999",
            message="",
            message_id="wamid.reminder.1",
            phone_number_id="pnid",
            access_token="token",
            button_payload="confirm_yes",
        )

        reminder_handler.assert_awaited_once()

    async def test_handoff_request_escalates_to_human(self):
        escalate = AsyncMock()
        run_agent = AsyncMock()
        deps = _build_processor_deps(
            escalate_to_human=escalate,
            run_agent_response=run_agent,
            detect_human_escalation_request=lambda _: True,
        )

        await process_incoming_message(
            deps=deps,
            clinic_id="clinic_1",
            phone="+5511999999999",
            message="quero falar com atendente humano",
            message_id="wamid.handoff.1",
            phone_number_id="pnid",
            access_token="token",
        )

        escalate.assert_awaited_once()
        run_agent.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
