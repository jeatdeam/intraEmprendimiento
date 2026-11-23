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
            "Redacta un documento formal, profesional y detallado (extensión de una página completa). "
            "Estructura: título en mayúsculas, datos generales (fecha, área, campos clave, quién lo elabora) y entre "
            "5 y 6 secciones numeradas según el tipo de documento: objetivo o resumen, detalle o descripción con los "
            "datos en tabla cuando haya números, análisis o evaluación de lo informado, acciones y próximos pasos en "
            "una tabla con las columnas N°, Acción, Responsable y Plazo, prioridad si aplica, y FIRMAS al final "
            "('Elaborado por:', 'Revisado por:', 'Aprobado por:'). Desarrolla cada sección con frases completas; "
            "usa solo los datos que se entregan y marca lo que falte como [completar]."
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
            "'Resultado: ✅ ACEPTADO' o 'Resultado: ❌ NO ACEPTADO' y 'Cumplimiento: X de Y puntos (Z %)'; luego las secciones "
            "1. RESUMEN DE LA REVISIÓN (tabla: Parte del formato, Cumple, Estado), 2. LO QUE ESTÁ BIEN (viñetas), "
            "3. LO QUE FALTA O HAY QUE CORREGIR (viñetas, cada una con el motivo), "
            "4. CÓMO CORREGIRLO PASO A PASO (pasos numerados; si está aceptado, QUÉ HACER AHORA) "
            "y 5. RECOMENDACIÓN (una o dos frases)."
        ),
    }

