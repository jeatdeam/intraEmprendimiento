"""Simulador de respuestas de IA.

Se usa en el MODO PRÁCTICA (datos falsos) y cuando no hay clave de IA
configurada. Produce resultados creíbles sin llamar a ningún servicio
externo, para que el empleado aprenda qué hace cada skill.
"""
import re
from datetime import date, datetime

from .equipos import buscar_equipo, evaluar
from .formatos import FORMATO_DE_TAREA, FORMATOS, fecha_larga
from .reglas import RANGOS_FORMULARIO, fmt, numero

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]

CHECK_EQUIPOS = {
    "aerogenerador": ["Verificar velocidad del viento bajo el límite permitido",
                      "Revisar arnés y línea de vida antes de subir",
                      "Inspeccionar fugas de aceite en la góndola",
                      "Revisar estado de las aspas (grietas, golpes)",
                      "Escuchar ruidos raros en la caja multiplicadora"],
    "inversor": ["Revisar mensajes de error en pantalla", "Medir temperatura del gabinete",
                 "Limpiar filtros de ventilación", "Revisar conexiones y cables sueltos"],
    "transformador": ["Revisar nivel y temperatura del aceite", "Buscar fugas o manchas en el piso",
                      "Revisar silicagel (color)", "Escuchar zumbido anormal"],
    "paneles": ["Revisar suciedad y sombras", "Buscar vidrios rotos o puntos calientes",
                "Revisar cableado y conectores"],
    "subestación": ["Revisar accesos y cerca perimetral", "Inspeccionar aisladores",
                    "Revisar alarmas en el tablero"],
}


def _fecha(cuando: datetime | None = None) -> str:
    h = cuando.date() if cuando else date.today()
    return f"{DIAS[h.weekday()]}, {h.day} de {MESES[h.month - 1]} de {h.year}"


def _oraciones(txt: str) -> list[str]:
    # El punto entre dos cifras (1.240 o 10.30) no corta la oración.
    partes = re.split(r"(?:(?<!\d)\.|\.(?!\d)|[\n;])+|,\s*(?=[a-záéíóúñ]+\s)", txt, flags=re.I)
    return [p.strip()[0].upper() + p.strip()[1:] for p in partes if len(p.strip()) > 3]


def _num(n: float) -> str:
    s = f"{n:,.1f}".rstrip("0").rstrip(".")
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _archivo(skill: str, rev: dict) -> str:
    """Respuesta simulada para 'Revisar archivo de datos', según el skill elegido."""
    r, probs = rev["resumen"], rev["problemas"]
    grupos = {t: [p for p in probs if p["tipo"] == t] for t in ("falla", "error", "bajo", "alto")}
    titulos = {"falla": "🔴 POSIBLES FALLAS DE MÁQUINA", "error": "❌ DATOS MAL ESCRITOS O IMPOSIBLES",
               "bajo": "⬇️ VALORES BAJO EL RANGO NORMAL", "alto": "⬆️ VALORES SOBRE EL RANGO NORMAL"}
    cab = (f"Archivo: {rev['archivo']}\nPeriodo: {r['desde'] or '-'} a {r['hasta'] or '-'} · "
           f"{rev['filas']} filas · {r['equipos']} equipos\n")

    if skill == "analista":
        txt = (f"📊 REVISIÓN DEL ARCHIVO — {rev['plantilla']}\n\n{cab}\nRESULTADOS\n"
               f"• Filas correctas:          {r['validas']}\n• Errores de datos:         {r['errores']}\n"
               f"• Valores bajo el rango:    {r['bajos']}\n• Valores sobre el rango:   {r['altos']}\n"
               f"• Posibles fallas:          {r['fallas']}\n")
        if rev["estructura"]:
            txt += "\nESTRUCTURA\n" + "\n".join(f"⚠️ {e}" for e in rev["estructura"]) + "\n"
        for t, ps in grupos.items():
            if ps:
                txt += f"\n{titulos[t]}\n" + "\n".join(
                    f"  Fila {p['fila']:<4} {p['columna']:<20} {p['valor'] or '(vacío)':>8}  {p['mensaje']}" for p in ps[:12])
                txt += f"\n  ... y {len(ps) - 12} más." if len(ps) > 12 else ""
                txt += "\n"
        return txt + ("\n✅ Todo el archivo está dentro de los rangos." if not probs and not rev["estructura"] else
                      "\nRecomendación: corrige los errores en el archivo original y vuelve a subirlo; "
                      "las fallas deben quedar registradas en una orden de mantenimiento.")

    if skill == "puntos":
        lin = [f"• {rev['filas']} filas revisadas de {r['equipos']} equipos ({r['desde'] or '-'} a {r['hasta'] or '-'})."]
        lin += [f"• {e}" for e in rev["estructura"]]
        for t, ps in grupos.items():
            if ps:
                ej = ps[0]
                lin.append(f"• {len(ps)} {titulos[t].split(' ', 1)[1].lower()}. Ej.: fila {ej['fila']}, {ej['columna']} = {ej['valor'] or 'vacío'}.")
        clave = ("hay posibles fallas de máquina que revisar con mantenimiento" if grupos["falla"] else
                 "hay datos mal escritos que corregir antes de usar el archivo" if grupos["error"] else
                 "hay valores fuera de lo normal que conviene confirmar" if probs else "el archivo está correcto")
        return f"📌 RESUMEN — Revisión del archivo\n\n" + "\n".join(lin[:8]) + f"\n\n👉 Lo más importante:\n{clave[0].upper() + clave[1:]}."

    # simple
    pasos = []
    if rev["estructura"]:
        pasos.append("Al archivo le faltan columnas o tiene columnas de más. Compáralo con la plantilla.")
    if grupos["error"]:
        p = grupos["error"][0]
        pasos.append(f"Hay {len(grupos['error'])} datos mal escritos. Por ejemplo, en la fila {p['fila']} "
                     f"({p['columna']}) dice «{p['valor'] or 'nada'}». Revisa que sean números y fechas correctas.")
    if grupos["falla"]:
        p = grupos["falla"][0]
        pasos.append(f"Hay {len(grupos['falla'])} días en que una máquina pudo fallar (primera en la fila {p['fila']}). "
                     "Avisa a mantenimiento si no está reportado.")
    if grupos["bajo"] or grupos["alto"]:
        pasos.append(f"Hay {len(grupos['bajo'])} valores más bajos y {len(grupos['alto'])} más altos de lo normal. "
                     "No siempre es un error, pero conviene preguntar por qué.")
    if not pasos:
        pasos.append("Revisamos todo el archivo y los números están dentro de lo normal.")
    return ("💬 EN PALABRAS SIMPLES\n\nRevisamos tu archivo fila por fila, como quien revisa una planilla con una regla.\n\n"
            + "\n".join(f"{i + 1}. {x}" for i, x in enumerate(pasos))
            + "\n\n💡 Consejo: en la pantalla de gráfica puedes ver en qué días pasó cada cosa.")


