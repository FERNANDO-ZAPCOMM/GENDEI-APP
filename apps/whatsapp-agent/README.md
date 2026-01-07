# WhatsApp Agent Service

Multi-creator WhatsApp agent system using OpenAI Agents SDK, integrated with the Firebase Functions backend via shared Firestore.

> pt-BR é a referência canônica do produto. Este README está em inglês por enquanto, mas foi atualizado para refletir o comportamento atual do serviço.

## Architecture

This Python microservice handles:
- WhatsApp webhook processing
- OpenAI Agents SDK (multi-agent orchestration)
- Message routing and conversation management
- Order creation and payment coordination
- Audio transcription
- Digital product delivery

The Firebase Functions backend handles:
- User authentication and authorization
- Creator management and onboarding
- Product/catalog CRUD operations
- Dashboard and analytics
- Embedded signup flow

Both services share a single Firestore database.

## Workflow Sync (No Drift)

Workflows are defined/edited in the dashboard (Frontend) and stored in Firestore (`creators/{creatorId}/workflows/{workflowId}`).
The WhatsApp agent loads the active workflow at runtime and executes it.

To keep **Frontend ↔ Functions ↔ WhatsApp Agent** synchronized, the canonical workflow “enum contract” lives in:
- `apps/shared/workflow_contract.json`

Generated targets (do not edit manually):
- `apps/functions/src/types/workflow_contract.ts` (runtime enums for Functions)
- `apps/frontend/lib/workflow_contract.ts` (union types for Frontend)
- `apps/whatsapp-agent/src/workflows/contract.py` (enums for the Agent workflow engine)

Regenerate after changing the contract:
```bash
python3 scripts/generate_workflow_contract.py
```

To verify CI/local drift (fails if generated files are outdated):
```bash
python3 scripts/verify_workflow_contract.py
```

## Workflow Auto-Heal (Ops)

To eliminate legacy workflow drift at scale, Functions includes a daily scheduled “auto-heal” job that recompiles workflows into the canonical schema.

Manual trigger (ops only):
- Endpoint: `POST /workflows/admin/auto-heal`
- Requires env `WORKFLOW_MIGRATION_TOKEN` on Functions and request header `x-admin-token`.
- Body options: `{ "dryRun": true, "onlyActive": true, "creatorId": "..." }`

## Quick Start

### Prerequisites

- Python 3.11+
- Google Cloud project with Firestore enabled
- WhatsApp Business Cloud API credentials
- OpenAI API key

### Local Development

1. **Install dependencies**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Run the service**:
   ```bash
   # NOTE: Firestore emulator defaults to 8080; use 8081 locally if running emulators.
   python -m uvicorn src.main:app --host 0.0.0.0 --port 8081 --reload
   ```

4. **Expose webhook** (for local testing):
   ```bash
   ngrok http 8081
   # Update DOMAIN in .env to your ngrok URL
   ```

### Cloud Run Deployment

1. **Build and deploy**:
   ```bash
   ./deploy.sh
   ```

   Deploy tuning (via env vars used by `deploy.sh`):
   - `CLOUD_RUN_MIN_INSTANCES` (recommended `1` for low latency)
   - `CLOUD_RUN_CONCURRENCY` (recommended `2` initially)
   - `CLOUD_RUN_MAX_INSTANCES` (e.g. `20`)
   - `CLOUD_RUN_CPU`, `CLOUD_RUN_MEMORY`, `CLOUD_RUN_TIMEOUT`

   Or manually:
   ```bash
   # Build Docker image
   docker build -t gcr.io/YOUR_PROJECT_ID/whatsapp-agent:latest .

   # Push to Google Container Registry
   docker push gcr.io/YOUR_PROJECT_ID/whatsapp-agent:latest

   # Deploy to Cloud Run
   gcloud run deploy whatsapp-agent \
     --image gcr.io/YOUR_PROJECT_ID/whatsapp-agent:latest \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID \
     --set-env-vars DEFAULT_CREATOR_ID=your_creator_id
   ```

2. **Set environment variables in Cloud Run**:
   - `WHATSAPP_TOKEN` (fallback only; normally resolved per creator via Firestore `channels`)
   - `WHATSAPP_VERIFY_TOKEN`
   - `OPENAI_API_KEY`
   - `GOOGLE_CLOUD_PROJECT`
   - `DEFAULT_CREATOR_ID`
   - `TEST_CREATOR_ID` (optional override for testing)
   - `DOMAIN` (your Cloud Run URL)

3. **Configure WhatsApp webhook**:
   - Go to Meta Developer Console
   - Set webhook URL: `https://your-service-url.run.app/whatsapp`
   - Set verify token: same as `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to: `messages`, `message_status`

## Firestore Schema

The service reads and writes to these Firestore collections:

```
creators/{creatorId}/
├── (doc fields)          # creator.profile + creator.whatsapp (embedded on creators/{creatorId})
├── channels/             # WhatsApp connections (read by Python)
├── products/             # Products (read by Python)
├── conversations/        # Conversations (written by Python)
│   └── {phone}/messages/chat_history  # Single-doc message map per conversation (written by Python)
└── orders/               # Orders (written by Python)

