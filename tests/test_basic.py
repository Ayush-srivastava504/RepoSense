import pytest
import sys

def test_always_passes():
    assert True

def test_python_version():
    assert sys.version_info.major == 3

def test_addition():
    assert 1 + 1 == 2

def test_string():
    assert "hello".upper() == "HELLO"

def test_list():
    my_list = [1, 2, 3]
    assert len(my_list) == 3