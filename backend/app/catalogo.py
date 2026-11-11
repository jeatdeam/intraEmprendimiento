"""Catálogo de SKILLS y TAREAS.

- Un SKILL es una "forma de trabajar" que se le da a la IA (su prompt).
- Una TAREA es un trabajo concreto de planta u oficina. Cada tarea define
  qué skills se pueden usar (el primero es el recomendado), qué campos
  completa el empleado y unos datos FALSOS de ejemplo para el modo práctica.

Para agregar una tarea o un skill nuevo basta con editar este archivo.
"""
from .equipos import EQUIPOS, GRAVEDAD, TIPOS_FALLA, opcion_equipo
from .formatos import FORMATOS, descripcion

SKILLS: dict[str, dict] = {
    "formal": {
        "nombre": "Redactor formal", "ico": "formal",
        "corto": "Escribe un documento ordenado y profesional.",
        "pasos": ["Lee los datos que escribiste", "Ordena la información por secciones",
                  "Usa un lenguaje formal y claro", "Agrega fecha, título y cierre"],
        "prompt": (
            "Redacta un documento formal y profesional. Estructura: título en mayúsculas, "
            "datos generales (fecha, área, campos clave), secciones numeradas "
            "(1. Descripción, 2. Acciones / próximos pasos y, si aplica, 3. Prioridad) y un cierre con firma."
        ),
    },
    "puntos": {
        "nombre": "Resumen en puntos", "ico": "puntos",
        "corto": "Convierte todo en una lista corta y fácil de leer.",
        "pasos": ["Lee todo el texto", "Busca las ideas más importantes",
                  "Elimina lo repetido", "Las escribe como lista de puntos"],
        "prompt": (
            "Resume la información en una lista de máximo 8 viñetas cortas (•), una idea por viñeta. "
            "Termina con una línea '👉 Lo más importante:' con la idea clave."
        ),
    },
    "simple": {
        "nombre": "Explicar fácil", "ico": "simple",
        "corto": "Explica con palabras sencillas, sin términos difíciles.",
        "pasos": ["Lee la consulta", "Cambia palabras técnicas por palabras comunes",
                  "Explica paso a paso", "Termina con un consejo práctico"],
        "prompt": (
            "Explica como se lo explicarías a una persona mayor que no es experta: frases cortas, "
            "sin tecnicismos (si usas uno, explícalo), pasos numerados y un '💡 Consejo' final."
        ),
    },
    "checklist": {
        "nombre": "Lista de seguridad", "ico": "checklist",
        "corto": "Crea una lista de verificación con pasos de seguridad.",
        "pasos": ["Identifica el equipo o la situación", "Agrega controles de seguridad obligatorios",
                  "Ordena los pasos para hacerlos uno por uno", "Deja casillas para marcar"],
        "prompt": (
            "Crea una lista de verificación con casillas '☐' en tres bloques: ANTES DE EMPEZAR "
            "(EPP, aviso al supervisor, bloqueo y etiquetado, verificación de ausencia de tensión), "
            "REVISIÓN (específica del equipo) y AL TERMINAR. Deja una línea de firma al final."
        ),
    },
    "analista": {
        "nombre": "Analista de datos", "ico": "analista",
        "corto": "Revisa números, saca totales, promedios y alertas.",
        "pasos": ["Busca los números en tus datos", "Calcula total, promedio, máximo y mínimo",
                  "Compara contra lo esperado", "Avisa si algo se ve raro"],
        "prompt": (
            "Analiza los datos numéricos: muestra una tabla simple en texto, luego RESULTADOS "
            "(total, promedio, máximo, mínimo con su unidad) y ALERTAS (valores anormales con ⚠️). "
            "Calcula con cuidado y no inventes datos que no estén en la entrada."
        ),
    },
    "correo": {
        "nombre": "Redactor de correos", "ico": "correo",
        "corto": "Escribe un correo listo para enviar.",
        "pasos": ["Identifica a quién va dirigido", "Escribe un asunto claro",
                  "Redacta el mensaje con saludo y despedida", "Mantiene un tono amable y profesional"],
        "prompt": (
            "Escribe un correo listo para copiar y enviar: líneas 'Para:' y 'Asunto:', saludo, "
            "cuerpo breve y claro, petición concreta, despedida y firma."
        ),
    },
}

