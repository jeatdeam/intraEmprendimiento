"""Simulador de respuestas de IA.

Se usa en el MODO PRÁCTICA (datos falsos) y cuando no hay clave de IA
configurada. Produce resultados creíbles sin llamar a ningún servicio
externo, para que el empleado aprenda qué hace cada skill.
"""
import re
from datetime import date, datetime

from .equipos import evaluar
from .formatos import FORMATO_DE_TAREA, FORMATOS, fecha_larga
from .reglas import fmt

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


def _fecha() -> str:
    h = date.today()
    return f"{DIAS[h.weekday()]}, {h.day} de {MESES[h.month - 1]} de {h.year}"


def _oraciones(txt: str) -> list[str]:
    partes = re.split(r"[.\n;]+|,\s*(?=[a-záéíóúñ]+\s)", txt, flags=re.I)
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


_PENDIENTE = r"falta|revisar|pend|necesit|acuerda|pide|revisa|debe|recomienda"


def _formal(area, t, d, nombre, planta, ors, cortos, label, area_txt) -> str:
    """Documento con formato de empresa: título, código, campos 'Campo: valor', secciones numeradas y firmas."""
    fid = FORMATO_DE_TAREA.get(t["id"])
    acciones = [o for o in ors if re.search(_PENDIENTE, o, re.I)]
    hechos = [o for o in ors if o not in acciones]
    autor = d.get("operador") or nombre or "[completar]"
    lista = lambda xs, vacio: "\n".join(f"• {x}." for x in xs) or f"• {vacio}"
    firmas = f"Elaborado por: {autor}\nRevisado por: ____________________\nAprobado por: ____________________"

    if fid:
        f = FORMATOS[fid]
        cab = [f["nombre"].upper(), f"Código: {f['codigo']} · Revisión: {f['revision']}", f"{planta} — {f['area']}", ""]
        if fid == "turno":
            gen = d.get("generacion", "").strip()
            cab += [f"Fecha: {fecha_larga()}", f"Turno: {d.get('turno', '[completar]')}", f"Operador: {autor}",
                    f"Energía generada: {gen + ' MWh' if gen and 'mwh' not in gen.lower() else gen or '[completar]'}"]
            cuerpo = {"Resumen del turno": (hechos[0] + "." if hechos else "Turno sin novedades relevantes."),
                      "Novedades y eventos": lista(hechos[1:] or hechos, "Sin novedades."),
                      "Pendientes": lista(acciones, "Ninguno.")}
        else:  # falla
            urg = d.get("urgencia", "[completar]")
            critica = bool(re.search(r"Crítica", urg))
            cab += [f"Fecha y hora: {fecha_larga()}, {datetime.now():%H:%M}", f"Equipo: {d.get('equipo', '[completar]')}",
                    f"Ubicación: {d.get('ubicacion', '[completar]')}", f"Prioridad: {urg.split(' - ')[0]}",
                    f"Reportado por: {nombre or '[completar]'}"]
            cuerpo = {"Descripción de la falla": " ".join(o + "." for o in ors) or "[completar]",
                      "Riesgo para personas": ("Existe riesgo para las personas. Aislar la zona y no acercarse al equipo."
                                               if critica else "No se informó riesgo directo para las personas. "
                                               "Mantener la zona señalizada hasta la revisión."),
                      "Acciones inmediatas": lista(["Avisar al supervisor de turno y a mantenimiento",
                                                    "Señalizar el equipo y la zona",
                                                    "No intervenir sin bloqueo y etiquetado (LOTO)"], "")}
        secs = [f"{i + 1}. {s['label'].upper()}\n{cuerpo.get(s['label'], firmas)}" for i, s in enumerate(f["secciones"])]
        return "\n".join(cab) + "\n\n" + "\n\n".join(secs)

    # Documento formal genérico (actas, solicitudes, informes…)
    cab = [t["nombre"].upper(), f"{planta} — {area_txt}", "", f"Fecha: {fecha_larga()}"]
    ev = evaluar(d) if t["id"] == "inspeccion" else None
    medida_ids = {m["var"] for m in ev["medidas"]} if ev else set()
    cab += [f"{label[c['id']]}: {d[c['id']]}" for c in cortos if c["id"] not in medida_ids]
    secs = []
    if ev and ev["medidas"]:
        secs.append(("MEDICIONES", "\n".join(
            f"  {m['label']}  {fmt(m['valor'])} {m['unidad']}  Normal {fmt(m['min'])}–{fmt(m['max'])} {m['unidad']}  "
            f"{'Dentro de rango' if m['estado'] == 'ok' else ('Sobre el rango' if m['estado'] == 'alto' else 'Bajo el rango')}"
            for m in ev["medidas"])))
    secs += [("DESCRIPCIÓN", " ".join(o + "." for o in ors) or "[completar]"),
            ("ACCIONES Y PRÓXIMOS PASOS", lista(acciones, "Dar seguimiento a lo descrito y registrar el cierre."))]
    if d.get("urgencia"):
        extra = " Se solicita atención inmediata del equipo de mantenimiento." if re.search(r"Crítica|Alta", d["urgencia"]) else ""
        secs.append(("PRIORIDAD", d["urgencia"] + "." + extra))
    secs.append(("FIRMAS", firmas))
    return "\n".join(cab) + "\n\n" + "\n\n".join(f"{i + 1}. {n}\n{c}" for i, (n, c) in enumerate(secs))


