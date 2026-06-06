#!/usr/bin/env python3

import subprocess
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

def run_migrations():
    db_url = os.getenv("DATABASE_URL")

    if not db_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    print(f"Using database: {db_url}")
    print()

    migrations_dir = Path(__file__).parent / "database" / "migrations"

    if not migrations_dir.exists():
        print(f"ERROR: Migrations directory not found: {migrations_dir}")
        sys.exit(1)

    migration_files = sorted(
        [
            f
            for f in migrations_dir.glob("*.sql")
            if f.name[:3].isdigit()
        ]
    )

    if not migration_files:
        print("ERROR: No migration files found")
        sys.exit(1)

    print(f"Found {len(migration_files)} migration files:")
    for f in migration_files:
        print(f"  - {f.name}")

    print()

    psql_path = r"D:\New folder (4)\bin\psql.exe"

    if not os.path.exists(psql_path):
        print(f"ERROR: psql not found at {psql_path}")
        sys.exit(1)

    for migration_file in migration_files:
        print(f"Running: {migration_file.name}...")

        result = subprocess.run(
            [
                psql_path,
                db_url,
                "-f",
                str(migration_file),
                "-v",
                "ON_ERROR_STOP=1",
            ],
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            print(f"ERROR in {migration_file.name}:")
            print(result.stderr)
            sys.exit(1)

        print(f"✓ {migration_file.name} completed")

        if result.stdout.strip():
            print(result.stdout)

        print()

    print("✓ All migrations completed successfully!")

if __name__ == "__main__":
    run_migrations()