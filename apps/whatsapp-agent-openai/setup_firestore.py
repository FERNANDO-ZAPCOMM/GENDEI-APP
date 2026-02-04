#!/usr/bin/env python3
"""
Setup Firestore data for ZapSell WhatsApp Agent

This script creates the required profile and product documents in Firestore.
"""

import os
from google.cloud import firestore
from datetime import datetime

# Configuration
PROJECT_ID = "zapsell-dev-2193d"
CREATOR_ID = "lvlFU5XBKNZoj191bDPJ56TR2Ze2"

# Initialize Firestore
db = firestore.Client(project=PROJECT_ID)

def create_profile():
    """Create creator profile document"""
    print(f"Creating profile for creator: {CREATOR_ID}")

    # NestJS backend uses: creators/{creatorId}/profiles/creator
    profile_ref = db.collection('creators').document(CREATOR_ID).collection('profiles').document('creator')

    profile_data = {
        'displayName': 'ZapSell Bot',
        'bio': 'Especialista em vendas digitais, aqui para ajudar você a encontrar os melhores produtos!',
        'voiceStyle': 'friendly_coach',
        'speakingPerspective': 'first_person',
        'primaryLanguage': 'pt-BR',
        'toneAttributes': {
            'formality': 5,
            'enthusiasm': 8,
            'empathy': 7,
            'humor': 6
        },
        'onboardingCompleted': True,
        'onboardingStep': 3,
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }

    profile_ref.set(profile_data)
    print("✅ Profile created!")
    return profile_data

def create_sample_product():
    """Create a sample product"""
    print(f"Creating sample product for creator: {CREATOR_ID}")

    product_ref = db.collection('creators').document(CREATOR_ID).collection('products').document('product_001')

    product_data = {
        'title': 'Curso de Vendas Online',
        'description': 'Aprenda a vender produtos digitais usando WhatsApp e automação',
        'price': 2900,  # R$ 29,00 in cents
        'currency': 'BRL',
        'retailerId': 'curso-vendas-001',
        'metadata': {
            'features': [
                '10 aulas em vídeo',
                'Suporte via WhatsApp',
                'Certificado de conclusão',
                'Grupo exclusivo no Telegram'
            ],
            'benefits': [
                'Aumente suas vendas em 300%',
                'Trabalhe de qualquer lugar',
                'Automatize seu atendimento'
            ]
        },
        'createdAt': datetime.utcnow(),
        'updatedAt': datetime.utcnow()
    }

    product_ref.set(product_data)
    print("✅ Product created!")
    return product_data

def verify_setup():
    """Verify the setup"""
    print("\n🔍 Verifying setup...")

    # Check profile (NestJS uses profiles/creator)
    profile_ref = db.collection('creators').document(CREATOR_ID).collection('profiles').document('creator')
    profile_doc = profile_ref.get()

    if profile_doc.exists:
        print("✅ Profile exists")
        profile_data = profile_doc.to_dict()
        print(f"   Bot Name: {profile_data.get('displayName')}")
        print(f"   Bio: {profile_data.get('bio', 'N/A')[:50]}...")
        print(f"   Voice: {profile_data.get('voiceStyle')}")
    else:
        print("❌ Profile missing")

    # Check products
    products_ref = db.collection('creators').document(CREATOR_ID).collection('products')
    products = list(products_ref.stream())

    if products:
        print(f"✅ Found {len(products)} product(s)")
        for product_doc in products:
            product_data = product_doc.to_dict()
            price = product_data.get('price', 0)
            price_formatted = f"R$ {price // 100},{price % 100:02d}"
            print(f"   - {product_data.get('title')} - {price_formatted}")
    else:
        print("❌ No products found")

    print("\n✅ Setup complete!")
    print("\nNext steps:")
    print("1. Send 'oi' to your WhatsApp Business number")
    print("2. Check Firestore for new conversation in:")
    print(f"   creators/{CREATOR_ID}/conversations/{{your_phone}}")
    print("3. Monitor logs:")
    print(f"   gcloud logs tail --follow --project={PROJECT_ID} --resource.labels.service_name=zapsell-whatsapp-agent")

def main():
    """Main setup function"""
    print("=" * 60)
    print("ZapSell WhatsApp Agent - Firestore Setup")
    print("=" * 60)
    print(f"Project: {PROJECT_ID}")
    print(f"Creator: {CREATOR_ID}")
    print("=" * 60)
    print()

    try:
        # Create profile
        create_profile()
        print()

        # Create sample product
        create_sample_product()
        print()

        # Verify
        verify_setup()

    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nMake sure:")
        print("1. You're authenticated: gcloud auth application-default login")
        print("2. You have Firestore permissions")
        print("3. The Firestore database exists")
        return 1

    return 0

if __name__ == "__main__":
    exit(main())
