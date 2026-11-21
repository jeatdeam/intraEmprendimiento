"""Antes y después de un documento revisado contra un formato oficial.

`comparar` devuelve dos hojas, línea por línea:
  - ANTES: el documento como llegó, con marcas donde hay un error o falta algo.
  - DESPUÉS: el mismo documento ordenado según el formato, con marcas en lo que se agregó o corrigió.

Marcas del antes:   error (la línea está mal) · falta (no está; se muestra dónde debería ir) · aviso (fuera de orden)
Marcas del después: nuevo (se agregó) · corregido (se cambió) · movido (se puso en su lugar) · pendiente (hay que escribirlo)

Lo que el documento no trae (una fecha, una sección entera) se toma de `correccion` cuando se conoce
(los archivos listos para evaluar la traen); si no, queda como [completar] para que lo escriba la persona.
"""
import re

from .formatos import FIRMAS_VACIAS, FORMATOS, _n, revisar_formato

_MD = re.compile(r"^\s*#{1,6}\s+|\*\*")
_PISTA = {"fecha": "Escribe la fecha, por ejemplo 09/11/2026.", "numero": "Escribe el número con su unidad.",
          "texto": "Completa este dato."}


def _limpia(l: str) -> str:
    """La línea sin marcas de Markdown (# al inicio y **)."""
    return re.sub(r"^\s*#{1,6}\s+", "", l).replace("**", "")


def _estructura(lineas: list[str], f: dict) -> dict:
    """Dónde está cada parte del formato (índice de línea), buscando igual que `revisar_formato`."""
    norm = [_n(_limpia(l)) for l in lineas]
    campos, secciones = {}, {}
    for c in f["campos"]:
        pat = re.compile(r"^[•\-\*\s]*(" + "|".join(re.escape(a) for a in c["alias"]) + r")\s*[:：]")
        i = next((i for i, l in enumerate(norm) if pat.match(l)), None)
        if i is not None:
            campos[c["label"]] = i
    for s in f["secciones"]:
        pat = re.compile(r"^(\d+[\.\)]\s*)?(" + "|".join(re.escape(a) for a in s["alias"]) + r")\b\s*:?\s*$")
        i = next((i for i, l in enumerate(norm) if len(l) <= 60 and pat.match(l)), None)
        if i is not None:
            secciones[s["label"]] = i
    return {
        "titulo": next((i for i, l in enumerate(norm[:8]) if _n(f["nombre"]) in l), None),
        "codigo": next((i for i, l in enumerate(norm) if f["codigo"].lower() in l), None),
        "campos": campos, "secciones": secciones,
    }


def _valor(linea: str) -> str:
    return linea.split(":", 1)[1].strip() if ":" in linea else ""


