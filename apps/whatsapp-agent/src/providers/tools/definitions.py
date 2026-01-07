"""
Provider-agnostic tool definitions.
These are converted to provider-specific formats at runtime.
"""

from typing import List, Dict, Any


# Tool definitions in a neutral format
# Each tool has: name, description, parameters (with name, type, description, required)
TOOL_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "send_text_message": {
        "name": "send_text_message",
        "description": "Send a text message to the customer via WhatsApp. This is the primary tool for communicating with customers. Use for responses, questions, and any text-based communication.",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Customer phone number in E.164 format (e.g., +5511999999999).",
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

    "send_greeting_with_products_button": {
        "name": "send_greeting_with_products_button",
        "description": "Send welcome greeting with button to show products. Use this when greeting a new customer for the first time.",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Customer phone number in E.164 format (e.g., +5511999999999).",
                "required": True,
            }
        ],
    },

    "send_notify_new_products_button": {
        "name": "send_notify_new_products_button",
        "description": "Send a NOTIFY_NEW_PRODUCTS opt-in button (no header), optionally with a short preface message. Use when the user wants to buy/enter something not yet available (no active products).",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Customer phone number in E.164 format.",
                "required": True,
            },
            {
                "name": "message",
                "type": "string",
                "description": "Optional preface message before the button.",
                "required": False,
                "default": "",
            }
        ],
    },

    "set_product_notification_preference": {
        "name": "set_product_notification_preference",
        "description": "Register user's preference to be notified about new products/community launches. Use ONLY when the user explicitly opts in.",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Customer phone number in E.164 format.",
                "required": True,
            },
            {
                "name": "wants_notification",
                "type": "boolean",
                "description": "True to enable notifications, False to disable.",
                "required": False,
                "default": True,
            },
            {
                "name": "interests",
                "type": "string",
                "description": "Optional interests/topics the user mentioned.",
                "required": False,
                "default": "",
            }
        ],
    },

    "get_product_info": {
        "name": "get_product_info",
        "description": "Get detailed information about a product. Use this to retrieve product details for answering customer questions.",
        "parameters": [
            {
                "name": "product_identifier",
                "type": "string",
                "description": "Product ID or title. If not provided, returns the default product.",
                "required": False,
            }
        ],
    },

    "list_all_products": {
        "name": "list_all_products",
        "description": "Get a list of all available products. Use this when the customer asks what products are available or wants to see all options.",
        "parameters": [],
    },

    "get_product_details": {
        "name": "get_product_details",
        "description": "Get detailed information about a product including RAG context. Returns comprehensive product information including topics, benefits, FAQ, and objection responses.",
        "parameters": [
            {
                "name": "product_id",
                "type": "string",
                "description": "The product ID to get details for.",
                "required": True,
            }
        ],
    },

    "answer_customer_question": {
        "name": "answer_customer_question",
        "description": "Find an answer for a customer question using RAG context. Searches the product's knowledge base to find relevant answers.",
        "parameters": [
            {
                "name": "product_id",
                "type": "string",
                "description": "The product ID to search within.",
                "required": True,
            },
            {
                "name": "question",
                "type": "string",
                "description": "The customer's question to answer.",
                "required": True,
            }
        ],
    },

    "get_objection_response": {
        "name": "get_objection_response",
        "description": "Get a pre-defined response for a customer objection. Use when a customer raises objections like 'it's too expensive', 'I don't have time', etc.",
        "parameters": [
            {
                "name": "product_id",
                "type": "string",
                "description": "The product ID related to the objection.",
                "required": True,
            },
            {
                "name": "objection",
                "type": "string",
                "description": "The customer's objection text.",
                "required": True,
            }
        ],
    },

    "send_product_card": {
        "name": "send_product_card",
        "description": "Send a single product card from the catalog via WhatsApp. Shows the product with image, title, price and a 'View' button.",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Customer phone number in E.164 format.",
                "required": True,
            },
            {
                "name": "product_id",
                "type": "string",
                "description": "Product ID from the catalog.",
                "required": True,
            },
            {
                "name": "body_text",
                "type": "string",
                "description": "Optional message text to accompany the product card.",
                "required": False,
            }
        ],
    },

    "send_product_catalog_list": {
        "name": "send_product_catalog_list",
        "description": "Send a multi-product catalog message via WhatsApp. Shows up to 30 products in a scrollable list.",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Customer phone number in E.164 format.",
                "required": True,
            },
            {
                "name": "header_text",
                "type": "string",
                "description": "Header text for the message (e.g., 'Nossos Produtos').",
                "required": True,
            },
            {
                "name": "body_text",
                "type": "string",
                "description": "Body text describing the products.",
                "required": True,
            },
            {
                "name": "product_ids",
                "type": "array",
                "description": "Optional list of specific product IDs. If not provided, sends all products.",
                "required": False,
            }
        ],
    },

    "send_full_catalog": {
        "name": "send_full_catalog",
        "description": "Send a catalog message that opens the full WhatsApp catalog. Customer can browse all products in the native WhatsApp catalog view.",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Customer phone number in E.164 format.",
                "required": True,
            },
            {
                "name": "body_text",
                "type": "string",
                "description": "Message text inviting to browse the catalog.",
                "required": True,
            }
        ],
    },

    "create_order_and_send_payment": {
        "name": "create_order_and_send_payment",
        "description": "Create an order and send payment instructions to the customer. Creates a new order and sends PIX payment instructions. Use when the customer confirms they want to buy.",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Customer phone number in E.164 format.",
                "required": True,
            },
            {
                "name": "product_id",
                "type": "string",
                "description": "Product ID to order. If not provided, uses the default product.",
                "required": False,
            }
        ],
    },

    "check_order_status": {
        "name": "check_order_status",
        "description": "Check the status of orders for a customer. Use when the customer asks about their order status, payment status, or wants to know if their payment was received.",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Customer phone number to check orders for.",
                "required": True,
            }
        ],
    },

    "enable_human_takeover": {
        "name": "enable_human_takeover",
        "description": "Enable human takeover for a conversation when the AI cannot handle the request. Use when customer explicitly asks to speak with a human, complex complaint, customer is frustrated, or technical issues.",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Customer phone number to enable human takeover for.",
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

    "deliver_free_product": {
        "name": "deliver_free_product",
        "description": "Deliver a free product (lead magnet) to the customer. Use when the customer has expressed interest in a free product and confirmed they want to receive it.",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Customer phone number to deliver the product to.",
                "required": True,
            },
            {
                "name": "product_id",
                "type": "string",
                "description": "ID of the free product to deliver.",
                "required": True,
            }
        ],
    },
}


