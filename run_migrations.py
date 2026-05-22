#!/usr/bin/env python3
"""
Database migration runner for Internship Platform.
Automatically runs all migration SQL files in order.
"""

import subprocess
import os
import sys
from pathlib import Path

def run_migrations():
    """Run all database migrations in sequence."""
    
    # Get DATABASE_URL from environment or use default
    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres")
    
    if not db_url:
        print("ERROR: DATABASE_URL not set. Please set it in your .env file")
        sys.exit(1)
    
    # Path to migration files
    migrations_dir = Path(__file__).parent / "database" / "migrations"
    
    if not migrations_dir.exists():
        print(f"ERROR: Migrations directory not found at {migrations_dir}")
        sys.exit(1)
    
    # Get all migration files in order
    migration_files = sorted([
        f for f in migrations_dir.glob("*.sql")
        if f.name.startswith(tuple(str(i).zfill(3) for i in range(10)))
    ])
    
    if not migration_files:
        print("ERROR: No migration files found")
        sys.exit(1)
    
    print(f"Found {len(migration_files)} migration files:")
    for f in migration_files:
        print(f"  - {f.name}")
    print()
    
    # Run each migration
    for migration_file in migration_files:
        print(f"Running: {migration_file.name}...")
        
        try:
            # Use psql to run the migration
            result = subprocess.run(
                [
                    "psql",
                    db_url,
                    "-f", str(migration_file),
                    "-v", "ON_ERROR_STOP=1"  # Stop on first error
                ],
                capture_output=True,
                text=True,
                check=False
            )
            
            if result.returncode != 0:
                print(f"ERROR in {migration_file.name}:")
                print(result.stderr)
                sys.exit(1)
            else:
                print(f"✓ {migration_file.name} completed")
                if result.stdout:
                    print(result.stdout)
        
        except FileNotFoundError:
            print("ERROR: psql command not found. Please install PostgreSQL client tools.")
            print("  Windows: choco install postgresql")
            print("  Mac: brew install postgresql")
            print("  Linux: sudo apt install postgresql-client")
            sys.exit(1)
        
        print()
    
    print("✓ All migrations completed successfully!")

if __name__ == "__main__":
    run_migrations()
