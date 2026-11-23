"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, CircleCheck, RefreshCw } from "lucide-react";
import { Creditos } from "creditos-dev";
import Encabezado from "@/components/Encabezado";
import Inicio from "@/components/Inicio";
import { SelectorSkill, SelectorTareas } from "@/components/Selectores";
import Formulario from "@/components/Formulario";
import Resultado, { Procesando } from "@/components/Resultado";
import Tutorial from "@/components/Tutorial";
import Grafica from "@/components/Grafica";
import MiHistorial, { EnvioGuardado } from "@/components/MiHistorial";
import ChatIA from "@/components/ChatIA";
import BaseInspecciones from "@/components/BaseInspecciones";
import type { MensajeUI } from "@/lib/guiaChat";
import { ejecutarTarea, obtenerCatalogo, obtenerHistorialUsuario, obtenerUsuarios } from "@/lib/api";
import { guardar, leer } from "@/lib/almacen";
import type { Area, Catalogo, Envio, HistorialUsuario, Modo, Pantalla, Resultado as Res, Tarea, Usuario } from "@/lib/types";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Home() {
  const [listo, setListo] = useState(false);
  const [pantalla, setPantalla] = useState<Pantalla>("inicio");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [modoElegido, setModo] = useState<Modo | null>(null);
  const modo: Modo = modoElegido ?? "practica";
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [skillId, setSkillId] = useState("");
  const [datos, setDatos] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<Res | null>(null);
  const [pasoIA, setPasoIA] = useState(0);
  const [error, setError] = useState("");
  const [tutorial, setTutorial] = useState(false);
  const [aviso, setAviso] = useState("");
  const [fs, setFs] = useState(20);
  // Historial del usuario (consultas y archivos subidos): se guarda en el servidor, no en el navegador.
  const [historial, setHistorial] = useState<HistorialUsuario | null>(null);
  const [errorHistorial, setErrorHistorial] = useState("");
  const [envioId, setEnvioId] = useState<number | null>(null);
  const [vieneDe, setVieneDe] = useState<Pantalla>("inicio");   // a dónde vuelve el botón del historial
  // Chat "Usar IA": la conversación se conserva al cerrar y volver a abrir la ventana.
  const [chatAbierto, setChatAbierto] = useState(false);
  const [chat, setChat] = useState<MensajeUI[]>([]);
  const cerrarChat = useCallback(() => setChatAbierto(false), []);
  // Base de datos de inspecciones: la última inspección enviada se resalta al abrirla.
  const [inspeccionNueva, setInspeccionNueva] = useState<number | null>(null);
  const [inspeccionResaltada, setInspeccionResaltada] = useState<number | null>(null);
  const [vieneDeBD, setVieneDeBD] = useState<Pantalla>("tareas");

  const letra = (px: number) => {
    document.documentElement.style.setProperty("--fs", `${px}px`);
    setFs(px);
    guardar("fs", px);
  };

  // Al elegir un usuario quedan marcados su lugar de trabajo y su modo habituales (se pueden cambiar).
  const elegirUsuario = useCallback((u: Usuario) => {
    setUsuario(u);
    setArea(u.area);
    setModo(u.modo);
    setError("");
    guardar("usuario", u.id);
  }, []);

  const cargarUsuarios = useCallback(async () => {
    try {
      const lista = await obtenerUsuarios();
      setUsuarios(lista);
      setError("");
      const previo = lista.find((u) => u.id === leer("usuario", ""));
      if (previo) elegirUsuario(previo);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [elegirUsuario]);

  // Cargar preferencias guardadas en el navegador y la lista de usuarios
  useEffect(() => {
    letra(leer("fs", 20));
    cargarUsuarios().finally(() => setListo(true));
  }, [cargarUsuarios]);

  const cargarHistorial = useCallback(async (id: string) => {
    try {
      setHistorial(await obtenerHistorialUsuario(id));
      setErrorHistorial("");
    } catch (e) {
      setErrorHistorial((e as Error).message);
    }
  }, []);
  const usuarioId = usuario?.id;
  useEffect(() => {
    setHistorial(null);
    if (usuarioId) cargarHistorial(usuarioId);
  }, [usuarioId, cargarHistorial]);

  const ir = useCallback((p: Pantalla) => {
    setPantalla(p);
    setError("");
    window.scrollTo(0, 0);
    requestAnimationFrame(() => document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true }));
  }, []);

  const mostrarAviso = (msg: string) => {
    setAviso(msg);
    setTimeout(() => setAviso(""), 2600);
  };

  const practica = modo === "practica";
  const skill = catalogo && skillId ? catalogo.skills[skillId] : null;
  const nombre = usuario?.nombre ?? "";
  const planta = catalogo?.planta ?? "Central Renovable";

  // Tareas que el usuario ya practicó: salen de su historial (envíos en modo práctica).
  const practicadas = useMemo(() => {
    const envios = historial ? [...historial.consultas, ...historial.archivos] : [];
    return [...new Set(envios.filter((e) => e.modo === "practica").map((e) => `${e.area}:${e.tarea_id}`))];
  }, [historial]);
  // Lo último que hizo, para el menú: consultas y archivos juntos, del más nuevo al más viejo.
  const recientes = useMemo(
    () => (historial ? [...historial.consultas, ...historial.archivos].sort((a, b) => b.creado.localeCompare(a.creado)).slice(0, 5) : []),
    [historial],
  );

  async function entrar() {
    if (!usuario || !area || !modoElegido) return;
    try {
      setCatalogo(await obtenerCatalogo(area));
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    ir("tareas");
    if (practica && !leer("tutorial", false)) setTutorial(true);
  }

  // Es una demo: el formulario siempre llega lleno con datos de ejemplo (en práctica y en trabajo real),
  // así solo falta tocar "Enviar". El nombre del operador es el del usuario elegido.
  function datosIniciales(t: Tarea) {
    const base: Record<string, string> = {};
    t.campos.forEach((c) => { if (c.tipo === "select" && c.opciones) base[c.id] = c.opciones[0]; });
    Object.assign(base, t.ejemplo);
    if (t.campos.some((c) => c.id === "operador") && nombre) base.operador = nombre;
    return base;
  }

  // En la inspección, al cambiar de equipo se cargan las mediciones de ejemplo de ese equipo.
  function cambiarDato(id: string, v: string) {
    const ej = id === "equipo" ? tarea?.ejemplos_equipo?.[v] : undefined;
    setDatos((d) => (ej ? { ...d, ...ej } : { ...d, [id]: v }));
    setError("");
    if (ej) mostrarAviso(`Mediciones de ejemplo de ${v.split(" · ")[0]} cargadas`);
  }

  function elegirTarea(t: Tarea) {
    setTarea(t);
    setDatos(datosIniciales(t));
    ir("skill");
  }

  // Desde el historial: vuelve a abrir una tarea ya hecha, con su mismo skill, lista para completar.
  async function reabrir(e: Envio) {
    try {
      const cat = catalogo && area === e.area ? catalogo : await obtenerCatalogo(e.area);
      const t = cat.tareas.find((x) => x.id === e.tarea_id);
      if (!t || !cat.skills[e.skill_id]) { mostrarAviso("Esa tarea ya no está disponible"); return; }
      window.speechSynthesis?.cancel();
      setArea(e.area); setModo(e.modo); setCatalogo(cat);
      setTarea(t); setSkillId(e.skill_id); setDatos(datosIniciales(t));
      ir("datos");
    } catch (err) {
      mostrarAviso((err as Error).message);
    }
  }

  const abrirHistorial = () => {
    if (!usuario) return;
    if (pantalla !== "historial" && pantalla !== "envio") setVieneDe(catalogo && pantalla !== "inicio" ? "tareas" : "inicio");
    window.speechSynthesis?.cancel();
    cargarHistorial(usuario.id);
    ir("historial");
  };
  const abrirEnvio = (e: Envio) => {
    if (pantalla !== "historial" && pantalla !== "envio") setVieneDe(catalogo && pantalla !== "inicio" ? "tareas" : "inicio");
    window.speechSynthesis?.cancel();
    setEnvioId(e.id);
    ir("envio");
  };

  function abrirInspecciones(resaltar: number | null) {
    window.speechSynthesis?.cancel();
    setVieneDeBD(pantalla === "resultado" ? "resultado" : "tareas");
    setInspeccionResaltada(resaltar);
    ir("inspecciones");
  }

  async function enviar() {
    if (!usuario || !area || !tarea || !skill) return;
    ir("procesando");
    setPasoIA(0);
    // Animación educativa: muestra cada paso del skill mientras la IA responde
    const animacion = (async () => {
      for (let i = 0; i < skill.pasos.length; i++) { setPasoIA(i); await esperar(650); }
      setPasoIA(skill.pasos.length);
    })();
    try {
      const [r] = await Promise.all([
        ejecutarTarea({ area, tarea_id: tarea.id, skill_id: skillId, modo, usuario: usuario.id, datos }),
        animacion,
      ]);
      setResultado(r);
      if (tarea.id === "inspeccion" && r.envio_id) setInspeccionNueva(r.envio_id);
      cargarHistorial(usuario.id);   // el envío ya quedó guardado en su historial
      ir("resultado");
    } catch (e) {
      await animacion;
      setPantalla("datos");
      setError((e as Error).message);
    }
  }

  const cerrarTutorial = useCallback(() => { setTutorial(false); guardar("tutorial", true); }, []);

  if (!listo) return null;

  const hechasArea = practicadas.filter((p) => p.startsWith(`${area}:`)).map((p) => p.split(":")[1]);

  return (
    <>
      <Encabezado
        planta={planta} usuario={usuario} recientes={recientes}
        area={area} modo={modo} enInicio={pantalla === "inicio"} letra={fs}
        onInicio={() => { window.speechSynthesis?.cancel(); ir("inicio"); }}
        onAyuda={() => setTutorial(true)}
        onLetra={letra} onHistorial={abrirHistorial} onAbrirEnvio={abrirEnvio}
      />
      <main>
        <div className="wrap">
          {pantalla === "inicio" && (
            <>
              <Inicio usuarios={usuarios} usuario={usuario} area={area} modo={modoElegido} practicadas={practicadas.length}
                onUsuario={elegirUsuario} onArea={setArea} onModo={setModo} onEntrar={entrar} />
              {error && (
                <p className="error" role="alert">
                  <CircleAlert size={20} aria-hidden="true" /> {error}
                  {!usuarios.length && <button className="hbtn" onClick={cargarUsuarios}><RefreshCw size={16} aria-hidden="true" /> Reintentar</button>}
                </p>
              )}
            </>
          )}
          {pantalla === "tareas" && catalogo && (
            <SelectorTareas nombre={nombre} tareas={catalogo.tareas} practica={practica} hechas={hechasArea} onElegir={elegirTarea}
              onGrafica={() => ir("grafica")} onHistorial={abrirHistorial} onChat={() => setChatAbierto(true)}
              onInspecciones={area === "planta" ? () => abrirInspecciones(null) : undefined} />
          )}
          {pantalla === "skill" && catalogo && tarea && (
            <SelectorSkill tarea={tarea} skills={catalogo.skills} practica={practica}
              onElegir={(id) => { setSkillId(id); ir("datos"); }} onVolver={() => ir("tareas")} />
          )}
          {pantalla === "datos" && tarea && skill && (
            <Formulario area={area ?? "planta"} tarea={tarea} skill={skill} skillId={skillId} datos={datos} practica={practica} error={error}
              usuario={usuario?.id ?? ""} enviados={historial?.archivos ?? []}
              onCambio={cambiarDato}
              onFalta={setError}
              onEjemplo={() => { setDatos(datosIniciales(tarea)); mostrarAviso("Datos de ejemplo restaurados"); }}
              onEnviar={enviar} onVolver={() => ir("skill")} />
          )}
          {pantalla === "grafica" && usuario && (
            <Grafica modo={modo} usuario={usuario} onVolver={() => ir(catalogo ? "tareas" : "historial")}
              volverA={catalogo ? "Volver a las tareas" : "Volver al historial"} />
          )}
          {pantalla === "historial" && usuario && (
            <MiHistorial usuario={usuario} historial={historial} error={errorHistorial} onAbrir={abrirEnvio}
              onGrafica={() => ir("grafica")} onVolver={() => ir(vieneDe)} onAviso={mostrarAviso}
              volverA={vieneDe === "tareas" ? "Volver a las tareas" : "Volver al inicio"} />
          )}
          {pantalla === "envio" && usuario && envioId !== null && (
            <EnvioGuardado usuario={usuario} envioId={envioId} planta={planta} onVolver={() => ir("historial")}
              onRepetir={reabrir} onAviso={mostrarAviso} />
          )}
          {pantalla === "procesando" && skill && <Procesando skill={skill} practica={practica} pasoActual={pasoIA} />}
          {pantalla === "resultado" && tarea && skill && resultado && (
            <Resultado tarea={tarea} skill={skill} texto={resultado.texto} entrada={resultado.entrada ?? []} planta={planta} origen={resultado.origen} practica={practica}
              usuario={usuario?.id ?? ""} revision={datos[tarea.campos.find((c) => c.tipo === "documento")?.id ?? ""] ?? ""}
              onOtroSkill={() => ir("skill")} onOtraTarea={() => ir("tareas")} onAviso={mostrarAviso}
              onBaseDatos={tarea.id === "inspeccion" ? () => abrirInspecciones(inspeccionNueva) : undefined} />
          )}
          {pantalla === "inspecciones" && (
            <BaseInspecciones modo={modo} resaltar={inspeccionResaltada} onVolver={() => ir(vieneDeBD)}
              volverA={vieneDeBD === "resultado" ? "Volver al resultado" : "Volver a las tareas"} />
          )}
        </div>
      </main>
      {/* Créditos del desarrollador (paquete creditos-dev): siempre al final de la página */}
      <footer className="pie">
        <Creditos />
      </footer>
      {chatAbierto && usuario && area && (
        <ChatIA area={area} modo={modo} usuario={usuario.id} nombre={nombre} mensajes={chat} onMensajes={setChat}
          onCerrar={cerrarChat} onAviso={mostrarAviso} />
      )}
      {tutorial && <Tutorial onCerrar={cerrarTutorial} />}
      {aviso && <div className="toast" role="status"><CircleCheck size={20} aria-hidden="true" /> {aviso}</div>}
    </>
  );
}