# Tool groups for different agent types
AGENT_TOOL_GROUPS: Dict[str, List[str]] = {
    "greeter": [
        "send_greeting_with_products_button",
        "send_notify_new_products_button",
        "send_text_message",
        "set_product_notification_preference",
    ],
    "notification_optin": [
        "send_text_message",
    ],
    "product_info": [
        "send_text_message",
        "send_notify_new_products_button",
        "get_product_info",
        "list_all_products",
        "get_product_details",
        "answer_customer_question",
        "get_objection_response",
        "set_product_notification_preference",
        "send_product_card",
        "send_product_catalog_list",
        "send_full_catalog",
    ],
    "free_product": [
        "send_text_message",
        "deliver_free_product",
        "get_product_info",
    ],
    "objection_handler": [
        "send_text_message",
        "get_product_info",
        "get_product_details",
        "get_objection_response",
    ],
    "sales_closer": [
        "send_text_message",
        "create_order_and_send_payment",
        "get_product_info",
    ],
    "payment": [
        "send_text_message",
        "create_order_and_send_payment",
        "check_order_status",
    ],
    "support": [
        "send_text_message",
        "enable_human_takeover",
        "check_order_status",
        "set_product_notification_preference",
    ],
    "mentorship_booking": [
        "send_text_message",
        "enable_human_takeover",
    ],
    "triage": [
        "send_text_message",
    ],
}


def get_tools_for_agent(agent_type: str) -> List[str]:
    """Get tool names for an agent type."""
    return AGENT_TOOL_GROUPS.get(agent_type, ["send_text_message"])
