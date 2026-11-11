"""Reglas para revisar archivos de datos (Excel / CSV) y los valores de los formularios.

Aquí se define:
  - PLANTILLA: qué columnas debe tener el archivo de producción diaria.
  - RANGOS: el rango NORMAL y el LÍMITE FÍSICO de cada valor, según el tipo de equipo.
      * Fuera del rango normal  -> alerta (valor "bajo" o "alto").
      * Fuera del límite físico -> error (el dato está mal escrito o es imposible).
  - RANGOS_FORMULARIO: rangos de los valores que se escriben a mano en los formularios.

Para cambiar un rango basta con editar los números de este archivo.
"""
import csv
import io
import random
import re
import unicodedata
from datetime import date, datetime, timedelta

# ───────────────────────── Configuración editable ─────────────────────────

PLANTILLA = {
    "nombre": "Producción diaria por equipo",
    "columnas": [
        {"id": "fecha", "label": "Fecha", "tipo": "fecha", "ejemplo": "2026-11-01"},
        {"id": "equipo", "label": "Equipo", "tipo": "texto", "ejemplo": "AG-07"},
        {"id": "tipo", "label": "Tipo de equipo", "tipo": "opcion", "opciones": ["aerogenerador", "inversor"],
         "ejemplo": "aerogenerador"},
        {"id": "generacion_mwh", "label": "Generación (MWh)", "tipo": "numero", "unidad": "MWh", "ejemplo": "38,5"},
        {"id": "disponibilidad_pct", "label": "Disponibilidad (%)", "tipo": "numero", "unidad": "%", "ejemplo": "98"},
        {"id": "temperatura_c", "label": "Temperatura (°C)", "tipo": "numero", "unidad": "°C", "ejemplo": "45"},
        {"id": "estado", "label": "Estado", "tipo": "opcion",
         "opciones": ["operativo", "detenido", "falla", "mantenimiento"], "ejemplo": "operativo"},
    ],
}

# (min_normal, max_normal, min_limite, max_limite) por tipo de equipo y columna numérica.
RANGOS: dict[str, dict[str, tuple[float, float, float, float]]] = {
    "aerogenerador": {
        "generacion_mwh": (10, 60, 0, 80),
        "disponibilidad_pct": (90, 100, 0, 100),
        "temperatura_c": (-10, 75, -40, 120),
    },
    "inversor": {
        "generacion_mwh": (4, 20, 0, 30),
        "disponibilidad_pct": (95, 100, 0, 100),
        "temperatura_c": (-5, 60, -30, 100),
    },
}

# Estados que significan que la máquina falló.
ESTADOS_FALLA = {"falla", "detenido"}

# Rangos de los formularios escritos a mano: (min_normal, max_normal, unidad).
RANGOS_FORMULARIO = {
    "turno": (250, 600, "MWh"),     # energía generada en un turno de 8 horas
    "lecturas": (30, 60, "MW"),     # cada lectura de potencia
}

MAX_FILAS = 5000

# ───────────────────────── Utilidades ─────────────────────────


def _norm(txt: str) -> str:
    """'Generación (MWh)' -> 'generacion_mwh'."""
    t = unicodedata.normalize("NFKD", str(txt)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "_", t).strip("_")


_ALIAS = {_norm(c["label"]): c["id"] for c in PLANTILLA["columnas"]}
_ALIAS.update({c["id"]: c["id"] for c in PLANTILLA["columnas"]})
_ALIAS.update({"generacion": "generacion_mwh", "disponibilidad": "disponibilidad_pct",
               "temperatura": "temperatura_c", "dia": "fecha", "maquina": "equipo"})


