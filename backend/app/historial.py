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
from pathlib import Path

from .equipos import EQUIPOS, evaluar
from .reglas import RANGOS_FORMULARIO, fmt, numero

RUTA = Path(os.getenv("HISTORIAL_DB", Path(__file__).resolve().parent.parent / "historial.db"))


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


def registrar(modo: str, area: str, tarea: dict, skill_id: str, nombre: str, origen: str,
              datos: dict, revision: tuple[str, dict, bool] | None = None) -> None:
    hoy = date.today().isoformat()
    puntos: list[tuple] = []
    tid = tarea["id"]

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
            puntos.append((hoy, "Potencia (lecturas)", u, prom, mn, mx, est, det))

    elif tid == "inspeccion":
        puntos += puntos_inspeccion(hoy, datos)

    elif tid == "falla":
        equipo = datos.get("equipo", "").strip() or "Equipo sin nombre"
        puntos.append((hoy, "Fallas reportadas", "", None, None, None, "falla",
                       [f"{equipo} · {datos.get('urgencia', '')}".strip(" ·")]))

    with _con() as c:
        cur = c.execute(
            "INSERT INTO envios (creado, modo, area, tarea_id, tarea, skill_id, nombre, origen) VALUES (?,?,?,?,?,?,?,?)",
            (datetime.now().isoformat(timespec="seconds"), modo, area, tid, tarea["nombre"], skill_id, nombre, origen))
        eid = cur.lastrowid
        if revision and not revision[2]:
            rid, res, _ = revision
            for r in res["registros"]:
                # Si ya se subió un archivo con ese equipo y día, el nuevo lo reemplaza (no se duplica).
                c.execute("DELETE FROM puntos WHERE modo = ? AND fecha = ? AND serie = ?",
                          (modo, r["fecha"], f"{r['equipo']} ({r['tipo']})"))
                puntos.append((r["fecha"], f"{r['equipo']} ({r['tipo']})", "MWh", r["valor"], r["min"], r["max"],
                               r["estado"], r["detalle"]))
            c.execute("UPDATE revisiones SET guardada = 1 WHERE id = ?", (rid,))
        if tid == "inspeccion" and puntos:
            # La última inspección del día de ese equipo reemplaza a la anterior (p. ej. al probar otro skill).
            equipo_id = puntos[0][1].split(" · ")[0]
            c.execute("DELETE FROM puntos WHERE modo = ? AND fecha = ? AND serie LIKE ?", (modo, hoy, f"{equipo_id} · %"))
        c.executemany(
            "INSERT INTO puntos (envio_id, modo, fecha, serie, unidad, valor, min, max, estado, detalle) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            [(eid, modo, f, s, u, v, mn, mx, e, json.dumps(d, ensure_ascii=False)) for f, s, u, v, mn, mx, e, d in puntos])


# ───────────── Consulta para la gráfica ─────────────

_ORDEN = ["ok", "alto", "bajo", "error", "falla"]


def consultar(modo: str, dias: int) -> dict:
    desde = (date.today() - timedelta(days=dias - 1)).isoformat()
    with _con() as c:
        filas = c.execute("SELECT * FROM puntos WHERE modo = ? AND fecha >= ? ORDER BY fecha, id",
                          (modo, desde)).fetchall()
        envios = c.execute(
            "SELECT tarea, COUNT(*) n, MAX(creado) ultimo FROM envios WHERE modo = ? AND substr(creado,1,10) >= ? "
            "GROUP BY tarea ORDER BY n DESC", (modo, desde)).fetchall()
        total = c.execute("SELECT COUNT(*) FROM envios WHERE modo = ? AND substr(creado,1,10) >= ?",
                          (modo, desde)).fetchone()[0]

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
