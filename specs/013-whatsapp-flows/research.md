# Research: WhatsApp Flows

**Feature**: 013-whatsapp-flows
**Date**: 2026-02-04

---

## Technical Decisions

### 1. Flow Architecture

**Decision**: Endpoint-based dynamic data with static flow structure

**Options**:
| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Static flows | Simple, cached | Limited flexibility | Rejected |
| Endpoint flows | Dynamic data | More complex | **Selected** |
| Hybrid | Best of both | Implementation overhead | Future |

**Why Endpoint-Based**:
- Real-time availability checking
- Dynamic professional/service lists
- Personalized options per patient
- Current date-based time slots

### 2. Data Endpoint Implementation

**Flow**:
```
1. WhatsApp sends POST to data endpoint
2. Endpoint receives: screen, data, flow_token
3. Endpoint returns: screen data, next screen
4. WhatsApp renders new screen
5. Repeat until flow completes
```

**Endpoint Structure**:
```typescript
// Request from WhatsApp
interface FlowDataRequest {
  version: string;
  action: 'ping' | 'INIT' | 'data_exchange';
  screen?: string;
  data?: Record<string, any>;
  flow_token?: string;
  decrypted_data?: {
    screen: string;
    data: Record<string, any>;
  };
}

// Response to WhatsApp
interface FlowDataResponse {
  version: string;
  screen: string;
  data: Record<string, any>;
}
```

### 3. Flow Token Strategy

**Decision**: Encrypted JSON with clinic/patient context

```typescript
interface FlowToken {
  clinicId: string;
  patientPhone: string;
  patientId?: string;
  flowType: string;
  sessionId: string;
  timestamp: number;
}

// Encrypt before sending
const flowToken = encryptFlowToken({
  clinicId: 'clinic_xyz',
  patientPhone: '+5511999999999',
  flowType: 'BOOKING',
  sessionId: uuid(),
  timestamp: Date.now(),
});
```

### 4. Availability Calculation for Flows

**Real-time availability in flow**:
```typescript
async function getAvailableSlots(
  clinicId: string,
  professionalId: string,
  date: string
): Promise<TimeSlot[]> {
  // Get professional's working hours for the day
  const professional = await getProfessional(clinicId, professionalId);
  const dayOfWeek = new Date(date).getDay();
  const workingHours = professional.workingHours[dayOfWeek];

  if (!workingHours?.enabled) return [];

  // Get existing appointments
  const appointments = await getAppointmentsByDate(clinicId, professionalId, date);

  // Calculate available slots
  const slots = generateTimeSlots(workingHours.start, workingHours.end, 30);

  // Filter out booked slots
  return slots.filter(slot =>
    !appointments.some(appt => isOverlapping(slot, appt))
  );
}
```

---

## Flow JSON Structure

### Booking Flow Example

