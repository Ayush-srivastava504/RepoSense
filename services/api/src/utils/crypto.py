# Module: src/utils/crypto.py
# Defines function(s): _get_cipher, encrypt_token, decrypt_token
#
#

from cryptography.fernet import Fernet, InvalidToken
from configs.config import settings

def _get_cipher() -> Fernet:
    key = settings.GITHUB_TOKEN_ENCRYPTION_KEY
    if not key:
        raise RuntimeError('GITHUB_TOKEN_ENCRYPTION_KEY is required. Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"')
    try:
        return Fernet(key.encode())
    except Exception as e:
        raise RuntimeError(f'Invalid GITHUB_TOKEN_ENCRYPTION_KEY: {e}')
_cipher = _get_cipher()

def encrypt_token(token: str) -> str:
    return _cipher.encrypt(token.encode()).decode()

def decrypt_token(encrypted: str) -> str:
    try:
        return _cipher.decrypt(encrypted.encode()).decode()
    except InvalidToken as exc:
        raise ValueError('Invalid encrypted token') from exc