# Inspección de ejemplo para cada equipo (demo): al elegir el equipo se cargan sus mediciones y observaciones.
_INSP = {
    "AG-01": {"motivo": "Seguimiento de vibración en el aspa 2 (inspección quincenal)",
              "voltaje": "691", "corriente": "1920", "temperatura": "63", "vibracion": "4,8",
              "falla": "Vibración excesiva", "gravedad": "Leve",
              "observaciones": "Vibración en el rotor de 4,8 mm/s (lo normal es hasta 4,5). Sube a 5,1 mm/s cuando el viento "
                               "pasa de 11 m/s. El aspa 2 tiene una marca de impacto de unos 3 cm cerca de la punta, sin "
                               "grietas visibles. Rodamiento principal sin ruido y con grasa limpia. Freno y sistema de "
                               "orientación funcionando bien. Se recomienda balancear el rotor en la próxima parada "
                               "programada y revisar el aspa 2 con dron."},
    "AG-07": {"motivo": "Inspección mensual programada y seguimiento de fuga de aceite",
              "voltaje": "702", "corriente": "1840", "temperatura": "81", "vibracion": "5,2",
              "falla": "Fuga de aceite", "gravedad": "Moderada",
              "observaciones": "La semana pasada se notó una pequeña fuga de aceite en la góndola. Hoy la mancha mide unos "
                               "40 cm y está junto al sello del eje principal. El nivel de aceite de la multiplicadora está "
                               "en el mínimo y la temperatura del aceite llegó a 81 °C (normal hasta 75). Se escucha un "
                               "zumbido al girar el rotor y la vibración subió a 5,2 mm/s. Se limpió la zona, se colocó "
                               "paño absorbente y se pidió a bodega el sello de repuesto (código SE-450). Se sugiere "
                               "limitar la potencia al 70 % hasta el cambio del sello."},
    "INV-03": {"motivo": "Revisión por alarma E-214 de sobretemperatura",
               "voltaje": "398", "corriente": "1460", "temperatura": "66", "vibracion": "1,1",
               "falla": "Sobretemperatura", "gravedad": "Moderada",
               "observaciones": "Gabinete a 66 °C (normal hasta 60 °C). El ventilador derecho no gira y el filtro de aire "
                                "está tapado de polvo. La producción de la fila 12 bajó de 1,4 a 0,6 MW desde las 09:40. "
                                "Voltaje y corriente AC dentro de rango. Conexiones DC sin puntos calientes en la cámara "
                                "térmica. Se limpió el filtro y la temperatura bajó a 61 °C. Falta cambiar el ventilador "
                                "(repuesto VF-220) con permiso de trabajo eléctrico."},
    "INV-05": {"motivo": "Ronda diaria de inspección",
               "voltaje": "404", "corriente": "1280", "temperatura": "47", "vibracion": "0,6",
               "falla": "Error de comunicación", "gravedad": "Leve",
               "observaciones": "El inversor opera normal: voltaje, corriente y temperatura dentro de rango. El SCADA dejó "
                                "de recibir datos durante 15 minutos a las 12:20; la luz de la tarjeta de comunicación "
                                "parpadeaba en rojo. Se reapretó el cable de red y se reinició la tarjeta; volvió a "
                                "comunicar. Filtros limpios, sin ruidos ni olores. Se dejará en observación 48 horas."},
    "TR-01": {"motivo": "Inspección semanal de la subestación",
              "voltaje": "402", "corriente": "2380", "temperatura": "79", "vibracion": "1,3",
              "falla": "Sin falla", "gravedad": "Ninguna",
              "observaciones": "Temperatura del aceite 79 °C con 31 °C de ambiente, dentro de rango; los 4 ventiladores "
                               "funcionando. Nivel de aceite en el punto medio del indicador. Silicagel color naranja "
                               "(en buen estado). Sin fugas ni manchas en la base. Zumbido normal. Aisladores limpios "
                               "y sin fisuras. Cerco y puerta de la subestación con candado."},
}
EJEMPLOS_INSPECCION = {opcion_equipo(e): {"equipo": opcion_equipo(e), **_INSP[e["id"]]} for e in EQUIPOS}

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
                     "novedades": "Recibí el turno a las 06:00 de Luis Rojas sin pendientes graves. Todos los equipos en servicio.\n\n"
                                  "06:45 - Ronda por el Parque Eólico Norte: AG-01 y AG-07 operando normal, viento de 9 m/s.\n"
                                  "08:10 - El aerogenerador AG-07 se detuvo 40 minutos por viento alto (ráfagas de 24 m/s) "
                                  "y volvió a arrancar solo a las 08:50. Sin alarmas después del arranque.\n"
                                  "09:30 - Se limpió el filtro de ventilación del inversor INV-03; la temperatura del gabinete "
                                  "bajó de 58 a 49 °C.\n"
                                  "11:00 - Llegó el camión de repuestos con el sello del eje principal y 2 filtros. "
                                  "Se guardó todo en bodega, guía N° 4471.\n"
                                  "12:20 - El SCADA perdió comunicación con INV-05 por 15 minutos; se recuperó sola.\n\n"
                                  "Seguridad: sin incidentes. Se hizo la charla de 5 minutos sobre trabajo en altura (6 personas).\n"
                                  "Pendiente para el turno tarde: revisar la cerca del sector norte (hay un poste suelto) "
                                  "y vigilar la comunicación de INV-05."}},
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
                     "descripcion": "Durante la ronda de las 10:15 escuché un zumbido fuerte que sale del gabinete del inversor. "
                                    "La pantalla muestra el error E-214 (sobretemperatura de módulo IGBT) y el gabinete está "
                                    "muy caliente al tacto: el termómetro marca 68 °C (lo normal es hasta 60 °C).\n\n"
                                    "La producción de la fila 12 bajó de 1,4 MW a 0,6 MW desde las 09:40 según el SCADA. "
                                    "El ventilador de la derecha no gira y el filtro de aire está tapado de polvo.\n\n"
                                    "Lo que hice: avisé al supervisor por radio, puse un cono y cinta de peligro frente al "
                                    "gabinete y NO lo abrí porque está energizado. Hace falta un técnico eléctrico con "
                                    "permiso de trabajo y el repuesto del ventilador (código VF-220)."}},
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
         "ejemplo": EJEMPLOS_INSPECCION[opcion_equipo(EQUIPOS[1])],
         # Al cambiar de equipo en el formulario se cargan sus propias mediciones de ejemplo (es una demo).
         "ejemplos_equipo": EJEMPLOS_INSPECCION},
        {"id": "procedimiento", "ico": "procedimiento", "nombre": "Preguntar un procedimiento",
         "desc": "Pregunta cómo se hace algo y la IA te lo explica.",
         "skills": ["simple", "checklist"],
         "campos": [{"id": "pregunta", "label": "¿Qué quieres saber?", "tipo": "area",
                     "hint": "Ejemplo: ¿Cómo hago el bloqueo de un tablero eléctrico?"}],
         "ejemplo": {"pregunta": "Mañana tengo que cambiar un interruptor dentro del tablero de baja tensión TB-04 del "
                                 "Parque Solar Sur, que alimenta las filas 10 a 14. Nunca hice el bloqueo y etiquetado "
                                 "(LOTO) solo.\n\n¿Cuáles son los pasos en orden para bloquear el tablero, qué candados y "
                                 "tarjetas uso, cómo compruebo que no queda tensión antes de tocar nada y qué hago al "
                                 "terminar para devolver el tablero a servicio? Trabajaré con un compañero."}},
        {"id": "lecturas", "ico": "lecturas", "nombre": "Revisar lecturas de producción",
         "desc": "Pega las lecturas y la IA te dice si algo anda mal.",
         "skills": ["analista", "puntos"],
         "campos": [{"id": "lecturas", "label": "Lecturas (una por línea)", "tipo": "area",
                     "hint": "Formato: hora: valor en MW"}],
         "ejemplo": {"lecturas": "06:00: 12\n07:00: 26\n08:00: 48\n09:00: 52\n10:00: 55\n11:00: 21\n12:00: 57\n"
                                 "13:00: 54\n14:00: 50\n15:00: 47\n16:00: 41\n17:00: 33\n18:00: 19"}},
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
                     "puntos": "orden de compra OC-2026-118 por 120 paneles de 550 W. debían llegar el lunes 16 y no llegaron, "
                               "nadie nos avisó. ya llamamos 2 veces y no contestan.\n"
                               "necesitamos fecha nueva de entrega por escrito y el número de guía del transporte.\n"
                               "si no llegan antes del viernes se atrasa el mantenimiento del sector C y perdemos unos "
                               "35 MWh por semana.\n"
                               "recordarles que el contrato tiene multa por atraso de 0,5 % por día.\n"
                               "contacto nuestro: área de compras, anexo 214"}},
        {"id": "resumen", "ico": "resumen", "nombre": "Resumir un documento",
         "desc": "Pega un texto largo y la IA te da lo importante.",
         "skills": ["puntos", "simple"],
         "campos": [{"id": "texto", "label": "Pega aquí el texto", "tipo": "area"}],
         "ejemplo": {"texto": "La nueva normativa de despacho establece que las centrales renovables deberán informar "
                              "su pronóstico de generación con 24 horas de anticipación. Las desviaciones mayores al 10% "
                              "podrán ser penalizadas. La medida entra en vigencia el próximo trimestre. Se recomienda que "
                              "cada planta designe un responsable del pronóstico y revise sus sistemas de medición. Además "
                              "se exigirá un reporte mensual de disponibilidad de equipos.\n\n"
                              "El pronóstico deberá enviarse antes de las 10:00 de cada día a través de la plataforma del "
                              "operador del sistema, en bloques de una hora. Las plantas con más de 50 MW instalados deberán "
                              "contar además con una estación meteorológica propia, calibrada al menos una vez al año. "
                              "Durante los primeros tres meses de vigencia habrá un periodo de marcha blanca sin multas, "
                              "en el que solo se informarán las desviaciones.\n\n"
                              "El reporte mensual de disponibilidad deberá indicar, por cada equipo, las horas en servicio, "
                              "las horas en mantenimiento programado y las horas de falla, con la causa de cada parada. "
                              "Las multas por desviación se calcularán sobre la energía no entregada y se descontarán de "
                              "los pagos del mes siguiente. Se realizará una capacitación virtual para los responsables "
                              "el día 3 del próximo mes."}},
        {"id": "acta", "ico": "acta", "nombre": "Acta de reunión",
         "desc": "Escribe tus notas y la IA arma el acta ordenada.",
         "skills": ["formal", "puntos"],
         "campos": [
             {"id": "asistentes", "label": "¿Quiénes asistieron?", "tipo": "text"},
             {"id": "notas", "label": "Notas de la reunión", "tipo": "area"},
         ],
         "ejemplo": {"asistentes": "Ana Gómez, Luis Rojas, Marta Díaz (ficticios)",
                     "notas": "reunión lunes 9:00 en sala de operaciones, terminó 10:15. dirige Ana.\n"
                              "1) presupuesto 2027: se pidió 8 % más para mantenimiento por el cambio de sellos en los "
                              "aerogeneradores. Ana lo presenta a gerencia el 30.\n"
                              "2) Luis presenta compra de 2 drones con cámara térmica para inspeccionar paneles y aspas. "
                              "costo aprox 18 mil dólares. ahorrarían 3 días de inspección al mes. Ana revisa costos y "
                              "pide 3 cotizaciones.\n"
                              "3) Marta pide capacitación en IA para el personal de planta y oficina, unas 25 personas. "
                              "se acuerda reunión con RRHH el viernes para ver fechas.\n"
                              "4) seguridad: recordar que el simulacro de evacuación es el 5 de diciembre.\n"
                              "pendiente de la reunión anterior: el informe de disponibilidad de octubre ya se envió (Luis)."}},
        {"id": "informe", "ico": "informe", "nombre": "Informe de generación",
         "desc": "Pega los datos del mes y la IA arma el informe.",
         "skills": ["analista", "formal"],
         "campos": [
             {"id": "periodo", "label": "Periodo", "tipo": "text"},
             {"id": "datos", "label": "Datos por instalación (MWh)", "tipo": "area", "hint": "Formato: nombre: valor"},
         ],
         "ejemplo": {"periodo": "Octubre 2026",
                     "datos": "Parque Eólico Norte: 18400 (meta 17500; AG-07 detenido 2 días por cambio de sello)\n"
                              "Parque Solar Sur: 12950 (meta 13200; INV-03 con falla de ventilador 3 días)\n"
                              "Parque Solar Este: 9800 (meta 9500)\n"
                              "Eólico Cerro Alto: 4100 (meta 5200; mes con poco viento)\n"
                              "Consumo propio de la planta: 310\n"
                              "Mes anterior (septiembre) total: 43900"}},
        {"id": "compra", "ico": "compra", "nombre": "Solicitud de compra",
         "desc": "Indica qué necesitas y la IA redacta la solicitud.",
         "skills": ["formal", "correo"],
         "campos": [
             {"id": "articulo", "label": "¿Qué se necesita comprar?", "tipo": "text"},
             {"id": "cantidad", "label": "Cantidad", "tipo": "text"},
             {"id": "motivo", "label": "¿Para qué se necesita?", "tipo": "area"},
         ],
         "ejemplo": {"articulo": "Guantes dieléctricos clase 2", "cantidad": "20 pares",
                     "motivo": "Los 20 pares que usa el equipo de mantenimiento eléctrico vencen su certificación el 15 de "
                               "diciembre y son obligatorios para trabajos en media tensión (hasta 17 kV) según el "
                               "reglamento interno RS-04. Sin ellos no se pueden hacer las maniobras en la subestación "
                               "ni en los tableros de los parques solares.\n"
                               "Tallas: 8 pares talla 9, 8 pares talla 10 y 4 pares talla 11. Deben venir con certificado "
                               "de ensayo dieléctrico vigente y su bolsa de protección.\n"
                               "Proveedor sugerido: Seguridad Industrial Andina (cotización COT-5521, aprox. 85 dólares el par). "
                               "Centro de costo: Mantenimiento Eléctrico MT-02. Entrega a más tardar el 10 de diciembre."}},
    ],
}


def buscar_tarea(area: str, tarea_id: str) -> dict | None:
    return next((t for t in TAREAS.get(area, []) if t["id"] == tarea_id), None)


def skills_publicos() -> dict:
    """Skills sin el prompt interno (el frontend no lo necesita)."""
    return {k: {c: v for c, v in s.items() if c != "prompt"} for k, s in SKILLS.items()}
