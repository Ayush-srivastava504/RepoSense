import logging
import sys
import json
from datetime import datetime


class JSONFormatter(logging.Formatter):
    """JSON formatter that outputs one JSON line per log record.
    
    Transforms log records into machine-readable JSON lines suitable for
    ingestion by logging aggregators like CloudWatch, Datadog, or Loki.
    Each line contains timestamp, log level, logger name, message, file location,
    and optional exception information.
    """
    
    def format(self, record: logging.LogRecord) -> str:
        """Format a log record as a single JSON line.
        
        Args:
            record: LogRecord from the logging system.
            
        Returns:
            Single-line JSON string representation of the record.
        """
        output = {
            "ts":      datetime.utcnow().isoformat(),
            "level":   record.levelname,
            "logger":  record.name,
            "msg":     record.getMessage(),
            "file":    f"{record.filename}:{record.lineno}",
        }
        if record.exc_info:
            output["exc"] = self.formatException(record.exc_info)
        return json.dumps(output)


def setup_logger(name: str, level: str = "INFO") -> logging.Logger:
    """Create and configure a structured logger.
    
    Sets up a logger with JSON formatting, avoiding duplicate handlers
    if the logger is already initialized. Each logger gets its own
    StreamHandler writing to stdout.
    
    Args:
        name: Logger name (typically __name__).
        level: Logging level as string ('DEBUG', 'INFO', 'WARNING', 'ERROR').
        
    Returns:
        Configured logger instance with JSON formatter.
    """
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(JSONFormatter())
    logger.addHandler(h)
    logger.propagate = False
    return logger