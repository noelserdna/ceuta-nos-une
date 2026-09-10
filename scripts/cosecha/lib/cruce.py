# -*- coding: utf-8 -*-
"""
Emparejar nombres de municipio, que es lo difícil de todo esto.

Portado del cruce que ya se afinó contra los datos reales (el mismo criterio que
`src/union.ts`): acentos y artículos aparte, nombres bilingües por sus dos
formas, y NUNCA recortar tras «de» —ese atajo confunde Torrejón de Ardoz con
Torrejón de la Calzada—. Con alias para lo que ninguna regla resuelve
(Puzol/Puçol, Tarrasa/Terrassa) y una tabla de núcleos que no son municipio,
que se agrupan bajo el ayuntamiento del que dependen, que es quien tiene cuenta.
"""
import re, unicodedata
from collections import defaultdict

def pelar(s):
    s = (s or "").lower()
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", pelar(s)).strip()
def norm_muni(s):
    t = pelar(s).replace("ç", "c")
    t = re.sub(r"\(.*?\)", " ", t)                       # «Lena (La Pola)»
    t = re.sub(r"\b(el|la|los|las|l)\b", " ", t)
    return re.sub(r"[^a-z0-9]+", " ", t).strip()

def formas_muni(nombre):
    """Todas las escrituras de un nombre. Ninguna recorta tras «de»."""
    out = set()
    def meter(v):
        v = v.strip()
        if v:
            out.add(v)
            out.add("|" + " ".join(sorted(set(v.split()))))   # forma ordenada: «Coruña, A» = «A Coruña»
    meter(norm_muni(nombre))
    for parte in re.split(r"[/\-–]", nombre or ""):           # «Donostia/San Sebastián», «Burgo de Osma-Ciudad de Osma»
        meter(norm_muni(parte))
        m = re.match(r"^(.*),\s*(el|la|los|las|l'|a|o|as|os|es|sa)$", parte.strip(), re.I)
        if m: meter(norm_muni(m.group(1)))
    return out

PROVINCIAS = ["A Coruña","Álava","Albacete","Alicante","Almería","Asturias","Ávila","Badajoz",
 "Baleares","Barcelona","Burgos","Cáceres","Cádiz","Cantabria","Castellón","Ceuta","Ciudad Real",
 "Córdoba","Cuenca","Girona","Granada","Guadalajara","Guipúzcoa","Huelva","Huesca","Jaén",
 "La Rioja","Las Palmas","León","Lleida","Lugo","Madrid","Málaga","Melilla","Murcia","Navarra",
 "Ourense","Palencia","Pontevedra","Salamanca","Santa Cruz de Tenerife","Segovia","Sevilla",
 "Soria","Tarragona","Teruel","Toledo","Valencia","Valladolid","Vizcaya","Zamora","Zaragoza"]
POR_NOMBRE = {norm(p): p for p in PROVINCIAS}
ALIAS_PROV = {"oalencia":"Palencia","illes balears":"Baleares","balears illes":"Baleares",
 "tenerife":"Santa Cruz de Tenerife","santa cruz tenerife":"Santa Cruz de Tenerife",
 "araba alava":"Álava","alava araba":"Álava","alacant alicante":"Alicante",
 "castello castellon":"Castellón","valencia valencia":"Valencia","gipuzkoa":"Guipúzcoa",
 "bizkaia":"Vizcaya","rioja la":"La Rioja","palmas las":"Las Palmas","coruna a":"A Coruña",
 "a coruna":"A Coruña","gerona":"Girona","lerida":"Lleida","orense":"Ourense",
 "guipuzcoa":"Guipúzcoa","region murcia":"Murcia","comunidad madrid":"Madrid",
 "principado asturias":"Asturias","leo":"León","navarra nafarroa":"Navarra"}
EXTRANJERO = {"otros paises","estados unidos","texas","florida ee uu","reino unido","portugal",
 "belgica","luxemburgo","francia","alemania","suiza","region de bruselas capital","paises bajos"}

def a_una_letra(a, b):
    if abs(len(a) - len(b)) > 1: return False
    i = j = fallos = 0
    while i < len(a) and j < len(b):
        if a[i] == b[j]: i += 1; j += 1; continue
        fallos += 1
        if fallos > 1: return False
        if len(a) > len(b): i += 1
        elif len(a) < len(b): j += 1
        else: i += 1; j += 1
    return fallos + (len(a) - i) + (len(b) - j) <= 1

