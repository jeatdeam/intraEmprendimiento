/**
 * Guía del chat "Usar IA": un árbol de RESPUESTAS PREDEFINIDAS en 3 etapas.
 *
 *   Etapa 1: la persona elige un tema       (3 opciones)
 *   Etapa 2: elige un detalle de ese tema   (3 opciones nuevas)
 *   Etapa 3: llega a la respuesta final     (fin del camino)
 *
 * No se llama a la IA: cada opción ya sabe qué responder y a dónde lleva.
 * Así se explica, con el mismo ejemplo, qué es un skill y cómo automatiza el trabajo.
 */
import type { Area } from "./types";

export interface Nodo {
  id: string;
  etiqueta: string;      // lo que dice el botón (y lo que "escribe" la persona al tocarlo)
  respuesta: string;     // respuesta predefinida (markdown sencillo: **negrita**, listas con "- " o "1. ")
  hijos?: Nodo[];        // las 3 opciones de la etapa siguiente; sin hijos = respuesta final
}

/** Mensaje tal como se ve en la ventana. `nodo` = vino de la guía (respuesta predefinida). */
export interface MensajeUI {
  role: "user" | "assistant";
  content: string;
  nodo?: string;
}

export const ETAPAS = 3;

// ───────────── Rama 3: un skill en acción (mismos datos, distinto skill) ─────────────

interface Ejemplo {
  id: string;
  nombre: string;
  datos: [string, string][];
  formal: string;
  puntos: string;
  simple: string;
}

