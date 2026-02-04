"""
Guardrails for WhatsApp Agent
following OpenAI Agents SDK best practices for input/output validation
"""

import logging
import re
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class GuardrailResult:
    """
    result of a guardrail check
    """
    allowed: bool
    modified_content: Optional[str] = None
    block_reason: Optional[str] = None


# ===== INPUT GUARDRAILS =====
def validate_input(message: str) -> GuardrailResult:
    """
    input guardrail - validates user message before processing
    checks for:
    - Harmful content patterns
    - Injection attempts
    - Spam patterns
    returns:
        GuardrailResult with allowed=True if safe, False if blocked
    """
    if not message or not message.strip():
        return GuardrailResult(allowed=True)

    normalized = message.lower().strip()

    # block prompt injection attempts
    injection_patterns = [
        r"ignore.*previous.*instructions",
        r"ignore.*above",
        r"disregard.*instructions",
        r"you are now",
        r"act as",
        r"pretend.*to.*be",
        r"system:?\s*prompt",
        r"<\|.*\|>",  # Token markers
        r"\[INST\]",  # Instruction markers
    ]

    for pattern in injection_patterns:
        if re.search(pattern, normalized, re.IGNORECASE):
            logger.warning(f"Input guardrail: Blocked injection attempt: {message[:50]}...")
            return GuardrailResult(
                allowed=False,
                block_reason="Mensagem não permitida"
            )

    # block excessive repetition (spam)
    words = normalized.split()
    if len(words) > 5:
        unique_words = set(words)
        if len(unique_words) < len(words) * 0.3:  # Less than 30% unique
            logger.warning(f"Input guardrail: Blocked spam pattern")
            return GuardrailResult(
                allowed=False,
                block_reason="Por favor, envie uma mensagem clara"
            )

    # block excessively long messages
    if len(message) > 2000:
        logger.warning(f"Input guardrail: Message too long ({len(message)} chars)")
        return GuardrailResult(
            allowed=True,
            modified_content=message[:2000] + "..."
        )

    return GuardrailResult(allowed=True)


# ===== OUTPUT GUARDRAILS =====
# patterns that should NEVER appear in output
BLOCKED_OUTPUT_PATTERNS = [
    # AI/Technology disclosure
    r"\bGPT\b",
    r"\bOpenAI\b",
    r"\bClaude\b",
    r"\bAnthrop",
    r"\bintelig[eê]ncia artificial\b",
    r"\b(sou|eu sou).*?\b(bot|robô|robo|IA|AI|assistente virtual)\b",
    r"\bmodelo de linguagem\b",
    r"\blarge language model\b",
    r"\bLLM\b",
    r"\bChatGPT\b",
    r"\bGemini\b",
    r"\balgor[ií]tmo\b",
    r"\bmachine learning\b",
    r"\bdeep learning\b",
    r"\bneural network\b",
    r"\brede neural\b",

    # internal system disclosure
    r"\bagent_session\b",
    r"\bfirestore\b",
    r"\bcloud run\b",
    r"\bfunction_tool\b",
    r"\bsend_text_message\b",
    r"\bsend_greeting\b",
    r"\bcreate_order\b",
]

# replacement patterns
OUTPUT_REPLACEMENTS = [
    (r"\bsou um (bot|robô|robo|assistente)\b", "sou atendente"),
    (r"\bcomo (IA|AI|inteligência artificial)\b", ""),
    (r"\bintelig[eê]ncia artificial\b", "tecnologia avançada"),
    (r"\balgor[ií]tmo\b", "sistema"),
]


def validate_output(response: str) -> GuardrailResult:
    """
    output guardrail - validates agent response before sending to user
    checks for:
    - AI/technology disclosure
    - Internal system information leaks
    - Inappropriate content
    returns:
        GuardrailResult with allowed=True and possibly modified_content
    """
    if not response or not response.strip():
        return GuardrailResult(allowed=True)

    modified = response
    was_modified = False

    # check for blocked patterns
    for pattern in BLOCKED_OUTPUT_PATTERNS:
        if re.search(pattern, modified, re.IGNORECASE):
            logger.warning(f"Output guardrail: Found blocked pattern: {pattern}")
            # remove the problematic content
            modified = re.sub(pattern, "", modified, flags=re.IGNORECASE)
            was_modified = True

    # apply replacements
    for pattern, replacement in OUTPUT_REPLACEMENTS:
        if re.search(pattern, modified, re.IGNORECASE):
            modified = re.sub(pattern, replacement, modified, flags=re.IGNORECASE)
            was_modified = True

    # clean up any double spaces or empty lines left by removals
    if was_modified:
        modified = re.sub(r'\s+', ' ', modified).strip()
        modified = re.sub(r'\n\s*\n', '\n', modified)

    # prevent generic "go to our site/socials" hallucinations unless a concrete URL/handle is present
    if re.search(r"\b(site|website|redes sociais|instagram)\b", modified, re.IGNORECASE) and not re.search(r"https?://|www\\.|@", modified):
        modified = re.sub(
            r"(?i)(^|\\s)(por favor,?\\s*)?(entre\\s+em\\s+contato|fale|chame)\\s+.*?(site|website|redes sociais|instagram).*?(\\.|$)",
            " Posso te ajudar por aqui mesmo. ",
            modified,
        ).strip()
        was_modified = True

    # check for empty response after cleaning
    if not modified.strip():
        logger.warning("Output guardrail: Response became empty after cleaning")
        return GuardrailResult(
            allowed=True,
            modified_content="Como posso te ajudar?"
        )

    if was_modified:
        logger.info(f"Output guardrail: Modified response")
        return GuardrailResult(allowed=True, modified_content=modified)

    return GuardrailResult(allowed=True)


def validate_whatsapp_compliance(response: str) -> GuardrailResult:
    """
    WhatsApp-specific guardrail for message compliance
    checks for:
    - Message length limits
    - Formatting compliance
    - Spam-like patterns
    """
    if not response:
        return GuardrailResult(allowed=True)

    # WhatsApp message length limit (4096 chars, but we want shorter)
    MAX_MESSAGE_LENGTH = 1500

    if len(response) > MAX_MESSAGE_LENGTH:
        logger.warning(f"Output guardrail: Message too long ({len(response)} chars)")
        # truncate at a sentence boundary if possible
        truncated = response[:MAX_MESSAGE_LENGTH]
        last_period = truncated.rfind('.')
        last_newline = truncated.rfind('\n')
        cut_point = max(last_period, last_newline, MAX_MESSAGE_LENGTH - 100)

        return GuardrailResult(
            allowed=True,
            modified_content=response[:cut_point + 1].strip()
        )

    return GuardrailResult(allowed=True)


# ===== COMBINED GUARDRAIL =====
def run_output_guardrails(response: str) -> str:
    """
    run all output guardrails in sequence
    args:
        response: the agent's response text
    returns:
        the validated/modified response safe to send
    """
    # first, check for blocked content
    result = validate_output(response)
    current = result.modified_content or response

    # then check WhatsApp compliance
    result = validate_whatsapp_compliance(current)
    final = result.modified_content or current

    return final


def run_input_guardrails(message: str) -> tuple[bool, str, Optional[str]]:
    """
    run all input guardrails
    args:
        message: user's input message
    returns:
        Tuple of (allowed, processed_message, block_reason)
    """
    result = validate_input(message)

    if not result.allowed:
        return False, message, result.block_reason

    processed = result.modified_content or message
    return True, processed, None
