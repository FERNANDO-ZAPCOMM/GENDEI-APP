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
            docs = self.db.collection(CLINICS).document(clinic_id).collection(
                "professionals"
            ).where("active", "==", True).get()

            professionals = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
                data["clinicId"] = clinic_id
                professionals.append(Professional.from_dict(data))

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
    # ============================================

    def create_appointment(self, appointment: Appointment) -> str:
        """Create a new appointment"""
        try:
            doc_ref = self.db.collection(APPOINTMENTS).document(appointment.id)
            doc_ref.set(appointment.to_dict())
            logger.info(f"✅ Appointment {appointment.id} created for {appointment.patient_name}")
            return appointment.id
        except Exception as e:
            logger.error(f"Error creating appointment: {e}")
            raise

    def get_appointment(self, appointment_id: str) -> Optional[Appointment]:
        """Get appointment by ID"""
        try:
            doc = self.db.collection(APPOINTMENTS).document(appointment_id).get()
            if doc.exists:
                data = doc.to_dict()
                data["id"] = doc.id
                return Appointment.from_dict(data)
            return None
        except Exception as e:
            logger.error(f"Error getting appointment {appointment_id}: {e}")
            return None

    def update_appointment(self, appointment_id: str, data: Dict[str, Any]) -> bool:
        """Update appointment fields"""
        try:
            data["updatedAt"] = datetime.now().isoformat()
            self.db.collection(APPOINTMENTS).document(appointment_id).update(data)
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
            query = self.db.collection(APPOINTMENTS).where("clinicId", "==", clinic_id)

            if start_date:
                query = query.where("date", ">=", start_date)
            if end_date:
                query = query.where("date", "<=", end_date)
            if professional_id:
                query = query.where("professionalId", "==", professional_id)

            docs = query.get()

            appointments = []
            for doc in docs:
                data = doc.to_dict()
                data["id"] = doc.id
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
        """Get all appointments in a date range (for reminders)"""
        try:
            docs = self.db.collection(APPOINTMENTS).where(
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
        """Get appointments for a patient"""
        try:
            query = self.db.collection(APPOINTMENTS).where("patientId", "==", patient_id)

            if clinic_id:
                query = query.where("clinicId", "==", clinic_id)

            docs = query.get()

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
    # ============================================

    def get_patient(self, patient_id: str) -> Optional[Patient]:
        """Get patient by ID (phone number)"""
        try:
            doc = self.db.collection(PATIENTS).document(patient_id).get()
            if doc.exists:
                data = doc.to_dict()
                data["id"] = doc.id
                return Patient.from_dict(data)
            return None
        except Exception as e:
            logger.error(f"Error getting patient {patient_id}: {e}")
            return None

    def upsert_patient(self, patient: Patient) -> str:
        """Create or update patient"""
        try:
            doc_ref = self.db.collection(PATIENTS).document(patient.id)
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

            logger.info(f"✅ Patient {patient.id} upserted: {patient.name}")
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
    # ============================================

    def create_order(self, order_id: str, data: Dict[str, Any]) -> str:
        """Create a new order"""
        try:
            data["createdAt"] = datetime.now().isoformat()
            self.db.collection(ORDERS).document(order_id).set(data)
            logger.info(f"✅ Order {order_id} created")
            return order_id
        except Exception as e:
            logger.error(f"Error creating order: {e}")
            raise

    def get_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        """Get order by ID"""
        try:
            doc = self.db.collection(ORDERS).document(order_id).get()
            if doc.exists:
                data = doc.to_dict()
                data["id"] = doc.id
                return data
            return None
        except Exception as e:
            logger.error(f"Error getting order: {e}")
            return None

    def update_order(self, order_id: str, data: Dict[str, Any]) -> bool:
        """Update order fields"""
        try:
            data["updatedAt"] = datetime.now().isoformat()
            self.db.collection(ORDERS).document(order_id).update(data)
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
        """Log a conversation message with schema matching frontend expectations"""
        try:
            conv_ref = self.db.collection(CLINICS).document(clinic_id).collection(
                "conversations"
            ).document(phone)

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

            # Add message to subcollection with schema matching frontend
            msg_data = {
                "conversationId": phone,
                "clinicId": clinic_id,
                "direction": direction,
                "from": phone_number_id if is_outbound else phone,
                "to": phone if is_outbound else phone_number_id,
                "body": content,
                "messageType": message_type,
                "timestamp": datetime.now(),  # Firestore Timestamp
                "isAiGenerated": source == "ai",
                "isHumanSent": source == "human",
            }
            if metadata:
                msg_data["metadata"] = metadata

            conv_ref.collection("messages").add(msg_data)

            # Update conversation last message
            now = datetime.now().isoformat()
            conv_ref.update({
                "lastMessage": content[:100],
                "updatedAt": now,
                "lastMessageAt": now,
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
        """Get conversation history for a phone number"""
        try:
            messages = self.db.collection(CLINICS).document(clinic_id).collection(
                "conversations"
            ).document(phone).collection("messages").order_by(
                "timestamp", direction=firestore.Query.DESCENDING
            ).limit(limit).get()

            result = []
            for msg in messages:
                data = msg.to_dict()
                data["id"] = msg.id
                result.append(data)

            # Return in chronological order
            result.reverse()
            return result
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