const EJEMPLOS: Record<Area, Ejemplo[]> = {
  planta: [
    {
      id: "falla", nombre: "Reportar una falla",
      datos: [["Equipo", "Aerogenerador AG-07"], ["Hora", "06:40"], ["Qué pasó", "ruido fuerte en la caja multiplicadora, 88 °C (normal hasta 80 °C)"], ["Qué se hizo", "se detuvo la turbina"]],
      formal: "**AVISO DE FALLA**\nCódigo: OP-FAL-01 · Revisión: 02\n\n**1. DATOS DEL EQUIPO**\nEquipo: Aerogenerador AG-07\nHora del evento: 06:40\n\n**2. DESCRIPCIÓN**\nSe detectó ruido anormal en la caja multiplicadora con una temperatura de 88 °C, **8 °C sobre el límite** permitido.\n\n**3. ACCIÓN INMEDIATA**\nSe detuvo la turbina de forma preventiva.\n\n**4. FIRMAS**\nElaborado por: [completar]\nRevisado por: [completar]",
      puntos: "- **AG-07** detenido a las 06:40.\n- Ruido en la caja multiplicadora.\n- Temperatura **88 °C** (límite 80 °C).\n- Pendiente: revisión de mantenimiento.",
      simple: "Esta mañana, a las 06:40, la turbina AG-07 empezó a hacer un ruido fuerte en la pieza que convierte el giro de las aspas (la caja multiplicadora). Además estaba **más caliente de lo normal**, así que se apagó para evitar un daño mayor. Ahora falta que mantenimiento la revise.",
    },
    {
      id: "turno", nombre: "Reporte de turno",
      datos: [["Turno", "noche, 22:00 a 06:00"], ["Generación", "412 MWh"], ["Novedad", "el inversor INV-03 se reinició 2 veces"], ["Pendiente", "limpiar paneles del sector B"]],
      formal: "**REPORTE DE TURNO**\nCódigo: OP-TUR-01 · Revisión: 03\n\n**1. DATOS DEL TURNO**\nTurno: Noche (22:00 – 06:00)\nGeneración total: 412 MWh\n\n**2. NOVEDADES**\nEl inversor INV-03 presentó **2 reinicios** durante el turno.\n\n**3. PENDIENTES PARA EL SIGUIENTE TURNO**\nLimpieza de paneles del sector B.\n\n**4. FIRMAS**\nElaborado por: [completar]\nRecibido por: [completar]",
      puntos: "- Turno noche: **412 MWh**.\n- INV-03 se reinició **2 veces**: vigilar.\n- Pendiente: limpiar paneles del **sector B**.",
      simple: "El turno de noche fue tranquilo: la planta produjo 412 MWh. Lo único raro es que uno de los equipos que convierten la energía de los paneles (el inversor 3) **se apagó y prendió solo dos veces**, así que conviene vigilarlo. Quedó pendiente limpiar los paneles del sector B.",
    },
    {
      id: "inspeccion", nombre: "Inspección de transformador",
      datos: [["Equipo", "Transformador TR-02"], ["Aceite", "72 °C (normal hasta 85 °C)"], ["Silicagel", "color rosado"], ["Fugas", "no se observan"]],
      formal: "**INFORME DE INSPECCIÓN**\nCódigo: MT-INS-02 · Revisión: 01\n\n**1. EQUIPO**\nTransformador TR-02\n\n**2. MEDICIONES**\nTemperatura del aceite: 72 °C (dentro de rango)\nFugas: no se observan\n\n**3. OBSERVACIONES**\nEl silicagel presenta **color rosado**, lo que indica que está saturado de humedad.\n\n**4. RECOMENDACIÓN**\nProgramar el cambio de silicagel.",
      puntos: "- TR-02: aceite a **72 °C**, ✅ normal.\n- Sin fugas.\n- ⚠️ Silicagel **rosado**: está saturado.\n- Acción: programar el cambio.",
      simple: "El transformador TR-02 está bien de temperatura y no gotea aceite. Lo único: las bolitas que absorben la humedad (el silicagel) se pusieron **rosadas**, y eso significa que ya no absorben más. Hay que cambiarlas pronto, es un trabajo sencillo.",
    },
  ],
  oficina: [
    {
      id: "correo", nombre: "Escribir un correo",
      datos: [["Para", "jefatura de operaciones"], ["Pedido", "comprar 10 arneses de seguridad"], ["Motivo", "los actuales vencen en diciembre"]],
      formal: "**SOLICITUD DE COMPRA**\nCódigo: AD-COM-01 · Revisión: 02\n\n**1. DATOS**\nDirigido a: Jefatura de Operaciones\nArtículo: Arnés de seguridad\nCantidad: 10 unidades\n\n**2. JUSTIFICACIÓN**\nLos arneses en uso **vencen en diciembre** y deben reemplazarse para cumplir la norma de trabajo en altura.\n\n**3. FIRMAS**\nSolicitado por: [completar]\nAprobado por: [completar]",
      puntos: "- Pedido: **10 arneses** de seguridad.\n- Motivo: los actuales **vencen en diciembre**.\n- Para: jefatura de operaciones.",
      simple: "Hola, les escribo para pedir **10 arneses de seguridad nuevos**. Los que usamos ahora vencen en diciembre y, si no los cambiamos a tiempo, el equipo no podrá trabajar en altura. ¿Podemos aprobar la compra esta semana? Gracias.",
    },
    {
      id: "acta", nombre: "Acta de reunión",
      datos: [["Reunión", "seguridad, lunes 9:00"], ["Asistentes", "5 personas"], ["Acuerdos", "simulacro el 5 de diciembre y revisar extintores"]],
      formal: "**ACTA DE REUNIÓN**\nCódigo: AD-ACT-01 · Revisión: 01\n\n**1. DATOS**\nTema: Seguridad\nFecha y hora: lunes, 9:00\nAsistentes: 5\n\n**2. ACUERDOS**\n1. Realizar un **simulacro** el 5 de diciembre.\n2. Revisar todos los **extintores** de la planta.\n\n**3. FIRMAS**\nRedactado por: [completar]\nAprobado por: [completar]",
      puntos: "- Reunión de seguridad, lunes 9:00 (5 asistentes).\n- ✅ Simulacro: **5 de diciembre**.\n- ✅ Revisar **extintores**.",
      simple: "El lunes nos reunimos 5 personas para hablar de seguridad. Quedamos en dos cosas: hacer un **simulacro el 5 de diciembre** para practicar qué hacer en una emergencia, y **revisar que todos los extintores funcionen**.",
    },
    {
      id: "resumen", nombre: "Resumir un informe",
      datos: [["Informe", "mensual de la planta"], ["Generación", "9 % sobre la meta"], ["Paradas", "2 no programadas"], ["Mantenimiento", "4 % bajo el presupuesto"]],
      formal: "**RESUMEN EJECUTIVO**\nCódigo: AD-INF-03 · Revisión: 01\n\n**1. RESULTADOS**\nLa generación del mes superó la meta en **9 %**.\n\n**2. INCIDENCIAS**\nSe registraron **2 paradas no programadas**.\n\n**3. COSTOS**\nEl gasto de mantenimiento quedó **4 % bajo** lo presupuestado.\n\n**4. CONCLUSIÓN**\nMes positivo; se recomienda analizar la causa de las paradas.",
      puntos: "- Generación: **+9 %** sobre la meta.\n- **2 paradas** no programadas.\n- Mantenimiento: **4 % bajo** presupuesto.",
      simple: "Fue un buen mes: la planta produjo **más energía de la que se esperaba** y se gastó menos de lo previsto en mantenimiento. Lo que hay que mirar son las **dos veces que la planta se detuvo** sin estar planeado.",
    },
  ],
};

