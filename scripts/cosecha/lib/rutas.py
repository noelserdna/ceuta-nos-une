# -*- coding: utf-8 -*-
"""Dónde vive lo cosechado. Ver lib/rutas.mjs: mismo criterio, mismo aviso."""
import os
import sys

PREDETERMINADO = "/Volumes/1T/fotos_ceutaweb"


def datos(obligatorio=True):
    ruta = os.environ.get("COSECHA_DATOS", PREDETERMINADO)
    if os.path.isdir(ruta):
        return ruta
    if not obligatorio:
        os.makedirs(ruta, exist_ok=True)
        return ruta
    print(f"✗ No encuentro {ruta}.", file=sys.stderr)
    print("  El disco externo no está montado. Enchúfalo, o di dónde están los datos "
          "con COSECHA_DATOS=/otra/ruta", file=sys.stderr)
    sys.exit(1)
