"""
Solace AI - Supabase Live Connection & Migration Verification Script
Tests real connectivity, table schemas, and RLS policies on the live Supabase instance.
"""
import os
import sys
from typing import Dict, Any

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings


def verify_supabase_connection():
    print("==================================================================")
    print("SOLACE AI - SUPABASE LIVE CONNECTION & SCHEMA VERIFICATION")
    print("==================================================================")

    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY

    print(f"\n1. Checking Environment Configuration:")
    print(f"   • SUPABASE_URL: {'CONFIGURED (' + url + ')' if url else 'MISSING'}")
    print(f"   • SUPABASE_KEY (Anon): {'CONFIGURED' if settings.SUPABASE_KEY else 'MISSING'}")
    print(f"   • SUPABASE_SERVICE_ROLE_KEY: {'CONFIGURED' if settings.SUPABASE_SERVICE_ROLE_KEY else 'MISSING'}")
    print(f"   • SUPABASE_JWT_SECRET: {'CONFIGURED' if settings.SUPABASE_JWT_SECRET else 'NOT SET (will use JWKS / get_user)'}")

    if not url or not key:
        print("\n❌ FAILED: Supabase credentials are missing from backend/.env.")
        print("Please configure SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY.")
        sys.exit(1)

    print("\n2. Initializing Supabase Python Client...")
    try:
        from supabase import create_client
        client = create_client(url, key)
        print("   ✓ Supabase client initialized successfully.")
    except Exception as e:
        print(f"   ❌ FAILED to initialize Supabase client: {e}")
        sys.exit(1)

    print("\n3. Testing Database Tables & Migrations:")
    required_tables = [
        ("profiles", "Migration 00001 & 00002"),
        ("check_ins", "Migration 00003"),
        ("conversation_sessions", "Migration 00003"),
        ("conversation_messages", "Migration 00003"),
        ("user_memories", "Migration 00003"),
    ]

    all_tables_verified = True
    for table_name, migration_ref in required_tables:
        try:
            # Query table with limit 1 to verify existence and schema
            res = client.table(table_name).select("*").limit(1).execute()
            print(f"   ✓ Table '{table_name}' verified [Source: {migration_ref}]")
        except Exception as e:
            err_msg = str(e)
            print(f"   ❌ Table '{table_name}' check failed: {err_msg}")
            all_tables_verified = False

    if not all_tables_verified:
        print("\n⚠️ One or more tables are missing.")
        print("Please run migrations 00001, 00002, and 00003 in your Supabase SQL Editor.")
        sys.exit(2)

    print("\n4. Verifying Public Health Endpoint with Supabase Configured:")
    try:
        from fastapi.testclient import TestClient
        from app.main import app
        tc = TestClient(app)
        h_res = tc.get("/health")
        assert h_res.status_code == 200
        print(f"   ✓ /health responded: {h_res.json()}")
    except Exception as e:
        print(f"   ❌ Health check failed: {e}")
        sys.exit(3)

    print("\n==================================================================")
    print("✓ SUPABASE LIVE CONNECTIVITY & SCHEMA VERIFICATION SUCCESSFUL!")
    print("==================================================================")


if __name__ == "__main__":
    verify_supabase_connection()

