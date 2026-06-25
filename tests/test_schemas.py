"""
Schema/Pydantic model tests.
"""
import pytest
from pydantic import ValidationError
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

def test_email_validation():
    """Test email validation."""
    try:
        from pydantic import BaseModel, EmailStr
        
        class TestModel(BaseModel):
            email: EmailStr
        
        # Valid email
        model = TestModel(email="test@example.com")
        assert model.email == "test@example.com"
        
        # Invalid email should raise ValidationError
        with pytest.raises(ValidationError):
            TestModel(email="not-an-email")
    except ImportError:
        pytest.skip("Pydantic not available")

def test_required_fields():
    """Test required field validation."""
    try:
        from pydantic import BaseModel
        
        class TestModel(BaseModel):
            name: str
            age: int
        
        # Valid
        model = TestModel(name="John", age=30)
        assert model.name == "John"
        assert model.age == 30
        
        # Missing required field
        with pytest.raises(ValidationError):
            TestModel(name="John")
    except ImportError:
        pytest.skip("Pydantic not available")

def test_field_validation():
    """Test field validation with constraints."""
    try:
        from pydantic import BaseModel, Field
        
        class TestModel(BaseModel):
            score: int = Field(ge=0, le=100)
        
        # Valid
        model = TestModel(score=75)
        assert model.score == 75
        
        # Invalid
        with pytest.raises(ValidationError):
            TestModel(score=150)
    except ImportError:
        pytest.skip("Pydantic not available")