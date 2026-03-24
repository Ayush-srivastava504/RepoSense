import logging
import sys
from configs.config import settings

def setup_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    
    if not logger.handlers:
        logger.setLevel(getattr(logging, settings.logging.LOG_LEVEL))
        
        formatter = logging.Formatter(settings.logging.LOG_FORMAT)
        
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
        
        if settings.logging.LOG_FILE:
            file_handler = logging.FileHandler(settings.logging.LOG_FILE)
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
    
    return logger