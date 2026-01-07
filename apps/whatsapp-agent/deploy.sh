#!/bin/bash
set -e

# DEBUG: CHECK CURRENT DIRECTORY
echo "Current directory: $(pwd)"

# LOAD .ENV WITH PROPER ERROR HANDLING
if [ -f ./.env ]; then
    echo "Loading .env file..."
    # Check for Windows line endings first
    if grep -q $'\r' .env; then
        echo "Warning: .env file has Windows line endings. Converting to Unix format..."
        tr -d '\r' < .env > .env.tmp && mv .env.tmp .env
    fi

    # Source the .env file with error handling
    set -o allexport
    source ./.env
    set +o allexport
    echo ".env file loaded successfully"
else
    echo "Warning: .env file not found. Using environment variables directly."
fi

# CLOUD RUN CONFIGURATION
PROJECT_ID="gendei-prod"
SERVICE_NAME="gendei-whatsapp-agent"
REGION="us-central1"
STORAGE_BUCKET="gendei-storage-${PROJECT_ID}"

# PERFORMANCE TUNING (override via env vars)
# Notes:
# - Lower concurrency reduces tail latency for LLM calls (one slow request won't starve others on the same instance).
# - Higher min instances reduces cold starts.
# - no-cpu-throttling keeps CPU allocated between requests (faster for background processing after webhook ACK).
CLOUD_RUN_CPU="${CLOUD_RUN_CPU:-2}"
CLOUD_RUN_MEMORY="${CLOUD_RUN_MEMORY:-4Gi}"
CLOUD_RUN_TIMEOUT="${CLOUD_RUN_TIMEOUT:-300}"
CLOUD_RUN_MIN_INSTANCES="${CLOUD_RUN_MIN_INSTANCES:-1}"
CLOUD_RUN_MAX_INSTANCES="${CLOUD_RUN_MAX_INSTANCES:-20}"
CLOUD_RUN_CONCURRENCY="${CLOUD_RUN_CONCURRENCY:-2}"
CLOUD_RUN_CPU_BOOST="${CLOUD_RUN_CPU_BOOST:-true}"          # true/false
CLOUD_RUN_NO_CPU_THROTTLING="${CLOUD_RUN_NO_CPU_THROTTLING:-true}"  # true/false

# Note: WhatsApp Business Numbers now come from Firestore in multi-tenant mode

# COMPUTE THE SERVICE ACCOUNT FOR THE PROJECT
echo "Fetching project number for ${PROJECT_ID}..."
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
if [ -z "${PROJECT_NUMBER}" ]; then
    echo "Error: Could not retrieve project number for ${PROJECT_ID}"
    exit 1
fi
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "Using service account: ${SERVICE_ACCOUNT}"

# REQUIRED-VARS CHECK (Multi-tenant mode: tokens come from Firestore, not env vars)
# Required: WHATSAPP_TOKEN (fallback), WHATSAPP_VERIFY_TOKEN (webhook verification), OPENAI_API_KEY (Agents SDK)
# AI PROVIDER CONFIGURATION (defaults to openai)
AI_PROVIDER="${AI_PROVIDER:-openai}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"

# Required vars depend on which AI provider is selected
for var in WHATSAPP_TOKEN WHATSAPP_VERIFY_TOKEN; do
    if [ -z "${!var}" ]; then
        echo "ERROR: $var not set. Please export it or add it to .env file."
        echo "Make sure your .env file has proper syntax:"
        echo "  $var=\"your_value_here\""
        exit 1
    fi
done

# Check provider-specific API keys
if [ "${AI_PROVIDER}" = "anthropic" ]; then
    if [ -z "${ANTHROPIC_API_KEY}" ]; then
        echo "ERROR: ANTHROPIC_API_KEY not set but AI_PROVIDER=anthropic"
        echo "Please set ANTHROPIC_API_KEY in your .env file"
        exit 1
    fi
    echo "Using Anthropic Claude as AI provider"
else
    if [ -z "${OPENAI_API_KEY}" ]; then
        echo "ERROR: OPENAI_API_KEY not set. Please export it or add it to .env file."
        exit 1
    fi
    echo "Using OpenAI as AI provider"
fi

# SET DEFAULT PHONE FOR PAGSEGURO API
DEFAULT_BRAZILIAN_PHONE="${DEFAULT_BRAZILIAN_PHONE:-+5511999999999}"
echo "Using default Brazilian phone for PagSeguro API: ${DEFAULT_BRAZILIAN_PHONE}"

