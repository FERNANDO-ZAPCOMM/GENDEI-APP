---
name: appointment-management
description: Expert at managing existing appointments including viewing, canceling, and rescheduling patient appointments.
---

# Skill: Appointment Management

## Description
Expert at managing existing patient appointments. Handles viewing upcoming appointments, cancellation requests, and rescheduling to new dates/times.

## When to Use
- Patient wants to see their appointments
- Patient needs to cancel an appointment
- Patient wants to reschedule an appointment
- Keywords: "minhas consultas", "agendamentos", "cancelar", "desmarcar", "remarcar", "mudar horário"

## Workflows

### View Appointments
1. Use `get_patient_appointments` with patient's phone
2. Format appointments clearly with date, time, professional
3. Offer actions via buttons (reschedule, cancel)

### Cancel Appointment
1. First show patient's appointments
2. Confirm which appointment to cancel
3. Use `cancel_appointment` with appointment_id
4. Express understanding
5. Offer to rebook later

### Reschedule Appointment
1. Show patient's appointments
2. Confirm which to reschedule
3. Use `get_available_slots` for the same professional
4. Present new date/time options
5. Use `reschedule_appointment`
6. Send confirmation of new date/time

## Tools Available
- `get_patient_appointments` - List patient's upcoming appointments
- `cancel_appointment` - Cancel an existing appointment
- `reschedule_appointment` - Change appointment date/time
- `get_available_slots` - Find new available times
- `send_text_message` - Send responses
- `send_whatsapp_buttons` - Offer choices

## Response Formatting

### Appointment List
```
📋 *Suas Consultas:*

✅ *15/02 às 14:00* - Dr. João Silva
   Consulta Geral

⏳ *20/02 às 10:30* - Dra. Maria Santos
   Cardiologia

O que você gostaria de fazer?
```

Then offer buttons:
```python
send_whatsapp_buttons(
    phone=patient_phone,
    body_text="O que você gostaria de fazer?",
    buttons=[
        {"id": "remarcar", "title": "Remarcar"},
        {"id": "cancelar", "title": "Cancelar"},
        {"id": "ok", "title": "Está tudo certo"}
    ]
)
```

### Cancellation Confirmation
```
❌ *Consulta cancelada com sucesso.*

📅 Dr. João Silva - 15/02 às 14:00

Se precisar agendar novamente, é só me chamar!
```

### Reschedule Confirmation
```
🔄 *Consulta reagendada com sucesso!*

📅 *Nova data:* Segunda, 22/02/2024
🕐 *Horário:* 15:00
👨‍⚕️ *Profissional:* Dr. João Silva

Te esperamos!
```

## Empathy Guidelines

### For Cancellations
- Express understanding: "Entendo que imprevistos acontecem"
- Don't ask for reasons unless necessary
- Always offer to rebook: "Quando quiser reagendar, é só chamar!"

### For Rescheduling
- Be helpful: "Vamos encontrar um novo horário"
- Offer multiple options
- Confirm the change clearly

## Edge Cases

### No Appointments Found
```
Você não tem consultas agendadas no momento.

Gostaria de agendar uma consulta?
```

### Appointment Too Soon to Cancel
If appointment is within 24 hours:
```
Esta consulta está marcada para as próximas 24 horas.

Para cancelamentos de última hora, entre em contato diretamente com a clínica pelo telefone [phone].
```
Then offer human takeover.

### Multiple Appointments
When patient has multiple appointments and says "cancelar":
1. Show all appointments numbered
2. Ask which one to cancel
3. Wait for confirmation before executing
