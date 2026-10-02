"""company_directory: A-Z keys fold accents so 'Élan' lands under E, not 'Other'."""
import importlib
import pathlib

import pytest

SRC = pathlib.Path(__file__).resolve().parents[1] / 'src'


@pytest.fixture
def mod(monkeypatch):
    monkeypatch.syspath_prepend(str(SRC))
    return importlib.import_module('services.company_directory')


def test_letters(mod):
    f = mod.directory_letter
    assert [f(x) for x in ['Acme', '  zoho', 'Élan', 'Ürün Ltd', 'Çelik', '3M', '(Pvt) Tata']] == ['a', 'z', 'e', 'u', 'c', '0-9', 'p']
    assert [f(x) for x in ['日本電気', '', '   ', '---']] == ['other'] * 4


def test_sort_key_groups_accents_with_base_letter(mod):
    names = ['Zoho', 'Élan', 'Eaton', 'Fiserv', 'Acme']
    assert sorted(names, key=mod.sort_key) == ['Acme', 'Eaton', 'Élan', 'Fiserv', 'Zoho']