_PENDIENTE = r"falta|revisar|pend|necesit|acuerda|pide|revisa|debe|recomienda|coordinar|confirmar"
_PARADA = r"detuvo|detenid|parada|par[oó] |falla|error|minutos|fuera de servicio|desconect|limitaci"
_SEGURIDAD = r"accidente|incidente|lesi[oó]n|herid|derrame|riesgo|sin epp|ca[ií]da de|golpe"
_PLAZO = r"hoy|mañana|lunes|martes|miércoles|jueves|viernes|sábado|domingo|esta semana|próxima semana|fin de mes"
_ESTADO = {"ok": "Dentro de rango", "alto": "Sobre el rango", "bajo": "Bajo el rango"}


def _tabla(cabecera: list[str], filas: list[list[str]]) -> str:
    """Tabla en texto: cada fila empieza con dos espacios y las columnas se separan con dos espacios."""
    limpia = lambda c: re.sub(r"\s{2,}", " ", str(c)).strip() or "—"
    return "\n".join("  " + "  ".join(limpia(c) for c in f) for f in [cabecera] + filas)


def _lista(xs: list[str], vacio: str = "") -> str:
    return "\n".join(f"• {x.rstrip('.')}." for x in xs) or (f"• {vacio}" if vacio else "")


def _cuantos(n: int, uno: str, varios: str) -> str:
    return f"{n} {uno if n == 1 else varios}"


def _plazo(texto: str, defecto: str = "Por definir") -> str:
    m = re.search(rf"\b({_PLAZO})\b", texto, re.I)
    if not m:
        return defecto
    p = m.group(1).lower()
    return p.capitalize() if p in ("hoy", "mañana") or " " in p else f"El {p}"


def _tabla_acciones(acciones: list[str], responsable: str = "Por definir", personas: list[str] | None = None,
                    titulo: str = "Acción") -> str:
    """Tabla 'acción · responsable · plazo'. El responsable se toma del texto si nombra a alguien conocido."""
    filas = []
    for i, a in enumerate(acciones, 1):
        quien = next((p for p in personas or [] if p.split()[0].lower() in a.lower()), responsable)
        filas.append([str(i), a.rstrip("."), quien, _plazo(a)])
    return _tabla(["N°", titulo, "Responsable", "Plazo"], filas)


def _firmas(autor: str) -> str:
    return f"Elaborado por: {autor}\nRevisado por: ____________________\nAprobado por: ____________________"


def _doc(cab: list[str], secs: list[tuple[str, str]]) -> str:
    return "\n".join(cab) + "\n\n" + "\n\n".join(f"{i + 1}. {n.upper()}\n{c}" for i, (n, c) in enumerate(secs))