# MULTI-TENANT CONFIGURATION
# TEST_CREATOR_ID is empty by default for production multi-creator mode
# Set it only for testing with a specific creator
TEST_CREATOR_ID="${TEST_CREATOR_ID:-}"
DEFAULT_CREATOR_ID="${DEFAULT_CREATOR_ID:-default_creator}"
DOMAIN="${DOMAIN:-https://${SERVICE_NAME}.${REGION}.run.app}"

echo "Configuration loaded:"
echo "  Mode: ${TEST_CREATOR_ID:+Testing (TEST_CREATOR_ID=$TEST_CREATOR_ID)}${TEST_CREATOR_ID:-Multi-creator (Firestore lookup)}"
echo "  Default Creator ID: ${DEFAULT_CREATOR_ID}"
echo "  Domain: ${DOMAIN}"

# ENABLE REQUIRED APIs
echo "Enabling required APIs for ${PROJECT_ID}..."
gcloud services enable run.googleapis.com --project "${PROJECT_ID}"
gcloud services enable firestore.googleapis.com --project "${PROJECT_ID}"
gcloud services enable storage.googleapis.com --project "${PROJECT_ID}"
gcloud services enable artifactregistry.googleapis.com --project "${PROJECT_ID}"
gcloud services enable iam.googleapis.com --project "${PROJECT_ID}"
gcloud services enable cloudbuild.googleapis.com --project "${PROJECT_ID}"

# CREATE FIRESTORE DATABASE IN NATIVE MODE IF IT DOESN'T EXIST
echo "Checking for Firestore database '(default)'..."
if ! gcloud firestore databases list --project "${PROJECT_ID}" | grep -q "(default)"; then
    echo "Creating default Firestore database in Native mode..."
    gcloud firestore databases create --database="(default)" --project "${PROJECT_ID}" --location="${REGION}" --type=firestore-native
else
    echo "Firestore database '(default)' already exists."
fi

# ENSURE DOCKER BUILDX IS AVAILABLE
if ! docker buildx ls | grep -q multi-arch; then
    echo "Setting up Docker Buildx..."
    docker buildx create --name multi-arch --use
    docker buildx inspect multi-arch --bootstrap
fi

# GRANT FIRESTORE, STORAGE, AND SIGNING PERMISSIONS TO THE CLOUD RUN SERVICE ACCOUNT
echo "Granting Firestore, Storage, and signing permissions to service account ${SERVICE_ACCOUNT}..."

# FIRESTORE
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/datastore.user" || true

# STORAGE
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/storage.admin" || true

# ALLOW SA TO SIGN V4 URLS
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/iam.serviceAccountTokenCreator" || true

# GRANT CLOUD RUN ADMIN ROLE TO ALLOW DEPLOYMENT
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/run.admin" || true

# ENSURE THE STORAGE BUCKET EXISTS
echo "Checking if Storage bucket exists: ${STORAGE_BUCKET}"
if ! gsutil ls -b "gs://${STORAGE_BUCKET}" &>/dev/null; then
    echo "Creating Storage bucket: ${STORAGE_BUCKET}"
    gsutil mb -p "${PROJECT_ID}" -l "${REGION}" "gs://${STORAGE_BUCKET}"

    # set appropriate access control
    echo "Setting storage bucket permissions..."
    gsutil iam ch "serviceAccount:${SERVICE_ACCOUNT}:objectAdmin" "gs://${STORAGE_BUCKET}"
    gsutil iam ch "serviceAccount:${SERVICE_ACCOUNT}:legacyBucketWriter" "gs://${STORAGE_BUCKET}"

    # Wait for bucket creation to propagate
    echo "Waiting for bucket creation to propagate (10 seconds)..."
    sleep 10
fi

# Ensure uniform bucket-level access is enabled
echo "Enabling uniform bucket-level access for ${STORAGE_BUCKET}..."
gsutil uniformbucketlevelaccess set on "gs://${STORAGE_BUCKET}" || true

# CREATE OR UPDATE ARTIFACT REGISTRY REPOSITORY FOR DOCKER IMAGES
echo "Creating or updating Artifact Registry repository..."
if ! gcloud artifacts repositories describe docker-repo --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
    gcloud artifacts repositories create docker-repo \
        --repository-format=docker \
        --location="${REGION}" \
        --project="${PROJECT_ID}" \
        --description="Repository for WhatsApp Agent Docker images"
fi

