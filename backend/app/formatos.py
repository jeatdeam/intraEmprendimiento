"""Formatos oficiales de documentos de la empresa.

Cada FORMATO define su código, los CAMPOS obligatorios del encabezado (líneas "Campo: valor")
y las SECCIONES obligatorias (títulos numerados). Se usan para dos cosas:
  1. Que los reportes que genera la IA salgan con el formato oficial.
  2. Revisar si un documento subido (Word, PDF o texto) cumple el formato y se acepta.

Para cambiar un formato basta con editar este archivo.
"""
import io
import re
import unicodedata
import zipfile
from datetime import datetime
from xml.etree import ElementTree as ET

FORMATOS: dict[str, dict] = {
    "turno": {
        "nombre": "Reporte de turno", "codigo": "OP-FOR-001", "revision": "03", "area": "Operaciones de Planta",
        "campos": [
            {"label": "Fecha", "alias": ["fecha"], "tipo": "fecha"},
            {"label": "Turno", "alias": ["turno"], "tipo": "texto"},
            {"label": "Operador", "alias": ["operador", "nombre del operador", "responsable"], "tipo": "texto"},
            {"label": "Energía generada", "alias": ["energia generada", "energia", "generacion"], "tipo": "numero"},
        ],
        "secciones": [
            {"label": "Resumen del turno", "alias": ["resumen del turno", "resumen", "descripcion"]},
            {"label": "Producción", "alias": ["produccion", "produccion del turno", "generacion"]},
            {"label": "Novedades y eventos", "alias": ["novedades y eventos", "novedades", "eventos"]},
            {"label": "Seguridad", "alias": ["seguridad", "seguridad y medio ambiente", "hse"]},
            {"label": "Pendientes", "alias": ["pendientes", "pendientes para el siguiente turno", "acciones", "proximos pasos"]},
            {"label": "Firmas", "alias": ["firmas", "firma", "aprobaciones"]},
        ],
    },
    "planta": {
        "nombre": "Reporte diario de planta", "codigo": "OP-FOR-002", "revision": "01", "area": "Operaciones de Planta",
        "campos": [
            {"label": "Fecha", "alias": ["fecha"], "tipo": "fecha"},
            {"label": "Elaborado por", "alias": ["elaborado por", "responsable", "jefe de turno"], "tipo": "texto"},
            {"label": "Generación total", "alias": ["generacion total", "generacion", "energia generada"], "tipo": "numero"},
            {"label": "Disponibilidad", "alias": ["disponibilidad"], "tipo": "numero"},
        ],
        "secciones": [
            {"label": "Resumen del día", "alias": ["resumen del dia", "resumen"]},
            {"label": "Producción", "alias": ["produccion", "generacion"]},
            {"label": "Equipos fuera de servicio", "alias": ["equipos fuera de servicio", "equipos detenidos", "fallas"]},
            {"label": "Seguridad", "alias": ["seguridad", "seguridad y medio ambiente", "hse"]},
            {"label": "Pendientes", "alias": ["pendientes", "acciones"]},
            {"label": "Firmas", "alias": ["firmas", "firma", "aprobaciones"]},
        ],
    },
    "semanal": {
        "nombre": "Reporte semanal", "codigo": "OP-FOR-003", "revision": "01", "area": "Operaciones",
        "campos": [
            {"label": "Semana", "alias": ["semana", "periodo"], "tipo": "texto"},
            {"label": "Elaborado por", "alias": ["elaborado por", "responsable"], "tipo": "texto"},
            {"label": "Generación de la semana", "alias": ["generacion de la semana", "generacion semanal", "generacion total", "generacion"], "tipo": "numero"},
        ],
        "secciones": [
            {"label": "Resumen ejecutivo", "alias": ["resumen ejecutivo", "resumen"]},
            {"label": "Producción de la semana", "alias": ["produccion de la semana", "produccion"]},
            {"label": "Fallas y mantenimiento", "alias": ["fallas y mantenimiento", "mantenimiento", "fallas"]},
            {"label": "Seguridad", "alias": ["seguridad", "hse"]},
            {"label": "Plan de la próxima semana", "alias": ["plan de la proxima semana", "proxima semana", "plan semanal"]},
            {"label": "Firmas", "alias": ["firmas", "firma", "aprobaciones"]},
        ],
    },
    "falla": {
        "nombre": "Aviso de falla urgente", "codigo": "MA-FOR-010", "revision": "04", "area": "Mantenimiento",
        "campos": [
            {"label": "Fecha y hora", "alias": ["fecha y hora", "fecha"], "tipo": "fecha"},
            {"label": "Equipo", "alias": ["equipo", "equipo afectado"], "tipo": "texto"},
            {"label": "Ubicación", "alias": ["ubicacion", "lugar"], "tipo": "texto"},
            {"label": "Prioridad", "alias": ["prioridad", "urgencia"], "tipo": "opcion",
             "opciones": ["baja", "media", "alta", "critica"]},
            {"label": "Reportado por", "alias": ["reportado por", "reporta", "elaborado por"], "tipo": "texto"},
        ],
        "secciones": [
            {"label": "Descripción de la falla", "alias": ["descripcion de la falla", "descripcion"]},
            {"label": "Impacto en la operación", "alias": ["impacto en la operacion", "impacto", "consecuencias"]},
            {"label": "Riesgo para personas", "alias": ["riesgo para personas", "riesgos", "riesgo"]},
            {"label": "Acciones inmediatas", "alias": ["acciones inmediatas", "acciones tomadas", "acciones"]},
            {"label": "Acciones recomendadas", "alias": ["acciones recomendadas", "recomendaciones", "seguimiento"]},
            {"label": "Firmas", "alias": ["firmas", "firma", "aprobaciones"]},
        ],
    },
}