def _doc_turno(d, autor, ors, hechos, acciones, cuando) -> list[tuple[str, str]]:
    mn, mx, _ = RANGOS_FORMULARIO["turno"]
    pmn, pmx, _ = RANGOS_FORMULARIO["lecturas"]
    turno = d.get("turno", "[completar]")
    gen = numero(re.sub(r"[^\d.,]", "", d.get("generacion", "")))
    paradas = [o for o in hechos if re.search(_PARADA, o, re.I)]
    seguridad = [o for o in ors if re.search(_SEGURIDAD, o, re.I)]
    trabajos = [o for o in hechos if re.search(r"limpi|manten|repar|cambi|reapret|ajust|reinici", o, re.I)]

    if gen is None:
        resumen = "No se informó la energía generada en el turno: [completar]. "
        filas = [["Energía generada", "[completar]", f"{fmt(mn)}–{fmt(mx)} MWh", "Sin dato"]]
    else:
        pot = gen / 8
        est = "ok" if mn <= gen <= mx else ("bajo" if gen < mn else "alto")
        est_p = "ok" if pmn <= pot <= pmx else ("bajo" if pot < pmn else "alto")
        frase = {"ok": "está dentro del rango normal", "bajo": "está por debajo del rango normal",
                 "alto": "está por encima del rango normal"}[est]
        resumen = (f"Durante el turno de {turno.split(' ')[0].lower()} se generaron {fmt(gen)} MWh, lo que equivale a una "
                   f"potencia media de {fmt(pot)} MW en las 8 horas del turno. El valor {frase} de la planta "
                   f"({fmt(mn)}–{fmt(mx)} MWh por turno). ")
        filas = [["Energía generada", f"{fmt(gen)} MWh", f"{fmt(mn)}–{fmt(mx)} MWh", _ESTADO[est]],
                 ["Potencia media", f"{fmt(pot)} MW", f"{fmt(pmn)}–{fmt(pmx)} MW", _ESTADO[est_p]]]
    horario = re.search(r"\((.+)\)", turno)
    filas.append(["Duración del turno", "8 horas", horario.group(1) if horario else "8 horas", "Completo"])
    resumen += (f"Se registraron {_cuantos(len(hechos), 'novedad', 'novedades')}"
                + (f", {len(paradas)} con efecto en la producción," if paradas else "")
                + f" y {_cuantos(len(acciones), 'pendiente queda', 'pendientes quedan')} para el siguiente turno.")

    produccion = _tabla(["Indicador", "Valor", "Referencia", "Estado"], filas) + "\n" + (
        "Eventos que afectaron la producción:\n" + _lista(paradas) if paradas
        else "No se registraron paradas ni limitaciones de producción en el turno.")
    seg = (_lista(seguridad) + "\n" if seguridad else "• No se reportaron accidentes ni incidentes durante el turno.\n")
    if trabajos:
        seg += (f"• Se {'hizo 1 trabajo' if len(trabajos) == 1 else f'hicieron {len(trabajos)} trabajos'} en equipos: "
                "confirmar que se cerraron los permisos de trabajo y se retiraron los bloqueos.\n")
    seg += "• Toda intervención en equipos se hace con bloqueo y etiquetado (LOTO) y con aviso al supervisor."
    return [("Resumen del turno", resumen),
            ("Producción", produccion),
            ("Novedades y eventos", _lista(hechos, "Sin novedades.")),
            ("Seguridad", seg),
            ("Pendientes", _tabla_acciones(acciones, "Turno entrante", titulo="Pendiente") if acciones else "• Ninguno."),
            ("Firmas", _firmas(autor))]


def _doc_falla(d, autor, ors) -> list[tuple[str, str]]:
    nivel = d.get("urgencia", "[completar]").split(" - ")[0]
    equipo, lugar = d.get("equipo", "[completar]"), d.get("ubicacion", "[completar]")
    txt = " ".join(ors).lower()
    plazo = {"Baja": "En la próxima parada programada", "Media": "Dentro de esta semana", "Alta": "Hoy mismo",
             "Crítica": "De inmediato"}.get(nivel, "Por definir")
    eq = buscar_equipo(equipo)
    tipo = eq["tipo"] if eq else next((k for k in ("aerogenerador", "inversor", "transformador") if k in equipo.lower()), "")

    desc = " ".join(o + "." for o in ors) or "[completar]"
    if len(ors) > 1:
        desc += "\nSíntomas observados:\n" + _lista(ors)

    perdida = (next((o for o in ors if re.search(r"producci|generaci", o, re.I)), "")
               or next((o for o in ors if re.search(r"detuvo|detenid|parad|no arranca|no enciende", o, re.I)), ""))
    impacto = [f"Pérdida de producción informada: {perdida[0].lower() + perdida[1:]}" if perdida else
               "No se informó pérdida de producción. Confirmar en el SCADA si el equipo sigue entregando energía",
               f"Equipo afectado: {equipo}, ubicado en {lugar}",
               {"aerogenerador": "Un aerogenerador detenido deja de entregar entre 30 y 50 MWh por día",
                "inversor": "Un inversor fuera de servicio deja sin producción a toda su fila de paneles (10 a 16 MWh por día)",
                "transformador": "Una falla del transformador puede dejar sin evacuación de energía a toda la planta",
                }.get(tipo, "El efecto sobre la generación debe confirmarse con operaciones"),
               f"Plazo de atención según la prioridad {nivel.lower()}: {plazo.lower()}"]

    riesgo = ("Existe riesgo para las personas. Aislar la zona, retirar al personal y no acercarse al equipo."
              if nivel == "Crítica" else
              "No se informó riesgo directo para las personas. Mantener la zona señalizada hasta la revisión.")
    riesgos = [msg for patron, msg in [
        (r"calient|temperatura|humo|quemad|olor", "Riesgo de quemaduras o de incendio: no tocar superficies calientes y tener un extintor a mano"),
        (r"ruido|vibra|zumbido|golpe", "Riesgo mecánico: no acercarse a partes en movimiento ni retirar protecciones"),
        (r"aceite|fuga|derrame|goteo", "Riesgo de resbalones y de contaminación: contener el derrame con material absorbente"),
        (r"error|voltaje|eléctric|electric|chispa|cable|tensión", "Riesgo eléctrico: no abrir gabinetes ni tableros sin bloqueo y verificación de ausencia de tensión"),
    ] if re.search(patron, txt)]
    if riesgos:
        riesgo += "\nRiesgos identificados según lo descrito:\n" + _lista(riesgos)

    inmediatas = ["Avisar al supervisor de turno y a mantenimiento", "Señalizar el equipo y la zona",
                  "No intervenir sin bloqueo y etiquetado (LOTO)"]
    if nivel in ("Alta", "Crítica"):
        inmediatas.append("Mantener a una persona a cargo de la zona hasta que llegue mantenimiento")
    recomendadas = _tabla(["N°", "Acción", "Responsable", "Plazo"], [
        ["1", "Diagnóstico en sitio con el equipo bloqueado", "Mantenimiento", plazo],
        ["2", "Revisar el historial de alarmas y mediciones en el SCADA", "Operaciones", "Hoy"],
        ["3", "Verificar repuestos disponibles en bodega", "Mantenimiento", "Antes de intervenir"],
        ["4", "Registrar la orden de trabajo, el tiempo fuera de servicio y el cierre", "Supervisor de turno", "Al terminar"],
    ])
    return [("Descripción de la falla", desc), ("Impacto en la operación", _lista(impacto)),
            ("Riesgo para personas", riesgo), ("Acciones inmediatas", _lista(inmediatas)),
            ("Acciones recomendadas", recomendadas), ("Firmas", _firmas(autor))]