def numero(v) -> float | None:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(" ", "")
    if not s:
        return None
    if "," in s and "." in s:          # 1.234,5 -> 1234.5
        s = s.replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def fecha(v) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = str(v or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def fmt(n: float) -> str:
    s = f"{n:,.1f}".rstrip("0").rstrip(".")
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


# ───────────────────────── Lectura del archivo ─────────────────────────


def _leer_filas(contenido: bytes, nombre: str) -> list[list]:
    if nombre.lower().endswith((".xlsx", ".xlsm")):
        try:
            from openpyxl import load_workbook
        except ImportError as e:  # pragma: no cover
            raise ValueError("El servidor no puede leer Excel (falta instalar openpyxl).") from e
        try:
            libro = load_workbook(io.BytesIO(contenido), read_only=True, data_only=True)
        except Exception as e:
            raise ValueError("No se pudo abrir el Excel. ¿Está dañado o protegido con contraseña?") from e
        hoja = libro.worksheets[0]
        filas = [list(f) for f in hoja.iter_rows(values_only=True)]
        libro.close()
        return filas
    if nombre.lower().endswith((".csv", ".txt")):
        try:
            texto = contenido.decode("utf-8-sig")
        except UnicodeDecodeError:
            texto = contenido.decode("latin-1")
        try:
            dialecto = csv.Sniffer().sniff(texto[:4000], delimiters=";,\t")
        except csv.Error:
            dialecto = csv.excel
        return [f for f in csv.reader(io.StringIO(texto), dialecto)]
    raise ValueError("Formato no admitido. Sube un archivo Excel (.xlsx) o CSV (.csv).")


def validar_archivo(contenido: bytes, nombre: str) -> dict:
    """Revisa estructura y rangos. Devuelve un resumen con todos los problemas encontrados."""
    filas = [f for f in _leer_filas(contenido, nombre) if any(str(c or "").strip() for c in f)]
    estructura: list[str] = []
    problemas: list[dict] = []
    registros: list[dict] = []

    if not filas:
        raise ValueError("El archivo está vacío.")

    cabecera = [_ALIAS.get(_norm(c or "")) for c in filas[0]]
    faltan = [c["label"] for c in PLANTILLA["columnas"] if c["id"] not in cabecera]
    sobran = [str(filas[0][i]) for i, c in enumerate(cabecera) if c is None and str(filas[0][i] or "").strip()]
    for col in faltan:
        estructura.append(f"Falta la columna «{col}».")
    if sobran:
        estructura.append("Columnas que no se reconocen (se ignoran): " + ", ".join(f"«{s}»" for s in sobran) + ".")
    if len(filas) - 1 > MAX_FILAS:
        estructura.append(f"El archivo tiene más de {MAX_FILAS} filas; solo se revisan las primeras {MAX_FILAS}.")

    pos = {cid: i for i, cid in enumerate(cabecera) if cid}
    if {"fecha", "equipo"} - pos.keys():
        return _resumen(nombre, 0, estructura, problemas, registros, bloqueado=True)

    vistos: set[tuple] = set()
    cols = {c["id"]: c for c in PLANTILLA["columnas"]}
    for n, fila in enumerate(filas[1:MAX_FILAS + 1], start=2):
        val = {cid: (fila[i] if i < len(fila) else None) for cid, i in pos.items()}

        def prob(col, tipo, msg, valor=None):
            problemas.append({"fila": n, "columna": cols[col]["label"] if col in cols else col,
                              "valor": "" if valor is None else str(valor), "tipo": tipo, "mensaje": msg})

        f = fecha(val.get("fecha"))
        if not f:
            prob("fecha", "error", "Fecha vacía o mal escrita (usa AAAA-MM-DD o DD/MM/AAAA).", val.get("fecha"))
            continue
        if f > date.today():
            prob("fecha", "error", "La fecha está en el futuro.", f.isoformat())
        equipo = str(val.get("equipo") or "").strip()
        if not equipo:
            prob("equipo", "error", "Falta el nombre del equipo.")
            continue
        if (f, equipo.lower()) in vistos:
            prob("equipo", "error", f"Fila repetida: {equipo} ya tiene datos del {f.isoformat()}.", equipo)
            continue
        vistos.add((f, equipo.lower()))

        tipo = _norm(val.get("tipo") or "")
        if tipo not in RANGOS:
            tipo = "aerogenerador" if re.match(r"^(ag|wtg|aero)", equipo, re.I) else (
                "inversor" if re.match(r"^(inv|pv)", equipo, re.I) else "")
            if "tipo" in pos:
                prob("tipo", "error", "Tipo de equipo no reconocido (usa aerogenerador o inversor).", val.get("tipo"))
            if not tipo:
                continue

        estado = _norm(val.get("estado") or "")
        if "estado" in pos and estado not in cols["estado"]["opciones"]:
            prob("estado", "error", "Estado no reconocido (operativo, detenido, falla o mantenimiento).", val.get("estado"))
            estado = ""

        reg = {"fecha": f.isoformat(), "equipo": equipo, "tipo": tipo, "valor": None,
               "min": RANGOS[tipo]["generacion_mwh"][0], "max": RANGOS[tipo]["generacion_mwh"][1],
               "estado": "ok", "detalle": []}
        for col, (mn, mx, lmn, lmx) in RANGOS[tipo].items():
            if col not in pos:
                continue
            bruto = val.get(col)
            v = numero(bruto)
            u = cols[col]["unidad"]
            if v is None:
                prob(col, "error", "Valor vacío o no es un número.", bruto)
                reg["detalle"].append(f"{cols[col]['label']} inválido")
                reg["estado"] = _peor(reg["estado"], "error")
                continue
            if col == "generacion_mwh":
                reg["valor"] = v
            if v < lmn or v > lmx:
                prob(col, "error", f"Valor imposible: debe estar entre {fmt(lmn)} y {fmt(lmx)} {u}.", fmt(v))
                reg["detalle"].append(f"{cols[col]['label']} imposible ({fmt(v)} {u})")
                reg["estado"] = _peor(reg["estado"], "error")
            elif v < mn and not (estado == "mantenimiento" and col != "temperatura_c"):
                prob(col, "bajo", f"Por debajo de lo normal ({fmt(mn)}–{fmt(mx)} {u}).", fmt(v))
                reg["detalle"].append(f"{cols[col]['label']} bajo ({fmt(v)} {u})")
                reg["estado"] = _peor(reg["estado"], "bajo")
            elif v > mx:
                prob(col, "alto", f"Por encima de lo normal ({fmt(mn)}–{fmt(mx)} {u}).", fmt(v))
                reg["detalle"].append(f"{cols[col]['label']} alto ({fmt(v)} {u})")
                reg["estado"] = _peor(reg["estado"], "alto")

        if estado in ESTADOS_FALLA or (reg["valor"] == 0 and estado != "mantenimiento"):
            motivo = f"estado «{estado}»" if estado in ESTADOS_FALLA else "generación en cero sin mantenimiento"
            prob("estado", "falla", f"Posible falla de la máquina: {motivo}.", estado or "0")
            reg["detalle"].insert(0, f"Falla de máquina ({motivo})")
            reg["estado"] = "falla"
        registros.append(reg)

    return _resumen(nombre, len(filas) - 1, estructura, problemas, registros)


_ORDEN = ["ok", "alto", "bajo", "error", "falla"]


def _peor(a: str, b: str) -> str:
    return a if _ORDEN.index(a) >= _ORDEN.index(b) else b


def _resumen(nombre, n, estructura, problemas, registros, bloqueado=False) -> dict:
    cuenta = lambda t: sum(1 for p in problemas if p["tipo"] == t)
    fechas = sorted({r["fecha"] for r in registros})
    return {
        "archivo": nombre, "plantilla": PLANTILLA["nombre"], "filas": n, "bloqueado": bloqueado,
        "estructura": estructura, "problemas": problemas, "registros": registros,
        "resumen": {"errores": cuenta("error") + sum(1 for e in estructura if e.startswith("Falta")),
                    "bajos": cuenta("bajo"), "altos": cuenta("alto"), "fallas": cuenta("falla"),
                    "validas": sum(1 for r in registros if r["estado"] == "ok"),
                    "desde": fechas[0] if fechas else None, "hasta": fechas[-1] if fechas else None,
                    "equipos": len({r["equipo"] for r in registros})},
    }


# ───────────────────────── Texto para la IA / simulador ─────────────────────────


def reporte_texto(res: dict, limite: int = 60) -> str:
    """Reporte de la revisión en texto plano, para que la IA lo explique con el skill elegido."""
    r = res["resumen"]
    lin = [f"Archivo: {res['archivo']} (plantilla: {res['plantilla']})",
           f"Filas de datos: {res['filas']} · Equipos: {r['equipos']} · Periodo: {r['desde'] or '-'} a {r['hasta'] or '-'}",
           f"Filas sin problemas: {r['validas']}",
           f"Errores de datos: {r['errores']} · Valores bajos: {r['bajos']} · Valores altos: {r['altos']} · "
           f"Posibles fallas de máquina: {r['fallas']}"]
    if res["estructura"]:
        lin.append("\nProblemas de estructura:")
        lin += [f"- {e}" for e in res["estructura"]]
    lin.append("\nRangos normales usados (mín–máx):")
    for tipo, cols in RANGOS.items():
        lin.append(f"- {tipo}: " + "; ".join(
            f"{c} {fmt(v[0])}–{fmt(v[1])}" for c, v in cols.items()))
    if res["problemas"]:
        lin.append("\nDetalle de problemas (fila · columna · valor · motivo):")
        for p in res["problemas"][:limite]:
            lin.append(f"- [{p['tipo'].upper()}] fila {p['fila']} · {p['columna']} · {p['valor'] or '(vacío)'} · {p['mensaje']}")
        if len(res["problemas"]) > limite:
            lin.append(f"- ... y {len(res['problemas']) - limite} problemas más.")
    else:
        lin.append("\nNo se encontraron problemas.")
    return "\n".join(lin)


# ───────────────────────── Archivo de ejemplo (práctica) ─────────────────────────


def archivo_ejemplo() -> bytes:
    """CSV ficticio de 14 días con algunos errores, valores fuera de rango y fallas a propósito."""
    rnd = random.Random(7)
    hoy = date.today()
    equipos = [("AG-01", "aerogenerador"), ("AG-07", "aerogenerador"), ("INV-03", "inversor"), ("INV-05", "inversor")]
    out = io.StringIO()
    w = csv.writer(out, delimiter=";")
    w.writerow([c["label"] for c in PLANTILLA["columnas"]])
    for d in range(14, 0, -1):
        f = hoy - timedelta(days=d)
        for eq, tipo in equipos:
            gen = rnd.uniform(28, 52) if tipo == "aerogenerador" else rnd.uniform(9, 17)
            disp, temp, est = rnd.uniform(96, 100), rnd.uniform(30, 55), "operativo"
            if eq == "AG-07" and d == 9:
                gen, disp, est = 6.2, 41, "falla"
            if eq == "AG-07" and d == 8:
                gen, disp, est = 0, 0, "detenido"
            if eq == "INV-03" and d in (5, 4):
                temp = 68 + d
            if eq == "AG-01" and d == 3:
                gen = 64.3
            if eq == "INV-05" and d == 6:
                gen = 2.1
            fila = [f.isoformat(), eq, tipo, fmt(gen), fmt(disp), fmt(temp), est]
            if eq == "INV-05" and d == 2:
                fila[5] = "4O"          # letra O en vez de cero
            if eq == "AG-01" and d == 11:
                fila[4] = "130"         # disponibilidad imposible
            w.writerow(fila)
    return out.getvalue().encode("utf-8-sig")


def plantilla_csv() -> bytes:
    out = io.StringIO()
    w = csv.writer(out, delimiter=";")
    w.writerow([c["label"] for c in PLANTILLA["columnas"]])
    w.writerow([c["ejemplo"] for c in PLANTILLA["columnas"]])
    return out.getvalue().encode("utf-8-sig")
