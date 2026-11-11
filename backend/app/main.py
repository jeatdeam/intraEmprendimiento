"""API del Asistente IA de Planta.

Endpoints:
  GET  /api/salud              -> estado del servidor y si la IA está configurada
  GET  /api/catalogo?area=...  -> skills y tareas del área (planta | oficina)
  POST /api/ejecutar           -> ejecuta una tarea con el skill elegido (y la guarda en el historial)
  POST /api/archivo/revisar    -> revisa estructura y rangos de un Excel/CSV
  POST /api/archivo/ejemplo    -> revisa el archivo ficticio (modo práctica)
  GET  /api/archivo/plantilla  -> descarga la plantilla CSV vacía
  GET  /api/archivo/ejemplo    -> descarga el archivo ficticio
  GET  /api/historial          -> valores diarios y alertas para la gráfica
"""
import logging
import os
from typing import Literal

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

from .catalogo import SKILLS, TAREAS, buscar_tarea, skills_publicos  # noqa: E402
from . import historial  # noqa: E402
from .ia import generar, ia_configurada  # noqa: E402
from .formatos import (FORMATOS, documento_ejemplo, leer_documento, plantilla_docx,  # noqa: E402
                       reporte_formato, revisar_formato)
from .reglas import archivo_ejemplo, plantilla_csv, reporte_texto, validar_archivo  # noqa: E402
from .simulador import simular  # noqa: E402

log = logging.getLogger("asistente")
NOMBRE_PLANTA = os.getenv("NOMBRE_PLANTA", "Central Renovable")
PRACTICA_USA_IA = os.getenv("PRACTICA_USA_IA", "false").lower() == "true"

app = FastAPI(title="Asistente IA de Planta")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["*"], allow_headers=["*"],
)

Area = Literal["planta", "oficina"]
Modo = Literal["practica", "real"]
MAX_BYTES = 4 * 1024 * 1024  # Vercel acepta hasta ~4.5 MB por petición

historial.iniciar()
# Semana de datos FICTICIOS para que las gráficas tengan historia (una sola vez por modo).
if os.getenv("SEMBRAR_DATOS", "true").lower() == "true":
    from .semilla import sembrar_todo
    sembrar_todo()


@app.get("/api/historial/equipo")
def ver_historial_equipo(equipo: str, modo: Modo, dias: int = Query(7, ge=3, le=60)):
    res = historial.consultar_equipo(modo, equipo.upper(), dias)
    if not res:
        raise HTTPException(404, "Equipo no encontrado")
    return res


class Ejecucion(BaseModel):
    area: Area
    tarea_id: str
    skill_id: str
    modo: Literal["practica", "real"]
    nombre: str = Field(default="", max_length=80)
    datos: dict[str, str] = {}


@app.get("/api/salud")
def salud():
    return {"ok": True, "ia_configurada": ia_configurada(), "planta": NOMBRE_PLANTA}


@app.get("/api/catalogo")
def catalogo(area: Area):
    return {"skills": skills_publicos(), "tareas": TAREAS[area], "planta": NOMBRE_PLANTA,
            "ia_configurada": ia_configurada()}


@app.post("/api/ejecutar")
async def ejecutar(e: Ejecucion):
    tarea = buscar_tarea(e.area, e.tarea_id)
    if not tarea:
        raise HTTPException(404, "Tarea no encontrada para esta área")
    if e.skill_id not in tarea["skills"] or e.skill_id not in SKILLS:
        raise HTTPException(400, "Ese skill no está disponible para esta tarea")

    faltan = [c["label"] for c in tarea["campos"] if not c.get("opcional") and not e.datos.get(c["id"], "").strip()]
    if faltan:
        raise HTTPException(422, "Falta completar: " + ", ".join(faltan))

    # Tareas con archivo o documento: el campo trae el id de la revisión; se cambia por el reporte en texto.
    revision = None      # (id, resultado, guardada) de un archivo de datos -> va a la gráfica
    resultado = None     # resultado de la revisión (archivo o documento) para el simulador
    for c in tarea["campos"]:
        if c["tipo"] not in ("archivo", "documento"):
            continue
        leida = historial.leer_revision(e.datos.get(c["id"], ""), e.modo)
        if not leida:
            raise HTTPException(422, "La revisión del archivo ya no existe. Vuelve a subir el archivo.")
        res, guardada = leida
        if c["tipo"] == "archivo":
            revision = (e.datos[c["id"]], res, guardada)
            e.datos = {**e.datos, c["id"]: reporte_texto(res)}
        else:
            fid = e.skill_id.removeprefix("fmt_")
            if fid in FORMATOS and res.get("formato") != fid:   # cambió de skill: se revisa contra el nuevo formato
                res = revisar_formato(res["texto"], fid, res["archivo"])
            e.datos = {**e.datos, c["id"]: reporte_formato(res)}
        resultado = res

    usar_ia = ia_configurada() and (e.modo == "real" or PRACTICA_USA_IA)
    if not usar_ia:
        texto = simular(e.area, tarea, e.skill_id, e.datos, e.nombre, NOMBRE_PLANTA, resultado)
        _registrar(e, tarea, "simulado", revision)
        return {"texto": texto, "origen": "simulado"}

    try:
        texto = await generar(e.area, tarea, e.skill_id, e.datos, e.nombre, NOMBRE_PLANTA)
    except anthropic.RateLimitError:
        raise HTTPException(503, "La IA está muy ocupada en este momento. Intenta en un minuto.")
    except anthropic.APIConnectionError:
        raise HTTPException(503, "No se pudo conectar con la IA. Revisa la conexión a internet.")
    except anthropic.APIStatusError as err:
        log.exception("Error de la API de IA")
        raise HTTPException(502, f"La IA respondió con un error ({err.status_code}). Avisa a soporte.")
    _registrar(e, tarea, "ia", revision)
    return {"texto": texto, "origen": "ia"}


