# -*- coding: utf-8 -*-
"""
Paso 1 de la cosecha: pasar la hoja «Fotos concentraciones» a datos/hoja.json.

Una fila del Excel es un par (publicación, municipio), no una publicación: The
Objective documenta once pueblos en la misma galería y La Voz de Almería diez.
Aquí se separan las dos cosas, porque cosechar once veces la misma URL serían
once visitas y once copias del mismo JPEG.

El script se autocomprueba: si los recuentos no cuadran con lo medido el
05/09/2026, sale con código 1. Un lector de hoja de cálculo que se equivoca en
silencio es peor que uno que no funciona.

    python3 scripts/cosecha/1-leer-hoja.py ~/Downloads/Municipios_España_Ayuntamientos_4.xlsx
"""
import hashlib
import json
import os
import re
import sys
from collections import Counter
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

import openpyxl

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, "lib"))
import rutas  # noqa: E402

SALIDA = os.path.join(rutas.datos(obligatorio=False), "hoja.json")

# Lo medido el 05/09/2026 sobre el libro _4. Si cambia, es que el libro es otro
# (bien) o que el lector se ha estropeado (mal): en los dos casos hay que mirar.
ESPERADO = {"filas": 934, "municipios": 765}

# Basura conocida en la columna URL: un buscador no es una publicación.
NO_ES_PUBLICACION = re.compile(r"facebook\.com/search/", re.I)


def normalizar_url(u):
    """Quita el rastreo y unifica, para que dos filas con la misma publicación
    escrita distinta cuenten como una."""
    p = urlparse((u or "").strip())
    query = [(k, v) for k, v in parse_qsl(p.query)
             if not k.lower().startswith(("utm_", "igsh", "fbclid", "mibextid", "sfnsn"))]
    ruta = p.path if p.path.endswith("/") or "." in p.path.rsplit("/", 1)[-1] else p.path + "/"
    return urlunparse((p.scheme or "https", p.netloc.lower().replace("m.facebook", "www.facebook"),
                       ruta, "", urlencode(query), ""))


def forma(url):
    """Cómo hay que abrirla, que es lo único que decide el trabajo."""
    u = url or ""
    if "instagram.com" in u:
        if re.search(r"/(reel|tv)/[\w-]+", u):
            return "instagram", "ig_reel"
        if re.search(r"/p/[\w-]+", u):
            return "instagram", "ig_post"
        return "instagram", "ig_perfil"
    if "facebook.com" in u:
        if re.search(r"(/posts/|story_fbid=|/videos/|/photos/|/permalink|/share/p/|/reel/|photo\.php)", u):
            return "facebook", "fb_post"
        return "facebook", "fb_pagina"
    return "prensa", "articulo"


def cuenta_de(url, medio):
    """@usuario en las redes, dominio en la prensa: es la unidad de retirada."""
    m = re.search(r"instagram\.com/([\w.]+)/(?:p|reel|tv)/", url or "")
    if m:
        return "@" + m.group(1)
    m = re.search(r"@([\w.]+)", medio or "")
    if m:
        return "@" + m.group(1)
    m = re.search(r"facebook\.com/([\w.\-]+)", url or "")
    if m and m.group(1) not in ("profile.php", "permalink.php", "photo.php"):
        return m.group(1)
    return (urlparse(url or "").netloc or "").replace("www.", "") or None


def credito_con_nombre(credito, cuenta):
    """Un crédito tiene que decir de quién es. La hoja trae a veces sólo el tipo
    —«(medio de comunicación)»— sin el nombre; entonces se antepone la cuenta que
    publica, que siempre la sabemos por la propia URL."""
    c = (credito or "").strip()
    if not c or c.startswith("("):
        return f"{cuenta or 'autor sin identificar'} {c}".strip()
    return c


AGENCIAS = re.compile(r"\b(EFE|Europa Press|Reuters|AFP|AP)\b", re.I)
OFICIAL = re.compile(r"(cuenta oficial|ayuntamiento|ayto|concello|ajuntament|udal)", re.I)


