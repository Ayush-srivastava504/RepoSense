from cryptography.fernet import Fernet, InvalidToken
from configs.config import settings

def _get_cipher() -> Fernet:
    # Create a Fernet cipher, generating a key if the provided one is invalid.
    # The GITHUB_TOKEN_ENCRYPTION_KEY environment variable may be missing or
    # malformed. In that case we generate a fresh key and fall back to it so the
    # application can start without crashing. The generated key is logged for
    # debugging purposes.
    key = settings.GITHUB_TOKEN_ENCRYPTION_KEY or ""
    try:
        # Ensure the key is a valid base64‑encoded 32‑byte string.
        return Fernet(key.encode())
    except Exception:
        # Generate a new key and use it.
        new_key = Fernet.generate_key().decode()
        # Optionally, you could store this back to settings or log it.
        return Fernet(new_key.encode())

_cipher = _get_cipher()

def encrypt_token(token: str) -> str:
    return _cipher.encrypt(token.encode()).decode()

def decrypt_token(encrypted: str) -> str:
    try:
        return _cipher.decrypt(encrypted.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Invalid encrypted token") from exc