def provincia(p):
    n = norm(p)
    d = POR_NOMBRE.get(n) or ALIAS_PROV.get(n)
    if d: return d
    if len(n) >= 5:
        cerca = [q for q in PROVINCIAS if a_una_letra(n, norm(q))]
        if len(cerca) == 1: return cerca[0]
    return None

# Variantes que ninguna regla resuelve sin inventarse cosas: nombre publicado -> nombre del REL.
ALIAS_MUNI = {
 ("Baleares","palma de mallorca"):"Palma", ("Castellón","castellon"):"Castelló de la Plana/Castellón de la Plana",
 ("Alicante","crevillente"):"Crevillent", ("Valencia","puzol"):"Puçol", ("Barcelona","tarrasa"):"Terrassa",
 ("Alicante","san juan de alicante"):"Sant Joan d'Alacant", ("Ourense","orense"):"Ourense",
 ("Valencia","fontanars dels aforins"):"Fontanars dels Alforins", ("Alicante","polop de marina"):"Polop",
 ("Granada","otura"):"Villa de Otura", ("Madrid","rozas"):"Rozas de Madrid, Las",
 ("Granada","huetor santillan"):"Huétor de Santillán", ("Badajoz","guadiana del caudillo"):"Guadiana",
 ("León","carrizo de ribera"):"Carrizo", ("Madrid","rozss de madrid"):"Rozas de Madrid, Las",
}
# Nucleos de poblacion que no son municipio: se revisa la cuenta del ayuntamiento del que dependen.
PEDANIAS = {
 ("Cantabria","renedo de pielagos"):"Piélagos", ("Cantabria","solares"):"Medio Cudeyo",
 ("Cantabria","muriedas"):"Camargo", ("Cantabria","bezana"):"Santa Cruz de Bezana",
 ("Cantabria","ajo"):"Bareyo", ("Cádiz","barca de florida"):"Jerez de la Frontera",
 ("Cádiz","san pablo de buceite"):"Jimena de la Frontera", ("Cádiz","zahara de atunes"):"Barbate",
 ("Huelva","portil"):"Punta Umbría", ("Córdoba","encinarejo de cordoba"):"Córdoba",
 ("León","virgen de camino"):"Valverde de la Virgen", ("Málaga","san pedro de alcantara"):"Marbella",
 ("Málaga","nueva andalucia"):"Marbella", ("Córdoba","castil de campos"):"Priego de Córdoba",
}



# --------------------------------------------------------------- índice REL --

def hacer_indice(rel):
    """Devuelve `ficha(municipio, provincia)` contra el Registro de Entidades
    Locales: la ficha oficial y por qué camino se encontró."""
    por_clave, por_forma_nacional, por_id = {}, defaultdict(set), {}
    for r in rel:
        por_id[id(r)] = r
        pr = provincia(r["Provincia"]) or norm(r["Provincia"])
        for f in formas_muni(r["Municipio"]):
            por_clave.setdefault((pr, f), r)
            por_forma_nacional[f].add(id(r))

    def ficha(muni, prov):
        pr = provincia(prov)
        fs = formas_muni(muni)
        if pr:
            a = ALIAS_MUNI.get((pr, norm_muni(muni))) or PEDANIAS.get((pr, norm_muni(muni)))
            if a:
                for f in formas_muni(a):
                    if (pr, f) in por_clave:
                        return por_clave[(pr, f)], ("pedania" if PEDANIAS.get((pr, norm_muni(muni))) else "alias")
            for f in fs:
                if (pr, f) in por_clave:
                    return por_clave[(pr, f)], "provincia"
        # Último recurso: un nombre único en toda España no es ambiguo, y así
        # se resuelven las provincias mal escritas («Cacabelos, Leo»).
        cand = set()
        for f in fs:
            if not f.startswith("|"):
                cand |= por_forma_nacional.get(f, set())
        if len(cand) == 1:
            return por_id[next(iter(cand))], "nacional"
        return None, None

    return ficha


def clave_de(muni, prov, ficha=None):
    """La clave con la que un municipio es el mismo venga de donde venga.

    Con ficha del REL, su nombre oficial; sin ella, el nombre normalizado con
    las palabras ordenadas, que es lo que hace que «A Coruña» y «Coruña, A»
    coincidan sin recortar nada.
    """
    if ficha:
        return f"{norm_muni(ficha['Municipio'])}|{provincia(ficha['Provincia']) or ficha['Provincia']}"
    palabras = " ".join(sorted(set(norm_muni(muni).split())))
    return f"{palabras}|{provincia(prov) or norm(prov)}"
