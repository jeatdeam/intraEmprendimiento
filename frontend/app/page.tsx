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

  function datosIniciales(t: Tarea, enPractica: boolean) {
    if (enPractica) return { ...t.ejemplo };
    const base: Record<string, string> = {};
    t.campos.forEach((c) => { if (c.tipo === "select" && c.opciones) base[c.id] = c.opciones[0]; });
    if (t.campos.some((c) => c.id === "operador")) base.operador = nombre;
    return base;
  }

  function elegirTarea(t: Tarea) {
    setTarea(t);
    setDatos(datosIniciales(t, practica));
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
      setTarea(t); setSkillId(e.skill_id); setDatos(datosIniciales(t, e.modo === "practica"));
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
              onGrafica={() => ir("grafica")} onHistorial={abrirHistorial} />
          )}
          {pantalla === "skill" && catalogo && tarea && (
            <SelectorSkill tarea={tarea} skills={catalogo.skills} practica={practica}
              onElegir={(id) => { setSkillId(id); ir("datos"); }} onVolver={() => ir("tareas")} />
          )}
          {pantalla === "datos" && tarea && skill && (
            <Formulario tarea={tarea} skill={skill} skillId={skillId} datos={datos} practica={practica} error={error}
              usuario={usuario?.id ?? ""} enviados={historial?.archivos ?? []}
              onCambio={(id, v) => { setDatos((d) => ({ ...d, [id]: v })); setError(""); }}
              onFalta={setError}
              onEjemplo={() => { setDatos({ ...tarea.ejemplo }); mostrarAviso("Datos de ejemplo restaurados"); }}
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
            <Resultado tarea={tarea} skill={skill} texto={resultado.texto} planta={planta} origen={resultado.origen} practica={practica}
              usuario={usuario?.id ?? ""} revision={datos[tarea.campos.find((c) => c.tipo === "documento")?.id ?? ""] ?? ""}
              onOtroSkill={() => ir("skill")} onOtraTarea={() => ir("tareas")} onAviso={mostrarAviso} />
          )}
        </div>
      </main>
      {/* Créditos del desarrollador (paquete creditos-dev): siempre al final de la página */}
      <footer className="pie">
        <Creditos />
      </footer>
      {tutorial && <Tutorial onCerrar={cerrarTutorial} />}
      {aviso && <div className="toast" role="status"><CircleCheck size={20} aria-hidden="true" /> {aviso}</div>}
    </>
  );
}