def comparar(texto: str, fid: str, archivo: str, correccion: dict | None = None) -> dict:
    f = FORMATOS[fid]
    cor_campos = (correccion or {}).get("campos", {})
    cor_secciones = (correccion or {}).get("secciones", {})
    lineas = [l.rstrip() for l in texto.replace("\r", "").splitlines()]
    while lineas and not lineas[-1]:
        lineas.pop()
    res = revisar_formato(texto, fid, archivo)
    ok = {(c["grupo"], c["label"]): c for c in res["checks"]}
    e = _estructura(lineas, f)
    inicio_secciones = sorted(e["secciones"].values())
    primera_seccion = inicio_secciones[0] if inicio_secciones else len(lineas)

    # Un título equivocado: la primera línea no es un campo ni el código, pero tampoco dice el nombre del formato.
    primera = next((i for i, l in enumerate(lineas) if l.strip()), None)
    titulo_malo = None
    if e["titulo"] is None and primera is not None and primera < primera_seccion and len(lineas[primera]) <= 70 \
            and primera != e["codigo"] and primera not in e["campos"].values():
        titulo_malo = primera

    # ───────────── ANTES: el documento tal cual, con marcas ─────────────
    antes: list[dict] = [{"t": l} for l in lineas]
    faltan: list[tuple[int, dict]] = []      # (posición donde debería ir, marca)

    def marcar(i: int, m: str, nota: str) -> None:
        if "m" not in antes[i]:
            antes[i].update(m=m, nota=nota)

    def falta(pos: int, que: str) -> None:
        faltan.append((pos, {"t": que, "m": "falta"}))

    debe = f"«{f['nombre'].upper()}»"
    if e["titulo"] is None:
        if titulo_malo is not None:
            marcar(titulo_malo, "error", f"El título debe decir {debe}.")
        else:
            falta(0, f"Falta el título {debe}")
    arriba = e["titulo"] if e["titulo"] is not None else titulo_malo
    if e["codigo"] is None:
        falta(0 if arriba is None else arriba + 1, f"Falta el código del formato: {f['codigo']} (rev. {f['revision']})")

    # Dónde va un campo que falta: después del campo anterior; el primero, justo antes de los campos que sí están
    # (o al final de la cabecera: después del título, el código y la línea de la empresa).
    en_cabecera = [i for i in e["campos"].values() if i < primera_seccion]
    if en_cabecera:
        ancla = min(en_cabecera)
    else:
        ancla = max([i for i in (arriba, e["codigo"]) if i is not None], default=-1) + 1
        while ancla < primera_seccion and lineas[ancla].strip():
            ancla += 1
    for c in f["campos"]:
        chk, i = ok[("Campos", c["label"])], e["campos"].get(c["label"])
        if i is not None and i < primera_seccion:
            ancla = i + 1
        if chk["ok"]:
            continue
        if i is None:
            falta(ancla, f"Falta la línea «{c['label']}: …»")
        else:
            marcar(i, "error", chk["detalle"])

    fin = len(lineas)
    for n, s in enumerate(f["secciones"]):
        chk, i = ok[("Secciones", s["label"])], e["secciones"].get(s["label"])
        if chk["ok"]:
            continue
        if i is None:
            sigue = [e["secciones"][x["label"]] for x in f["secciones"][n + 1:] if x["label"] in e["secciones"]]
            falta(min(sigue) if sigue else fin, f"Falta la sección «{s['label'].upper()}»")
        elif "vacía" in chk["detalle"]:
            marcar(i, "error", "La sección está vacía.")
        else:
            marcar(i, "error", "El título tiene marcas de Markdown (# o **); así no se reconoce como sección.")

    # Secciones fuera del orden oficial.
    movidas, tope = set(), -1
    for s in f["secciones"]:
        i = e["secciones"].get(s["label"])
        if i is None:
            continue
        if i < tope:
            movidas.add(s["label"])
            marcar(i, "aviso", "Está fuera del orden oficial.")
        tope = max(tope, i)
    for i, l in enumerate(lineas):
        if _MD.search(l):
            marcar(i, "error", "Tiene marcas de Markdown (# o **). El formato oficial no las usa.")
    for pos, marca in sorted(faltan, key=lambda x: -x[0]):   # de abajo hacia arriba para no mover los índices
        antes.insert(pos, marca)
    # `sorted` es estable, pero al insertar de abajo hacia arriba las marcas de una misma posición quedan al revés.
    # Se reordenan los tramos seguidos de marcas "falta" para que salgan en el orden del formato.
    orden = {m["t"]: n for n, (_, m) in enumerate(faltan)}
    i = 0
    while i < len(antes):
        j = i
        while j < len(antes) and antes[j].get("m") == "falta":
            j += 1
        if j - i > 1:
            antes[i:j] = sorted(antes[i:j], key=lambda m: orden[m["t"]])
        i = max(j, i + 1)

    # ───────────── DESPUÉS: el documento ordenado según el formato ─────────────
    despues: list[dict] = []

    def poner(t: str, m: str | None = None, nota: str | None = None) -> None:
        linea = {"t": t}
        if m:
            linea["m"] = m
            if nota:
                linea["nota"] = nota
        despues.append(linea)

    def original(i: int) -> None:
        """Una línea que ya estaba bien: se deja igual, sin las marcas de Markdown si las tenía."""
        limpia = _limpia(lineas[i])
        if limpia != lineas[i]:
            poner(limpia, "corregido", "Se quitaron las marcas de Markdown.")
        else:
            poner(limpia)

    def bloque(texto_: str, m: str, nota: str) -> None:
        for n, l in enumerate(texto_.splitlines()):
            poner(l, m, nota if n == 0 else None)

    if e["titulo"] is not None:
        original(e["titulo"])
    else:
        poner(f["nombre"].upper(), "corregido" if titulo_malo is not None else "nuevo",
              f"Antes decía «{lineas[titulo_malo].strip()}»." if titulo_malo is not None else "Se agregó el título del formato.")
    if e["codigo"] is not None:
        original(e["codigo"])
    else:
        poner(f"Código: {f['codigo']} · Revisión: {f['revision']}", "nuevo", "Se agregó el código del formato.")
    usadas = {e["titulo"], e["codigo"], titulo_malo, *e["campos"].values()}
    for i in range(primera_seccion):          # la línea de la empresa y cualquier otra de la cabecera
        if i not in usadas and lineas[i].strip():
            original(i)
    poner("")

    autor = ""
    for c in f["campos"]:
        chk, i = ok[("Campos", c["label"])], e["campos"].get(c["label"])
        if chk["ok"]:
            original(i)
            if c["label"] in ("Operador", "Elaborado por", "Reportado por"):
                autor = _valor(lineas[i])
            continue
        bueno = cor_campos.get(c["label"], "")
        previo = _valor(lineas[i]) if i is not None else ""
        if not bueno:
            pista = (_PISTA.get(c["tipo"]) or "Elige una opción: " + ", ".join(
                o.capitalize() for o in c["opciones"]).replace("Critica", "Crítica") + ".")
            poner(f"{c['label']}: [completar]", "pendiente", pista)
        elif i is None:
            poner(f"{c['label']}: {bueno}", "nuevo", "Faltaba esta línea.")
        else:
            poner(f"{c['label']}: {bueno}", "corregido", f"Antes decía «{previo}»." if previo else "Estaba vacío.")
        if bueno and c["label"] in ("Operador", "Elaborado por", "Reportado por"):
            autor = bueno
    poner("")

    for n, s in enumerate(f["secciones"], 1):
        chk, i = ok[("Secciones", s["label"])], e["secciones"].get(s["label"])
        titulo = f"{n}. {s['label'].upper()}"
        bueno = cor_secciones.get(s["label"]) or (
            FIRMAS_VACIAS.format(autor=autor or "____________________") if s["label"] == "Firmas" else "")
        if i is None:
            poner(titulo, "nuevo", "Sección agregada.")
            if bueno:
                bloque(bueno, "nuevo", "")
            else:
                poner("[completar]", "pendiente", "Escribe el contenido de esta sección.")
            poner("")
            continue
        if s["label"] in movidas:
            poner(titulo, "movido", "Se movió a su lugar en el orden oficial.")
        elif _MD.search(lineas[i]):
            poner(titulo, "corregido", "Se quitaron las marcas de Markdown.")
        else:
            poner(titulo)
        sig = next((x for x in inicio_secciones if x > i), len(lineas))
        cuerpo = list(range(i + 1, sig))
        while cuerpo and not lineas[cuerpo[-1]].strip():
            cuerpo.pop()
        while cuerpo and not lineas[cuerpo[0]].strip():
            cuerpo.pop(0)
        if "vacía" in chk["detalle"] and not chk["ok"]:
            if bueno:
                bloque(bueno, "nuevo", "Se completó la sección, que estaba vacía.")
            else:
                poner("[completar]", "pendiente", "Escribe el contenido de esta sección.")
        else:
            for j in cuerpo:
                original(j) if lineas[j].strip() else poner("")
        poner("")
    while despues and not despues[-1]["t"]:
        despues.pop()

    texto_despues = "\n".join(l["t"] for l in despues) + "\n"
    res2 = revisar_formato(texto_despues, fid, archivo)
    resumen = lambda r: {k: r[k] for k in ("aceptado", "cumple", "total", "checks", "observaciones")}
    return {
        "archivo": archivo, "formato": fid, "nombre": f["nombre"], "codigo": f["codigo"], "revision": f["revision"],
        "antes": {**resumen(res), "lineas": antes},
        "despues": {**resumen(res2), "lineas": despues, "texto": texto_despues},
        "cambios": sum(1 for l in despues if l.get("nota") and l["m"] != "pendiente"),
        "pendientes": sum(1 for l in despues if l.get("m") == "pendiente"),
    }


def detectar_formato(texto: str) -> str:
    """El formato al que más se parece un documento: por su código, por su título o por los puntos que cumple."""
    norm = _n(texto)
    for fid, f in FORMATOS.items():
        if f["codigo"].lower() in norm:
            return fid
    cabecera = _n("\n".join(texto.splitlines()[:8]))
    for fid, f in FORMATOS.items():
        if _n(f["nombre"]) in cabecera:
            return fid
    return max(FORMATOS, key=lambda fid: revisar_formato(texto, fid, "")["cumple"])
