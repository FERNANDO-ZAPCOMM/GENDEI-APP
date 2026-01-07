"""
Audio Transcription Utilities
Handles transcription of audio messages using OpenAI Whisper
"""

import os
import logging
from typing import Optional
import openai  # type: ignore

logger = logging.getLogger(__name__)

# initiaZlize OpenAI client
openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


async def transcribe_audio(file_path: str, mime_type: Optional[str] = None) -> Optional[str]:
    """
    transcribe audio file using OpenAI Whisper
    args:
        file_path: Path to audio file
        mime_type: MIME type of the audio file
    returns:
        transcribed text or None if failed
    """
    try:
        logger.info(f"Transcribing audio: {file_path}")

        with open(file_path, 'rb') as audio_file:
            response = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="pt"  # portuguese
            )

        transcription = response.text
        logger.info(f"✅ Transcription successful: {transcription[:100]}...")
        return transcription

    except Exception as e:
        logger.error(f"Error transcribing audio: {e}")
        return None
