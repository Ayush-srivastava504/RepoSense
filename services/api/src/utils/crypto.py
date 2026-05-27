from cryptography.fernet import Fernet, InvalidToken
from configs.config import settings

def _get_cipher() -> Fernet:
    """Initialize and return a Fernet cipher for token encryption.
    
    Requires the GITHUB_TOKEN_ENCRYPTION_KEY environment variable to be set
    to a valid base64-encoded 32-byte key. If the key is missing or malformed,
    raises RuntimeError with instructions to generate a valid key.
    
    The key is generated once and reused for all encryption/decryption operations.
    All GitHub tokens encrypted with one key cannot be decrypted with another,
    so key changes will render all stored tokens unreadable.
    
    Returns:
        Fernet: Initialized cipher for symmetric encryption.
        
    Raises:
        RuntimeError: If key is missing or not a valid Fernet key.
    """
    key = settings.GITHUB_TOKEN_ENCRYPTION_KEY
    if not key:
        raise RuntimeError(
            "GITHUB_TOKEN_ENCRYPTION_KEY is required. "
            "Generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    try:
        return Fernet(key.encode())
    except Exception as e:
        raise RuntimeError(f"Invalid GITHUB_TOKEN_ENCRYPTION_KEY: {e}")

_cipher = _get_cipher()

def encrypt_token(token: str) -> str:
    """Encrypt a GitHub access token for storage in the database.
    
    Uses the Fernet symmetric encryption cipher to encrypt the raw token
    into a base64-encoded encrypted string safe for database storage.
    
    Args:
        token: Raw GitHub access token string.
        
    Returns:
        Base64-encoded encrypted token string.
    """
    return _cipher.encrypt(token.encode()).decode()

def decrypt_token(encrypted: str) -> str:
    """Decrypt a stored GitHub access token.
    
    Uses the Fernet symmetric encryption cipher to decrypt a previously
    encrypted token retrieved from the database back into the raw token.
    
    Args:
        encrypted: Base64-encoded encrypted token from database.
        
    Returns:
        Raw GitHub access token string.
        
    Raises:
        ValueError: If the encrypted string is invalid or corrupted.
    """
    try:
        return _cipher.decrypt(encrypted.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Invalid encrypted token") from exc