# Skills de FORMATO: revisan si un documento subido cumple el formato oficial de la empresa.
_ICO_FMT = {"turno": "turno", "planta": "planta", "semanal": "semanal", "falla": "falla"}
for _fid, _f in FORMATOS.items():
    SKILLS[f"fmt_{_fid}"] = {
        "nombre": _f["nombre"], "ico": _ICO_FMT[_fid],
        "corto": f"Revisa si el documento cumple el formato {_f['codigo']}.",
        "pasos": ["Lee el documento que subiste", "Busca el título y el código del formato",
                  "Revisa cada campo y cada sección obligatoria", "Dice si se acepta o qué hay que corregir"],
        "prompt": (
            f"Eres el revisor de documentos de la empresa. Revisa si el documento cumple el formato oficial: {descripcion(_fid)} "
            "Ya se hizo una revisión automática (incluida); confírmala leyendo el texto del documento y revisa también "
            "la calidad: que la información sea clara, completa y coherente. Estructura de tu respuesta: "
            "primera línea REVISIÓN DE FORMATO; luego las líneas 'Documento: …', 'Formato: nombre y código' y "
            "'Resultado: ✅ ACEPTADO' o 'Resultado: ❌ NO ACEPTADO'; luego las secciones "
            "1. LO QUE ESTÁ BIEN (viñetas), 2. LO QUE FALTA O HAY QUE CORREGIR (viñetas, cada una con cómo corregirlo) "
            "y 3. RECOMENDACIÓN (una o dos frases)."
        ),
    }

