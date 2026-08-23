# Module: src/utils/logger.py
# Defines class(es): JSONFormatter
# Defines function(s): setup_logger
#

import logging
import sys
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):

    def format(self, record: logging.LogRecord) -> str:
        output = {'ts': datetime.utcnow().isoformat(), 'level': record.levelname, 'logger': record.name, 'msg': record.getMessage(), 'file': f'{record.filename}:{record.lineno}'}
        if record.exc_info:
            output['exc'] = self.formatException(record.exc_info)
        return json.dumps(output)

def setup_logger(name: str, level: str='INFO') -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(JSONFormatter())
    logger.addHandler(h)
    logger.propagate = False
    return logger
