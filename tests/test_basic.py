"""
Basic tests that should always pass.
"""
import pytest
import sys
import asyncio

def test_python_version():
    """Test Python version is correct."""
    assert sys.version_info.major == 3
    assert sys.version_info.minor >= 11

def test_async():
    """Test async functionality works."""
    async def test_async_func():
        await asyncio.sleep(0.1)
        return True
    
    result = asyncio.run(test_async_func())
    assert result is True

def test_environment():
    """Test environment variables are set."""
    import os
    # These should be set in CI/CD
    assert os.environ.get("DATABASE_URL") is not None
    assert os.environ.get("JWT_SECRET") is not None

def test_math_operations():
    """Test basic math operations."""
    assert 1 + 1 == 2
    assert 2 * 3 == 6
    assert 10 / 2 == 5

def test_string_operations():
    """Test basic string operations."""
    assert "hello".upper() == "HELLO"
    assert "world".capitalize() == "World"
    assert "test" in "testing"

def test_list_operations():
    """Test basic list operations."""
    my_list = [1, 2, 3]
    assert len(my_list) == 3
    my_list.append(4)
    assert len(my_list) == 4
    assert 2 in my_list

def test_dictionary_operations():
    """Test basic dictionary operations."""
    my_dict = {"key": "value"}
    assert my_dict["key"] == "value"
    my_dict["new"] = "data"
    assert "new" in my_dict

@pytest.mark.parametrize("input_value,expected", [
    (1, 2),
    (2, 3),
    (3, 4),
    (4, 5),
])
def test_parametrized(input_value, expected):
    """Test parametrized tests work."""
    assert input_value + 1 == expected

@pytest.mark.skip(reason="Skipped test example")
def test_skipped():
    """This test is skipped."""
    assert False

@pytest.mark.slow
def test_slow_operation():
    """Example of a slow test marker."""
    import time
    time.sleep(0.5)
    assert True