def _formato(rev: dict) -> str:
    """Respuesta simulada de un skill de formato: veredicto, lo que está bien y lo que falta."""
    ok = [c for c in rev["checks"] if c["ok"]]
    mal = [c for c in rev["checks"] if not c["ok"]]
    res = "✅ ACEPTADO" if rev["aceptado"] else "❌ NO ACEPTADO"
    txt = ("REVISIÓN DE FORMATO\n"
           f"Documento: {rev['archivo']}\nFormato: {rev['nombre']} ({rev['codigo']}, rev. {rev['revision']})\n"
           f"Resultado: {res}\nCumplimiento: {rev['cumple']} de {rev['total']} puntos\n\n"
           "1. LO QUE ESTÁ BIEN\n" + ("\n".join(f"• {c['label']}." for c in ok) or "• Nada todavía.")
           + "\n\n2. LO QUE FALTA O HAY QUE CORREGIR\n"
           + ("\n".join(f"• {c['label']}: {c['detalle']}" for c in mal) or "• Nada. El documento cumple el formato.")
           + "".join(f"\n• {o}" for o in rev["observaciones"]))
    rec = ("El documento cumple el formato oficial y puede enviarse."
           if rev["aceptado"] else
           f"Corrige los {len(mal) + len(rev['observaciones'])} puntos indicados y vuelve a subirlo. "
           f"Puedes descargar la plantilla oficial {rev['codigo']} para no olvidar ninguna sección.")
    return txt + f"\n\n3. RECOMENDACIÓN\n{rec}"


def simular(area: str, t: dict, skill: str, d: dict, nombre: str, planta: str, revision: dict | None = None) -> str:
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
        return _formal(area, t, d, nombre, planta, ors, cortos, label, area_txt)

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
        return (f"🦺 LISTA DE VERIFICACIÓN — {t['nombre']}\nEquipo: {eq}{ubic}\nFecha: {_fecha()}{medidas}\n\n"
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
        return (f"📊 ANÁLISIS DE DATOS — {t['nombre']}{per}\n\n{tabla}\nRESULTADOS\n"
                f"• Total:     {_num(tot)} {u}\n• Promedio:  {_num(prom)} {u}\n"
                f"• Máximo:    {_num(mx)} {u}{nom(mx)}\n• Mínimo:    {_num(mn)} {u}{nom(mn)}\n\n"
                f"ALERTAS\n{alertas}\n\n{nota}"
                "Recomendación: confirma estos números con el sistema de medición oficial (SCADA) antes de enviarlos.")

    if skill == "correo":
        para = d.get("para", "[destinatario]")
        tema = d.get("tema") or f"{t['nombre']}: {d.get('articulo', '')}".rstrip(": ")
        cant = f" Necesitamos {d['cantidad']}." if d.get("cantidad") else ""
        pedido = "confirmarnos una nueva fecha a la brevedad" if t["id"] == "correo" else "gestionar esta solicitud a la brevedad"
        return (f"Para: {para}\nAsunto: {tema}\n\nEstimado/a {re.split(r'[(,]', para)[0].strip()}:\n\n"
                f"Espero que se encuentre bien. Le escribo en relación con {(d.get('tema') or d.get('articulo') or t['nombre']).lower()}.\n\n"
                + " ".join(o + "." for o in ors) + cant
                + f"\n\nLe agradeceríamos {pedido}. Quedo atento/a a su respuesta.\n\n"
                  f"Saludos cordiales,\n{firma}\n{planta} — {area_txt}")

    return "Skill no reconocido."