const SKILLS_DEMO: { id: "formal" | "puntos" | "simple"; nombre: string; que: string }[] = [
  { id: "formal", nombre: "Redactor formal", que: "un documento oficial con código, secciones y firmas" },
  { id: "puntos", nombre: "Resumen en puntos", que: "una lista corta para leer en segundos" },
  { id: "simple", nombre: "Explicar fácil", que: "una explicación sin palabras técnicas" },
];

function ramaProbar(area: Area): Nodo {
  return {
    id: "probar",
    etiqueta: "Quiero ver un skill en acción",
    respuesta:
      "¡Vamos a probar! Te mostraré cómo **los mismos datos** salen distintos según el skill.\n\n" +
      "Primero elige una **tarea**:",
    hijos: EJEMPLOS[area].map((e) => ({
      id: `probar.${e.id}`,
      etiqueta: e.nombre,
      respuesta:
        `Estos son los **datos** que escribió el empleado para "${e.nombre}":\n\n` +
        e.datos.map(([k, v]) => `- **${k}**: ${v}`).join("\n") +
        "\n\nAhora elige el **skill**, es decir, **cómo** quieres que la IA trabaje con esos datos:",
      hijos: SKILLS_DEMO.map((s) => ({
        id: `probar.${e.id}.${s.id}`,
        etiqueta: `${s.nombre}: ${s.que}`,
        respuesta:
          `Con el skill **${s.nombre}**, la IA entrega esto:\n\n${e[s.id]}\n\n` +
          "Fíjate: los datos fueron **los mismos**. Lo único que cambió fue el skill, que ya tenía guardadas " +
          "las instrucciones de formato. Eso es **automatizar**: tú eliges, la IA hace el trabajo repetitivo.",
      })),
    })),
  };
}

// ───────────── Ramas 1 y 2: qué es un skill y cómo automatiza ─────────────