# Qué formato oficial usa cada tarea al generar el documento.
FORMATO_DE_TAREA = {"turno": "turno", "falla": "falla"}

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]


def _n(t: str) -> str:
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", t).strip()


def descripcion(fid: str) -> str:
    f = FORMATOS[fid]
    return (f"{f['nombre']} (código {f['codigo']}, rev. {f['revision']}). "
            f"Encabezado con las líneas: {', '.join(c['label'] for c in f['campos'])}. "
            f"Secciones numeradas en este orden: "
            + "; ".join(f"{i + 1}. {s['label'].upper()}" for i, s in enumerate(f["secciones"])) + ".")


# ───────────────────────── Leer el archivo ─────────────────────────

def leer_documento(contenido: bytes, nombre: str) -> str:
    n = nombre.lower()
    if n.endswith((".txt", ".md")):
        try:
            return contenido.decode("utf-8-sig")
        except UnicodeDecodeError:
            return contenido.decode("latin-1")
    if n.endswith(".docx"):
        try:
            with zipfile.ZipFile(io.BytesIO(contenido)) as z:
                xml = z.read("word/document.xml")
        except (zipfile.BadZipFile, KeyError) as e:
            raise ValueError("No se pudo abrir el Word. ¿Está dañado?") from e
        w = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
        lineas = []
        for p in ET.fromstring(xml).iter(f"{w}p"):
            lineas.append("".join(t.text or "" for t in p.iter(f"{w}t")))
        return "\n".join(lineas)
    if n.endswith(".pptx"):
        try:
            with zipfile.ZipFile(io.BytesIO(contenido)) as z:
                diapos = sorted((x for x in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", x)),
                                key=lambda x: int(re.search(r"(\d+)\.xml$", x).group(1)))
                a = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
                lineas = []
                for d in diapos:
                    for p in ET.fromstring(z.read(d)).iter(f"{a}p"):
                        lineas.append("".join(t.text or "" for t in p.iter(f"{a}t")))
        except (zipfile.BadZipFile, KeyError) as e:
            raise ValueError("No se pudo abrir el PowerPoint. ¿Está dañado?") from e
        return "\n".join(lineas)
    if n.endswith(".pdf"):
        try:
            from pypdf import PdfReader
        except ImportError as e:  # pragma: no cover
            raise ValueError("El servidor no puede leer PDF (falta instalar pypdf).") from e
        try:
            pdf = PdfReader(io.BytesIO(contenido))
            return "\n".join(p.extract_text() or "" for p in pdf.pages[:30])
        except Exception as e:
            raise ValueError("No se pudo leer el PDF. ¿Está protegido o es una imagen escaneada?") from e
    raise ValueError("Formato no admitido. Sube un Word (.docx), PDF (.pdf), PowerPoint (.pptx) o texto (.txt).")


# ───────────────────────── Revisar el formato ─────────────────────────

def _es_fecha(v: str) -> bool:
    v = _n(v)
    if re.search(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b", v):
        return True
    return bool(re.search(r"\b\d{1,2} de (" + "|".join(MESES) + r")( de \d{4})?", v))


def revisar_formato(texto: str, fid: str, archivo: str) -> dict:
    f = FORMATOS[fid]
    lineas = [l.strip() for l in texto.splitlines()]
    norm = [_n(l) for l in lineas]
    checks: list[dict] = []

    def check(grupo, label, ok, detalle):
        checks.append({"grupo": grupo, "label": label, "ok": ok, "detalle": detalle})

    # Encabezado
    titulo_ok = any(_n(f["nombre"]) in l for l in norm[:8])
    check("Encabezado", "Título del documento", titulo_ok,
          "Correcto." if titulo_ok else f"En las primeras líneas debe decir «{f['nombre'].upper()}».")
    codigo_ok = f["codigo"].lower() in _n(texto)
    check("Encabezado", "Código del formato", codigo_ok,
          f"Indica {f['codigo']}." if codigo_ok else f"Debe indicar el código {f['codigo']} (rev. {f['revision']}).")

    # Campos "Campo: valor"
    for c in f["campos"]:
        valor = None
        for l, ln in zip(lineas, norm):
            m = re.match(r"^[•\-\*\s]*(" + "|".join(re.escape(a) for a in c["alias"]) + r")\s*[:：]\s*(.*)$", ln)
            if m:
                valor = l.split(":", 1)[1].strip() if ":" in l else ""
                break
        if valor is None:
            check("Campos", c["label"], False, f"Falta la línea «{c['label']}: …».")
        elif not valor or re.fullmatch(r"[_\.\-\s\[\]]*|\[?completar\]?", _n(valor)):
            check("Campos", c["label"], False, "Está vacío.")
        elif c["tipo"] == "fecha" and not _es_fecha(valor):
            check("Campos", c["label"], False, f"«{valor}» no es una fecha válida (ej.: 09/11/2026).")
        elif c["tipo"] == "numero" and not re.search(r"\d", valor):
            check("Campos", c["label"], False, f"«{valor}» debe tener un número con su unidad.")
        elif c["tipo"] == "opcion" and not any(_n(valor).startswith(o) for o in c["opciones"]):
            check("Campos", c["label"], False, f"«{valor}» no es válido. Usa: {', '.join(o.capitalize() for o in c['opciones']).replace('Critica', 'Crítica')}.")
        else:
            check("Campos", c["label"], True, valor[:80])

    # Secciones: un título corto, opcionalmente numerado, que coincide con algún alias.
    posiciones = []
    for s in f["secciones"]:
        pat = re.compile(r"^(#+\s*)?(\d+[\.\)]\s*)?(" + "|".join(re.escape(a) for a in s["alias"]) + r")\b\s*:?\s*$")
        idx = next((i for i, l in enumerate(norm) if len(l) <= 60 and pat.match(l)), None)
        if idx is None:
            check("Secciones", s["label"], False, f"Falta la sección «{s['label'].upper()}».")
            continue
        posiciones.append(idx)
        # Contenido de la sección: líneas hasta el próximo título numerado (máximo 15).
        cuerpo = []
        for l in norm[idx + 1: idx + 16]:
            if re.match(r"^(#+\s*)?\d+[\.\)]\s+[a-z]", l):
                break
            if l and not re.fullmatch(r"\[?completar\]?", l):
                cuerpo.append(l)
        if not cuerpo:
            check("Secciones", s["label"], False, "La sección está vacía.")
        else:
            check("Secciones", s["label"], True, "Presente.")
    orden_ok = posiciones == sorted(posiciones)
    observaciones = []
    if not orden_ok:
        observaciones.append("Las secciones no están en el orden oficial.")
    if len(texto.strip()) < 80:
        observaciones.append("El documento es muy corto o no se pudo leer bien el texto.")
    if re.search(r"(^|\n)\s*#{1,6}\s|\*\*", texto):
        observaciones.append("Tiene marcas de Markdown (# o **). El formato oficial no las usa.")

    cumple = sum(1 for c in checks if c["ok"])
    return {
        "formato": fid, "nombre": f["nombre"], "codigo": f["codigo"], "revision": f["revision"],
        "archivo": archivo, "palabras": len(texto.split()),
        "aceptado": cumple == len(checks) and orden_ok, "cumple": cumple, "total": len(checks),
        "checks": checks, "observaciones": observaciones, "texto": texto[:12000],
    }


def reporte_formato(res: dict) -> str:
    """Texto que recibe la IA: el resultado de la revisión automática y el documento."""
    lin = [f"Formato contra el que se revisa: {descripcion(res['formato'])}",
           f"Archivo subido: {res['archivo']} ({res['palabras']} palabras)",
           f"Revisión automática: {res['cumple']} de {res['total']} puntos cumplen → "
           f"{'ACEPTADO' if res['aceptado'] else 'NO ACEPTADO'}"]
    lin += [f"- [{'OK' if c['ok'] else 'FALTA'}] {c['grupo']} · {c['label']}: {c['detalle']}" for c in res["checks"]]
    lin += [f"- [OBSERVACIÓN] {o}" for o in res["observaciones"]]
    lin.append("\nTexto del documento subido:\n\"\"\"\n" + res["texto"] + "\n\"\"\"")
    return "\n".join(lin)


# ───────────────────────── Ejemplos y plantillas ─────────────────────────

_VALORES = {
    "Fecha": "09/11/2026", "Turno": "Mañana (06:00 - 14:00)", "Operador": "Juan Pérez (ficticio)",
    "Energía generada": "412 MWh", "Elaborado por": "Ana Gómez (ficticia)", "Generación total": "1.240 MWh",
    "Disponibilidad": "97,8 %", "Semana": "Semana 45 (02/11/2026 al 08/11/2026)",
    "Generación de la semana": "8.650 MWh", "Fecha y hora": "09/11/2026 10:40", "Equipo": "Inversor INV-03 (ficticio)",
    "Ubicación": "Sector B, fila 12", "Prioridad": "Alta", "Reportado por": "Luis Rojas (ficticio)",
}


FIRMAS_VACIAS = "Elaborado por: {autor}\nRevisado por: ____________________\nAprobado por: ____________________"

# Contenido FICTICIO de cada sección de los documentos de ejemplo (uno por formato).
_TEXTOS: dict[str, dict[str, str]] = {
    "turno": {
        "Resumen del turno": (
            "Turno con operación estable. Se generaron 412 MWh, un 3 % sobre el pronóstico del día. El parque eólico "
            "trabajó con viento medio de 9 m/s y el parque solar con cielo despejado desde las 08:30. Hubo una parada "
            "corta del aerogenerador AG-07 por ráfagas, sin daños."),
        "Producción": (
            "  Instalación  Energía (MWh)  Disponibilidad\n"
            "  Parque Eólico Norte  268  97 %\n"
            "  Parque Solar Sur  144  99 %\n"
            "Potencia media del turno: 51,5 MW (rango normal 30–60 MW).\n"
            "Pérdida estimada por la parada del AG-07: 3 MWh."),
        "Novedades y eventos": (
            "• 07:50 — El aerogenerador AG-07 se detuvo 40 minutos por ráfagas sobre el límite y volvió a operar solo.\n"
            "• 09:15 — Se limpió el panel del inversor INV-03; la temperatura del gabinete bajó de 58 a 49 °C.\n"
            "• 11:00 — Llegó el camión de repuestos: se recibieron 2 sellos de eje y 4 filtros de ventilación.\n"
            "• 13:20 — Ronda de cierre sin alarmas activas en el SCADA."),
        "Seguridad": (
            "• Sin accidentes ni incidentes en el turno.\n"
            "• Charla de 5 minutos sobre trabajo en altura antes de la ronda.\n"
            "• Se aplicó bloqueo y etiquetado (LOTO) durante la limpieza del INV-03."),
        "Pendientes": (
            "• Revisar la cerca perimetral del sector norte (poste 14 inclinado).\n"
            "• Confirmar con mantenimiento la fecha del balanceo del aspa 2 del AG-01."),
    },
    "planta": {
        "Resumen del día": (
            "Día de operación normal con una generación total de 1.240 MWh y una disponibilidad de 97,8 %. La única "
            "indisponibilidad relevante fue la del aerogenerador AG-07, detenido por mantenimiento correctivo. "
            "No hubo eventos de seguridad ni reclamos del coordinador del sistema."),
        "Producción": (
            "  Instalación  Energía (MWh)  Pronóstico (MWh)  Diferencia\n"
            "  Parque Eólico Norte  790  820  -3,7 %\n"
            "  Parque Solar Sur  450  440  +2,3 %\n"
            "  Total planta  1.240  1.260  -1,6 %\n"
            "La diferencia con el pronóstico se explica por la parada del AG-07 (aprox. 38 MWh no generados)."),
        "Equipos fuera de servicio": (
            "• AG-07 — Detenido desde las 15:20 del día anterior por sobretemperatura del aceite de la multiplicadora. "
            "Se cambia el sello del eje principal; retorno estimado mañana a las 10:00.\n"
            "• INV-05 — 2 horas sin comunicación con el SCADA; se reinició la tarjeta y quedó operativo."),
        "Seguridad": (
            "• 0 accidentes, 0 incidentes, 1 observación preventiva (orden y limpieza en bodega).\n"
            "• Permisos de trabajo emitidos: 3 (uno de altura, dos eléctricos).\n"
            "• Sin derrames: el aceite del AG-07 se contuvo con paños absorbentes y se dispuso como residuo peligroso."),
        "Pendientes": (
            "• Cerrar la orden de trabajo del AG-07 y registrar las horas de parada.\n"
            "• Programar la limpieza de filtros de los inversores del sector C.\n"
            "• Enviar el pronóstico de generación de mañana antes de las 12:00."),
    },
    "semanal": {
        "Resumen ejecutivo": (
            "La planta generó 8.650 MWh en la semana, un 2 % bajo la meta de 8.820 MWh. La disponibilidad promedio "
            "fue de 96,9 %. El evento principal fue la falla del aerogenerador AG-07 (fuga de aceite y "
            "sobretemperatura), que estuvo 31 horas fuera de servicio. No hubo accidentes."),
        "Producción de la semana": (
            "  Instalación  Energía (MWh)  Meta (MWh)  Cumplimiento\n"
            "  Parque Eólico Norte  5.480  5.700  96 %\n"
            "  Parque Solar Sur  3.170  3.120  102 %\n"
            "  Total  8.650  8.820  98 %\n"
            "Mejor día: jueves, con 1.310 MWh. Día más bajo: martes, con 1.090 MWh (AG-07 detenido)."),
        "Fallas y mantenimiento": (
            "• AG-07 — Fuga de aceite en la góndola que terminó en sobretemperatura. Se cambió el sello del eje "
            "principal y se rellenó el aceite de la multiplicadora. 31 horas detenido.\n"
            "• INV-03 — Caída de voltaje por un conector flojo en el string 4 y filtro de ventilación sucio. Corregido.\n"
            "• AG-01 — Desbalance leve en el aspa 2; balanceo programado para la próxima parada.\n"
            "Mantenimientos preventivos cumplidos: 11 de 12 (92 %)."),
        "Seguridad": (
            "• 0 accidentes con tiempo perdido; 142 días sin accidentes.\n"
            "• 2 observaciones preventivas cerradas y 1 abierta (señalización del acceso a la subestación).\n"
            "• Se completó la capacitación de trabajo en altura de 6 técnicos."),
        "Plan de la próxima semana": (
            "• Balanceo del aspa 2 del AG-01 (martes, con ventana de viento bajo).\n"
            "• Limpieza de paneles de los sectores B y C.\n"
            "• Auditoría interna del procedimiento de bloqueo y etiquetado.\n"
            "• Recepción de 20 pares de guantes dieléctricos clase 2."),
    },
    "falla": {
        "Descripción de la falla": (
            "El inversor INV-03 hace un ruido fuerte y continuo, y la pantalla muestra el error E-214. El gabinete está "
            "más caliente de lo normal (64 °C medidos en la puerta; lo normal es hasta 60 °C). El problema empezó cerca "
            "de las 10:10 y no se quita al reiniciar la pantalla."),
        "Impacto en la operación": (
            "• La fila 12 del sector B bajó su producción de 14 a 3 MWh por día.\n"
            "• Si el inversor se desconecta por protección se pierden cerca de 1,8 MW en horas de sol.\n"
            "• No afecta a los demás inversores del sector."),
        "Riesgo para personas": (
            "Riesgo de quemadura por contacto con el gabinete y riesgo eléctrico si se abre sin bloqueo. "
            "No hay personas trabajando en la fila 12. La zona quedó señalizada con cinta y cono."),
        "Acciones inmediatas": (
            "• Se avisó al supervisor de turno y a mantenimiento eléctrico a las 10:25.\n"
            "• Se señalizó el equipo y se prohibió abrir el gabinete.\n"
            "• Se tomó foto del código de error y de la temperatura."),
        "Acciones recomendadas": (
            "• Revisar el ventilador y el filtro del gabinete con el equipo bloqueado (LOTO).\n"
            "• Medir el voltaje AC y reapretar los conectores del string 4.\n"
            "• Registrar la orden de trabajo y el tiempo fuera de servicio."),
    },
}


def armar_documento(fid: str, valores: dict[str, str], secciones: dict[str, str], *, autor: str = "",
                    planta: str = "Central Renovable", sin_codigo: bool = False, sin: tuple[str, ...] = ()) -> str:
    """Arma el texto de un documento con un formato oficial.

    `valores` son los campos del encabezado y `secciones` el contenido de cada sección.
    Para simular documentos mal hechos: `sin_codigo` quita la línea del código y `sin` omite campos o secciones.
    """
    f = FORMATOS[fid]
    lin = [f["nombre"].upper()]
    if not sin_codigo:
        lin.append(f"Código: {f['codigo']} · Revisión: {f['revision']}")
    lin += [f"{planta} — {f['area']}", ""]
    lin += [f"{c['label']}: {valores.get(c['label'], '')}" for c in f["campos"] if c["label"] not in sin]
    lin.append("")
    n = 0
    for s in f["secciones"]:
        if s["label"] in sin:
            continue
        n += 1
        cuerpo = secciones.get(s["label"]) or (FIRMAS_VACIAS.format(autor=autor or "____________________")
                                               if s["label"] == "Firmas" else "[completar]")
        lin += [f"{n}. {s['label'].upper()}", cuerpo, ""]
    return "\n".join(lin).rstrip() + "\n"


def documento_ejemplo(fid: str) -> str:
    """Documento ficticio con errores a propósito (le falta el código, una sección y un campo mal llenado)."""
    f = FORMATOS[fid]
    valores = dict(_VALORES)
    if f["campos"][0]["tipo"] == "fecha":
        valores[f["campos"][0]["label"]] = "ayer en la mañana"          # fecha mal escrita a propósito
    falta = f["secciones"][-2]["label"]                                  # falta una sección
    autor = valores.get("Operador") or valores.get("Elaborado por") or valores.get("Reportado por", "")
    return armar_documento(fid, valores, _TEXTOS[fid], autor=autor, planta="Central Renovable (ficticia)",
                           sin_codigo=True, sin=(falta,))


def plantilla_docx(fid: str) -> bytes:
    """Plantilla Word (.docx) vacía con el formato oficial, sin dependencias externas."""
    f = FORMATOS[fid]
    esc = lambda t: t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    def p(t, negrita=False, tam=None):
        rpr = ("<w:b/>" if negrita else "") + (f'<w:sz w:val="{tam}"/>' if tam else "")
        return f'<w:p><w:r>{f"<w:rPr>{rpr}</w:rPr>" if rpr else ""}<w:t xml:space="preserve">{esc(t)}</w:t></w:r></w:p>'

    cuerpo = [p(f["nombre"].upper(), True, 32), p(f"Código: {f['codigo']} · Revisión: {f['revision']}"),
              p(f"Central Renovable — {f['area']}"), p("")]
    cuerpo += [p(f"{c['label']}: ") for c in f["campos"]] + [p("")]
    for i, s in enumerate(f["secciones"]):
        cuerpo.append(p(f"{i + 1}. {s['label'].upper()}", True))
        if s["label"] == "Firmas":
            cuerpo += [p("Elaborado por: ____________________"), p("Revisado por: ____________________"),
                       p("Aprobado por: ____________________")]
        else:
            cuerpo.append(p("[completar]"))
        cuerpo.append(p(""))
    doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
           '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
           + "".join(cuerpo) + "</w:body></w:document>")
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml",
                   '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="xml" ContentType="application/xml"/>'
                   '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr("_rels/.rels",
                   '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr("word/document.xml", doc)
    return out.getvalue()


def fecha_larga(cuando: datetime | None = None) -> str:
    h = cuando or datetime.now()
    dias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
    return f"{dias[h.weekday()]}, {h.day} de {MESES[h.month - 1]} de {h.year}"
