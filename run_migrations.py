#!/usr/bin/env python3
"""
Production-grade database migration runner.
Works across: local dev, GitHub Actions, Docker, EC2 production.
"""

import subprocess
import os
import sys
import logging
from pathlib import Path
from typing import List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MigrationRunner:
    """Handles database migrations with environment detection."""
    
    def __init__(self):
        self.db_url = os.getenv("DATABASE_URL")
        self.project_root = self._find_project_root()
        self.migrations_dir = self._find_migrations_dir()
        self.psql_path = self._find_psql()
        
    def _find_project_root(self) -> Path:
        """
        Find the project root directory.
        Works in: local dev, GitHub Actions, Docker, EC2.
        """
        # Start from the script's location
        current = Path(__file__).resolve().parent
        
        # Common markers for project root
        markers = [
            ".git",
            "services/api",
            "infrastructure",
            "docker-compose.yml",
            "pyproject.toml",
            "requirements.txt"
        ]
        
        # Walk up until we find a marker
        for parent in [current] + list(current.parents):
            for marker in markers:
                if (parent / marker).exists():
                    logger.debug(f"Found project root at: {parent}")
                    return parent
                    
            # Check if we're in services/api
            if parent.name == "api" and (parent.parent / "infrastructure").exists():
                return parent.parent
        
        # Fallback: assume we're in services/api
        if current.name == "api":
            return current.parent
        
        # Last resort: use current directory
        logger.warning(f"Could not find project root, using: {current}")
        return current
    
    def _find_migrations_dir(self) -> Path:
        """Find the migrations directory."""
        # Try multiple possible locations
        possible_paths = [
            # Project root structure
            self.project_root / "services" / "api" / "database" / "migrations",
            self.project_root / "database" / "migrations",
            self.project_root / "migrations",
            
            # Relative to script
            Path(__file__).parent / "database" / "migrations",
            Path(__file__).parent / "migrations",
            
            # Docker/EC2 paths
            Path("/app/database/migrations"),
            Path("/app/migrations"),
        ]
        
        # Also check if we're in services/api
        if Path(__file__).parent.name == "api":
            possible_paths.insert(0, Path(__file__).parent / "database" / "migrations")
        
        for path in possible_paths:
            if path and path.exists() and path.is_dir():
                logger.info(f"Found migrations at: {path}")
                return path
        
        # If not found, create the directory
        default_path = self.project_root / "services" / "api" / "database" / "migrations"
        logger.warning(f"Migrations directory not found. Creating: {default_path}")
        default_path.mkdir(parents=True, exist_ok=True)
        return default_path
    
    def _find_psql(self) -> str:
        """Find psql executable."""
        # Check if psql is in PATH
        try:
            result = subprocess.run(
                ["which", "psql"],
                capture_output=True,
                text=True,
                check=False
            )
            if result.returncode == 0 and result.stdout.strip():
                psql_path = result.stdout.strip()
                logger.info(f"Found psql at: {psql_path}")
                return psql_path
        except Exception:
            pass
        
        # Check common installation paths
        common_paths = [
            # Linux (GitHub Actions, EC2)
            "/usr/bin/psql",
            "/usr/local/bin/psql",
            # Windows
            r"C:\Program Files\PostgreSQL\15\bin\psql.exe",
            r"C:\Program Files\PostgreSQL\14\bin\psql.exe",
            r"D:\New folder (4)\bin\psql.exe",
        ]
        
        for path in common_paths:
            if os.path.exists(path):
                logger.info(f"Found psql at: {path}")
                return path
        
        # If not found, assume it's in PATH (will fail with clear error)
        logger.warning("psql not found in common locations, using 'psql' from PATH")
        return "psql"
    
    def get_migration_files(self) -> List[Path]:
        """Get sorted migration files."""
        if not self.migrations_dir.exists():
            logger.error(f"Migrations directory not found: {self.migrations_dir}")
            return []
        
        # Get all SQL files sorted by name
        migration_files = sorted(
            [f for f in self.migrations_dir.glob("*.sql") if f.name[:3].isdigit()]
        )
        
        if not migration_files:
            logger.warning(f"No migration files found in {self.migrations_dir}")
            return []
        
        return migration_files
    
    def run_migration(self, migration_file: Path) -> bool:
        """Run a single migration file."""
        logger.info(f"Running: {migration_file.name}")
        
        try:
            # Build command
            cmd = [
                self.psql_path,
                self.db_url,
                "-f",
                str(migration_file),
                "-v",
                "ON_ERROR_STOP=1",
            ]
            
            # Run migration
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False,
                timeout=300  # 5 minute timeout per migration
            )
            
            if result.returncode != 0:
                logger.error(f"Failed: {migration_file.name}")
                if result.stderr:
                    logger.error(f"Error: {result.stderr}")
                return False
            
            if result.stdout.strip():
                logger.info(result.stdout.strip())
            
            logger.info(f"✓ {migration_file.name} completed")
            return True
            
        except subprocess.TimeoutExpired:
            logger.error(f"Timeout: {migration_file.name} took more than 5 minutes")
            return False
        except FileNotFoundError:
            logger.error(f"psql not found at: {self.psql_path}")
            logger.error("Please install PostgreSQL client:")
            logger.error("  Ubuntu/Debian: sudo apt-get install postgresql-client")
            logger.error("  RHEL/CentOS: sudo yum install postgresql")
            return False
        except Exception as e:
            logger.error(f"Error running {migration_file.name}: {e}")
            return False
    
    def run(self) -> bool:
        """Run all migrations."""
        # Validate database URL
        if not self.db_url:
            logger.error("DATABASE_URL environment variable not set")
            return False
        
        logger.info(f"Database: {self._mask_db_url(self.db_url)}")
        logger.info(f"Project root: {self.project_root}")
        logger.info(f"Migrations directory: {self.migrations_dir}")
        logger.info(f"psql path: {self.psql_path}")
        
        # Get migration files
        migration_files = self.get_migration_files()
        if not migration_files:
            logger.error("No migration files found")
            return False
        
        logger.info(f"Found {len(migration_files)} migration(s):")
        for f in migration_files:
            logger.info(f"  - {f.name}")
        logger.info("")
        
        # Run migrations
        success_count = 0
        for migration_file in migration_files:
            if self.run_migration(migration_file):
                success_count += 1
            else:
                logger.error(f"Stopping at {migration_file.name}")
                return False
        
        logger.info(f"✓ All {success_count} migrations completed successfully!")
        return True
    
    def _mask_db_url(self, url: str) -> str:
        """Mask password in database URL for logging."""
        import re
        return re.sub(r':([^:@]+)@', ':***@', url)


def main():
    """Main entry point."""
    runner = MigrationRunner()
    success = runner.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()