const QUE_ES: Nodo = {
  id: "que",
  etiqueta: "¿Qué es un skill?",
  respuesta:
    "Un **skill** es una **habilidad guardada** que le das a la IA: instrucciones que alguien escribió **una sola vez** " +
    "(qué hacer, en qué orden y con qué formato) para que la IA las siga **siempre igual**.\n\n" +
    "Piénsalo como una **receta**: los ingredientes son tus datos y el skill dice cómo prepararlos.\n\n" +
    "¿Qué quieres saber ahora?",
  hijos: [
    {
      id: "que.vida",
      etiqueta: "Dame un ejemplo de la vida diaria",
      respuesta:
        "Imagina que le pides a un compañero \"haz el reporte del turno\". Si es nuevo, te pregunta cómo. " +
        "Si ya tiene la **costumbre** de hacerlo con título, fecha, novedades y firma, lo hace solo.\n\n" +
        "Esa costumbre es el skill: **la IA ya sabe cómo hacerlo** sin que se lo expliques cada vez.\n\n¿Qué más quieres ver?",
      hijos: [
        {
          id: "que.vida.formato",
          etiqueta: "¿Y si quiero otro formato?",
          respuesta:
            "Cambias de skill y listo. Los **mismos datos** pueden salir como:\n\n" +
            "- **Redactor formal**: documento para entregar a la jefatura.\n" +
            "- **Resumen en puntos**: para leer rápido en el turno.\n" +
            "- **Explicar fácil**: para alguien que no conoce el tema.\n\n" +
            "No reescribes nada: solo eliges otra habilidad.",
        },
        {
          id: "que.vida.crear",
          etiqueta: "¿Quién crea los skills?",
          respuesta:
            "Un skill se escribe **una sola vez**, normalmente por alguien que conoce bien el trabajo (un supervisor o el área de calidad). Se le indica:\n\n" +
            "1. **Qué rol** toma la IA (por ejemplo, un técnico revisor).\n" +
            "2. **Qué pasos** sigue.\n" +
            "3. **Qué formato** entrega.\n\n" +
            "Desde ahí, todo el equipo lo usa con **un solo toque**.",
        },
        {
          id: "que.vida.error",
          etiqueta: "¿La IA se puede equivocar con un skill?",
          respuesta:
            "Sí. El skill hace que la IA trabaje **ordenada y siempre igual**, pero no la vuelve perfecta. Por eso:\n\n" +
            "- **Lee siempre** el resultado antes de usarlo.\n" +
            "- Si falta un dato, la IA lo marca como **[completar]**.\n" +
            "- En seguridad mandan el **procedimiento oficial** y tu supervisor.",
        },
      ],
    },
    {
      id: "que.diferencia",
      etiqueta: "¿En qué se diferencia de preguntar normal?",
      respuesta:
        "Cuando **preguntas normal**, la IA improvisa: cada vez puede responder distinto y tú tienes que explicarle todo.\n\n" +
        "Con un **skill**, la forma de trabajar ya está definida:\n\n" +
        "- Mismo orden.\n- Mismo formato.\n- Mismas reglas de la empresa.\n\n" +
        "Resultado: respuestas **parejas** y listas para usar. ¿Qué quieres saber?",
      hijos: [
        {
          id: "que.diferencia.libre",
          etiqueta: "¿Cuándo conviene preguntar libre?",
          respuesta:
            "Pregunta libre cuando tienes una **duda puntual** o algo nuevo: qué significa una palabra, una idea para un mensaje, cómo explicar un tema.\n\n" +
            "Usa un **skill** cuando la tarea **se repite** (reportes, actas, avisos de falla) y debe salir siempre con el mismo formato.\n\n" +
            "En esta ventana puedes hacer las dos cosas: tocar opciones o escribir tu pregunta abajo.",
        },
        {
          id: "que.diferencia.parejas",
          etiqueta: "¿Por qué las respuestas salen parejas?",
          respuesta:
            "Porque el skill le da a la IA **las mismas instrucciones** cada vez. Es como un formulario: aunque lo llenen personas distintas, " +
            "todos los reportes tienen las **mismas secciones**.\n\n" +
            "Así tu supervisor encuentra la información **siempre en el mismo lugar**.",
        },
        {
          id: "que.diferencia.largo",
          etiqueta: "¿Tengo que escribir instrucciones largas?",
          respuesta:
            "No. Esa es la ventaja: las instrucciones largas **ya están dentro del skill**. Tú solo:\n\n" +
            "1. Eliges la **tarea**.\n2. Eliges el **skill**.\n3. Revisas tus **datos**.\n\n" +
            "La plataforma junta todo y se lo manda a la IA por ti.",
        },
      ],
    },
    {
      id: "que.lista",
      etiqueta: "¿Qué skills hay en esta plataforma?",
      respuesta:
        "Estos son los skills que puedes elegir en las tareas:\n\n" +
        "- **Redactor formal**: documento ordenado y profesional.\n" +
        "- **Resumen en puntos**: lo esencial, corto y claro.\n" +
        "- **Explicar fácil**: sin palabras técnicas.\n" +
        "- **Lista de seguridad**: pasos a revisar antes de trabajar.\n" +
        "- **Analista de datos**: revisa números y marca alertas.\n" +
        "- **Redactor de correos**: mensaje listo para enviar.\n\n" +
        "¿Sobre cuál quieres saber más?",
      hijos: [
        {
          id: "que.lista.formal",
          etiqueta: "Redactor formal",
          respuesta:
            "Convierte tus datos en un **documento oficial** de la empresa: título, **código y revisión** del formato, secciones numeradas y líneas de firma.\n\n" +
            "Si falta algo obligatorio, lo deja marcado como **[completar]** para que no se te pase.",
        },
        {
          id: "que.lista.seguridad",
          etiqueta: "Lista de seguridad",
          respuesta:
            "Arma una **lista de verificación** con casillas ☐ para revisar antes de un trabajo: equipo de protección, bloqueo de energía, condiciones del clima, permisos.\n\n" +
            "Recuerda: la lista **ayuda**, pero el procedimiento oficial y tu supervisor tienen la última palabra.",
        },
        {
          id: "que.lista.analista",
          etiqueta: "Analista de datos",
          respuesta:
            "Revisa números (lecturas, producción, temperaturas), saca **totales y promedios**, y compara cada valor con su **rango normal**.\n\n" +
            "Lo que está fuera de rango aparece marcado como **alerta**, así no tienes que revisar fila por fila.",
        },
      ],
    },
  ],
};