scheduled_tasks/          # Root-level scheduled follow-ups/cart recovery (written by Python)
```

## Multi-Creator Support

The service automatically routes webhooks to the correct creator based on `phone_number_id`:

1. Webhook arrives with `phone_number_id`
2. Service looks up the channel in Firestore
3. Loads creator-specific data (creator profile, products)
4. Initializes creator-specific agents
5. Processes message in creator context

## Manual Testing

Before embedded signup is approved, you can manually set up a creator:

1. **Create creator in Firestore** (via Firebase Functions API or Firebase Console):
   ```javascript
   creators/{creatorId}
   {
     name: "My Store",
     status: "active",
     profile: {
       displayName: "John Doe",
       voiceStyle: "friendly_coach",
       speakingPerspective: "first_person",
       language: "pt-BR"
     },
     createdAt: timestamp,
     updatedAt: timestamp
   }
   ```

2. **Create channel**:
   ```javascript
   creators/{creatorId}/channels/{channelId}
   {
     phoneNumberId: "YOUR_PHONE_NUMBER_ID",
     wabaId: "YOUR_WABA_ID",
     accessToken: "YOUR_ACCESS_TOKEN",
     isActive: true,
     createdAt: timestamp
   }
   ```

3. **Add products**:
   ```javascript
   creators/{creatorId}/products/{productId}
   {
     title: "My Product",
     description: "Product description",
     price: 2900,  // in cents
     currency: "BRL",
     retailerId: "product-001",
     metadata: {
       features: ["Feature 1", "Feature 2"],
       benefits: ["Benefit 1", "Benefit 2"]
     }
   }
   ```

4. **Set DEFAULT_CREATOR_ID** in environment variables to your creator ID

## API Endpoints

- `POST /whatsapp` - WhatsApp webhook (receives messages)
- `GET /whatsapp` - Webhook verification
- `GET /health` - Health check
- `GET /` - Service info
 - `POST /cron/process-scheduled-tasks` - Process scheduled tasks (Cloud Scheduler)
 - `POST /cron/detect-abandoned-carts` - Detect abandoned carts and schedule recovery

## Troubleshooting

### Messages not being received

- Check WhatsApp webhook configuration in Meta Developer Console
- Verify `WHATSAPP_VERIFY_TOKEN` matches
- Check Cloud Run logs for errors
- Ensure webhook URL is publicly accessible

### Agent not responding

- Check OpenAI API key is valid
- Check Firestore permissions
- Verify creator data exists in Firestore
- Check Cloud Run logs for agent errors

### Button click not replying

The service handles interactive replies (buttons/lists) and routes `button_reply`/`list_reply` payloads.

For the “notify me” flow:
- Button id: `NOTIFY_NEW_PRODUCTS`
- Expected behavior: save notification preference + reply with a confirmation message.

### Duplicate replies / repeated workflows

In production, WhatsApp webhooks can be retried and Cloud Run can scale to multiple instances. To prevent double-processing the same inbound message, the agent uses Firestore-based idempotency:
- Collection: `processed_messages/{messageId}`
- Write pattern: atomic `create()` (first writer wins)
- Optional TTL: store `expires_at` and configure Firestore TTL to auto-delete old documents
- Escape hatch: set env `FIRESTORE_DEDUP_ENABLED=false` to fall back to in-memory only (not recommended)

### Firestore permission errors

- Ensure service account has Firestore read/write permissions
- Check `GOOGLE_APPLICATION_CREDENTIALS` is set correctly
- Verify `GOOGLE_CLOUD_PROJECT` matches your project

## Development Tips

- Use `LOG_LEVEL=DEBUG` for verbose logging
- Test agents locally before deploying
- Use ngrok for local webhook testing
- Monitor Cloud Run logs in real-time during development

## Next Steps

1. Implement embedded signup flow in the Firebase Functions backend
2. Add payment integration (PIX, Stripe, etc.)
3. Implement digital product delivery via Cloud Storage
4. Add analytics and reporting
5. Implement human takeover for complex queries

## Code Layout (Relevant)

- `src/main.py` - FastAPI app, webhook handlers, cron endpoints
- `src/runtime/creator_runtime.py` - Per-creator runtime/cache loading from Firestore
- `src/agents/openai_factory.py` - OpenAI Agents SDK specialized agent factory
- `src/agents/function_tools.py` - Tools used by agents (WhatsApp, payments, catalog)
- `src/services/scheduler.py` - Follow-ups/cart recovery scheduler (Cloud Scheduler/cron)

## License

MIT

## Greeting UX (First Contact)

The greeting is designed to be short, WhatsApp-native, and resilient at scale.
It uses profile fields (voice style, lead temperature, niche) and can optionally list 1–2 product titles when `profile.showProductsInGreeting=true` (default).

### No products (creator is still preparing)

Flow:
1. Single text message connected to the profile (name + niche), honoring `profile.voiceStyle` + `profile.leadTemperature`, ending with a short question.
2. The opt-in button (`QUERO SER AVISADO`, id `NOTIFY_NEW_PRODUCTS`) is only sent when the lead asks about upcoming products or shows buying intent.

Behavior:
- Clicking the button persists `notificationPreference=True` for the contact and replies with a confirmation message.
- If the user shows buying intent but there are no active products yet, the greeter sends a short honest message and then sends the same opt-in button.

## Typing Indicator

For text messages, the service marks the message as read and shows the typing indicator using the WhatsApp Cloud API `messages` endpoint with:
- `status: "read"`
- `message_id: "<wamid...>"`
- `typing_indicator: { "type": "text" }`

### Products exist

Flow:
1. Single profile-connected message (name + niche), honoring `profile.voiceStyle` + `profile.leadTemperature`, ending with a short question.
2. If `profile.showProductsInGreeting=true` (default), the message may include 1–2 product titles as a short teaser.
3. If the user asks for details or shows buying intent, the conversation routes to `product_info` or `sales_closer`.
