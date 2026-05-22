#!/usr/bin/env python3
"""
Quick import test to verify all modules can be imported without errors.
"""
import sys
import traceback

def test_imports():
    """Test that all key modules can be imported."""
    modules_to_test = [
        "src.configs.settings",
        "src.configs.db",
        "src.configs.redis",
        "src.middleware.auth",
        "src.middleware.rate_limit",
        "src.routes.auth",
        "src.routes.github",
        "src.routes.resume",
        "src.routes.jobs",
        "src.core.app",
    ]
    
    print("Testing module imports...")
    failed = []
    
    for module_name in modules_to_test:
        try:
            __import__(module_name)
            print(f"  ✓ {module_name}")
        except Exception as e:
            print(f"  ✗ {module_name}: {str(e)}")
            failed.append((module_name, e))
    
    if failed:
        print(f"\n❌ {len(failed)} modules failed to import:")
        for module_name, error in failed:
            print(f"\n{module_name}:")
            traceback.print_exception(type(error), error, error.__traceback__)
        return 1
    else:
        print(f"\n✓ All {len(modules_to_test)} modules imported successfully!")
        return 0

if __name__ == "__main__":
    sys.exit(test_imports())
