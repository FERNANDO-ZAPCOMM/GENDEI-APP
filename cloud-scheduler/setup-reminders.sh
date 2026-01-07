#!/bin/bash
# Gendei Cloud Scheduler Setup
# Sets up a cron job to trigger appointment reminders every 15 minutes

set -e

# GENDEI SEPARATE PROJECT - Update these values after creating the Firebase project
PROJECT_ID="gendei-prod"
REGION="us-central1"
SERVICE_ACCOUNT="gendei-prod@appspot.gserviceaccount.com"

# Cloud Functions URL for the reminder endpoint
FUNCTIONS_URL="https://us-central1-gendei-prod.cloudfunctions.net/api"

echo "Setting up Cloud Scheduler for Gendei reminders..."
echo "Project: ${PROJECT_ID}"
echo ""

# Create the scheduler job
gcloud scheduler jobs create http gendei-appointment-reminders \
  --project=${PROJECT_ID} \
  --location=${REGION} \
  --schedule="*/15 * * * *" \
  --uri="${FUNCTIONS_URL}/reminders/trigger" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"source":"cloud-scheduler"}' \
  --oidc-service-account-email=${SERVICE_ACCOUNT} \
  --oidc-token-audience="${FUNCTIONS_URL}" \
  --time-zone="America/Sao_Paulo" \
  --description="Triggers appointment reminders every 15 minutes (24h and 2h before appointments)" \
  --attempt-deadline="180s" || {
    echo "Job may already exist, trying to update..."
    gcloud scheduler jobs update http gendei-appointment-reminders \
      --project=${PROJECT_ID} \
      --location=${REGION} \
      --schedule="*/15 * * * *" \
      --uri="${FUNCTIONS_URL}/reminders/trigger" \
      --http-method=POST \
      --headers="Content-Type=application/json" \
      --message-body='{"source":"cloud-scheduler"}' \
      --oidc-service-account-email=${SERVICE_ACCOUNT} \
      --oidc-token-audience="${FUNCTIONS_URL}" \
      --time-zone="America/Sao_Paulo" \
      --description="Triggers appointment reminders every 15 minutes (24h and 2h before appointments)" \
      --attempt-deadline="180s"
}

echo "Cloud Scheduler job created/updated successfully!"
echo ""
echo "Job details:"
gcloud scheduler jobs describe gendei-appointment-reminders \
  --project=${PROJECT_ID} \
  --location=${REGION}

echo ""
echo "To manually trigger the job for testing:"
echo "gcloud scheduler jobs run gendei-appointment-reminders --project=${PROJECT_ID} --location=${REGION}"