# BUILD & PUSH CONTAINER TO ARTIFACT REGISTRY, TARGETING X86_64
echo "Building & pushing multi-arch image (x86_64)..."
docker buildx build \
    --platform linux/amd64 \
    -t "${REGION}-docker.pkg.dev/${PROJECT_ID}/docker-repo/${SERVICE_NAME}" \
    . \
    --push

echo "Deploying WhatsApp Agent Service to Cloud Run..."
# NOTE: Multi-creator mode - tokens come from Firestore channels, not env vars
# - TEST_CREATOR_ID is empty to enable multi-creator lookup
# - WHATSAPP_TOKEN is BISU token (fallback only)
# - Creator is looked up from Firestore by phone_number_id
gcloud run deploy "${SERVICE_NAME}" \
    --image "${REGION}-docker.pkg.dev/${PROJECT_ID}/docker-repo/${SERVICE_NAME}" \
    --platform managed \
    --region "${REGION}" \
    --project "${PROJECT_ID}" \
    --allow-unauthenticated \
    --service-account "${SERVICE_ACCOUNT}" \
    --timeout "${CLOUD_RUN_TIMEOUT}" \
    --cpu "${CLOUD_RUN_CPU}" \
    --memory "${CLOUD_RUN_MEMORY}" \
    --execution-environment gen2 \
    --min-instances "${CLOUD_RUN_MIN_INSTANCES}" \
    --max-instances "${CLOUD_RUN_MAX_INSTANCES}" \
    --concurrency "${CLOUD_RUN_CONCURRENCY}" \
    $( [ "${CLOUD_RUN_CPU_BOOST}" = "true" ] && echo "--cpu-boost" ) \
    $( [ "${CLOUD_RUN_NO_CPU_THROTTLING}" = "true" ] && echo "--no-cpu-throttling" ) \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
    --set-env-vars="WHATSAPP_TOKEN=${WHATSAPP_TOKEN}" \
    --set-env-vars="WHATSAPP_VERIFY_TOKEN=${WHATSAPP_VERIFY_TOKEN}" \
    --set-env-vars="OPENAI_API_KEY=${OPENAI_API_KEY}" \
    --set-env-vars="TEST_CREATOR_ID=${TEST_CREATOR_ID}" \
    --set-env-vars="DEFAULT_CREATOR_ID=${DEFAULT_CREATOR_ID}" \
    --set-env-vars="DOMAIN=${DOMAIN}" \
    --set-env-vars="STORAGE_BUCKET=${STORAGE_BUCKET}" \
    --set-env-vars="SIGNING_SERVICE_ACCOUNT=${SERVICE_ACCOUNT}" \
    --set-env-vars="PAGSEGURO_EMAIL=${PAGSEGURO_EMAIL:-}" \
    --set-env-vars="PAGSEGURO_TOKEN=${PAGSEGURO_TOKEN:-}" \
    --set-env-vars="PAGSEGURO_ENVIRONMENT=${PAGSEGURO_ENVIRONMENT:-production}" \
    --set-env-vars="DEFAULT_BRAZILIAN_PHONE=${DEFAULT_BRAZILIAN_PHONE:-}" \
    --set-env-vars="AI_PROVIDER=${AI_PROVIDER}" \
    --set-env-vars="ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}"

echo "Deployment complete!"
echo "Use the URL below as your WhatsApp webhook:"
gcloud run services describe "${SERVICE_NAME}" --platform managed --region "${REGION}" --format 'value(status.url)'

echo ""
echo "Gendei WhatsApp Agent deployed successfully!"
echo "Service: ${SERVICE_NAME}"
echo "AI Provider: ${AI_PROVIDER^^}"
echo "Mode: Multi-clinic (clinics looked up from Firestore by phone_number_id)"
echo "Storage: ${STORAGE_BUCKET}"
echo ""
echo "Next steps:"
echo "1. Ensure Meta App webhook is configured with: <service-url>/whatsapp"
echo "2. Connect WhatsApp via Embedded Signup in Gendei dashboard"
echo "3. The agent will auto-route messages to the correct clinic"
echo "3. Check the logs with: gcloud logs tail --follow --project=${PROJECT_ID} --resource.labels.service_name=${SERVICE_NAME}"
echo ""
echo "Appointment Scheduling Agent Active:"
echo "  - Greeting Agent (Fast Path)"
echo "  - Scheduling Agent"
echo "  - Reminder Agent"
echo "  - Triage Agent (Router)"
echo ""
