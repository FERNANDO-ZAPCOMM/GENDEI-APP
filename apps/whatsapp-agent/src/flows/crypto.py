"""
WhatsApp Flows Encryption/Decryption Module

Handles encrypted data exchange for WhatsApp Flows endpoints.
Uses AES-128-GCM for payload encryption and RSA for key exchange.

Based on WhatsApp Business Platform documentation:
https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint
"""

import os
import json
import base64
import logging
from typing import Dict, Any, Tuple, Optional
from cryptography.hazmat.primitives import hashes, serialization  # type: ignore
from cryptography.hazmat.primitives.asymmetric import padding as asym_padding  # type: ignore
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes  # type: ignore
from cryptography.hazmat.backends import default_backend  # type: ignore

logger = logging.getLogger(__name__)

# Get private key from environment
FLOWS_PRIVATE_KEY_PEM = os.getenv("FLOWS_PRIVATE_KEY", "")


def _get_private_key():
    """Load the RSA private key from environment variable."""
    if not FLOWS_PRIVATE_KEY_PEM:
        return None

    # Handle escaped newlines in environment variable
    pem_data = FLOWS_PRIVATE_KEY_PEM.replace("\\n", "\n")

    try:
        private_key = serialization.load_pem_private_key(
            pem_data.encode(),
            password=None,
            backend=default_backend()
        )
        return private_key
    except Exception as e:
        logger.error(f"Failed to load private key: {e}")
        return None


def decrypt_request(
    encrypted_flow_data: str,
    encrypted_aes_key: str,
    initial_vector: str,
) -> Tuple[Optional[Dict[str, Any]], Optional[bytes], Optional[bytes]]:
    """
    Decrypt an incoming WhatsApp Flow request.

    Args:
        encrypted_flow_data: Base64-encoded encrypted payload
        encrypted_aes_key: Base64-encoded RSA-encrypted AES key
        initial_vector: Base64-encoded initialization vector

    Returns:
        Tuple of (decrypted_data dict, aes_key bytes, iv bytes)
        Returns (None, None, None) if decryption fails or encryption not configured
    """
    private_key = _get_private_key()

    if not private_key:
        logger.warning("Flows encryption not configured (no private key)")
        return None, None, None

    try:
        # Decode base64 inputs
        encrypted_aes_key_bytes = base64.b64decode(encrypted_aes_key)
        encrypted_data_bytes = base64.b64decode(encrypted_flow_data)
        iv_bytes = base64.b64decode(initial_vector)

        # Decrypt the AES key using RSA-OAEP
        aes_key = private_key.decrypt(
            encrypted_aes_key_bytes,
            asym_padding.OAEP(
                mgf=asym_padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )

        # Decrypt the flow data using AES-128-GCM
        # The encrypted data has the auth tag appended (last 16 bytes)
        auth_tag = encrypted_data_bytes[-16:]
        ciphertext = encrypted_data_bytes[:-16]

        cipher = Cipher(
            algorithms.AES(aes_key),
            modes.GCM(iv_bytes, auth_tag),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        decrypted_bytes = decryptor.update(ciphertext) + decryptor.finalize()

        # Parse JSON
        decrypted_data = json.loads(decrypted_bytes.decode('utf-8'))

        logger.info("Successfully decrypted flow request")
        return decrypted_data, aes_key, iv_bytes

    except Exception as e:
        logger.error(f"Failed to decrypt flow request: {e}")
        return None, None, None


def encrypt_response(
    response_data: Dict[str, Any],
    aes_key: bytes,
    initial_vector: bytes,
) -> str:
    """
    Encrypt a WhatsApp Flow response.

    Args:
        response_data: Response data dict to encrypt
        aes_key: AES key (same as used for decryption)
        initial_vector: Original IV (will be flipped for response)

    Returns:
        Base64-encoded encrypted response
    """
    try:
        # Flip the IV for response (per WhatsApp Flows spec)
        flipped_iv = bytes(b ^ 0xFF for b in initial_vector)

        # Serialize response to JSON
        response_json = json.dumps(response_data)
        response_bytes = response_json.encode('utf-8')

        # Encrypt using AES-128-GCM with flipped IV
        cipher = Cipher(
            algorithms.AES(aes_key),
            modes.GCM(flipped_iv),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(response_bytes) + encryptor.finalize()

        # Append auth tag to ciphertext
        encrypted_data = ciphertext + encryptor.tag

        # Base64 encode
        encrypted_response = base64.b64encode(encrypted_data).decode('utf-8')

        logger.info("Successfully encrypted flow response")
        return encrypted_response

    except Exception as e:
        logger.error(f"Failed to encrypt flow response: {e}")
        raise


def is_encryption_configured() -> bool:
    """Check if flows encryption is configured (private key available)."""
    return bool(FLOWS_PRIVATE_KEY_PEM)


def handle_encrypted_flow_request(raw_body: bytes) -> Tuple[Dict[str, Any], Optional[bytes], Optional[bytes], bool]:
    """
    Handle an incoming flow request, detecting whether it's encrypted or not.

    Args:
        raw_body: Raw request body bytes

    Returns:
        Tuple of (decrypted_data, aes_key, iv, is_encrypted)
        If not encrypted, returns (parsed_json, None, None, False)
    """
    try:
        body = json.loads(raw_body)

        # Check if this is an encrypted request
        if all(key in body for key in ['encrypted_flow_data', 'encrypted_aes_key', 'initial_vector']):
            # Encrypted request
            decrypted_data, aes_key, iv = decrypt_request(
                body['encrypted_flow_data'],
                body['encrypted_aes_key'],
                body['initial_vector']
            )

            if decrypted_data is None:
                # Decryption failed
                logger.error("Failed to decrypt flow request")
                return {"error": "decryption_failed"}, None, None, True

            return decrypted_data, aes_key, iv, True
        else:
            # Unencrypted request (development/testing)
            return body, None, None, False

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse flow request body: {e}")
        return {"error": "invalid_json"}, None, None, False


def prepare_flow_response(
    response_data: Dict[str, Any],
    aes_key: Optional[bytes],
    initial_vector: Optional[bytes],
    is_encrypted: bool,
) -> Any:
    """
    Prepare a flow response, encrypting if necessary.

    Args:
        response_data: Response data dict
        aes_key: AES key (if encrypted request)
        initial_vector: IV (if encrypted request)
        is_encrypted: Whether the original request was encrypted

    Returns:
        Encrypted string if encrypted request, otherwise dict
    """
    if is_encrypted and aes_key and initial_vector:
        return encrypt_response(response_data, aes_key, initial_vector)
    else:
        return response_data