def _doc_acta(d, autor, hechos, acciones, hoy) -> list[tuple[str, str]]:
    personas = [re.sub(r"\(.*?\)", "", p).strip() for p in re.split(r",|\by\b", d.get("asistentes", ""))]
    personas = [p for p in personas if p]
    return [
        ("Objetivo de la reunión", f"Dejar constancia de los temas tratados y de los acuerdos tomados en la reunión del {hoy}, "
                                   f"con {_cuantos(len(personas), 'asistente', 'asistentes')}."),
        ("Asistentes", _lista(personas, "[completar]")),
        ("Temas tratados", _lista(hechos or acciones, "[completar]")),
        ("Acuerdos y compromisos", _tabla_acciones(acciones, personas=personas, titulo="Acuerdo") if acciones
         else "• No se registraron acuerdos en las notas."),
        ("Próximos pasos", _lista(["Enviar esta acta a los asistentes para su revisión en un plazo de 2 días hábiles",
                                   "Si no hay observaciones en ese plazo, el acta se da por aprobada",
                                   "Cada responsable informa el avance de su compromiso en la próxima reunión"])),
        ("Firmas", _firmas(autor)),
    ]


def _doc_compra(d, autor, ors, planta) -> list[tuple[str, str]]:
    art, cant = d.get("articulo", "[completar]"), d.get("cantidad", "[completar]")
    txt = " ".join(ors).lower()
    impacto = [msg for patron, msg in [
        (r"obligator|segur|certific|norma|epp", "Se incumple un requisito de seguridad y los trabajos asociados tendrían que suspenderse"),
        (r"venc", "El material actual quedará vencido y no podrá seguir usándose"),
        (r"manten|repuesto|falla|deten|parad|fuga", "Se arriesga la continuidad de operación del equipo y se alargan los tiempos de parada"),
    ] if re.search(patron, txt)] or ["La necesidad descrita queda sin atender y puede afectar la operación normal del área"]
    return [
        ("Objetivo", f"Solicitar la compra de {cant} de {art[0].lower() + art[1:]} para {planta}."),
        ("Detalle de lo solicitado", _tabla(["Ítem", "Descripción", "Cantidad", "Requisito"],
                                            [["1", art, cant, "Con ficha técnica y certificado vigente"]])),
        ("Justificación", " ".join(o + "." for o in ors) or "[completar]"),
        ("Impacto si no se aprueba", _lista(impacto)),
        ("Próximos pasos", _tabla(["N°", "Paso", "Responsable", "Plazo"], [
            ["1", "Pedir al menos 3 cotizaciones", "Compras", "5 días hábiles"],
            ["2", "Verificar presupuesto disponible y centro de costo", "Administración", "2 días hábiles"],
            ["3", "Aprobar la solicitud", "Jefatura del área", "Al recibir las cotizaciones"],
            ["4", "Emitir la orden de compra y coordinar la entrega", "Compras", "Tras la aprobación"],
        ])),
        ("Firmas", _firmas(autor)),
    ]


def _pares(d: dict) -> list[tuple[str, float]]:
    txt = "\n".join(str(v) for v in d.values())
    return [(k.strip(), numero(v)) for k, v in re.findall(r"^[ \t]*([^\n:]+?):[ \t]*([\d.,]+)[ \t]*$", txt, flags=re.M)
            if numero(v) is not None]


def _doc_informe(d, autor, pares) -> list[tuple[str, str]]:
    tot = sum(v for _, v in pares)
    prom = tot / len(pares)
    (kmx, mx), (kmn, mn) = max(pares, key=lambda p: p[1]), min(pares, key=lambda p: p[1])
    pct = lambda v: f"{_num(v / tot * 100)} %" if tot else "—"
    bajos = [(k, v) for k, v in pares if v < prom * 0.6]
    analisis = [f"{kmx} aportó el {pct(mx)} de la generación del periodo",
                f"La diferencia entre la instalación de mayor y la de menor generación es de {_num(mx - mn)} MWh"]
    analisis += [f"{k} generó un {_num(100 - v / prom * 100)} % menos que el promedio: conviene revisar su disponibilidad "
                 "y si tuvo paradas en el periodo" for k, v in bajos]
    if not bajos:
        analisis.append("Ninguna instalación quedó muy por debajo del promedio")
    return [
        ("Objetivo", f"Informar la generación de energía de {d.get('periodo') or 'el periodo'} por instalación "
                     "y destacar los resultados que requieren atención."),
        ("Generación por instalación", _tabla(["Instalación", "Energía (MWh)", "Participación"],
                                              [[k, _num(v), pct(v)] for k, v in pares] + [["Total", _num(tot), "100 %"]])),
        ("Resultados", f"Generación total: {_num(tot)} MWh\nPromedio por instalación: {_num(prom)} MWh\n"
                       f"Mayor generación: {kmx} ({_num(mx)} MWh)\nMenor generación: {kmn} ({_num(mn)} MWh)"),
        ("Análisis", _lista(analisis)),
        ("Recomendaciones", _lista(["Confirmar estos valores con los medidores oficiales (SCADA) antes de enviarlos",
                                    "Comparar el total con la meta y con el mismo periodo del año anterior",
                                    "Adjuntar el detalle de paradas y mantenimientos de las instalaciones con menor generación"])),
        ("Firmas", _firmas(autor)),
    ]