def licencia(credito, red):
    """Para poder cambiar de criterio por clase sin volver a cosechar nada."""
    c = credito or ""
    if AGENCIAS.search(c):
        return "agencia"
    if OFICIAL.search(c):
        return "institucional"
    if red == "prensa":
        return "prensa"
    return "sin_clasificar"


def main():
    libro = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser(
        "~/Downloads/Municipios_España_Ayuntamientos_4.xlsx")
    wb = openpyxl.load_workbook(libro, data_only=True)
    ws = wb["Fotos concentraciones"]
    cab = [c.value for c in ws[6]]

    publicaciones, vinculos, municipios, descartadas = {}, [], {}, []
    for fila in ws.iter_rows(min_row=7, values_only=True):
        d = {k: (str(v).strip() if v is not None else None) for k, v in zip(cab, fila)}
        if not d.get("Municipio"):
            continue
        clave_muni = f"{d['Municipio']}|{d['Provincia']}"
        municipios.setdefault(clave_muni, {
            "municipio": d["Municipio"], "provincia": d["Provincia"], "ccaa": d["CCAA"],
        })

        url = normalizar_url(d["URL"])
        if not url or NO_ES_PUBLICACION.search(url):
            # El municipio se queda; lo que no sirve es el enlace. Sale en el
            # mapa sin foto, que es la verdad: hubo concentración y no tenemos
            # de dónde bajar nada.
            descartadas.append({"municipio": clave_muni, "url": d["URL"]})
            continue

        red, fma = forma(url)
        pub = publicaciones.setdefault(url, {
            "url": url, "red": red, "forma": fma,
            "cuenta": cuenta_de(url, d["Medio"]), "medio": d["Medio"],
            "credito": credito_con_nombre(d["Credito"] or d["Medio"], cuenta_de(url, d["Medio"])),
            "licencia": licencia(d["Credito"] or d["Medio"], red),
            "hay_video": 1 if fma in ("ig_reel",) else 0,
        })

        vinculos.append({
            "url": url, "municipio": clave_muni,
            "tipo": {"Cartel de convocatoria": "cartel", "Foto/vídeo del acto": "acto",
                     "Cartel + foto del acto": "cartel_y_acto", "Foto de prensa": "prensa",
                     "Página oficial confirmada (sin extracto de la publicación)": "solo_pagina",
                     }.get(d["Tipo"], "sin_clasificar"),
            "lugar": d["Lugar"] if d["Lugar"] not in (None, "—", "-") else None,
            "notas": d["Notas"],
        })
        # La clave sirve para reanudar: identifica la publicación, no la fila.
        pub["clave"] = hashlib.sha256(url.encode()).hexdigest()[:16]

    formas = Counter(p["forma"] for p in publicaciones.values())
    licencias = Counter(p["licencia"] for p in publicaciones.values())
    print(f"Fotos concentraciones: {len(vinculos)} vínculos · {len(publicaciones)} publicaciones "
          f"· {len(municipios)} municipios · {sum(1 for v in vinculos if v['notas'])} con notas")
    print("  formas:   " + " · ".join(f"{k} {n}" for k, n in formas.most_common()))
    print("  licencia: " + " · ".join(f"{k} {n}" for k, n in licencias.most_common()))
    if descartadas:
        print(f"  descartadas {len(descartadas)} URL que no son publicaciones "
              f"(sus municipios se conservan, sin foto)")

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, "w", encoding="utf-8") as fh:
        json.dump({"libro": os.path.basename(libro),
                   "publicaciones": list(publicaciones.values()),
                   "vinculos": vinculos,
                   "municipios": list(municipios.values()),
                   "descartadas": descartadas}, fh, ensure_ascii=False, indent=1)
    print("✓ escrito", SALIDA)

    if len(vinculos) + len(descartadas) != ESPERADO["filas"] or len(municipios) != ESPERADO["municipios"]:
        print(f"✗ los recuentos no cuadran con lo medido ({ESPERADO}). Mira la hoja antes de seguir.",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
