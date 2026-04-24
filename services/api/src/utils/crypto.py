from cryptography.fernet import Fernet
from ..config.settings import settings

cipher = Fernet(settings.GITHUB_TOKEN_ENCRYPTION_KEY.encode())

def encrypt_token(token: str) -> str:
    return cipher.encrypt(token.encode()).decode()

def decrypt_token(encrypted: str) -> str:
    return cipher.decrypt(encrypted.encode()).decode()