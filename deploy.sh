#!/bin/bash
# Gendei Deployment Script
# Deploys Cloud Functions and sets up Cloud Scheduler

set -e

PROJECT_ID="gendei-prod"
REGION="us-central1"

echo "============================================"
echo "  GENDEI DEPLOYMENT"
echo "  Project: ${PROJECT_ID}"
echo "============================================"
echo ""

# Check if logged in to Firebase
echo "Checking Firebase login..."
firebase login:list || {
    echo "Please login to Firebase first:"
    echo "  firebase login"
    exit 1
}

# Check if project exists
echo ""
echo "Checking project access..."
firebase projects:list | grep -q "${PROJECT_ID}" || {
    echo "ERROR: Project ${PROJECT_ID} not found!"
    echo "Please create the project first at https://console.firebase.google.com"
    exit 1
}

# Set project
echo ""
echo "Setting active project to ${PROJECT_ID}..."
firebase use ${PROJECT_ID}

# Build functions
echo ""
echo "Building Cloud Functions..."
cd apps/functions
npm install
npm run build
cd ../..

# Deploy Firestore rules
echo ""
echo "Deploying Firestore rules..."
firebase deploy --only firestore:rules --project ${PROJECT_ID}

# Deploy Storage rules
echo ""
echo "Deploying Storage rules..."
firebase deploy --only storage --project ${PROJECT_ID}

# Deploy Cloud Functions
echo ""
echo "Deploying Cloud Functions..."
firebase deploy --only functions --project ${PROJECT_ID}

# Get the functions URL
echo ""
echo "============================================"
echo "  DEPLOYMENT COMPLETE!"
echo "============================================"
echo ""
echo "Cloud Functions URL:"
echo "  https://${REGION}-${PROJECT_ID}.cloudfunctions.net/api"
echo ""
echo "Next steps:"
echo "  1. Set up Cloud Scheduler: ./cloud-scheduler/setup-reminders.sh"
echo "  2. Update frontend .env with the API URL"
echo "  3. Deploy frontend to Vercel"
echo ""
