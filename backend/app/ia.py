"""Conexión con la IA (Claude, de Anthropic).

Arma el prompt a partir del skill elegido + los datos de la tarea y llama
a la API. La clave se lee de la variable de entorno ANTHROPIC_API_KEY.
"""
import os

import anthropic

from .catalogo import SKILLS
from .equipos import evaluacion_texto, evaluar
from .formatos import FORMATO_DE_TAREA, descripcion

MODELO = os.getenv("IA_MODELO", "claude-opus-5-5")
ESFUERZO = os.getenv("IA_ESFUERZO", "low")  # low = respuestas rápidas para tareas simples

_client: anthropic.AsyncAnthropic | None = None


def ia_configurada() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def _cliente() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic()
    return _client


def _system(area: str, skill_id: str, planta: str, tarea_id: str = "") -> str:
    area_txt = "operación y mantenimiento en PLANTA" if area == "planta" else "trabajo administrativo en OFICINA"
    formato = ""
    if skill_id == "formal" and tarea_id in FORMATO_DE_TAREA:
        formato = ("\n\nEste documento DEBE seguir el formato oficial de la empresa: "
                   f"{descripcion(FORMATO_DE_TAREA[tarea_id])} Después del título pon la línea "
                   "'Código: … · Revisión: …'. En la sección FIRMAS usa las líneas 'Elaborado por:', "
                   "'Revisado por:' y 'Aprobado por:'.")
    return (
        f"Eres el asistente de IA de {planta}, una central de generación de energía renovable "
        f"(solar y eólica). Ayudas a empleados de {area_txt}; muchos no tienen experiencia con IA "
        "y algunos son personas mayores.\n\n"
        "Reglas generales:\n"
        "- Responde siempre en español, con lenguaje claro y respetuoso.\n"
        "- Entrega SOLO el resultado final, listo para usar, en texto plano (sin Markdown: nada de #, ** ni tablas con |).\n"
        "- Presentación (la plataforma la convierte en un documento de empresa): la primera línea es el TÍTULO en "
        "mayúsculas; los datos van en líneas 'Campo: valor'; las secciones son líneas '1. TÍTULO EN MAYÚSCULAS'; "
        "las listas usan viñetas '• ' o casillas '☐ '; para una tabla escribe cada fila en una línea que empiece con "
        "dos espacios y separa las columnas con dos o más espacios.\n"
        "- No inventes datos. Si falta información importante, márcala como [completar].\n"
        "- En temas de seguridad, recuerda que el procedimiento oficial de la planta y el supervisor "
        "tienen la última palabra.\n\n"
        f"Skill a aplicar — {SKILLS[skill_id]['nombre']}:\n{SKILLS[skill_id]['prompt']}{formato}"
    )


async def generar(area: str, tarea: dict, skill_id: str, datos: dict, nombre: str, planta: str) -> str:
    lineas = [f"- {c['label']}: {datos.get(c['id'], '').strip() or '(vacío)'}" for c in tarea["campos"]]
    usuario = (
        f"Tarea: {tarea['nombre']}\n"
        f"Empleado: {nombre or '[sin nombre]'}\n\n"
        "Datos que escribió el empleado:\n" + "\n".join(lineas)
    )
    if tarea["id"] == "inspeccion":
        evaluacion = evaluacion_texto(evaluar(datos))
        if evaluacion:
            usuario += "\n\n" + evaluacion + "\nIncluye las mediciones y la falla en el resultado, marcando lo que esté fuera de rango."

    response = await _cliente().beta.messages.create(
        model=MODELO,
        max_tokens=16000,
        system=_system(area, skill_id, planta, tarea["id"]),
        messages=[{"role": "user", "content": usuario}],
        output_config={"effort": ESFUERZO},
        # Si el modelo rechaza la petición, la API reintenta automáticamente con otro modelo.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )

    if response.stop_reason == "refusal":
        return "⚠️ La IA no pudo procesar esta solicitud. Revisa el texto o consulta con tu supervisor."

    texto = "".join(b.text for b in response.content if b.type == "text").strip()
    if response.stop_reason == "max_tokens":
        texto += "\n\n[La respuesta se cortó por ser muy larga.]"
    return texto or "La IA no devolvió texto. Intenta de nuevo."
