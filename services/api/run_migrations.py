# Production-grade database migration runner.
# Works across: local dev, GitHub Actions, Docker, EC2 production.
#
#

import subprocess
import os
import sys
import logging
from pathlib import Path
from typing import List, Optional
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MigrationRunner:

    def __init__(self):
        self.db_url = os.getenv('DATABASE_URL')
        self.migrations_dir = self._find_migrations_dir()
        self.psql_path = self._find_psql()

    def _find_migrations_dir(self) -> Path:
        script_dir = Path(__file__).resolve().parent
        migrations_dir = script_dir / 'database' / 'migrations'
        if not migrations_dir.exists():
            project_root = script_dir.parent
            migrations_dir = project_root / 'database' / 'migrations'
        if not migrations_dir.exists():
            migrations_dir = Path('/app/database/migrations')
        if not migrations_dir.exists():
            logger.error(f'Migrations directory not found')
            logger.error(f'Expected at: {script_dir / 'database' / 'migrations'}')
            migrations_dir = script_dir / 'database' / 'migrations'
            migrations_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f'Created migrations directory: {migrations_dir}')
        logger.info(f'Migrations directory: {migrations_dir}')
        return migrations_dir

    def _find_psql(self) -> str:
        try:
            result = subprocess.run(['which', 'psql'], capture_output=True, text=True, check=False)
            if result.returncode == 0 and result.stdout.strip():
                psql_path = result.stdout.strip()
                logger.info(f'Found psql at: {psql_path}')
                return psql_path
        except Exception:
            pass
        common_paths = ['/usr/bin/psql', '/usr/local/bin/psql', '/opt/homebrew/bin/psql']
        for path in common_paths:
            if os.path.exists(path):
                logger.info(f'Found psql at: {path}')
                return path
        logger.warning("psql not found, using 'psql' from PATH")
        return 'psql'

    def get_migration_files(self) -> List[Path]:
        if not self.migrations_dir.exists():
            logger.error(f'Migrations directory not found: {self.migrations_dir}')
            return []
        migration_files = sorted([f for f in self.migrations_dir.glob('*.sql') if f.name[:3].isdigit()])
        if not migration_files:
            migration_files = sorted(self.migrations_dir.glob('*.sql'))
        if not migration_files:
            logger.warning(f'No migration files found in {self.migrations_dir}')
            return []
        return migration_files

    def run_migration(self, migration_file: Path) -> bool:
        logger.info(f'Running: {migration_file.name}')
        try:
            cmd = [self.psql_path, self.db_url, '-f', str(migration_file), '-v', 'ON_ERROR_STOP=1']
            result = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=300)
            if result.returncode != 0:
                logger.error(f'Failed: {migration_file.name}')
                if result.stderr:
                    logger.error(f'Error: {result.stderr}')
                return False
            if result.stdout.strip():
                logger.info(result.stdout.strip())
            logger.info(f'✓ {migration_file.name} completed')
            return True
        except subprocess.TimeoutExpired:
            logger.error(f'Timeout: {migration_file.name} took more than 5 minutes')
            return False
        except FileNotFoundError:
            logger.error(f'psql not found at: {self.psql_path}')
            logger.error('Please install PostgreSQL client')
            return False
        except Exception as e:
            logger.error(f'Error running {migration_file.name}: {e}')
            return False

    def run(self) -> bool:
        if not self.db_url:
            logger.error('DATABASE_URL environment variable not set')
            return False
        masked_url = self.db_url
        if '@' in masked_url:
            masked_url = masked_url.split('@')[0].replace('://', '://***:') + '@' + masked_url.split('@')[1]
        logger.info(f'Database: {masked_url}')
        logger.info(f'Migrations directory: {self.migrations_dir}')
        migration_files = self.get_migration_files()
        if not migration_files:
            logger.warning('No migration files found. Creating sample migration...')
            self._create_sample_migration()
            return True
        logger.info(f'Found {len(migration_files)} migration(s):')
        for f in migration_files:
            logger.info(f'  - {f.name}')
        logger.info('')
        success_count = 0
        for migration_file in migration_files:
            if self.run_migration(migration_file):
                success_count += 1
            else:
                logger.error(f'Stopping at {migration_file.name}')
                return False
        logger.info(f'✓ All {success_count} migrations completed successfully!')
        return True

    def _create_sample_migration(self):
        sample_file = self.migrations_dir / '001_sample.sql'
        sample_file.write_text('\n-- Sample migration file\n-- Add your schema changes here\n\n-- Example:\n-- CREATE TABLE IF NOT EXISTS users (\n--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n--     email TEXT UNIQUE NOT NULL,\n--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n-- );\n')
        logger.info(f'Created sample migration: {sample_file}')

def main():
    runner = MigrationRunner()
    success = runner.run()
    sys.exit(0 if success else 1)
if __name__ == '__main__':
    main()
