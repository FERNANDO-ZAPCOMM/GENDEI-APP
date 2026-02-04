#!/bin/bash
# Gendei WhatsApp Agent - Claude SDK Deployment Script

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT:-gendei-prod}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="gendei-whatsapp-agent-claude"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Deploying Gendei WhatsApp Agent (Claude SDK)..."
echo "   Project: ${PROJECT_ID}"
echo "   Region: ${REGION}"
echo "   Service: ${SERVICE_NAME}"

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t ${IMAGE_NAME} .

# Push to Container Registry
echo "⬆️ Pushing to Container Registry..."
docker push ${IMAGE_NAME}

# Deploy to Cloud Run
echo "☁️ Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --timeout 300 \
    --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
    --project ${PROJECT_ID}

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --platform managed \
    --region ${REGION} \
    --project ${PROJECT_ID} \
    --format 'value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo "   Service URL: ${SERVICE_URL}"
echo ""
echo "📝 Don't forget to:"
echo "   1. Update the Meta webhook URL to: ${SERVICE_URL}/whatsapp"
echo "   2. Set the required environment variables in Cloud Run"
echo "      - ANTHROPIC_API_KEY"
echo "      - META_BISU_ACCESS_TOKEN"
echo "      - META_WEBHOOK_VERIFY_TOKEN"
