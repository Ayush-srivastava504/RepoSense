# Production-grade database migration runner.
# Works across: local dev, GitHub Actions, Docker, EC2 production.

import os
import sys
import logging
import subprocess
from pathlib import Path
from typing import List


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


class MigrationRunner:

    def __init__(self):
        self.db_url = os.getenv("DATABASE_URL")
        self.migrations_dir = self._find_migrations_dir()
        self.psql_path = self._find_psql()

    def _find_migrations_dir(self) -> Path:
        script_dir = Path(__file__).resolve().parent

        candidates = [
            script_dir / "database" / "migrations",
            script_dir.parent / "database" / "migrations",
            Path("/app/database/migrations"),
        ]

        for migrations_dir in candidates:
            if migrations_dir.exists() and migrations_dir.is_dir():
                logger.info(f"Migrations directory: {migrations_dir}")
                return migrations_dir

        expected_path = script_dir / "database" / "migrations"

        logger.error("Migrations directory not found")
        logger.error(f"Expected at: {expected_path}")

        return expected_path

    def _find_psql(self) -> str:
        try:
            result = subprocess.run(
                ["which", "psql"],
                capture_output=True,
                text=True,
                check=False,
            )

            if result.returncode == 0 and result.stdout.strip():
                psql_path = result.stdout.strip()
                logger.info(f"Found psql at: {psql_path}")
                return psql_path

        except Exception as exc:
            logger.debug(f"Unable to locate psql using which: {exc}")

        common_paths = [
            "/usr/bin/psql",
            "/usr/local/bin/psql",
            "/opt/homebrew/bin/psql",
        ]

        for path in common_paths:
            if os.path.exists(path):
                logger.info(f"Found psql at: {path}")
                return path

        logger.warning("psql not found, using 'psql' from PATH")
        return "psql"

    def get_migration_files(self) -> List[Path]:
        if not self.migrations_dir.exists():
            logger.error(
                f"Migrations directory does not exist: "
                f"{self.migrations_dir}"
            )
            return []

        if not self.migrations_dir.is_dir():
            logger.error(
                f"Migrations path is not a directory: "
                f"{self.migrations_dir}"
            )
            return []

        migration_files = sorted(
            [
                file
                for file in self.migrations_dir.glob("*.sql")
                if file.name[:3].isdigit()
            ],
            key=lambda file: file.name,
        )

        if not migration_files:
            migration_files = sorted(
                self.migrations_dir.glob("*.sql"),
                key=lambda file: file.name,
            )

        if not migration_files:
            logger.error(
                f"No migration files found in: "
                f"{self.migrations_dir}"
            )
            return []

        return migration_files

    def run_migration(self, migration_file: Path) -> bool:
        logger.info(f"Running migration: {migration_file.name}")

        try:
            command = [
                self.psql_path,
                self.db_url,
                "-v",
                "ON_ERROR_STOP=1",
                "-f",
                str(migration_file),
            ]

            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
                timeout=300,
            )

            if result.returncode != 0:
                logger.error(
                    f"Migration failed: {migration_file.name}"
                )

                if result.stdout.strip():
                    logger.error(
                        f"stdout:\n{result.stdout.strip()}"
                    )

                if result.stderr.strip():
                    logger.error(
                        f"stderr:\n{result.stderr.strip()}"
                    )

                return False

            if result.stdout.strip():
                logger.info(result.stdout.strip())

            if result.stderr.strip():
                logger.warning(result.stderr.strip())

            logger.info(
                f"Migration completed: {migration_file.name}"
            )

            return True

        except subprocess.TimeoutExpired:
            logger.error(
                f"Migration timeout: {migration_file.name} "
                f"exceeded 5 minutes"
            )
            return False

        except FileNotFoundError:
            logger.error(
                f"psql executable not found at: {self.psql_path}"
            )
            logger.error(
                "Install the PostgreSQL client before running migrations."
            )
            return False

        except Exception as exc:
            logger.error(
                f"Unexpected error running "
                f"{migration_file.name}: {exc}"
            )
            return False

    def _mask_database_url(self) -> str:
        if not self.db_url:
            return "<not-set>"

        try:
            if "@" in self.db_url:
                credentials, host = self.db_url.rsplit("@", 1)

                if "://" in credentials:
                    scheme = credentials.split("://", 1)[0]
                    return f"{scheme}://***:***@{host}"

                return f"***:***@{host}"

            return self.db_url

        except Exception:
            return "<masked>"

    def run(self) -> bool:
        if not self.db_url:
            logger.error(
                "DATABASE_URL environment variable is not set"
            )
            return False

        logger.info(
            f"Database: {self._mask_database_url()}"
        )

        logger.info(
            f"Migrations directory: {self.migrations_dir}"
        )

        migration_files = self.get_migration_files()

        if not migration_files:
            logger.error(
                "No migration files found. "
                "Refusing to report migration success."
            )
            return False

        logger.info(
            f"Found {len(migration_files)} migration(s):"
        )

        for migration_file in migration_files:
            logger.info(
                f"  - {migration_file.name}"
            )

        logger.info("")

        success_count = 0

        for migration_file in migration_files:
            success = self.run_migration(migration_file)

            if success:
                success_count += 1
            else:
                logger.error(
                    f"Stopping migration process at: "
                    f"{migration_file.name}"
                )
                return False

        logger.info(
            f"All {success_count} migration(s) "
            f"completed successfully!"
        )

        return True


def main():
    runner = MigrationRunner()

    success = runner.run()

    if success:
        logger.info("Database migration process completed.")
        sys.exit(0)

    logger.error("Database migration process failed.")
    sys.exit(1)


if __name__ == "__main__":
    main()