def _doc_inspeccion(d, autor, ev, acciones, hoy) -> list[tuple[str, str]]:
    eq = ev["equipo"]
    fuera = [m for m in ev["medidas"] if m["estado"] != "ok"]
    grave = ev["gravedad"] in ("Grave", "Crítica")
    falla = (f"Tipo: {ev['falla']}\nGravedad: {ev['gravedad']}" + (f"\n{ev['detalle']}" if ev["detalle"] else "")
             if ev["falla"] else "No se encontraron fallas en la inspección." + (f"\n{ev['detalle']}" if ev["detalle"] else ""))
    if not ev["medidas"]:
        evaluacion = "No se registraron mediciones en esta inspección."
    elif fuera:
        evaluacion = (f"{len(fuera)} de {len(ev['medidas'])} mediciones están fuera del rango normal: "
                      + "; ".join(f"{m['label'].lower()} {fmt(m['valor'])} {m['unidad']} ({_ESTADO[m['estado']].lower()})"
                                  for m in fuera) + ".")
    else:
        evaluacion = f"Las {len(ev['medidas'])} mediciones están dentro del rango normal."
    evaluacion += "\n" + ("Conclusión: el equipo NO debe volver a operar hasta que mantenimiento lo autorice." if grave else
                          "Conclusión: el equipo puede seguir en operación bajo seguimiento, con una nueva medición en el próximo turno."
                          if fuera or ev["falla"] else "Conclusión: el equipo está en condiciones normales de operación.")
    pasos = [[f"Volver a medir {m['label'].lower()} y comparar con este registro", "Operador de turno", "Próximo turno"] for m in fuera]
    if ev["falla"]:
        pasos.append([f"Abrir orden de trabajo por {ev['falla'].lower()} ({ev['gravedad'].lower()})", "Mantenimiento",
                      "De inmediato" if grave else "Esta semana"])
    pasos += [[a.rstrip("."), "Por definir", _plazo(a)] for a in acciones]
    pasos.append(["Registrar esta inspección en el historial del equipo", autor, "Hoy"])
    return [
        ("Objetivo", f"Registrar el estado del {eq['nombre'] if eq else d.get('equipo', 'equipo')} en la inspección del {hoy} "
                     "y dejar definidas las acciones a seguir."),
        ("Mediciones", _tabla(["Variable", "Valor medido", "Rango normal", "Resultado"],
                              [[m["label"], f"{fmt(m['valor'])} {m['unidad']}", f"{fmt(m['min'])}–{fmt(m['max'])} {m['unidad']}",
                                _ESTADO[m["estado"]]] for m in ev["medidas"]]) if ev["medidas"] else "[completar]"),
        ("Falla encontrada", falla),
        ("Evaluación", evaluacion),
        ("Acciones y próximos pasos", _tabla(["N°", "Acción", "Responsable", "Plazo"],
                                             [[str(i), *p] for i, p in enumerate(pasos, 1)])),
        ("Firmas", _firmas(autor)),
    ]


def _formal(area, t, d, nombre, planta, ors, cortos, label, area_txt, cuando=None) -> str:
    """Documento con formato de empresa: título, código, campos 'Campo: valor', secciones numeradas y firmas."""
    cuando = cuando or datetime.now()
    hoy = fecha_larga(cuando)
    fid = FORMATO_DE_TAREA.get(t["id"])
    acciones = [o for o in ors if re.search(_PENDIENTE, o, re.I)]
    hechos = [o for o in ors if o not in acciones]
    autor = d.get("operador") or nombre or "[completar]"

    if fid:   # formatos oficiales: reporte de turno y aviso de falla
        f = FORMATOS[fid]
        cab = [f["nombre"].upper(), f"Código: {f['codigo']} · Revisión: {f['revision']}", f"{planta} — {f['area']}", ""]
        if fid == "turno":
            gen = d.get("generacion", "").strip()
            cab += [f"Fecha: {hoy}", f"Turno: {d.get('turno', '[completar]')}", f"Operador: {autor}",
                    f"Energía generada: {gen + ' MWh' if gen and 'mwh' not in gen.lower() else gen or '[completar]'}"]
            return _doc(cab, _doc_turno(d, autor, ors, hechos, acciones, cuando))
        cab += [f"Fecha y hora: {hoy}, {cuando:%H:%M}", f"Equipo: {d.get('equipo', '[completar]')}",
                f"Ubicación: {d.get('ubicacion', '[completar]')}", f"Prioridad: {d.get('urgencia', '[completar]').split(' - ')[0]}",
                f"Reportado por: {nombre or '[completar]'}"]
        return _doc(cab, _doc_falla(d, nombre or "[completar]", ors))

    # Documentos formales sin código oficial (actas, solicitudes, informes, inspecciones…)
    cab = [t["nombre"].upper(), f"{planta} — {area_txt}", "", f"Fecha: {hoy}"]
    ev = evaluar(d) if t["id"] == "inspeccion" else None
    omitir = {m["var"] for m in ev["medidas"]} | {"falla", "gravedad"} if ev else {"asistentes"}  # van en su sección
    cab += [f"{label[c['id']]}: {d[c['id']]}" for c in cortos if c["id"] not in omitir]
    if ev and ev["equipo"]:
        cab.append(f"Ubicación: {ev['equipo']['ubicacion']}")
    cab.append(f"Elaborado por: {autor}")

    if t["id"] == "acta":
        return _doc(cab, _doc_acta(d, autor, hechos, acciones, hoy))
    if t["id"] == "compra":
        return _doc(cab, _doc_compra(d, autor, ors, planta))
    if t["id"] == "informe" and len(_pares(d)) > 1:
        return _doc(cab, _doc_informe(d, autor, _pares(d)))
    if ev:
        return _doc(cab, _doc_inspeccion(d, autor, ev, acciones, hoy))

    secs = [("Descripción", " ".join(o + "." for o in ors) or "[completar]")]
    if len(hechos) > 1:
        secs.append(("Puntos principales", _lista(hechos)))
    secs.append(("Acciones y próximos pasos", _tabla_acciones(acciones) if acciones
                 else "• Dar seguimiento a lo descrito y registrar el cierre."))
    if d.get("urgencia"):
        extra = " Se solicita atención inmediata del equipo de mantenimiento." if re.search(r"Crítica|Alta", d["urgencia"]) else ""
        secs.append(("Prioridad", d["urgencia"] + "." + extra))
    secs.append(("Firmas", _firmas(autor)))
    return _doc(cab, secs)


