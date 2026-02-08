# Gendei Firestore Database
# Database operations using gendei_ prefixed collections

import os
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from google.cloud import firestore

from src.scheduler.models import (
    Clinic, Professional, Service, Appointment,
    Patient, AppointmentStatus, PaymentType
)

logger = logging.getLogger(__name__)

# Collection names with gendei_ prefix
CLINICS = "gendei_clinics"
APPOINTMENTS = "gendei_appointments"
PATIENTS = "gendei_patients"
WHATSAPP = "gendei_whatsapp"
ORDERS = "gendei_orders"
PAYMENTS = "gendei_payments"
TEMPLATES = "gendei_templates"
TOKENS = "gendei_tokens"


class GendeiDatabase:
    """Firestore database operations for Gendei"""
    MAX_MESSAGES_PER_CONVERSATION = 250

    def __init__(self, project_id: Optional[str] = None):
        """Initialize Firestore client"""
        try:
            self.project_id = project_id or os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT", "gendei-prod")
            self.db = firestore.Client(project=self.project_id)
            logger.info(f"✅ Gendei Firestore connected to project: {self.project_id}")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Firestore: {e}")
            raise

    # ============================================
    # CLINIC OPERATIONS
    # ============================================

    def get_clinic(self, clinic_id: str) -> Optional[Clinic]:
        """Get clinic by ID"""
        try:
            doc = self.db.collection(CLINICS).document(clinic_id).get()
            if doc.exists:
                data = doc.to_dict()
                data["id"] = doc.id
                return Clinic.from_dict(data)
            return None
        except Exception as e:
            logger.error(f"Error getting clinic {clinic_id}: {e}")
            return None

    def get_clinic_by_phone_number_id(self, phone_number_id: str) -> Optional[Clinic]:
        """Get clinic by WhatsApp phone number ID"""
        try:
            docs = self.db.collection(CLINICS).where(
                "whatsappPhoneNumberId", "==", phone_number_id
            ).limit(1).get()

            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                return Clinic.from_dict(data)
            return None
        except Exception as e:
            logger.error(f"Error getting clinic by phone number ID: {e}")
            return None

    def create_clinic(self, clinic: Clinic) -> str:
        """Create a new clinic"""
        try:
            doc_ref = self.db.collection(CLINICS).document(clinic.id)
            doc_ref.set(clinic.to_dict())
            logger.info(f"✅ Clinic {clinic.id} created: {clinic.name}")
            return clinic.id
        except Exception as e:
            logger.error(f"Error creating clinic: {e}")
            raise

    def update_clinic(self, clinic_id: str, data: Dict[str, Any]) -> bool:
        """Update clinic fields"""
        try:
            data["updatedAt"] = datetime.now().isoformat()
            self.db.collection(CLINICS).document(clinic_id).update(data)
            logger.info(f"✅ Clinic {clinic_id} updated")
            return True
        except Exception as e:
            logger.error(f"Error updating clinic {clinic_id}: {e}")
            return False

    # ============================================
    # PROFESSIONAL OPERATIONS
    # ============================================

    def get_clinic_professionals(self, clinic_id: str) -> List[Professional]:
        """Get all professionals for a clinic"""
        try:
            professionals_ref = self.db.collection(CLINICS).document(clinic_id).collection(
                "professionals"
            )
            docs = professionals_ref.where("active", "==", True).get()

            professionals = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                data["clinicId"] = clinic_id
                professionals.append(Professional.from_dict(data))

            # Backward-compatible fallback:
            # some legacy docs may have missing/non-boolean `active` values, which
            # are excluded by Firestore equality query.
            if not professionals:
                all_docs = professionals_ref.get()
                for doc in all_docs:
                    data = doc.to_dict() or {}
                    active_raw = data.get("active", True)
                    if isinstance(active_raw, bool):
                        is_active = active_raw
                    elif isinstance(active_raw, str):
                        is_active = active_raw.strip().lower() in {
                            "true", "1", "yes", "sim", "active", "ativo"
                        }
                    else:
                        is_active = bool(active_raw)

                    if not is_active:
                        continue

                    data["id"] = doc.id
                    data["clinicId"] = clinic_id
                    professionals.append(Professional.from_dict(data))

                if professionals:
                    logger.warning(
                        "Fallback professionals loader used for clinic %s (count=%d). "
                        "Consider normalizing `active` field to boolean true/false.",
                        clinic_id,
                        len(professionals),
                    )

            return professionals
        except Exception as e:
            logger.error(f"Error getting professionals for clinic {clinic_id}: {e}")
            return []

    def get_professional(self, clinic_id: str, professional_id: str) -> Optional[Professional]:
        """Get a specific professional"""
        try:
            doc = self.db.collection(CLINICS).document(clinic_id).collection(
                "professionals"
            ).document(professional_id).get()

            if doc.exists:
                data = doc.to_dict()
                data["id"] = doc.id
                data["clinicId"] = clinic_id
                return Professional.from_dict(data)
            return None
        except Exception as e:
            logger.error(f"Error getting professional {professional_id}: {e}")
            return None

    def create_professional(self, professional: Professional) -> str:
        """Create a new professional"""
        try:
            doc_ref = self.db.collection(CLINICS).document(
                professional.clinic_id
            ).collection("professionals").document(professional.id)
            doc_ref.set(professional.to_dict())
            logger.info(f"✅ Professional {professional.id} created: {professional.name}")
            return professional.id
        except Exception as e:
            logger.error(f"Error creating professional: {e}")
            raise

    def update_professional(self, clinic_id: str, professional_id: str, data: Dict[str, Any]) -> bool:
        """Update professional fields"""
        try:
            self.db.collection(CLINICS).document(clinic_id).collection(
                "professionals"
            ).document(professional_id).update(data)
            logger.info(f"✅ Professional {professional_id} updated")
            return True
        except Exception as e:
            logger.error(f"Error updating professional: {e}")
            return False

    # ============================================
    # SERVICE OPERATIONS
    # ============================================

    def get_clinic_services(self, clinic_id: str) -> List[Service]:
        """Get all services for a clinic"""
        try:
            docs = self.db.collection(CLINICS).document(clinic_id).collection(
                "services"
            ).where("active", "==", True).get()

            services = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                data["clinicId"] = clinic_id
                services.append(Service.from_dict(data))

            return services
        except Exception as e:
            logger.error(f"Error getting services for clinic {clinic_id}: {e}")
            return []

    def get_service(self, clinic_id: str, service_id: str) -> Optional[Service]:
        """Get a specific service"""
        try:
            doc = self.db.collection(CLINICS).document(clinic_id).collection(
                "services"
            ).document(service_id).get()

            if doc.exists:
                data = doc.to_dict()
                data["id"] = doc.id
                data["clinicId"] = clinic_id
                return Service.from_dict(data)
            return None
        except Exception as e:
            logger.error(f"Error getting service {service_id}: {e}")
            return None

    def create_service(self, service: Service) -> str:
        """Create a new service"""
        try:
            doc_ref = self.db.collection(CLINICS).document(
                service.clinic_id
            ).collection("services").document(service.id)
            doc_ref.set(service.to_dict())
            logger.info(f"✅ Service {service.id} created: {service.name}")
            return service.id
        except Exception as e:
            logger.error(f"Error creating service: {e}")
            raise

    # ============================================
    # APPOINTMENT OPERATIONS
    # Now uses nested path: clinics/{clinicId}/appointments/{appointmentId}
    # ============================================

    def create_appointment(self, appointment: Appointment) -> str:
        """Create a new appointment under the clinic subcollection"""
        try:
            # Save to clinics/{clinicId}/appointments/{appointmentId}
            doc_ref = self.db.collection(CLINICS).document(appointment.clinic_id).collection(
                "appointments"
            ).document(appointment.id)
            doc_ref.set(appointment.to_dict())
            logger.info(f"✅ Appointment {appointment.id} created for {appointment.patient_name} in clinic {appointment.clinic_id}")
            return appointment.id
        except Exception as e:
            logger.error(f"Error creating appointment: {e}")
            raise

    def get_appointment(self, appointment_id: str, clinic_id: Optional[str] = None) -> Optional[Appointment]:
        """Get appointment by ID. If clinic_id provided, use direct path; otherwise search."""
        try:
            if clinic_id:
                # Direct lookup with known clinic_id
                doc = self.db.collection(CLINICS).document(clinic_id).collection(
                    "appointments"
                ).document(appointment_id).get()
                if doc.exists:
                    data = doc.to_dict()
                    data["id"] = doc.id
                    return Appointment.from_dict(data)
                return None
            else:
                # Search using collection group query (across all clinics)
                docs = self.db.collection_group("appointments").where(
                    "id", "==", appointment_id
                ).limit(1).get()
                for doc in docs:
                    data = doc.to_dict()
                    data["id"] = doc.id
                    return Appointment.from_dict(data)
                return None
        except Exception as e:
            logger.error(f"Error getting appointment {appointment_id}: {e}")
            return None

    def update_appointment(self, appointment_id: str, data: Dict[str, Any], clinic_id: Optional[str] = None) -> bool:
        """Update appointment fields. If clinic_id provided, use direct path."""
        try:
            data["updatedAt"] = datetime.now().isoformat()

            if clinic_id:
                # Direct update with known clinic_id
                self.db.collection(CLINICS).document(clinic_id).collection(
                    "appointments"
                ).document(appointment_id).update(data)
            else:
                # Find the appointment first to get clinic_id
                appointment = self.get_appointment(appointment_id)
                if appointment:
                    self.db.collection(CLINICS).document(appointment.clinic_id).collection(
                        "appointments"
                    ).document(appointment_id).update(data)
                else:
                    logger.error(f"Appointment {appointment_id} not found for update")
                    return False

            logger.info(f"✅ Appointment {appointment_id} updated")
            return True
        except Exception as e:
            logger.error(f"Error updating appointment: {e}")
            return False

    def get_clinic_appointments(
        self,
        clinic_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        professional_id: Optional[str] = None
    ) -> List[Appointment]:
        """Get appointments for a clinic with optional filters"""
        try:
            # Query from clinics/{clinicId}/appointments subcollection
            query = self.db.collection(CLINICS).document(clinic_id).collection("appointments")

            docs = query.get()

            appointments = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id

                # Apply filters in memory (to avoid complex Firestore index requirements)
                if start_date and data.get("date", "") < start_date:
                    continue
                if end_date and data.get("date", "") > end_date:
                    continue
                if professional_id and data.get("professionalId") != professional_id:
                    continue

                appointments.append(Appointment.from_dict(data))

            return appointments
        except Exception as e:
            logger.error(f"Error getting clinic appointments: {e}")
            return []

    def get_appointments_in_range(
        self,
        clinic_id: str,
        start_date: str,
        end_date: str
    ) -> List[Appointment]:
        """Get appointments in a date range (for availability checking)"""
        return self.get_clinic_appointments(
            clinic_id=clinic_id,
            start_date=start_date,
            end_date=end_date
        )

    def get_all_appointments_in_range(
        self,
        start_date: str,
        end_date: str
    ) -> List[Appointment]:
        """Get all appointments in a date range (for reminders) using collection group"""
        try:
            # Use collection group query to get appointments from all clinics
            docs = self.db.collection_group("appointments").where(
                "date", ">=", start_date
            ).where("date", "<=", end_date).get()

            appointments = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                appointments.append(Appointment.from_dict(data))

            return appointments
        except Exception as e:
            logger.error(f"Error getting all appointments in range: {e}")
            return []

    def get_patient_appointments(
        self,
        patient_id: str,
        clinic_id: Optional[str] = None
    ) -> List[Appointment]:
        """Get appointments for a patient using collection group query"""
        try:
            if clinic_id:
                # Query specific clinic's appointments
                docs = self.db.collection(CLINICS).document(clinic_id).collection(
                    "appointments"
                ).where("patientId", "==", patient_id).get()
            else:
                # Query all clinics using collection group
                docs = self.db.collection_group("appointments").where(
                    "patientId", "==", patient_id
                ).get()

            appointments = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                appointments.append(Appointment.from_dict(data))

            return appointments
        except Exception as e:
            logger.error(f"Error getting patient appointments: {e}")
            return []

    # ============================================
    # PATIENT OPERATIONS
    # Now uses nested path: clinics/{clinicId}/patients/{patientId}
    # ============================================

    def get_patient(self, patient_id: str, clinic_id: Optional[str] = None) -> Optional[Patient]:
        """Get patient by ID (phone number). If clinic_id provided, use direct path."""
        try:
            if clinic_id:
                # Direct lookup
                doc = self.db.collection(CLINICS).document(clinic_id).collection(
                    "patients"
                ).document(patient_id).get()
                if doc.exists:
                    data = doc.to_dict()
                    data["id"] = doc.id
                    return Patient.from_dict(data)
                return None
            else:
                # Search across all clinics using collection group
                docs = self.db.collection_group("patients").where(
                    "id", "==", patient_id
                ).limit(1).get()
                for doc in docs:
                    data = doc.to_dict()
                    data["id"] = doc.id
                    return Patient.from_dict(data)
                return None
        except Exception as e:
            logger.error(f"Error getting patient {patient_id}: {e}")
            return None

    def upsert_patient(self, patient: Patient) -> str:
        """Create or update patient under clinic subcollection"""
        try:
            # Patient should have at least one clinic_id
            if not patient.clinic_ids:
                raise ValueError("Patient must have at least one clinic_id")

            clinic_id = patient.clinic_ids[0]  # Primary clinic

            doc_ref = self.db.collection(CLINICS).document(clinic_id).collection(
                "patients"
            ).document(patient.id)
            existing = doc_ref.get()

            if existing.exists:
                # Update only if data changed
                update_data = {
                    "name": patient.name,
                    "updatedAt": datetime.now().isoformat()
                }
                if patient.cpf:
                    update_data["cpf"] = patient.cpf
                if patient.birth_date:
                    update_data["birthDate"] = patient.birth_date
                if patient.email:
                    update_data["email"] = patient.email
                if patient.convenio_name:
                    update_data["convenioName"] = patient.convenio_name
                if patient.convenio_number:
                    update_data["convenioNumber"] = patient.convenio_number

                # Add clinic to list if not present
                existing_data = existing.to_dict()
                clinic_ids = existing_data.get("clinicIds", [])
                for cid in patient.clinic_ids:
                    if cid not in clinic_ids:
                        clinic_ids.append(cid)
                update_data["clinicIds"] = clinic_ids

                doc_ref.update(update_data)
            else:
                # Create new patient
                doc_ref.set(patient.to_dict())

            logger.info(f"✅ Patient {patient.id} upserted in clinic {clinic_id}: {patient.name}")
            return patient.id
        except Exception as e:
            logger.error(f"Error upserting patient: {e}")
            raise

    # ============================================
    # WHATSAPP CONNECTION OPERATIONS
    # ============================================

    def get_whatsapp_connection(self, phone_number_id: str) -> Optional[Dict[str, Any]]:
        """Get WhatsApp connection by phone number ID"""
        try:
            doc = self.db.collection(WHATSAPP).document(phone_number_id).get()
            if doc.exists:
                data = doc.to_dict()
                data["id"] = doc.id
                return data
            return None
        except Exception as e:
            logger.error(f"Error getting WhatsApp connection: {e}")
            return None

    def save_whatsapp_connection(self, phone_number_id: str, data: Dict[str, Any]) -> bool:
        """Save WhatsApp connection"""
        try:
            data["updatedAt"] = datetime.now().isoformat()
            self.db.collection(WHATSAPP).document(phone_number_id).set(data, merge=True)
            logger.info(f"✅ WhatsApp connection {phone_number_id} saved")
            return True
        except Exception as e:
            logger.error(f"Error saving WhatsApp connection: {e}")
            return False

    # ============================================
    # ORDER OPERATIONS
    # Now uses nested path: clinics/{clinicId}/orders/{orderId}
    # ============================================

    def create_order(self, order_id: str, data: Dict[str, Any], clinic_id: Optional[str] = None) -> str:
        """Create a new order under clinic subcollection"""
        try:
            data["createdAt"] = datetime.now().isoformat()
            # Use clinic_id from data if not provided as parameter
            cid = clinic_id or data.get("clinicId")
            if not cid:
                raise ValueError("Order must have a clinicId")

            self.db.collection(CLINICS).document(cid).collection(
                "orders"
            ).document(order_id).set(data)
            logger.info(f"✅ Order {order_id} created in clinic {cid}")
            return order_id
        except Exception as e:
            logger.error(f"Error creating order: {e}")
            raise

    def get_order(self, order_id: str, clinic_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get order by ID. If clinic_id provided, use direct path; otherwise search."""
        try:
            if clinic_id:
                # Direct lookup
                doc = self.db.collection(CLINICS).document(clinic_id).collection(
                    "orders"
                ).document(order_id).get()
                if doc.exists:
                    data = doc.to_dict()
                    data["id"] = doc.id
                    return data
                return None
            else:
                # Search across all clinics using collection group
                docs = self.db.collection_group("orders").where(
                    "id", "==", order_id
                ).limit(1).get()
                for doc in docs:
                    data = doc.to_dict()
                    data["id"] = doc.id
                    return data
                return None
        except Exception as e:
            logger.error(f"Error getting order: {e}")
            return None

    def update_order(self, order_id: str, data: Dict[str, Any], clinic_id: Optional[str] = None) -> bool:
        """Update order fields. If clinic_id provided, use direct path."""
        try:
            data["updatedAt"] = datetime.now().isoformat()

            if clinic_id:
                # Direct update
                self.db.collection(CLINICS).document(clinic_id).collection(
                    "orders"
                ).document(order_id).update(data)
            else:
                # Find order first to get clinic_id
                order = self.get_order(order_id)
                if order and order.get("clinicId"):
                    self.db.collection(CLINICS).document(order["clinicId"]).collection(
                        "orders"
                    ).document(order_id).update(data)
                else:
                    logger.error(f"Order {order_id} not found for update")
                    return False

            return True
        except Exception as e:
            logger.error(f"Error updating order: {e}")
            return False

    # ============================================
    # TOKEN OPERATIONS
    # ============================================

    def save_access_token(self, clinic_id: str, token_data: Dict[str, Any]) -> bool:
        """Save encrypted access token"""
        try:
            token_data["updatedAt"] = datetime.now().isoformat()
            self.db.collection(TOKENS).document(clinic_id).set(token_data, merge=True)
            return True
        except Exception as e:
            logger.error(f"Error saving access token: {e}")
            return False

    def get_access_token(self, clinic_id: str) -> Optional[str]:
        """Get access token for clinic - prioritizes BISU token for reliability"""
        try:
            # 1. First try BISU token from environment (most reliable - system user token)
            # The BISU token has permissions to all WABAs connected via Embedded Signup
            # Check both META_BISU_ACCESS_TOKEN and WHATSAPP_TOKEN for backward compatibility
            bisu_token = os.getenv("META_BISU_ACCESS_TOKEN") or os.getenv("WHATSAPP_TOKEN")
            if bisu_token:
                logger.info(f"✅ Using system token from environment for {clinic_id}")
                return bisu_token

            # 2. Fall back to whatsappAccessToken in clinic document
            # This is the user OAuth token from Embedded Signup (may be short-lived)
            clinic_doc = self.db.collection(CLINICS).document(clinic_id).get()
            if clinic_doc.exists:
                clinic_data = clinic_doc.to_dict()
                clinic_token = clinic_data.get("whatsappAccessToken")
                if clinic_token:
                    logger.info(f"⚠️ Using whatsappAccessToken from clinic doc for {clinic_id} (fallback)")
                    return clinic_token

            # 3. Fall back to tokens collection
            token_doc = self.db.collection(TOKENS).document(clinic_id).get()
            if token_doc.exists:
                token_data = token_doc.to_dict()
                stored_token = token_data.get("accessToken")
                if stored_token:
                    logger.info(f"⚠️ Using accessToken from tokens collection for {clinic_id} (fallback)")
                    return stored_token

            logger.warning(f"❌ No access token found for clinic {clinic_id}")
            return None
        except Exception as e:
            logger.error(f"Error getting access token for {clinic_id}: {e}")
            return None

    def get_clinic_access_token(self, clinic_id: str) -> Optional[str]:
        """Alias for get_access_token - Get WhatsApp access token for clinic"""
        return self.get_access_token(clinic_id)

    # ============================================
    # CONVERSATION/CHAT OPERATIONS
    # ============================================

    def log_conversation_message(
        self,
        clinic_id: str,
        phone: str,
        message_type: str,
        content: str,
        source: str = "patient",
        metadata: Optional[Dict[str, Any]] = None,
        phone_number_id: Optional[str] = None
    ) -> bool:
        """Log a conversation message using single-doc chat history format."""
        try:
            conv_ref = self.db.collection(CLINICS).document(clinic_id).collection(
                "conversations"
            ).document(phone)
            chat_history_ref = conv_ref.collection("messages").document("chat_history")

            # Create conversation doc if not exists
            conv_doc = conv_ref.get()
            if not conv_doc.exists:
                now = datetime.now().isoformat()
                conv_ref.set({
                    "id": phone,
                    "clinicId": clinic_id,
                    "phone": phone,
                    "waUserId": phone,
                    "waUserPhone": phone,
                    "state": "novo",
                    "lastMessage": content[:100],
                    "messageCount": 0,
                    "isHumanTakeover": False,
                    "aiPaused": False,
                    "createdAt": now,
                    "updatedAt": now,
                    "lastMessageAt": now
                })

            # Determine direction based on source
            is_outbound = source in ["ai", "human", "system", "clinic"]
            direction = "out" if is_outbound else "in"
            now = datetime.utcnow()
            timestamp_iso = now.isoformat()
            timestamp_key = timestamp_iso.replace(".", "_")

            # Store all messages in a single chat_history document map.
            msg_data = {
                "conversationId": phone,
                "clinicId": clinic_id,
                "direction": direction,
                "from": phone_number_id if is_outbound else phone,
                "to": phone if is_outbound else phone_number_id,
                "body": content,
                "messageType": message_type,
                "timestamp": timestamp_iso,
                "isAiGenerated": source == "ai",
                "isHumanSent": source == "human",
            }
            if metadata:
                msg_data["metadata"] = metadata

            existing_doc = chat_history_ref.get()
            if not existing_doc.exists:
                # One-time bootstrap: migrate legacy per-message docs into chat_history.
                legacy_docs = conv_ref.collection("messages").order_by(
                    "timestamp", direction=firestore.Query.DESCENDING
                ).limit(self.MAX_MESSAGES_PER_CONVERSATION - 1).get()

                messages_map: Dict[str, Dict[str, Any]] = {}
                for legacy_doc in reversed(list(legacy_docs)):
                    legacy_data = legacy_doc.to_dict()
                    legacy_ts = legacy_data.get("timestamp")
                    if hasattr(legacy_ts, "isoformat"):
                        legacy_ts_iso = legacy_ts.isoformat()
                    elif legacy_ts:
                        legacy_ts_iso = str(legacy_ts)
                    else:
                        legacy_ts_iso = datetime.utcnow().isoformat()
                    legacy_key = legacy_ts_iso.replace(".", "_")
                    legacy_data["timestamp"] = legacy_ts_iso
                    messages_map[legacy_key] = legacy_data

                messages_map[timestamp_key] = msg_data
                sorted_entries = sorted(messages_map.items(), key=lambda item: item[0])
                trimmed_entries = sorted_entries[-self.MAX_MESSAGES_PER_CONVERSATION:]
                trimmed_map = dict(trimmed_entries)

                chat_history_ref.set({
                    "messages": trimmed_map,
                    "lastUpdated": timestamp_iso,
                    "messageCount": len(trimmed_map),
                    "clinicId": clinic_id,
                    "waUserId": phone,
                })
            else:
                existing_count = int(existing_doc.to_dict().get("messageCount", 0))
                next_count = existing_count + 1
                trim_count = max(next_count - self.MAX_MESSAGES_PER_CONVERSATION, 0)

                history_updates: Dict[str, Any] = {
                    f"messages.{timestamp_key}": msg_data,
                    "lastUpdated": timestamp_iso,
                    "messageCount": min(next_count, self.MAX_MESSAGES_PER_CONVERSATION),
                    "clinicId": clinic_id,
                    "waUserId": phone,
                }

                if trim_count > 0:
                    messages_map = existing_doc.to_dict().get("messages", {})
                    sorted_keys = sorted(messages_map.keys())
                    keys_to_remove = sorted_keys[:trim_count]
                    for key in keys_to_remove:
                        history_updates[f"messages.{key}"] = firestore.DELETE_FIELD

                chat_history_ref.set(history_updates, merge=True)

            # Update conversation last message
            now_iso = datetime.now().isoformat()
            conv_ref.update({
                "lastMessage": content[:100],
                "updatedAt": now_iso,
                "lastMessageAt": now_iso,
                "messageCount": firestore.Increment(1)
            })

            logger.debug(f"📝 Logged {direction} message for {phone}")
            return True
        except Exception as e:
            logger.error(f"Error logging conversation message: {e}")
            return False

    def get_conversation_history(
        self,
        clinic_id: str,
        phone: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get conversation history for a phone number."""
        try:
            conv_ref = self.db.collection(CLINICS).document(clinic_id).collection(
                "conversations"
            ).document(phone)

            # New format: single chat_history document.
            chat_history_doc = conv_ref.collection("messages").document("chat_history").get()
            if chat_history_doc.exists:
                data = chat_history_doc.to_dict() or {}
                messages_map = data.get("messages", {})
                sorted_messages = sorted(
                    messages_map.items(),
                    key=lambda item: item[1].get("timestamp", item[0])
                )[-limit:]
                result = []
                for message_id, message_data in sorted_messages:
                    message = dict(message_data)
                    message["id"] = message_id
                    result.append(message)
                return result

            # Legacy fallback: one document per message in subcollection.
            messages = conv_ref.collection("messages").order_by(
                "timestamp", direction=firestore.Query.DESCENDING
            ).limit(limit).get()

            legacy_result = []
            for msg in messages:
                message_data = msg.to_dict()
                message_data["id"] = msg.id
                legacy_result.append(message_data)

            legacy_result.reverse()
            return legacy_result
        except Exception as e:
            logger.error(f"Error getting conversation history: {e}")
            return []

    # ============================================
    # REMINDER OPERATIONS
    # ============================================

    def create_reminder(self, data: Dict[str, Any]) -> str:
        """Create a reminder record"""
        try:
            doc_ref = self.db.collection("gendei_reminders").add(data)
            return doc_ref[1].id
        except Exception as e:
            logger.error(f"Error creating reminder: {e}")
            raise

    def get_pending_reminders(self, clinic_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get pending reminders"""
        try:
            query = self.db.collection("gendei_reminders").where("sent", "==", False)

            docs = query.get()
            reminders = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                reminders.append(data)

            return reminders
        except Exception as e:
            logger.error(f"Error getting pending reminders: {e}")
            return []

    def mark_reminder_sent(self, reminder_id: str) -> bool:
        """Mark a reminder as sent"""
        try:
            self.db.collection("gendei_reminders").document(reminder_id).update({
                "sent": True,
                "sentAt": datetime.now().isoformat()
            })
            return True
        except Exception as e:
            logger.error(f"Error marking reminder sent: {e}")
            return False

    # ============================================
    # CONTACT MANAGEMENT (Like Zapcomm)
    # ============================================

    def upsert_contact(
        self,
        clinic_id: str,
        phone: str,
        name: Optional[str] = None,
        profile_picture_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Create or update a contact in the contacts collection.
        Args:
            clinic_id: Clinic ID
            phone: WhatsApp phone number (used as document ID)
            name: Contact name from WhatsApp profile
            profile_picture_url: URL to profile picture
            metadata: Additional metadata
        Returns:
            Contact ID if successful
        """
        try:
            # Use phone number as document ID
            contact_id = phone.replace(' ', '')
            contact_ref = self.db.collection(CLINICS).document(clinic_id).collection(
                "contacts"
            ).document(contact_id)

            doc = contact_ref.get()
            now = datetime.now().isoformat()

            if doc.exists:
                # Update existing contact
                updates = {
                    "updatedAt": now,
                    "lastMessageAt": now,
                }
                if name:
                    updates["name"] = name
                if profile_picture_url:
                    updates["profilePictureUrl"] = profile_picture_url

                # Increment message count
                current_data = doc.to_dict()
                updates["messageCount"] = current_data.get("messageCount", 0) + 1

                contact_ref.update(updates)
                logger.debug(f"👤 Updated contact {contact_id}: {name}")
            else:
                # Create new contact
                contact_data = {
                    "id": contact_id,
                    "phone": phone,
                    "name": name,
                    "profilePictureUrl": profile_picture_url,
                    "clinicId": clinic_id,
                    "source": "whatsapp",
                    "messageCount": 1,
                    "tags": [],
                    "metadata": metadata or {},
                    "createdAt": now,
                    "updatedAt": now,
                    "lastMessageAt": now,
                }
                contact_ref.set(contact_data)
                logger.info(f"👤 Created new contact {contact_id}: {name}")

            return contact_id

        except Exception as e:
            logger.error(f"Error upserting contact: {e}")
            return None

    def get_contact(self, clinic_id: str, phone: str) -> Optional[Dict[str, Any]]:
        """
        Get a contact by phone number.
        Args:
            clinic_id: Clinic ID
            phone: WhatsApp phone number
        Returns:
            Contact data if found
        """
        try:
            contact_id = phone.replace(' ', '')
            contact_ref = self.db.collection(CLINICS).document(clinic_id).collection(
                "contacts"
            ).document(contact_id)
            doc = contact_ref.get()

            if doc.exists:
                contact = doc.to_dict()
                contact["id"] = doc.id
                return contact

            return None

        except Exception as e:
            logger.error(f"Error getting contact: {e}")
            return None

    # ============================================
    # HUMAN TAKEOVER (Like Zapcomm)
    # ============================================

    def is_human_takeover_enabled(self, clinic_id: str, phone: str) -> bool:
        """
        Check if human takeover is enabled for this conversation.
        Checks both 'isHumanTakeover' (dashboard) and 'humanTakeover' (agent) fields.
        Also checks 'aiPaused' for additional safety.
        """
        try:
            conv_ref = self.db.collection(CLINICS).document(clinic_id).collection(
                "conversations"
            ).document(phone)
            doc = conv_ref.get()

            if doc.exists:
                data = doc.to_dict()
                # Check all possible takeover flags
                is_takeover = data.get("isHumanTakeover", False) or data.get("humanTakeover", False)
                ai_paused = data.get("aiPaused", False)
                return is_takeover or ai_paused

            return False

        except Exception as e:
            logger.error(f"Error checking human takeover: {e}")
            return False

    def set_human_takeover(
        self,
        clinic_id: str,
        phone: str,
        enabled: bool,
        reason: Optional[str] = None
    ) -> bool:
        """
        Set human takeover status for a conversation.
        Args:
            clinic_id: Clinic ID
            phone: WhatsApp phone number
            enabled: Whether to enable human takeover
            reason: Optional reason for handoff
        Returns:
            True if successful
        """
        try:
            conv_ref = self.db.collection(CLINICS).document(clinic_id).collection(
                "conversations"
            ).document(phone)

            now = datetime.now().isoformat()
            updates = {
                "humanTakeover": enabled,
                "isHumanTakeover": enabled,  # Dashboard uses this field
                "handledBy": "human" if enabled else "ai",
                "aiPaused": enabled,
                "updatedAt": now
            }

            if enabled:
                updates["humanTakeoverAt"] = now
                updates["takenOverAt"] = now  # Dashboard uses this field
                if reason:
                    updates["humanTakeoverReason"] = reason

            conv_ref.set(updates, merge=True)

            logger.info(f"{'🙋' if enabled else '🤖'} Human takeover {'enabled' if enabled else 'disabled'} for {phone}")
            return True

        except Exception as e:
            logger.error(f"Error setting human takeover: {e}")
            return False

    # ============================================
    # CONVERSATION STATE PERSISTENCE (Like Zapcomm)
    # ============================================

    def load_conversation_state(self, clinic_id: str, phone: str) -> Dict[str, Any]:
        """
        Load conversation state for a WhatsApp user.
        Args:
            clinic_id: Clinic ID
            phone: WhatsApp user ID (phone number)
        Returns:
            Conversation state dict
        """
        try:
            conv_ref = self.db.collection(CLINICS).document(clinic_id).collection(
                "conversations"
            ).document(phone)
            doc = conv_ref.get()

            if doc.exists:
                state = doc.to_dict()
                logger.debug(f"📋 Loaded conversation state for {phone}")
                return state
            else:
                # Create new conversation state
                now = datetime.now().isoformat()
                new_state = {
                    "id": phone,
                    "clinicId": clinic_id,
                    "phone": phone,
                    "waUserId": phone,  # For frontend compatibility
                    "waUserPhone": phone,  # Phone number for display
                    "state": "novo",  # Portuguese state name for frontend
                    "context": {},
                    "lastMessageAt": now,
                    "isSessionActive": True,
                    "isHumanTakeover": False,
                    "aiPaused": False,
                    "createdAt": now,
                    "updatedAt": now
                }
                conv_ref.set(new_state)
                logger.info(f"📋 Created new conversation state for {phone}")
                return new_state

        except Exception as e:
            logger.error(f"Error loading conversation state: {e}")
            # Return minimal state
            return {
                "phone": phone,
                "clinicId": clinic_id,
                "waUserId": phone,
                "waUserPhone": phone,
                "state": "novo",
                "context": {},
                "isSessionActive": True,
                "isHumanTakeover": False,
                "aiPaused": False
            }

    def save_conversation_state(self, clinic_id: str, phone: str, state: Dict[str, Any]) -> bool:
        """
        Save conversation state.
        Args:
            clinic_id: Clinic ID
            phone: WhatsApp user ID
            state: Conversation state to save
        Returns:
            True if successful
        """
        try:
            conv_ref = self.db.collection(CLINICS).document(clinic_id).collection(
                "conversations"
            ).document(phone)

            # Update timestamps
            now = datetime.now().isoformat()
            state["updatedAt"] = now
            state["lastMessageAt"] = now

            # Merge with existing data
            conv_ref.set(state, merge=True)

            logger.debug(f"💾 Saved conversation state for {phone}")
            return True

        except Exception as e:
            logger.error(f"Error saving conversation state: {e}")
            return False

    def get_conversation_state(self, clinic_id: str, phone: str) -> Optional[Dict[str, Any]]:
        """
        Get conversation state.
        Args:
            clinic_id: Clinic ID
            phone: WhatsApp user ID
        Returns:
            Conversation state dict or None if not found
        """
        try:
            conv_ref = self.db.collection(CLINICS).document(clinic_id).collection(
                "conversations"
            ).document(phone)

            doc = conv_ref.get()
            if doc.exists:
                return doc.to_dict()
            return None

        except Exception as e:
            logger.error(f"Error getting conversation state: {e}")
            return None

    # ============================================
    # MESSAGE DEDUPLICATION (Like Zapcomm - Firestore-backed)
    # ============================================

    def is_message_processed(self, message_id: str, ttl_hours: int = 24) -> bool:
        """
        Check if a message has already been processed (Firestore-backed).
        Args:
            message_id: WhatsApp message ID
            ttl_hours: Hours to keep message IDs
        Returns:
            True if message was already processed
        """
        try:
            doc_ref = self.db.collection("gendei_processed_messages").document(message_id)
            doc = doc_ref.get()

            if doc.exists:
                # Check if within TTL
                data = doc.to_dict()
                processed_at = data.get("processedAt", "")
                if processed_at:
                    processed_time = datetime.fromisoformat(processed_at)
                    if datetime.now() - processed_time < timedelta(hours=ttl_hours):
                        return True
                    # Expired, will be re-processed
                    doc_ref.delete()
                    return False
                return True

            return False

        except Exception as e:
            logger.error(f"Error checking message processed: {e}")
            return False

    def mark_message_processed(self, message_id: str) -> bool:
        """
        Mark a message as processed.
        Args:
            message_id: WhatsApp message ID
        Returns:
            True if successful
        """
        try:
            self.db.collection("gendei_processed_messages").document(message_id).set({
                "messageId": message_id,
                "processedAt": datetime.now().isoformat()
            })
            return True
        except Exception as e:
            logger.error(f"Error marking message processed: {e}")
            return False

    # ============================================
    # APPOINTMENTS NEEDING REMINDERS
    # ============================================

    def get_appointments_needing_reminder(
        self,
        reminder_type: str,
        clinic_id: Optional[str] = None
    ) -> List[Appointment]:
        """
        Get appointments that need a specific reminder sent.
        Args:
            reminder_type: "reminder_24h" or "reminder_2h"
            clinic_id: Optional filter by clinic
        Returns:
            List of appointments needing reminders
        """
        try:
            now = datetime.now()

            if reminder_type == "reminder_24h":
                # Get appointments 23-25 hours from now
                window_start = now + timedelta(hours=23)
                window_end = now + timedelta(hours=25)
            elif reminder_type == "reminder_2h":
                # Get appointments 1.5-2.5 hours from now
                window_start = now + timedelta(hours=1, minutes=30)
                window_end = now + timedelta(hours=2, minutes=30)
            else:
                logger.error(f"Unknown reminder type: {reminder_type}")
                return []

            # Query appointments in the window
            start_date = window_start.date().isoformat()
            end_date = window_end.date().isoformat()

            query = self.db.collection(APPOINTMENTS).where("date", ">=", start_date).where("date", "<=", end_date)

            if clinic_id:
                query = query.where("clinicId", "==", clinic_id)

            docs = query.get()

            # Filter to confirmed appointments that haven't received this reminder
            needs_reminder = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id

                # Check status
                status = data.get("status", "")
                if status not in ["confirmed", "confirmed_presence"]:
                    continue

                # Check if already sent
                if reminder_type == "reminder_24h" and data.get("reminder24hSent"):
                    continue
                if reminder_type == "reminder_2h" and data.get("reminder2hSent"):
                    continue

                # Check if in time window
                apt_date = data.get("date", "")
                apt_time = data.get("time", "00:00")
                try:
                    apt_dt = datetime.strptime(f"{apt_date} {apt_time}", "%Y-%m-%d %H:%M")
                    if window_start <= apt_dt <= window_end:
                        needs_reminder.append(Appointment.from_dict(data))
                except ValueError:
                    continue

            logger.info(f"Found {len(needs_reminder)} appointments needing {reminder_type}")
            return needs_reminder

        except Exception as e:
            logger.error(f"Error getting appointments needing reminder: {e}")
            return []