```json
{
  "version": "3.1",
  "screens": [
    {
      "id": "SERVICE_SELECT",
      "title": "Selecione o serviço",
      "terminal": false,
      "data": {
        "services": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "title": { "type": "string" }
            }
          },
          "__example__": []
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "RadioButtonsGroup",
            "name": "service_id",
            "label": "Serviços disponíveis",
            "required": true,
            "data-source": "${data.services}"
          },
          {
            "type": "Footer",
            "label": "Continuar",
            "on-click-action": {
              "name": "data_exchange",
              "payload": {
                "service_id": "${form.service_id}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "PROFESSIONAL_SELECT",
      "title": "Selecione o profissional",
      "terminal": false,
      "data": {
        "professionals": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "title": { "type": "string" }
            }
          }
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "RadioButtonsGroup",
            "name": "professional_id",
            "label": "Profissionais",
            "required": true,
            "data-source": "${data.professionals}"
          },
          {
            "type": "Footer",
            "label": "Continuar",
            "on-click-action": {
              "name": "data_exchange",
              "payload": {
                "professional_id": "${form.professional_id}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "DATE_SELECT",
      "title": "Selecione a data",
      "terminal": false,
      "data": {
        "available_dates": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "title": { "type": "string" }
            }
          }
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "DatePicker",
            "name": "date",
            "label": "Data da consulta",
            "required": true,
            "min-date": "${data.min_date}",
            "max-date": "${data.max_date}",
            "unavailable-dates": "${data.unavailable_dates}"
          },
          {
            "type": "Footer",
            "label": "Continuar",
            "on-click-action": {
              "name": "data_exchange",
              "payload": {
                "date": "${form.date}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "TIME_SELECT",
      "title": "Selecione o horário",
      "terminal": false,
      "data": {
        "time_slots": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "title": { "type": "string" }
            }
          }
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "RadioButtonsGroup",
            "name": "time",
            "label": "Horários disponíveis",
            "required": true,
            "data-source": "${data.time_slots}"
          },
          {
            "type": "Footer",
            "label": "Continuar",
            "on-click-action": {
              "name": "data_exchange",
              "payload": {
                "time": "${form.time}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "CONFIRMATION",
      "title": "Confirme seu agendamento",
      "terminal": true,
      "data": {
        "service_name": { "type": "string" },
        "professional_name": { "type": "string" },
        "date_formatted": { "type": "string" },
        "time_formatted": { "type": "string" }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Resumo do agendamento"
          },
          {
            "type": "TextBody",
            "text": "Serviço: ${data.service_name}"
          },
          {
            "type": "TextBody",
            "text": "Profissional: ${data.professional_name}"
          },
          {
            "type": "TextBody",
            "text": "Data: ${data.date_formatted}"
          },
          {
            "type": "TextBody",
            "text": "Horário: ${data.time_formatted}"
          },
          {
            "type": "Footer",
            "label": "Confirmar agendamento",
            "on-click-action": {
              "name": "complete",
              "payload": {
                "confirmed": true
              }
            }
          }
        ]
      }
    }
  ]
}
```

---

## Flow Trigger via AI Agent

```python
# In AI agent, trigger flow
async def trigger_booking_flow(
    phone_number_id: str,
    access_token: str,
    to: str,
    clinic_id: str,
    flow_id: str
):
    """Trigger WhatsApp Flow for booking."""
    flow_token = encrypt_flow_token({
        'clinicId': clinic_id,
        'patientPhone': to,
        'flowType': 'BOOKING',
        'sessionId': str(uuid4()),
        'timestamp': int(time.time())
    })

    message = {
        'messaging_product': 'whatsapp',
        'recipient_type': 'individual',
        'to': to,
        'type': 'interactive',
        'interactive': {
            'type': 'flow',
            'header': {
                'type': 'text',
                'text': 'Agendar Consulta'
            },
            'body': {
                'text': 'Clique abaixo para agendar sua consulta de forma rápida e fácil.'
            },
            'footer': {
                'text': 'Gendei - Agendamento Inteligente'
            },
            'action': {
                'name': 'flow',
                'parameters': {
                    'flow_message_version': '3',
                    'flow_token': flow_token,
                    'flow_id': flow_id,
                    'flow_cta': 'Agendar agora',
                    'flow_action': 'navigate',
                    'flow_action_payload': {
                        'screen': 'SERVICE_SELECT'
                    }
                }
            }
        }
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f'https://graph.facebook.com/v22.0/{phone_number_id}/messages',
            headers={'Authorization': f'Bearer {access_token}'},
            json=message
        )
        return response.json()
```

---

## Security Considerations

1. **Flow Token Encryption**: AES-256-GCM for flow tokens
2. **Request Validation**: Verify WhatsApp signature on webhooks
3. **Data Validation**: Sanitize all user inputs
4. **Rate Limiting**: Prevent flow abuse
5. **Audit Logging**: Track all flow interactions

---

## References

- [WhatsApp Flows Documentation](https://developers.facebook.com/docs/whatsapp/flows)
- [Flows JSON Reference](https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson)
- [Data Exchange Endpoint](https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint)