def _formato(rev: dict) -> str:
    """Respuesta simulada de un skill de formato: veredicto, lo que está bien y lo que falta."""
    ok = [c for c in rev["checks"] if c["ok"]]
    mal = [c for c in rev["checks"] if not c["ok"]]
    res = "✅ ACEPTADO" if rev["aceptado"] else "❌ NO ACEPTADO"
    pct = round(rev["cumple"] / max(rev["total"], 1) * 100)
    grupos = list(dict.fromkeys(c["grupo"] for c in rev["checks"]))
    detalle = _tabla(["Parte del formato", "Cumple", "Estado"], [
        [g, f"{sum(c['ok'] for c in rev['checks'] if c['grupo'] == g)} de {sum(c['grupo'] == g for c in rev['checks'])}",
         "Completo" if all(c["ok"] for c in rev["checks"] if c["grupo"] == g) else "Con observaciones"] for g in grupos])
    txt = ("REVISIÓN DE FORMATO\n"
           f"Documento: {rev['archivo']}\nFormato: {rev['nombre']} ({rev['codigo']}, rev. {rev['revision']})\n"
           f"Resultado: {res}\nCumplimiento: {rev['cumple']} de {rev['total']} puntos ({pct} %)\n"
           f"Extensión: {rev.get('palabras', 0)} palabras\n\n"
           "1. RESUMEN DE LA REVISIÓN\n" + detalle
           + "\n\n2. LO QUE ESTÁ BIEN\n" + ("\n".join(f"• {c['grupo']} — {c['label']}." for c in ok) or "• Nada todavía.")
           + "\n\n3. LO QUE FALTA O HAY QUE CORREGIR\n"
           + ("\n".join(f"• {c['grupo']} — {c['label']}: {c['detalle']}" for c in mal) or "• Nada. El documento cumple el formato.")
           + "".join(f"\n• {o}" for o in rev["observaciones"]))
    if rev["aceptado"]:
        pasos = ["Guarda el documento con su nombre definitivo.", "Pide las firmas de revisión y aprobación.",
                 "Envíalo o archívalo según el procedimiento de tu área."]
        rec = "El documento cumple el formato oficial y puede enviarse."
    else:
        paso = lambda c: (
            (f"Agrega la sección «{c['label'].upper()}» con su título numerado y escribe su contenido."
             if "Falta" in c["detalle"] else f"Completa la sección «{c['label'].upper()}»: está vacía.")
            if c["grupo"] == "Secciones" else
            f"Corrige el campo «{c['label']}» del encabezado. {c['detalle']}" if c["grupo"] == "Campos" else
            f"Corrige el encabezado. {c['detalle']}")
        pasos = [paso(c) for c in mal[:8]]
        pasos += ["Revisa que las secciones queden numeradas y en el orden del formato oficial.",
                  "Vuelve a subir el documento para confirmar que se acepta."]
        rec = (f"Corrige los {len(mal) + len(rev['observaciones'])} puntos indicados y vuelve a subirlo. "
               f"Puedes descargar la plantilla oficial {rev['codigo']} para no olvidar ninguna sección.")
    return (txt + f"\n\n4. {'QUÉ HACER AHORA' if rev['aceptado'] else 'CÓMO CORREGIRLO PASO A PASO'}\n"
            + "\n".join(f"{i}. {p}" for i, p in enumerate(pasos, 1)) + f"\n\n5. RECOMENDACIÓN\n{rec}")


