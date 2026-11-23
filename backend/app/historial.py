"""Historial de formularios enviados y archivos revisados (base de datos SQLite local).

Cada envío se guarda en `envios`. Los valores numéricos que salen de él
(generación por equipo, energía por turno, lecturas de potencia, fallas)
se guardan en `puntos`, uno por día y serie, para dibujar la gráfica diaria.
Los datos de práctica se guardan aparte (modo = 'practica') y nunca se mezclan con los reales.
"""
import json
import os
import re
import sqlite3
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta
import tempfile
from pathlib import Path

from .equipos import EQUIPOS, evaluar
from .reglas import RANGOS_FORMULARIO, fmt, numero

# En Vercel solo se puede escribir en /tmp (y se borra al apagarse la función): sirve para la demo.
_POR_DEFECTO = Path(tempfile.gettempdir()) / "historial.db" if os.getenv("VERCEL") else Path(__file__).resolve().parent.parent / "historial.db"
RUTA = Path(os.getenv("HISTORIAL_DB", _POR_DEFECTO))


def _con() -> sqlite3.Connection:
    c = sqlite3.connect(RUTA)
    c.row_factory = sqlite3.Row
    return c


def iniciar():
    with _con() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS envios (
            id INTEGER PRIMARY KEY, creado TEXT, modo TEXT, area TEXT, tarea_id TEXT, tarea TEXT,
            skill_id TEXT, nombre TEXT, origen TEXT);
        CREATE TABLE IF NOT EXISTS puntos (
            id INTEGER PRIMARY KEY, envio_id INTEGER, modo TEXT, fecha TEXT, serie TEXT, unidad TEXT,
            valor REAL, min REAL, max REAL, estado TEXT, detalle TEXT);
        CREATE INDEX IF NOT EXISTS ix_puntos ON puntos (modo, fecha);
        CREATE TABLE IF NOT EXISTS revisiones (
            id TEXT PRIMARY KEY, creado TEXT, modo TEXT, datos TEXT, guardada INTEGER DEFAULT 0);
        """)
        # Columnas agregadas después (historial por usuario): se crean si la base es de una versión anterior.
        nuevas = {"envios": {"usuario": "TEXT DEFAULT ''", "archivo": "TEXT", "resumen": "TEXT DEFAULT ''",
                             "extra": "TEXT", "resultado": "TEXT"},
                  "puntos": {"usuario": "TEXT DEFAULT ''"}}
        for tabla, cols in nuevas.items():
            hay = {f["name"] for f in c.execute(f"PRAGMA table_info({tabla})")}
            for col, tipo in cols.items():
                if col not in hay:
                    c.execute(f"ALTER TABLE {tabla} ADD COLUMN {col} {tipo}")
        c.execute("CREATE INDEX IF NOT EXISTS ix_envios_usuario ON envios (usuario, creado)")


# ───────────── Revisiones de archivo (pendientes hasta que se envían a la IA) ─────────────

def guardar_revision(modo: str, res: dict) -> str:
    rid = uuid.uuid4().hex
    with _con() as c:
        c.execute("DELETE FROM revisiones WHERE guardada = 0 AND creado < ?",
                  ((datetime.now() - timedelta(days=1)).isoformat(),))
        c.execute("INSERT INTO revisiones (id, creado, modo, datos) VALUES (?, ?, ?, ?)",
                  (rid, datetime.now().isoformat(), modo, json.dumps(res, ensure_ascii=False)))
    return rid


def leer_revision(rid: str, modo: str) -> tuple[dict, bool] | None:
    with _con() as c:
        f = c.execute("SELECT datos, guardada FROM revisiones WHERE id = ? AND modo = ?", (rid, modo)).fetchone()
    return (json.loads(f["datos"]), bool(f["guardada"])) if f else None


# ───────────── Registro de envíos ─────────────

def puntos_inspeccion(fecha: str, datos: dict) -> list[tuple]:
    """Una serie por equipo y variable (ej. 'AG-07 · Voltaje') y otra con sus fallas ('AG-07 · Fallas')."""
    ev = evaluar(datos)
    eq = ev["equipo"]
    if not eq:
        return []
    out = []
    for m in ev["medidas"]:
        det = [] if m["estado"] == "ok" else [
            f"{m['label']} {'alto' if m['estado'] == 'alto' else 'bajo'}: {fmt(m['valor'])} {m['unidad']} "
            f"(normal {fmt(m['min'])}–{fmt(m['max'])})"]
        out.append((fecha, f"{eq['id']} · {m['label']}", m["unidad"], m["valor"], m["min"], m["max"], m["estado"], det))
    if ev["falla"]:
        det = f"{ev['falla']} · gravedad {ev['gravedad']}" + (f" — {ev['detalle']}" if ev["detalle"] else "")
        out.append((fecha, f"{eq['id']} · Fallas", "", None, None, None, "falla", [det]))
    return out


SERIE_FORMATO = "Formato de documentos (cumplimiento)"


def resumen_revision(res: dict) -> dict:
    """Lo esencial de la revisión de un archivo subido, para mostrarlo en el historial del usuario."""
    if "checks" in res:      # documento revisado contra un formato oficial
        return {"tipo": "documento", "formato": res["nombre"], "codigo": res["codigo"], "aceptado": res["aceptado"],
                "cumple": res["cumple"], "total": res["total"], "palabras": res.get("palabras", 0)}
    r = res["resumen"]       # archivo de datos (Excel / CSV)
    return {"tipo": "archivo", "filas": res["filas"], "equipos": r["equipos"], "desde": r["desde"], "hasta": r["hasta"],
            "errores": r["errores"], "bajos": r["bajos"], "altos": r["altos"], "fallas": r["fallas"]}


def _resumen(tarea: dict, datos: dict, rev: dict | None) -> str:
    """Una línea que describe el envío en la lista del historial."""
    if rev and rev["tipo"] == "documento":
        return f"Formato {rev['formato']} ({rev['codigo']}) · cumple {rev['cumple']} de {rev['total']} puntos"
    if rev:
        fuera = rev["bajos"] + rev["altos"]
        return (f"{rev['filas']} filas de {rev['equipos']} equipos · {rev['errores']} errores · "
                f"{fuera} fuera de rango · {rev['fallas']} posibles fallas")
    if tarea["id"] == "turno" and datos.get("generacion", "").strip():
        return f"Turno {datos.get('turno', '').lower()} · {datos['generacion'].strip()} MWh generados"
    cortos = [datos[c["id"]].strip() for c in tarea["campos"]
              if c["tipo"] in ("text", "select") and not c.get("medida") and datos.get(c["id"], "").strip()]
    largo = next((datos[c["id"]].strip() for c in tarea["campos"] if c["tipo"] == "area" and datos.get(c["id"], "").strip()), "")
    txt = " · ".join(cortos[:3]) or " · ".join(" ".join(l.split()) for l in largo.splitlines() if l.strip())
    return txt if len(txt) <= 130 else txt[:127].rstrip() + "…"


def registrar(modo: str, area: str, tarea: dict, skill_id: str, nombre: str, origen: str,
              datos: dict, revision: tuple[str, dict, bool] | None = None, *,
              usuario: str = "", texto: str = "", archivo: dict | None = None,
              cuando: datetime | None = None) -> int:
    """Guarda un envío con su resultado y los valores que van a la gráfica.

    `archivo` es el resultado de la revisión del archivo o documento subido (si la tarea lleva uno).
    `cuando` permite fechar el envío en el pasado (solo lo usan los datos de ejemplo).
    """
    cuando = cuando or datetime.now()
    hoy = cuando.date().isoformat()
    puntos: list[tuple] = []
    tid = tarea["id"]
    rev = resumen_revision(archivo) if archivo else None

    if tid == "turno":
        v = numero(re.sub(r"[^\d.,]", "", datos.get("generacion", "")))
        if v is not None:
            mn, mx, u = RANGOS_FORMULARIO["turno"]
            est = "bajo" if v < mn else "alto" if v > mx else "ok"
            det = [] if est == "ok" else [f"Turno {datos.get('turno', '').split(' ')[0]}: {fmt(v)} {u} ({est})"]
            puntos.append((hoy, "Energía por turno (reportes)", u, v, mn, mx, est, det))

    elif tid == "lecturas":
        mn, mx, u = RANGOS_FORMULARIO["lecturas"]
        pares = re.findall(r"^\s*([^\n:]+(?::\d\d)?)\s*:\s*([\d.,]+)\s*$", datos.get("lecturas", ""), re.M)
        vals = [(h.strip(), numero(x)) for h, x in pares if numero(x) is not None]
        if vals:
            prom = sum(v for _, v in vals) / len(vals)
            fuera = [(h, v) for h, v in vals if v < mn or v > mx]
            est = "ok" if not fuera else ("bajo" if any(v < mn for _, v in fuera) else "alto")
            det = [f"{h}: {fmt(v)} {u} ({'bajo' if v < mn else 'alto'})" for h, v in fuera]
            puntos.append((hoy, "Potencia (lecturas)", u, round(prom, 1), mn, mx, est, det))

    elif tid == "inspeccion":
        puntos += puntos_inspeccion(hoy, datos)

    elif tid == "falla":
        equipo = datos.get("equipo", "").strip() or "Equipo sin nombre"
        puntos.append((hoy, "Fallas reportadas", "", None, None, None, "falla",
                       [f"{equipo} · {datos.get('urgencia', '')}".strip(" ·")]))

    elif rev and rev["tipo"] == "documento":
        # Cada documento revisado deja un punto: qué porcentaje del formato oficial cumple (la meta es 100 %).
        pct = round(rev["cumple"] / max(rev["total"], 1) * 100)
        det = [f"{archivo['archivo']}: {'aceptado' if rev['aceptado'] else 'no aceptado'} · "
               f"{rev['cumple']} de {rev['total']} puntos del formato {rev['codigo']}"]
        puntos.append((hoy, SERIE_FORMATO, "%", pct, 100, 100, "ok" if rev["aceptado"] else "bajo", det))

    # Lo que escribió la persona (sin el campo del archivo), para volver a verlo desde el historial.
    campos = [{"label": c["label"], "valor": datos[c["id"]].strip()} for c in tarea["campos"]
              if c["tipo"] not in ("archivo", "documento") and datos.get(c["id"], "").strip()]
    extra = {"campos": campos, "revision": rev}
    if rev and rev["tipo"] == "documento":
        extra["documento"] = archivo.get("texto", "")
    elif rev and archivo.get("tabla"):
        extra["tabla"] = archivo["tabla"]      # las filas del archivo de datos, para poder cargarlo otra vez

    with _con() as c:
        cur = c.execute(
            "INSERT INTO envios (creado, modo, area, tarea_id, tarea, skill_id, nombre, origen, usuario, archivo, "
            "resumen, extra, resultado) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (cuando.isoformat(timespec="seconds"), modo, area, tid, tarea["nombre"], skill_id, nombre, origen, usuario,
             archivo["archivo"] if archivo else None, _resumen(tarea, datos, rev),
             json.dumps(extra, ensure_ascii=False), texto))
        eid = cur.lastrowid
        if revision and not revision[2]:
            rid, res, _ = revision
            for r in res["registros"]:
                # Si esa persona ya subió un archivo con ese equipo y día, el nuevo lo reemplaza (no se duplica).
                c.execute("DELETE FROM puntos WHERE modo = ? AND usuario = ? AND fecha = ? AND serie = ?",
                          (modo, usuario, r["fecha"], f"{r['equipo']} ({r['tipo']})"))
                puntos.append((r["fecha"], f"{r['equipo']} ({r['tipo']})", "MWh", r["valor"], r["min"], r["max"],
                               r["estado"], r["detalle"]))
            if rid:
                c.execute("UPDATE revisiones SET guardada = 1 WHERE id = ?", (rid,))
        if tid == "inspeccion" and puntos:
            # La última inspección del día de ese equipo reemplaza a la anterior (p. ej. al probar otro skill).
            equipo_id = puntos[0][1].split(" · ")[0]
            c.execute("DELETE FROM puntos WHERE modo = ? AND usuario = ? AND fecha = ? AND serie LIKE ?",
                      (modo, usuario, hoy, f"{equipo_id} · %"))
        c.executemany(
            "INSERT INTO puntos (envio_id, modo, fecha, serie, unidad, valor, min, max, estado, detalle, usuario) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            [(eid, modo, f, s, u, v, mn, mx, e, json.dumps(d, ensure_ascii=False), usuario)
             for f, s, u, v, mn, mx, e, d in puntos])
    return eid


# ───────────── Historial de cada usuario ─────────────

def _fila_envio(f: sqlite3.Row) -> dict:
    extra = json.loads(f["extra"] or "{}")
    return {"id": f["id"], "creado": f["creado"], "modo": f["modo"], "area": f["area"], "tarea_id": f["tarea_id"],
            "tarea": f["tarea"], "skill_id": f["skill_id"], "archivo": f["archivo"], "resumen": f["resumen"] or "",
            "origen": f["origen"], "revision": extra.get("revision")}


def contar_envios() -> dict[str, dict]:
    """Cuántas consultas y cuántos archivos subidos tiene cada usuario."""
    with _con() as c:
        filas = c.execute("SELECT usuario, SUM(archivo IS NULL) consultas, SUM(archivo IS NOT NULL) archivos "
                          "FROM envios WHERE usuario != '' GROUP BY usuario").fetchall()
    return {f["usuario"]: {"consultas": f["consultas"], "archivos": f["archivos"]} for f in filas}


def listar_envios(usuario: str, limite: int = 60) -> list[dict]:
    """Envíos de un usuario, del más nuevo al más viejo (consultas y archivos subidos, de práctica y reales)."""
    with _con() as c:
        filas = c.execute("SELECT * FROM envios WHERE usuario = ? ORDER BY creado DESC, id DESC LIMIT ?",
                          (usuario, limite)).fetchall()
    return [_fila_envio(f) for f in filas]


def leer_envio(eid: int, usuario: str) -> dict | None:
    with _con() as c:
        f = c.execute("SELECT * FROM envios WHERE id = ? AND usuario = ?", (eid, usuario)).fetchone()
    if not f:
        return None
    extra = json.loads(f["extra"] or "{}")
    return {**_fila_envio(f), "campos": extra.get("campos", []), "documento": extra.get("documento", ""),
            "tabla": extra.get("tabla"), "texto": f["resultado"] or ""}


# ───────────── Consulta para la gráfica ─────────────

_ORDEN = ["ok", "alto", "bajo", "error", "falla"]


def consultar(modo: str, dias: int, usuario: str | None = None) -> dict:
    """Valores diarios para la gráfica. Con `usuario`, solo lo que envió esa persona; sin él, toda la planta."""
    desde = (date.today() - timedelta(days=dias - 1)).isoformat()
    de, args = ("AND usuario = ?", (modo, desde, usuario)) if usuario else ("", (modo, desde))
    with _con() as c:
        filas = c.execute(f"SELECT * FROM puntos WHERE modo = ? AND fecha >= ? {de} ORDER BY fecha, id", args).fetchall()
        envios = c.execute(
            f"SELECT tarea, COUNT(*) n, MAX(creado) ultimo FROM envios WHERE modo = ? AND substr(creado,1,10) >= ? {de} "
            "GROUP BY tarea ORDER BY n DESC", args).fetchall()
        total = c.execute(f"SELECT COUNT(*) FROM envios WHERE modo = ? AND substr(creado,1,10) >= ? {de}",
                          args).fetchone()[0]

    # Agrupar por serie y día: el valor diario es el promedio de lo registrado ese día;
    # el estado del día es el peor estado registrado.
    grupos: dict[str, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    meta: dict[str, dict] = {}
    for f in filas:
        grupos[f["serie"]][f["fecha"]].append(f)
        meta.setdefault(f["serie"], {"unidad": f["unidad"], "min": f["min"], "max": f["max"]})

    series, alertas = [], []
    for nombre, por_dia in grupos.items():
        puntos = []
        for dia in sorted(por_dia):
            fs = por_dia[dia]
            vals = [x["valor"] for x in fs if x["valor"] is not None]
            estado = max((x["estado"] for x in fs), key=_ORDEN.index)
            detalle = [d for x in fs for d in json.loads(x["detalle"] or "[]")]
            puntos.append({"fecha": dia, "valor": round(sum(vals) / len(vals), 2) if vals else None,
                           "registros": len(fs), "estado": estado, "detalle": detalle})
            if estado != "ok":
                alertas.append({"fecha": dia, "serie": nombre, "estado": estado, "detalle": detalle})
        m = meta[nombre]
        series.append({"id": nombre, "nombre": nombre, "unidad": m["unidad"], "min": m["min"], "max": m["max"],
                       "dias": puntos, "alertas": sum(1 for p in puntos if p["estado"] != "ok")})

    series.sort(key=lambda s: (s["nombre"] == "Fallas reportadas", s["nombre"]))
    alertas.sort(key=lambda a: (a["fecha"], a["serie"]), reverse=True)
    return {"desde": desde, "hasta": date.today().isoformat(), "series": series, "alertas": alertas,
            "envios": {"total": total, "por_tarea": [dict(e) for e in envios]}}


def consultar_equipo(modo: str, equipo_id: str, dias: int = 7) -> dict | None:
    """Mediciones diarias y fallas de un equipo en los últimos días (para el panel al costado del formulario)."""
    eq = next((e for e in EQUIPOS if e["id"] == equipo_id), None)
    if not eq:
        return None
    hasta = date.today()
    fechas = [(hasta - timedelta(days=i)).isoformat() for i in range(dias - 1, -1, -1)]
    with _con() as c:
        filas = c.execute(
            "SELECT * FROM puntos WHERE modo = ? AND fecha >= ? AND (serie LIKE ? OR serie LIKE ? OR serie = 'Fallas reportadas') "
            "ORDER BY fecha, id", (modo, fechas[0], f"{equipo_id} · %", f"{equipo_id} (%")).fetchall()

    variables: dict[str, dict] = {}
    eventos: dict[str, list] = defaultdict(list)
    for f in filas:
        detalle = json.loads(f["detalle"] or "[]")
        if f["serie"] == "Fallas reportadas":
            detalle = [d for d in detalle if equipo_id.lower() in d.lower()]
            if not detalle:
                continue
        nombre = f["serie"].split(" · ", 1)[1] if " · " in f["serie"] else "Generación"
        if f["valor"] is None:            # fallas (sin valor numérico)
            eventos[f["fecha"]] += [{"estado": f["estado"], "detalle": d} for d in detalle]
            continue
        v = variables.setdefault(nombre, {"id": nombre, "nombre": nombre, "unidad": f["unidad"],
                                          "min": f["min"], "max": f["max"], "dias": {}})
        prev = v["dias"].get(f["fecha"])
        # si hay varias mediciones el mismo día, queda la peor
        if not prev or _ORDEN.index(f["estado"]) >= _ORDEN.index(prev["estado"]):
            v["dias"][f["fecha"]] = {"valor": f["valor"], "estado": f["estado"], "detalle": detalle}
        if f["estado"] != "ok":
            eventos[f["fecha"]] += [{"estado": f["estado"], "detalle": d} for d in detalle]

    orden = ["Voltaje", "Corriente", "Temperatura", "Vibración", "Generación"]
    lista = sorted(variables.values(), key=lambda v: orden.index(v["nombre"]) if v["nombre"] in orden else 99)
    # sin repetidos (mismo estado y detalle el mismo día)
    eventos = {k: [dict(t) for t in dict.fromkeys(tuple(sorted(x.items())) for x in v)] for k, v in eventos.items()}
    return {"equipo": eq, "fechas": fechas, "variables": lista,
            "eventos": eventos,
            "dias_mal": sorted(eventos.keys())}


# ───────────── Base de datos de inspecciones ─────────────

_VARS_INSP = ("Voltaje", "Corriente", "Temperatura", "Vibración")


def listar_inspecciones(modo: str, equipo: str = "", limite: int = 300) -> list[dict]:
    """Una fila por inspección guardada: equipo, inspector, mediciones con su estado y la falla encontrada.

    Sale de las tablas `envios` (quién y cuándo) y `puntos` (las mediciones de cada envío).
    Si una inspección fue reemplazada por otra del mismo día (mismo equipo y persona), ya no tiene mediciones y no se lista.
    """
    filtro, args = ("AND p.serie LIKE ?", [f"{equipo.upper()} · %"]) if equipo else ("", [])
    with _con() as c:
        filas = c.execute(
            "SELECT e.id, e.creado, e.nombre, e.usuario, e.skill_id, e.origen, p.serie, p.unidad, p.valor, p.min, p.max, "
            "p.estado, p.detalle FROM envios e JOIN puntos p ON p.envio_id = e.id "
            f"WHERE e.modo = ? AND e.tarea_id = 'inspeccion' AND p.serie LIKE '% · %' {filtro} "
            "ORDER BY e.creado DESC, e.id DESC, p.id", [modo, *args]).fetchall()

    equipos = {e["id"]: e for e in EQUIPOS}
    out: dict[int, dict] = {}
    for f in filas:
        eq_id, var = f["serie"].split(" · ", 1)
        if eq_id not in equipos:
            continue
        r = out.get(f["id"])
        if r is None:
            if len(out) >= limite:
                break
            eq = equipos[eq_id]
            r = out[f["id"]] = {
                "id": f["id"], "creado": f["creado"], "inspector": (f["nombre"] or "").replace(" (Datos de ejemplo)", ""),
                "usuario": f["usuario"] or "", "skill_id": f["skill_id"], "ejemplo": f["origen"] == "semilla",
                "equipo": {"id": eq["id"], "nombre": eq["nombre"], "tipo": eq["tipo"], "ubicacion": eq["ubicacion"]},
                "medidas": {}, "falla": None, "gravedad": "Ninguna", "detalle": "", "estado": "ok"}
        if var == "Fallas":
            txt = (json.loads(f["detalle"] or "[]") or [""])[0]
            m = re.match(r"(.+?) · gravedad (\w+)(?: — (.*))?$", txt, re.S)
            if m:
                r["falla"], r["gravedad"], r["detalle"] = m.group(1), m.group(2), (m.group(3) or "")
            else:
                r["falla"] = txt
        elif var in _VARS_INSP:
            r["medidas"][var] = {"valor": f["valor"], "unidad": f["unidad"], "min": f["min"], "max": f["max"],
                                 "estado": f["estado"]}

    for r in out.values():
        fuera = any(m["estado"] != "ok" for m in r["medidas"].values())
        grave = r["gravedad"] in ("Grave", "Crítica")
        r["estado"] = "critico" if grave else "falla" if r["falla"] else "alerta" if fuera else "ok"
    return list(out.values())


# ───────────── Reportes anteriores de una tarea (panel al costado del formulario) ─────────────

def reportes_tarea(modo: str, area: str, tarea_id: str, equipo: str = "", dias: int = 7) -> dict:
    """Los envíos de esa tarea en los últimos `dias` días (de toda la planta) y sus valores para la gráfica.

    Con `equipo` (inspección), solo los de ese equipo. Si la tarea no mide nada, la gráfica es la cantidad
    de reportes por día.
    """
    hoy = date.today()
    fechas = [(hoy - timedelta(days=i)).isoformat() for i in range(dias - 1, -1, -1)]
    with _con() as c:
        envios = c.execute(
            "SELECT * FROM envios WHERE modo = ? AND area = ? AND tarea_id = ? AND substr(creado, 1, 10) >= ? "
            "ORDER BY creado DESC, id DESC", (modo, area, tarea_id, fechas[0])).fetchall()
        ids = [e["id"] for e in envios]
        puntos = c.execute(
            f"SELECT * FROM puntos WHERE envio_id IN ({','.join('?' * len(ids))}) ORDER BY fecha, id", ids).fetchall() if ids else []

    eq = equipo.upper()
    por_envio: dict[int, list] = defaultdict(list)
    for p in puntos:
        if eq and not (p["serie"].startswith(f"{eq} · ") or p["serie"].startswith(f"{eq} (")):
            continue
        por_envio[p["envio_id"]].append(p)

    lista, conteo = [], defaultdict(int)
    for e in envios:
        ps = por_envio.get(e["id"], [])
        if eq and not ps:
            continue
        extra = json.loads(e["extra"] or "{}")
        rev = extra.get("revision")
        if rev and rev.get("tipo") == "documento":
            estado = "ok" if rev["aceptado"] else "falla"
        else:
            estado = max((p["estado"] for p in ps), key=_ORDEN.index, default="ok")
        dia = e["creado"][:10]
        conteo[dia] += 1
        lista.append({
            "id": e["id"], "creado": e["creado"], "dia": dia, "nombre": (e["nombre"] or "").replace(" (Datos de ejemplo)", ""),
            "skill_id": e["skill_id"], "archivo": e["archivo"], "resumen": e["resumen"] or "", "estado": estado,
            "ejemplo": e["origen"] == "semilla", "campos": extra.get("campos", [])[:6]})

    # Una serie por variable medida (sin el prefijo del equipo); el valor del día es el peor registrado.
    series: dict[str, dict] = {}
    ids_ok = {x["id"] for x in lista}
    for p in puntos:
        if p["envio_id"] not in ids_ok or p["valor"] is None:
            continue
        if eq and not (p["serie"].startswith(f"{eq} · ") or p["serie"].startswith(f"{eq} (")):
            continue
        nombre = p["serie"].split(" · ", 1)[1] if " · " in p["serie"] else p["serie"]
        if eq and " · " not in p["serie"]:
            nombre = "Generación"
        s = series.setdefault(nombre, {"id": nombre, "nombre": nombre, "unidad": p["unidad"], "min": p["min"],
                                       "max": p["max"], "dias": {}})
        prev = s["dias"].get(p["fecha"])
        if not prev or _ORDEN.index(p["estado"]) >= _ORDEN.index(prev["estado"]):
            s["dias"][p["fecha"]] = {"valor": p["valor"], "estado": p["estado"]}

    orden = ["Voltaje", "Corriente", "Temperatura", "Vibración", "Generación"]
    malos = sorted({x["dia"] for x in lista if x["estado"] != "ok"})
    return {"fechas": fechas, "envios": lista, "conteo": dict(conteo), "dias_mal": malos,
            "series": sorted(series.values(), key=lambda v: orden.index(v["nombre"]) if v["nombre"] in orden else 50)}
