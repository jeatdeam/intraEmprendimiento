"""Equipos de la planta y rangos de las mediciones de inspección.

Cada TIPO de equipo tiene sus variables con (mínimo normal, máximo normal, unidad).
Fuera de ese rango la medición se marca como baja o alta.
Para agregar un equipo o cambiar un rango basta con editar este archivo.
"""
import re

from .reglas import fmt, numero

EQUIPOS = [
    {"id": "AG-01", "tipo": "aerogenerador", "nombre": "Aerogenerador AG-01", "ubicacion": "Parque Eólico Norte, posición 1"},
    {"id": "AG-07", "tipo": "aerogenerador", "nombre": "Aerogenerador AG-07", "ubicacion": "Parque Eólico Norte, posición 7"},
    {"id": "INV-03", "tipo": "inversor", "nombre": "Inversor solar INV-03", "ubicacion": "Parque Solar Sur, sector B fila 12"},
    {"id": "INV-05", "tipo": "inversor", "nombre": "Inversor solar INV-05", "ubicacion": "Parque Solar Sur, sector C fila 4"},
    {"id": "TR-01", "tipo": "transformador", "nombre": "Transformador TR-01", "ubicacion": "Subestación principal"},
]

# Variables que se miden en la inspección: id -> (etiqueta, unidad, {tipo: (min, max)})
VARIABLES = {
    "voltaje": ("Voltaje", "V", {"aerogenerador": (655, 725), "inversor": (380, 420), "transformador": (380, 420)}),
    "corriente": ("Corriente", "A", {"aerogenerador": (0, 2600), "inversor": (0, 1800), "transformador": (0, 3000)}),
    "temperatura": ("Temperatura", "°C", {"aerogenerador": (35, 75), "inversor": (20, 60), "transformador": (30, 85)}),
    "vibracion": ("Vibración", "mm/s", {"aerogenerador": (0, 4.5), "inversor": (0, 2.0), "transformador": (0, 3.0)}),
}

TIPOS_FALLA = ["Sin falla", "Fuga de aceite", "Sobretemperatura", "Falla eléctrica / voltaje", "Vibración excesiva",
               "Error de comunicación", "Daño mecánico", "Otra"]
GRAVEDAD = ["Ninguna", "Leve", "Moderada", "Grave", "Crítica"]


def opcion_equipo(e: dict) -> str:
    return f"{e['id']} · {e['nombre'].rsplit(' ', 1)[0]}"


def buscar_equipo(texto: str) -> dict | None:
    m = re.search(r"\b(AG|INV|TR)-\d{2}\b", texto or "", re.I)
    return next((e for e in EQUIPOS if m and e["id"] == m.group(0).upper()), None)


def rango(var: str, tipo: str) -> tuple[float, float]:
    return VARIABLES[var][2][tipo]


def evaluar(datos: dict) -> dict:
    """Evalúa las mediciones de una inspección contra los rangos del tipo de equipo."""
    eq = buscar_equipo(datos.get("equipo", ""))
    medidas = []
    if eq:
        for var, (label, u, rangos) in VARIABLES.items():
            v = numero(re.sub(r"[^\d.,\-]", "", datos.get(var, "")))
            if v is None:
                continue
            mn, mx = rangos[eq["tipo"]]
            est = "bajo" if v < mn else "alto" if v > mx else "ok"
            medidas.append({"var": var, "label": label, "unidad": u, "valor": v, "min": mn, "max": mx, "estado": est})
    falla = datos.get("falla", "Sin falla")
    return {"equipo": eq, "medidas": medidas, "falla": None if falla in ("", "Sin falla") else falla,
            "gravedad": datos.get("gravedad", "Ninguna"), "detalle": datos.get("observaciones", "").strip()}


def evaluacion_texto(ev: dict) -> str:
    """Texto para la IA con cada medición y si está dentro del rango normal."""
    if not ev["equipo"]:
        return ""
    lin = [f"Evaluación automática de las mediciones ({ev['equipo']['nombre']}, tipo {ev['equipo']['tipo']}):"]
    for m in ev["medidas"]:
        txt = {"ok": "normal", "bajo": "BAJO el rango", "alto": "SOBRE el rango"}[m["estado"]]
        lin.append(f"- {m['label']}: {fmt(m['valor'])} {m['unidad']} → {txt} (normal {fmt(m['min'])}–{fmt(m['max'])} {m['unidad']})")
    if ev["falla"]:
        lin.append(f"- Falla detectada: {ev['falla']} · gravedad {ev['gravedad']}")
    return "\n".join(lin)
