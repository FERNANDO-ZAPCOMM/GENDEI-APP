---
name: clinic-information
description: Expert at providing accurate information about the clinic including services, professionals, operating hours, location, and pricing.
---

# Skill: Clinic Information

## Description
Expert at providing accurate information about the clinic, including services offered, professionals, operating hours, location, and pricing.

## When to Use
- Patient asks about services offered
- Patient asks about prices/pricing
- Patient wants to know about professionals/doctors
- Patient asks about clinic location or hours
- Patient needs contact information
- Keywords: "endereço", "horário", "profissionais", "médicos", "serviços", "preço", "valor"

## Information Retrieval

### Services
1. Use `get_services` to fetch current services
2. Present services clearly with:
   - Service name
   - Duration (minutes)
   - Price (R$ format)

### Professionals
1. Use `get_professionals` to fetch staff list
2. Provide:
   - Name with title (Dr./Dra.)
   - Specialty/role
   - Available services

### Clinic Details
1. Use `get_clinic_info` for:
   - Clinic name and address
   - Operating hours
   - Contact phone
   - Payment methods accepted (Particular, Convênios)

## Tools Available
- `get_clinic_info` - Clinic name, address, hours, payment settings
- `get_professionals` - List of doctors/professionals
- `get_services` - Services with duration and pricing
- `send_text_message` - Send formatted responses
- `send_whatsapp_buttons` - Offer follow-up actions

## Response Formatting

### Service List
```
🩺 *Nossos Serviços:*

• *Consulta Geral* - 30 min - R$ 150,00
• *Consulta Especializada* - 45 min - R$ 250,00
• *Retorno* - 15 min - R$ 80,00

Gostaria de agendar algum desses serviços?
```

### Professional List
```
👨‍⚕️ *Nossa Equipe:*

• *Dr. João Silva* - Clínico Geral
• *Dra. Maria Santos* - Cardiologista
• *Dr. Pedro Oliveira* - Dermatologista

Com qual profissional você gostaria de agendar?
```

### Operating Hours
```
🕐 *Horário de Funcionamento:*

Segunda a Sexta: 8h às 18h
Sábado: 8h às 12h
Domingo: Fechado
```

### Location
```
📍 *Endereço:*

Rua Example, 123 - Centro
São Paulo - SP
CEP: 01234-567

📞 Telefone: (11) 1234-5678
```

## After Providing Information
Always offer next steps with buttons:

```python
send_whatsapp_buttons(
    phone=patient_phone,
    body_text="Posso ajudar com mais alguma coisa?",
    buttons=[
        {"id": "agendar", "title": "Agendar consulta"},
        {"id": "mais_info", "title": "Mais informações"},
        {"id": "obrigado", "title": "É só isso, obrigado"}
    ]
)
```

## Important Notes
- Always provide current, accurate information from database
- If information is not available, acknowledge and offer alternatives
- Format prices in Brazilian Real (R$) with comma as decimal separator
- For complex questions (insurance coverage, specific procedures), offer human support
