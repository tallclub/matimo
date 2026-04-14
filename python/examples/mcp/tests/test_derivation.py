#!/usr/bin/env python3
"""
Quick test to verify the site-packages derivation approach.
"""
import sys
import pathlib
import inspect

from matimo import Matimo

# Test the derivation
matimo_module = inspect.getmodule(Matimo)
matimo_module_path = matimo_module.__file__
print(f"matimo module path: {matimo_module_path}")

site_packages = str(pathlib.Path(matimo_module_path).parent.parent)
print(f"derived site-packages: {site_packages}")

# Check if publisher packages are there
import os
matimopkgs = [d for d in os.listdir(site_packages) if d.startswith("matimo_")]
print(f"Found {len(matimopkgs)} matimo_* packages:")
for pkg in sorted(matimopkgs)[:5]:
    print(f"  - {pkg}")