def simular(area: str, t: dict, skill: str, d: dict, nombre: str, planta: str, revision: dict | None = None,
            cuando: datetime | None = None) -> str:
    """`cuando` fecha el documento (solo lo usan los datos de ejemplo del historial); por defecto, ahora."""
    if t["id"] == "archivo" and revision:
        return _archivo(skill, revision)
    label = {c["id"]: c["label"] for c in t["campos"]}
    campos = [c for c in t["campos"] if d.get(c["id"])]
    cortos = [c for c in campos if c["tipo"] != "area"]
    largo = ". ".join(d[c["id"]] for c in campos if c["tipo"] == "area")
    ors = _oraciones(largo)
    firma = nombre or "[Tu nombre]"
    area_txt = "Operaciones de Planta" if area == "planta" else "Administración"

    if t["id"] == "formato" and revision:
        return _formato(revision)

    if skill == "formal":
        return _formal(area, t, d, nombre, planta, ors, cortos, label, area_txt, cuando)

    if skill == "puntos":
        clave = next((o for o in ors if re.search(r"falta|error|ruido|detuvo|penaliz|fuga|baj|vence|pide|retras", o, re.I)),
                     ors[0] if ors else "Sin novedades relevantes")
        return (f"📌 RESUMEN — {t['nombre']}\n\n"
                + "".join(f"• {label[c['id']]}: {d[c['id']]}\n" for c in cortos)
                + "\n".join(f"• {o}" for o in ors[:7])
                + f"\n\n👉 Lo más importante:\n{clave}.")

    if skill == "simple":
        if t["id"] == "procedimiento":
            return (f"💬 EXPLICACIÓN FÁCIL\n\nTu pregunta: “{d.get('pregunta', '')}”\n\n"
                    "Piénsalo así: antes de tocar un equipo eléctrico, hay que asegurarse de que NADIE pueda "
                    "encenderlo mientras trabajas.\n\nPaso a paso:\n"
                    "1. Avisa a tu supervisor y a los compañeros de la zona.\n"
                    "2. Apaga el equipo de forma normal.\n"
                    "3. Corta la energía en el interruptor o seccionador principal.\n"
                    "4. Pon TU candado personal y TU etiqueta con tu nombre.\n"
                    "5. Comprueba con el medidor que no hay tensión.\n"
                    "6. Recién ahora puedes trabajar.\n"
                    "7. Al terminar, solo TÚ quitas tu candado.\n\n"
                    "💡 Consejo: si tienes cualquier duda, no sigas. Pregunta primero.\n"
                    "(Ejemplo de práctica: siempre sigue el procedimiento oficial de tu planta.)")
        consejo = ("Mientras llega mantenimiento, no te acerques al equipo si está caliente o hace ruido."
                   if t["id"] == "falla" else "Si algo no queda claro, pregunta a tu jefe directo.")
        urg = f"¿Es urgente? {d['urgencia']}.\n" if d.get("urgencia") else ""
        return ("💬 EN PALABRAS SIMPLES\n\n" + "\n".join(f"{i + 1}. {o}." for i, o in enumerate(ors[:5]))
                + f"\n\n{urg}💡 En resumen: {ors[0] if ors else 'no hay información suficiente'}. {consejo}")

    if skill == "checklist":
        eq = d.get("equipo", "el equipo")
        base = ["Usar casco, lentes, guantes y zapatos de seguridad", "Avisar al supervisor de turno antes de empezar",
                "Confirmar que el equipo está sin energía (bloqueo y etiquetado)",
                "Verificar que no hay tensión con el medidor", "Señalizar la zona de trabajo"]
        clave = next((k for k in CHECK_EQUIPOS if k in eq.lower()), None)
        extra = CHECK_EQUIPOS[clave] if clave else [f"Revisar: {o.lower()}" for o in ors]
        if t["id"] == "procedimiento":
            # La pregunta no trae un campo "equipo": se busca en el texto y se arma la lista del trabajo consultado.
            pregunta = d.get("pregunta", "")
            clave = next((k for k in CHECK_EQUIPOS if k in pregunta.lower()), None)
            eq = f"{clave.capitalize()} (según tu consulta)" if clave else "El equipo de tu consulta"
            extra = ["Identificar todas las fuentes de energía del equipo (eléctrica, mecánica, hidráulica)",
                     "Colocar candado y etiqueta personal en cada punto de corte",
                     "Probar el arranque para confirmar que el equipo no enciende",
                     "Tener a mano el procedimiento oficial y el permiso de trabajo firmado"] + (CHECK_EQUIPOS[clave] if clave else [])
        if d.get("falla") and d["falla"] != "Sin falla":
            extra = extra + [f"Revisar la falla encontrada: {d['falla'].lower()} ({d.get('gravedad', '').lower()}) y registrar su avance"]
        elif d.get("observaciones"):
            extra = extra + [f"Revisar lo observado la última vez: {d['observaciones']}"]
        ubic = f" · Ubicación: {d['ubicacion']}" if d.get("ubicacion") else ""
        ev = evaluar(d) if t["id"] == "inspeccion" else None
        medidas = ""
        if ev and ev["equipo"]:
            ubic = f"\nUbicación: {ev['equipo']['ubicacion']}"
            fuera = [m for m in ev["medidas"] if m["estado"] != "ok"]
            extra = [f"Volver a medir {m['label'].lower()}: salió {'alto' if m['estado'] == 'alto' else 'bajo'} "
                     f"({fmt(m['valor'])} {m['unidad']})" for m in fuera] + extra
            medidas = "\n\nMEDICIONES DE HOY\n" + "\n".join(
                f"  {m['label']}  {fmt(m['valor'])} {m['unidad']}  {fmt(m['min'])}–{fmt(m['max'])} {m['unidad']}  "
                f"{'✅ Normal' if m['estado'] == 'ok' else '⚠️ ' + ('Alto' if m['estado'] == 'alto' else 'Bajo')}"
                for m in ev["medidas"])
            if ev["falla"]:
                medidas += (f"\n\nFALLA ENCONTRADA\nTipo: {ev['falla']}\nGravedad: {ev['gravedad']}"
                            + (f"\nDetalle: {ev['detalle']}" if ev["detalle"] else ""))
                if ev["gravedad"] in ("Grave", "Crítica"):
                    base.insert(0, "NO poner el equipo en marcha hasta que mantenimiento lo autorice")
        consulta = f"\nConsulta: {d['pregunta']}" if t["id"] == "procedimiento" and d.get("pregunta") else ""
        return (f"🦺 LISTA DE VERIFICACIÓN — {t['nombre']}\nEquipo: {eq}{ubic}{consulta}\nFecha: {_fecha(cuando)}{medidas}\n\n"
                "ANTES DE EMPEZAR (seguridad)\n" + "\n".join(f"☐ {x}" for x in base)
                + "\n\nREVISIÓN\n" + "\n".join(f"☐ {x}" for x in extra)
                + "\n\nAL TERMINAR\n☐ Retirar herramientas y dejar la zona limpia\n"
                  "☐ Retirar bloqueo (solo quien lo puso)\n☐ Registrar lo encontrado y avisar al supervisor\n\n"
                  "Firma: ____________________")

    if skill == "analista" and t["id"] == "turno":
        gen = float(re.sub(r"[^\d.,]", "", d.get("generacion", "0")).replace(",", ".") or 0)
        paradas = [o for o in ors if re.search(r"detuvo|parada|falla|error|minutos", o, re.I)]
        return (f"📊 ANÁLISIS DEL TURNO — {d.get('turno', '')}\n\n"
                f"• Energía generada:   {_num(gen)} MWh\n"
                f"• Potencia media:     {_num(gen / 8)} MW (turno de 8 horas)\n\n"
                "EVENTOS QUE AFECTAN LA PRODUCCIÓN\n"
                + ("\n".join(f"⚠️ {o}." for o in paradas) or "✅ No se registraron paradas.")
                + "\n\nPENDIENTES\n"
                + ("\n".join(f"☐ {o}." for o in ors if re.search(r"falta|revisar|pend", o, re.I)) or "Ninguno.")
                + "\n\nRecomendación: compara la energía generada con el pronóstico del día en el SCADA.")

    if skill == "analista":
        txt = "\n".join(str(v) for v in d.values())
        pares = [(k.strip(), float(v.replace(",", ".")))
                 for k, v in re.findall(r"^[ \t]*([^\n]+?):[ \t]*([\d.,]+)[ \t]*$", txt, flags=re.M)]
        nums = [v for _, v in pares] or [float(n.replace(",", ".")) for n in re.findall(r"\d+(?:[.,]\d+)?", txt)]
        if not nums:
            return "📊 No encontré números para analizar. Escribe los valores, por ejemplo:  10:00: 52"
        tot, prom, mx, mn = sum(nums), sum(nums) / len(nums), max(nums), min(nums)
        u = "MW" if t["id"] == "lecturas" else "MWh"
        nom = lambda v: f" ({next(k for k, x in pares if x == v)})" if pares else ""
        tabla = "".join(f"  {k:<24} {_num(v):>8} {u} {'█' * max(1, round(v / mx * 20))}\n" for k, v in pares)
        raros = [(k, v) for k, v in pares if v < prom * 0.6]
        alertas = ("\n".join(f"⚠️ {k}: {_num(v)} {u}, un {_num(100 - v / prom * 100)}% por debajo del promedio. Conviene revisar."
                             for k, v in raros) or "✅ No se ven valores fuera de lo normal.")
        nota = f"Nota: con {_num(tot)} MWh en 8 horas, la potencia media fue de {_num(tot / 8)} MW.\n" if t["id"] == "turno" else ""
        per = f" · {d['periodo']}" if d.get("periodo") else ""
        # Interpretación: qué significan los números, en frases cortas.
        lectura = [f"Se analizaron {len(nums)} valores; la diferencia entre el mayor y el menor es de {_num(mx - mn)} {u}."]
        if t["id"] == "lecturas":
            rmn, rmx, _ = RANGOS_FORMULARIO["lecturas"]
            fuera = [(k, v) for k, v in pares if v < rmn or v > rmx]
            lectura.append(f"{len(pares) - len(fuera)} de {len(pares)} lecturas están dentro del rango normal de la planta "
                           f"({_num(rmn)}–{_num(rmx)} {u})." if pares else "")
            lectura += [f"{k}: {_num(v)} {u} está {'bajo' if v < rmn else 'sobre'} el rango normal." for k, v in fuera]
        elif pares and tot:
            lectura.append(f"{nom(mx).strip(' ()')} concentra el {_num(mx / tot * 100)} % del total y "
                           f"{nom(mn).strip(' ()')} el {_num(mn / tot * 100)} %.")
        interpretacion = "INTERPRETACIÓN\n" + "\n".join(f"• {x}" for x in lectura if x) + "\n\n"
        return (f"📊 ANÁLISIS DE DATOS — {t['nombre']}{per}\n\n{tabla}\nRESULTADOS\n"
                f"• Total:     {_num(tot)} {u}\n• Promedio:  {_num(prom)} {u}\n"
                f"• Máximo:    {_num(mx)} {u}{nom(mx)}\n• Mínimo:    {_num(mn)} {u}{nom(mn)}\n\n"
                f"{interpretacion}ALERTAS\n{alertas}\n\n{nota}"
                "Recomendación: confirma estos números con el sistema de medición oficial (SCADA) antes de enviarlos.")

    if skill == "correo":
        para = d.get("para") or ("Área de Compras" if t["id"] == "compra" else "[completar]")
        tema = d.get("tema") or f"{t['nombre']}: {d.get('articulo', '')}".rstrip(": ")
        cant = f" Necesitamos {d['cantidad']}." if d.get("cantidad") else ""
        pedido = "confirmarnos una nueva fecha a la brevedad" if t["id"] == "correo" else "gestionar esta solicitud a la brevedad"
        asunto = (d.get("tema") or d.get("articulo") or t["nombre"])
        contexto = ors[0] + "." if ors else ""
        puntos = ors[1:]
        cuerpo = (f"Espero que se encuentre bien. Le escribo en nombre de {planta} en relación con "
                  f"{asunto[0].lower() + asunto[1:]}.\n\n{contexto}{cant}")
        if puntos:
            cuerpo += "\n\nPara que tenga el detalle completo:\n" + "\n".join(f"• {o}." for o in puntos)
        return (f"Para: {para}\nAsunto: {tema}\n\nEstimado/a {re.split(r'[(,]', para)[0].strip()}:\n\n{cuerpo}"
                f"\n\nLe agradeceríamos {pedido} y, si es posible, indicarnos por este medio la persona de contacto "
                "para hacer el seguimiento.\n\nQuedo atento/a a su respuesta y a su disposición para cualquier consulta.\n\n"
                f"Saludos cordiales,\n{firma}\n{planta} — {area_txt}")

    return "Skill no reconocido."