TAREAS: dict[str, list[dict]] = {
    "planta": [
        {"id": "formato", "ico": "formato", "nombre": "Revisar formato de un documento",
         "apps": ["word", "pdf", "powerpoint", "texto"],
         "desc": "Sube tu reporte en Word, PDF, PowerPoint o texto y la IA te dice si cumple el formato de la empresa.",
         "skills": ["fmt_turno", "fmt_falla", "fmt_planta", "fmt_semanal"],
         "campos": [
             {"id": "documento", "label": "Documento a revisar (Word, PDF, PowerPoint o texto)", "tipo": "documento",
              "hint": "El skill que elegiste define contra qué formato oficial se revisa."},
         ],
         "ejemplo": {}},
        {"id": "turno", "ico": "turno", "nombre": "Reporte de turno",
         "desc": "Cuenta qué pasó en tu turno y la IA arma el reporte.",
         "skills": ["formal", "puntos", "analista"],
         "campos": [
             {"id": "turno", "label": "Turno", "tipo": "select",
              "opciones": ["Mañana (06:00 - 14:00)", "Tarde (14:00 - 22:00)", "Noche (22:00 - 06:00)"]},
             {"id": "operador", "label": "Nombre del operador", "tipo": "text"},
             {"id": "generacion", "label": "Energía generada en el turno (MWh)", "tipo": "text"},
             {"id": "novedades", "label": "¿Qué pasó en el turno?", "tipo": "area",
              "hint": "Escribe como si se lo contaras a un compañero."},
         ],
         "ejemplo": {"turno": "Mañana (06:00 - 14:00)", "operador": "Juan Pérez (ficticio)", "generacion": "412",
                     "novedades": "Turno normal. El aerogenerador 7 se detuvo 40 minutos por viento alto y volvió solo. "
                                  "Se limpió el panel del inversor 3. Llegó el camión de repuestos a las 11. "
                                  "Falta revisar la cerca del sector norte."}},
        {"id": "falla", "ico": "falla", "nombre": "Reportar una falla",
         "desc": "Describe el problema y la IA arma el aviso de mantenimiento.",
         "skills": ["formal", "checklist", "simple"],
         "campos": [
             {"id": "equipo", "label": "¿Qué equipo falla?", "tipo": "text"},
             {"id": "ubicacion", "label": "¿Dónde está?", "tipo": "text"},
             {"id": "urgencia", "label": "¿Qué tan urgente es?", "tipo": "select",
              "opciones": ["Baja - puede esperar", "Media - esta semana", "Alta - hoy mismo",
                           "Crítica - riesgo para personas"]},
             {"id": "descripcion", "label": "¿Qué observaste?", "tipo": "area"},
         ],
         "ejemplo": {"equipo": "Inversor solar INV-03 (ficticio)", "ubicacion": "Sector B, fila 12",
                     "urgencia": "Alta - hoy mismo",
                     "descripcion": "Hace un ruido fuerte, la pantalla muestra error E-214 y está más caliente "
                                    "de lo normal. Bajó la producción de esa fila."}},
        {"id": "inspeccion", "ico": "inspeccion", "nombre": "Inspección de equipo",
         "desc": "Registra las mediciones y fallas del equipo; la IA te arma la revisión.",
         "skills": ["checklist", "puntos", "formal"],
         "campos": [
             {"id": "equipo", "label": "Equipo a inspeccionar", "tipo": "select",
              "opciones": [opcion_equipo(e) for e in EQUIPOS]},
             {"id": "motivo", "label": "Motivo de la inspección", "tipo": "text"},
             {"id": "voltaje", "label": "Voltaje medido (V)", "tipo": "text", "medida": True,
              "hint": "Normal: 655–725 V aerogenerador · 380–420 V inversor y transformador."},
             {"id": "corriente", "label": "Corriente medida (A)", "tipo": "text", "medida": True, "opcional": True},
             {"id": "temperatura", "label": "Temperatura (°C)", "tipo": "text", "medida": True,
              "hint": "Aceite de multiplicadora en aerogeneradores; gabinete en inversores."},
             {"id": "vibracion", "label": "Vibración (mm/s)", "tipo": "text", "medida": True, "opcional": True},
             {"id": "falla", "label": "Falla encontrada", "tipo": "select", "opciones": TIPOS_FALLA},
             {"id": "gravedad", "label": "Gravedad de la falla", "tipo": "select", "opciones": GRAVEDAD},
             {"id": "observaciones", "label": "Detalle de la falla y observaciones", "tipo": "area", "opcional": True,
              "hint": "Dónde está, cómo se ve, desde cuándo, qué se hizo."},
         ],
         "ejemplo": {"equipo": opcion_equipo(EQUIPOS[1]), "motivo": "Inspección mensual programada",
                     "voltaje": "702", "corriente": "1840", "temperatura": "81", "vibracion": "5,2",
                     "falla": "Fuga de aceite", "gravedad": "Moderada",
                     "observaciones": "La última vez se notó una pequeña fuga de aceite en la góndola. Hoy la mancha "
                                      "es más grande y está cerca del sello del eje principal. El nivel de aceite de la "
                                      "multiplicadora está en el mínimo y se escucha un zumbido al girar el rotor. "
                                      "Se limpió la zona y se colocó un paño absorbente."}},
        {"id": "procedimiento", "ico": "procedimiento", "nombre": "Preguntar un procedimiento",
         "desc": "Pregunta cómo se hace algo y la IA te lo explica.",
         "skills": ["simple", "checklist"],
         "campos": [{"id": "pregunta", "label": "¿Qué quieres saber?", "tipo": "area",
                     "hint": "Ejemplo: ¿Cómo hago el bloqueo de un tablero eléctrico?"}],
         "ejemplo": {"pregunta": "¿Cómo hago el bloqueo y etiquetado (LOTO) de un tablero eléctrico antes de trabajar en él?"}},
        {"id": "lecturas", "ico": "lecturas", "nombre": "Revisar lecturas de producción",
         "desc": "Pega las lecturas y la IA te dice si algo anda mal.",
         "skills": ["analista", "puntos"],
         "campos": [{"id": "lecturas", "label": "Lecturas (una por línea)", "tipo": "area",
                     "hint": "Formato: hora: valor en MW"}],
         "ejemplo": {"lecturas": "08:00: 48\n09:00: 52\n10:00: 55\n11:00: 21\n12:00: 57\n13:00: 54\n14:00: 50"}},
    ],
    "oficina": [
        {"id": "formato", "ico": "formato", "nombre": "Revisar formato de un documento",
         "apps": ["word", "pdf", "powerpoint", "texto"],
         "desc": "Sube tu reporte en Word, PDF, PowerPoint o texto y la IA te dice si cumple el formato de la empresa.",
         "skills": ["fmt_semanal", "fmt_planta", "fmt_turno", "fmt_falla"],
         "campos": [
             {"id": "documento", "label": "Documento a revisar (Word, PDF, PowerPoint o texto)", "tipo": "documento",
              "hint": "El skill que elegiste define contra qué formato oficial se revisa."},
         ],
         "ejemplo": {}},
        {"id": "archivo", "ico": "archivo", "nombre": "Revisar archivo de datos",
         "apps": ["excel", "csv"],
         "desc": "Sube el Excel o CSV de producción y la IA te dice qué está mal o fuera de rango.",
         "skills": ["analista", "puntos", "simple"],
         "campos": [
             {"id": "archivo", "label": "Archivo de producción diaria (Excel o CSV)", "tipo": "archivo",
              "hint": "Columnas: Fecha, Equipo, Tipo de equipo, Generación (MWh), Disponibilidad (%), Temperatura (°C), Estado."},
         ],
         "ejemplo": {}},
        {"id": "correo", "ico": "correo", "nombre": "Escribir un correo",
         "apps": ["gmail", "outlook"],
         "desc": "Dile a la IA qué quieres decir y ella escribe el correo.",
         "skills": ["correo", "formal", "simple"],
         "campos": [
             {"id": "para", "label": "¿Para quién es?", "tipo": "text"},
             {"id": "tema", "label": "Tema del correo", "tipo": "text"},
             {"id": "puntos", "label": "¿Qué quieres decir?", "tipo": "area",
              "hint": "No te preocupes por la redacción, escribe las ideas."},
         ],
         "ejemplo": {"para": "Proveedor Solartec S.A. (ficticio)", "tema": "Retraso en entrega de paneles",
                     "puntos": "los paneles debían llegar el lunes y no llegaron. necesitamos fecha nueva. "
                               "si no llegan esta semana se atrasa el mantenimiento del sector C"}},
        {"id": "resumen", "ico": "resumen", "nombre": "Resumir un documento",
         "desc": "Pega un texto largo y la IA te da lo importante.",
         "skills": ["puntos", "simple"],
         "campos": [{"id": "texto", "label": "Pega aquí el texto", "tipo": "area"}],
         "ejemplo": {"texto": "La nueva normativa de despacho establece que las centrales renovables deberán informar "
                              "su pronóstico de generación con 24 horas de anticipación. Las desviaciones mayores al 10% "
                              "podrán ser penalizadas. La medida entra en vigencia el próximo trimestre. Se recomienda que "
                              "cada planta designe un responsable del pronóstico y revise sus sistemas de medición. Además "
                              "se exigirá un reporte mensual de disponibilidad de equipos."}},
        {"id": "acta", "ico": "acta", "nombre": "Acta de reunión",
         "desc": "Escribe tus notas y la IA arma el acta ordenada.",
         "skills": ["formal", "puntos"],
         "campos": [
             {"id": "asistentes", "label": "¿Quiénes asistieron?", "tipo": "text"},
             {"id": "notas", "label": "Notas de la reunión", "tipo": "area"},
         ],
         "ejemplo": {"asistentes": "Ana Gómez, Luis Rojas, Marta Díaz (ficticios)",
                     "notas": "se habló del presupuesto 2027. Luis presenta compra de 2 drones para inspección. "
                              "Marta pide capacitación en IA para el personal. se acuerda reunión con RRHH el viernes. "
                              "Ana revisa costos de drones."}},
        {"id": "informe", "ico": "informe", "nombre": "Informe de generación",
         "desc": "Pega los datos del mes y la IA arma el informe.",
         "skills": ["analista", "formal"],
         "campos": [
             {"id": "periodo", "label": "Periodo", "tipo": "text"},
             {"id": "datos", "label": "Datos por instalación (MWh)", "tipo": "area", "hint": "Formato: nombre: valor"},
         ],
         "ejemplo": {"periodo": "Octubre 2026",
                     "datos": "Parque Eólico Norte: 18400\nParque Solar Sur: 12950\nParque Solar Este: 9800\nEólico Cerro Alto: 4100"}},
        {"id": "compra", "ico": "compra", "nombre": "Solicitud de compra",
         "desc": "Indica qué necesitas y la IA redacta la solicitud.",
         "skills": ["formal", "correo"],
         "campos": [
             {"id": "articulo", "label": "¿Qué se necesita comprar?", "tipo": "text"},
             {"id": "cantidad", "label": "Cantidad", "tipo": "text"},
             {"id": "motivo", "label": "¿Para qué se necesita?", "tipo": "area"},
         ],
         "ejemplo": {"articulo": "Guantes dieléctricos clase 2", "cantidad": "20 pares",
                     "motivo": "Los actuales vencen su certificación en diciembre y son obligatorios para trabajos en media tensión."}},
    ],
}


def buscar_tarea(area: str, tarea_id: str) -> dict | None:
    return next((t for t in TAREAS.get(area, []) if t["id"] == tarea_id), None)


def skills_publicos() -> dict:
    """Skills sin el prompt interno (el frontend no lo necesita)."""
    return {k: {c: v for c, v in s.items() if c != "prompt"} for k, s in SKILLS.items()}