def _registrar(e: Ejecucion, tarea: dict, origen: str, revision) -> None:
    try:
        historial.registrar(e.modo, e.area, tarea, e.skill_id, e.nombre, origen, e.datos, revision)
    except Exception:  # el historial nunca debe impedir entregar el resultado
        log.exception("No se pudo guardar el envío en el historial")


def _revisar(contenido: bytes, nombre: str, modo: str) -> dict:
    try:
        res = validar_archivo(contenido, nombre)
    except ValueError as err:
        raise HTTPException(422, str(err))
    res = {**res, "id": historial.guardar_revision(modo, res)}
    res.pop("registros")
    return res


@app.post("/api/archivo/revisar")
async def revisar_archivo(archivo: UploadFile = File(...), modo: Modo = Form("real")):
    contenido = await archivo.read(MAX_BYTES + 1)
    if len(contenido) > MAX_BYTES:
        raise HTTPException(413, "El archivo pesa más de 4 MB.")
    return _revisar(contenido, archivo.filename or "archivo", modo)


@app.post("/api/archivo/ejemplo")
def revisar_ejemplo():
    return _revisar(archivo_ejemplo(), "produccion_ejemplo.csv", "practica")


def _csv(contenido: bytes, nombre: str) -> Response:
    return Response(contenido, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{nombre}"'})


@app.get("/api/archivo/plantilla")
def descargar_plantilla():
    return _csv(plantilla_csv(), "plantilla_produccion.csv")


@app.get("/api/archivo/ejemplo")
def descargar_ejemplo():
    return _csv(archivo_ejemplo(), "produccion_ejemplo.csv")


@app.get("/api/historial")
def ver_historial(modo: Modo, dias: int = Query(30, ge=7, le=366)):
    return historial.consultar(modo, dias)


# ───────────── Revisión de formato de documentos (Word, PDF, texto) ─────────────

Formato = Literal["turno", "planta", "semanal", "falla"]


def _revisar_doc(texto: str, nombre: str, formato: str, modo: str) -> dict:
    res = revisar_formato(texto, formato, nombre)
    return {**res, "id": historial.guardar_revision(modo, res)}


@app.post("/api/documento/revisar")
async def revisar_documento(archivo: UploadFile = File(...), formato: Formato = Form(...), modo: Modo = Form("real")):
    contenido = await archivo.read(MAX_BYTES + 1)
    if len(contenido) > MAX_BYTES:
        raise HTTPException(413, "El archivo pesa más de 4 MB.")
    nombre = archivo.filename or "documento"
    try:
        texto = leer_documento(contenido, nombre)
    except ValueError as err:
        raise HTTPException(422, str(err))
    if not texto.strip():
        raise HTTPException(422, "No se encontró texto en el documento. Si es un PDF escaneado, súbelo en Word o texto.")
    return _revisar_doc(texto, nombre, formato, modo)


@app.post("/api/documento/ejemplo")
def revisar_documento_ejemplo(formato: Formato):
    return _revisar_doc(documento_ejemplo(formato), f"ejemplo_{formato}.txt", formato, "practica")


@app.post("/api/documento/cambiar-formato")
def cambiar_formato(id: str, formato: Formato, modo: Modo):
    leida = historial.leer_revision(id, modo)
    if not leida:
        raise HTTPException(404, "La revisión ya no existe. Vuelve a subir el documento.")
    res, _ = leida
    return _revisar_doc(res["texto"], res["archivo"], formato, modo)


@app.get("/api/documento/plantilla")
def descargar_plantilla_doc(formato: Formato):
    f = FORMATOS[formato]
    return Response(plantilla_docx(formato),
                    media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    headers={"Content-Disposition": f'attachment; filename="{f["codigo"]}_{formato}.docx"'})


@app.get("/api/documento/ejemplo")
def descargar_documento_ejemplo(formato: Formato):
    return Response(documento_ejemplo(formato).encode("utf-8"), media_type="text/plain; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="ejemplo_{formato}.txt"'})