const AUTOMATIZA: Nodo = {
  id: "auto",
  etiqueta: "¿Cómo automatiza mi trabajo un skill?",
  respuesta:
    "Automatizar es que **la máquina haga los pasos repetitivos** por ti. Con un skill pasa así:\n\n" +
    "1. Tú das los **datos** (o tocas una opción).\n" +
    "2. La plataforma los junta con las **instrucciones del skill**.\n" +
    "3. La IA devuelve el **resultado con formato**.\n\n" +
    "Tú solo revisas. ¿Qué parte quieres entender mejor?",
  hijos: [
    {
      id: "auto.boton",
      etiqueta: "¿Qué pasa cuando toco un botón?",
      respuesta:
        "Cada botón tiene guardado **qué pedirle a la IA**. Al tocarlo, la plataforma arma el mensaje completo por ti:\n\n" +
        "- Quién eres y tu área.\n- La tarea elegida.\n- Las instrucciones del skill.\n- Tus datos.\n\n" +
        "No tienes que escribir nada de eso. ¿Qué quieres saber?",
      hijos: [
        {
          id: "auto.boton.tiempo",
          etiqueta: "¿Cuánto se demora?",
          respuesta:
            "Normalmente **unos segundos**. Mientras tanto la plataforma te muestra los pasos del skill (leer datos, ordenar, redactar, revisar) " +
            "para que veas qué está haciendo la IA.",
        },
        {
          id: "auto.boton.datos",
          etiqueta: "¿Mis datos se envían a alguien?",
          respuesta:
            "En **modo práctica** no se envía nada: todo son datos falsos y respuestas de ejemplo.\n\n" +
            "En **trabajo real**, tus datos van solo a la IA para generar el resultado y quedan en **tu historial**. " +
            "Igual, **nunca escribas contraseñas ni datos personales**.",
        },
        {
          id: "auto.boton.cambiar",
          etiqueta: "¿Puedo cambiar el resultado?",
          respuesta:
            "Sí. Si no te convence:\n\n- Prueba **otro skill** con los mismos datos.\n- Corrige tus datos y vuelve a enviar.\n- Copia el texto y ajústalo a mano.\n\n" +
            "El resultado es un **borrador**: la última palabra la tienes tú.",
        },
      ],
    },
    {
      id: "auto.predefinidas",
      etiqueta: "¿Qué son las respuestas predefinidas?",
      respuesta:
        "Son respuestas que **alguien preparó de antemano** para preguntas que se repiten. No hay que esperar a la IA: la respuesta ya está lista.\n\n" +
        "Justamente **estas opciones que estás tocando** son respuestas predefinidas: cada botón lleva a una respuesta ya escrita y a 3 opciones nuevas. " +
        "¿Qué quieres saber?",
      hijos: [
        {
          id: "auto.predefinidas.arbol",
          etiqueta: "¿Cómo se arma este camino de opciones?",
          respuesta:
            "Es un **árbol de decisiones** de 3 etapas:\n\n" +
            "1. **Etapa 1**: eliges un tema.\n2. **Etapa 2**: eliges un detalle de ese tema.\n3. **Etapa 3**: llegas a la respuesta final.\n\n" +
            "Cada opción ya sabe a dónde lleva. Igual que un skill, el camino **se diseñó una vez** y funciona siempre igual para todos.",
        },
        {
          id: "auto.predefinidas.parecido",
          etiqueta: "¿En qué se parecen a un skill?",
          respuesta:
            "En los dos casos el trabajo **se define una vez y se reutiliza**:\n\n" +
            "- La **respuesta predefinida** guarda el **texto final**.\n" +
            "- El **skill** guarda la **forma de trabajar**, y la IA la rellena con tus datos.\n\n" +
            "Por eso la predefinida es instantánea pero fija, y el skill se adapta a cada caso.",
        },
        {
          id: "auto.predefinidas.cuando",
          etiqueta: "¿Cuándo uso una y cuándo la otra?",
          respuesta:
            "- **Respuesta predefinida**: preguntas frecuentes con una sola respuesta correcta (a quién avisar de una falla, cómo pedir un permiso).\n" +
            "- **Skill**: cuando cada caso trae **datos distintos** (un reporte de turno, un aviso de falla, un acta).\n" +
            "- **Pregunta libre**: para todo lo demás. Escríbela abajo.",
        },
      ],
    },
    {
      id: "auto.trabajo",
      etiqueta: "¿Qué partes de mi trabajo se automatizan?",
      respuesta:
        "Sirve para lo que **se repite** y siempre lleva el mismo formato. Elige un tipo de trabajo:",
      hijos: [
        {
          id: "auto.trabajo.docs",
          etiqueta: "Documentos y reportes",
          respuesta:
            "Reportes de turno, actas, informes semanales, avisos de falla: los datos cambian, pero **el formato es siempre el mismo**. " +
            "El skill te deja el documento armado con código, secciones y firmas; tú solo completas y revisas.",
        },
        {
          id: "auto.trabajo.numeros",
          etiqueta: "Revisión de números",
          respuesta:
            "Al subir un Excel o CSV con lecturas, el skill **Analista de datos** compara cada valor con los **rangos normales** del equipo y marca lo que está fuera. " +
            "Lo que antes era revisar fila por fila, ahora sale resumido en segundos.",
        },
        {
          id: "auto.trabajo.correos",
          etiqueta: "Correos y avisos",
          respuesta:
            "Le das la idea en pocas palabras (\"avisar que el inversor 3 está parado\") y el skill **Redactor de correos** la convierte en un mensaje " +
            "con saludo, motivo, detalle y cierre, listo para copiar y enviar.",
        },
      ],
    },
  ],
};

/** Raíz de la guía para un área: sus hijos son las 3 opciones de la etapa 1. */
export function guia(area: Area): Nodo {
  return { id: "", etiqueta: "", respuesta: "", hijos: [QUE_ES, AUTOMATIZA, ramaProbar(area)] };
}

/** Busca un nodo por id y devuelve también su etapa (1, 2 o 3). */
export function buscarNodo(raiz: Nodo, id: string): { nodo: Nodo; etapa: number } | null {
  const pila: { nodo: Nodo; etapa: number }[] = (raiz.hijos ?? []).map((n) => ({ nodo: n, etapa: 1 }));
  while (pila.length) {
    const x = pila.pop()!;
    if (x.nodo.id === id) return x;
    (x.nodo.hijos ?? []).forEach((h) => pila.push({ nodo: h, etapa: x.etapa + 1 }));
  }
  return null;
}
