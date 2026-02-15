# Plan: Reminder System

**Feature**: 010-reminder-system
**Status**: Implemented
**Date**: 2026-02-04
**Updated**: 2026-02-15

---

## Overview

Automated appointment reminders sent via WhatsApp at 24 hours and 2 hours before confirmed appointments. Uses boolean flags on appointment documents (no separate reminders collection) and vertical-aware message formatting.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Scheduler | Cloud Scheduler (every 15 minutes) |
| Processing | Firebase Cloud Functions (Node.js/Express) |
| Messaging | WhatsApp Agent (Python FastAPI on Cloud Run) |
| Storage | Boolean flags on `gendei_appointments` documents |
| Vertical Config | `getVerticalTerms()` in `apps/functions/src/services/verticals.ts` |

---

## Key Features

1. Automated 24h reminder with confirmation request
2. Automated 2h reminder with optional arrive-early tip
3. Vertical-aware terminology (consulta/sessao, emoji, arrival tips)
4. Deduplication via boolean flags on appointment documents
5. Status transition to `awaiting_confirmation` after 24h reminder
6. Manual single-reminder endpoint for testing

---

## Reminder Types

| Type | Window | Purpose | Status Change |
|------|--------|---------|---------------|
| 24h | 23-25h before | Reminder + confirmation request | `confirmed` -> `awaiting_confirmation` |
| 2h | 1.5-2.5h before | Final reminder + arrival tip | None |

---

## System Architecture

```
+-----------------+    +--------------------+    +-----------------+
| Cloud Scheduler |----| Firebase Functions  |----| WhatsApp Agent  |
| (every 15 min)  |    | /reminders/trigger |    | /api/send-      |
+-----------------+    +--------------------+    |  reminder       |
                              |                  +-----------------+
                              v                         |
                       +----------------+               v
                       | Firestore      |        +-------------+
                       | gendei_        |        | WhatsApp    |
                       | appointments   |        | Cloud API   |
                       | (flags update) |        +-------------+
                       +----------------+
```

---

## Processing Flow

```
1. Cloud Scheduler triggers POST /reminders/trigger every 15 minutes
2. Calculate time windows:
   - 24h window: now + 23h to now + 25h
   - 2h window: now + 1.5h to now + 2.5h
3. Query gendei_appointments:
   - date in window range
   - status in ['confirmed', 'confirmed_presence']
   - reminder flag not yet set
4. For each appointment:
   a. Get clinic info (WhatsApp connection, address, vertical)
   b. Get access token from gendei_tokens
   c. Format message with getVerticalTerms()
   d. Send via WhatsApp Agent POST /api/send-reminder
   e. Update appointment: set flag + timestamp (+ status for 24h)
5. Return summary: { sent24h, sent2h, errors }
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /reminders/trigger | Cloud Scheduler entry point (every 15 min) |
| POST | /reminders/send/:appointmentId | Manual send for testing |

---

## Environment Variables

```bash
# Firebase Functions
WHATSAPP_AGENT_URL=https://gendei-whatsapp-agent-....run.app  # WhatsApp Agent Cloud Run URL
```

---

## Success Metrics

- Reminders processed within 15-minute scheduler interval
- Zero duplicate sends
- Vertical-correct terminology
