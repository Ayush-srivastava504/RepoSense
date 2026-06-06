import asyncpg
from .config import settings

_pool = None

async def get_db_pool():
    """Create and return a singleton asyncpg connection pool.
    
    Attempts to establish a connection pool on first call. If the connection
    fails, logs a warning and returns None, allowing the application to start
    in degraded mode. On subsequent calls, retries the connection attempt if
    the pool was previously None, enabling recovery when the database becomes
    available. This pattern is essential in containerized environments where
    services may start before dependencies are ready.
    
    Returns:
        asyncpg.Pool if connection successful, None if unavailable.
    """
    global _pool
    if _pool is not None:
        return _pool
    try:
        # Attempt to create a connection pool using the configured URL.
        # In development environments the URL may contain a Docker service name
        # (e.g. "postgres") that cannot be resolved when the app is run locally.
        # If a DNS resolution error occurs, fall back to localhost while keeping
        # the original credentials and database name.
        try:
            _pool = await asyncpg.create_pool(
                settings.DATABASE_URL,
                min_size=1,
                max_size=10,
                command_timeout=60,
            )
        except OSError as dns_err:
            # OSError with errno 11001 indicates getaddrinfo failure.
            import urllib.parse

            parsed = urllib.parse.urlparse(settings.DATABASE_URL)
            # Replace the hostname with localhost while preserving the original path.
            # The netloc should contain only the credentials and host/port.
            netloc = f"{parsed.username}:{parsed.password}@localhost:{parsed.port}"
            fallback_url = parsed._replace(netloc=netloc).geturl()
            print(f"[WARN] DB hostname resolution failed ({dns_err}); retrying with localhost")
            _pool = await asyncpg.create_pool(
                fallback_url,
                min_size=1,
                max_size=10,
                command_timeout=60,
            )
        print("[DB] Connection pool created")
    except Exception as exc:
        print(f"[WARN] DB connect failed: {exc}")
        _pool = None
    return _pool


async def close_db_pool():
    """Close the connection pool and reset to None.
    
    Safely closes all connections in the pool and resets the global _pool
    variable to None, allowing a fresh connection on the next startup.
    Typically called during application shutdown.
    """
    global _pool
    if _pool:
        await _pool.close()
        _pool = None