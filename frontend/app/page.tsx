"use client";
import { useCallback, useEffect, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import Encabezado from "@/components/Encabezado";
import Inicio from "@/components/Inicio";
import { SelectorSkill, SelectorTareas } from "@/components/Selectores";
import Formulario from "@/components/Formulario";
import Resultado, { Procesando } from "@/components/Resultado";
import Tutorial from "@/components/Tutorial";
import Grafica from "@/components/Grafica";
import { ejecutarTarea, obtenerCatalogo } from "@/lib/api";
import { guardar, leer } from "@/lib/almacen";
import type { Area, Catalogo, Modo, Pantalla, Resultado as Res, Tarea } from "@/lib/types";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Home() {
  const [listo, setListo] = useState(false);
  const [pantalla, setPantalla] = useState<Pantalla>("inicio");
  const [nombre, setNombre] = useState("");
  const [area, setArea] = useState<Area | null>(null);
  const [modoElegido, setModo] = useState<Modo | null>(null);
  const modo: Modo = modoElegido ?? "practica";
  const [practicadas, setPracticadas] = useState<string[]>([]);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [skillId, setSkillId] = useState("");
  const [datos, setDatos] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<Res | null>(null);
  const [pasoIA, setPasoIA] = useState(0);
  const [error, setError] = useState("");
  const [tutorial, setTutorial] = useState(false);
  const [aviso, setAviso] = useState("");

  // Cargar preferencias guardadas en el navegador
  useEffect(() => {
    setNombre(leer("nombre", ""));
    // Dónde trabaja y qué quiere hacer se eligen cada vez: ninguna opción viene marcada de antemano.
    setPracticadas(leer<string[]>("practicadas", []));
    letra(leer("fs", 20));
    setListo(true);
  }, []);

  const letra = (px: number) => {
    document.documentElement.style.setProperty("--fs", `${px}px`);
    guardar("fs", px);
  };

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

  async function entrar() {
    if (!area || !modoElegido) return;
    guardar("nombre", nombre.trim());
    guardar("area", area);
    guardar("modo", modo);
    try {
      setCatalogo(await obtenerCatalogo(area));
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    ir("tareas");
    if (practica && !leer("tutorial", false)) setTutorial(true);
  }

  function elegirTarea(t: Tarea) {
    setTarea(t);
    const base: Record<string, string> = {};
    t.campos.forEach((c) => { if (c.tipo === "select" && c.opciones) base[c.id] = c.opciones[0]; });
    if (!practica && t.campos.some((c) => c.id === "operador")) base.operador = nombre;
    setDatos(practica ? { ...t.ejemplo } : base);
    ir("skill");
  }

  async function enviar() {
    if (!area || !tarea || !skill) return;
    ir("procesando");
    setPasoIA(0);
    // Animación educativa: muestra cada paso del skill mientras la IA responde
    const animacion = (async () => {
      for (let i = 0; i < skill.pasos.length; i++) { setPasoIA(i); await esperar(650); }
      setPasoIA(skill.pasos.length);
    })();
    try {
      const [r] = await Promise.all([
        ejecutarTarea({ area, tarea_id: tarea.id, skill_id: skillId, modo, nombre: nombre.trim(), datos }),
        animacion,
      ]);
      setResultado(r);
      if (practica && !practicadas.includes(`${area}:${tarea.id}`)) {
        const nuevas = [...practicadas, `${area}:${tarea.id}`];
        setPracticadas(nuevas);
        guardar("practicadas", nuevas);
      }
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
        planta={catalogo?.planta ?? "Central Renovable"}
        area={area} modo={modo} enInicio={pantalla === "inicio"}
        onAyuda={() => setTutorial(true)}
        onSalir={() => { window.speechSynthesis?.cancel(); ir("inicio"); }}
        onLetra={letra}
      />
      <main>
        <div className="wrap">
          {pantalla === "inicio" && (
            <>
              <Inicio nombre={nombre} area={area} modo={modoElegido} practicadas={practicadas.length}
                onNombre={setNombre} onArea={setArea} onModo={setModo} onEntrar={entrar} />
              {error && <p className="error" role="alert"><CircleAlert size={20} aria-hidden="true" /> {error}</p>}
            </>
          )}
          {pantalla === "tareas" && catalogo && (
            <SelectorTareas nombre={nombre.trim()} tareas={catalogo.tareas} practica={practica} hechas={hechasArea} onElegir={elegirTarea}
              onGrafica={() => ir("grafica")} />
          )}
          {pantalla === "skill" && catalogo && tarea && (
            <SelectorSkill tarea={tarea} skills={catalogo.skills} practica={practica}
              onElegir={(id) => { setSkillId(id); ir("datos"); }} onVolver={() => ir("tareas")} />
          )}
          {pantalla === "datos" && tarea && skill && (
            <Formulario tarea={tarea} skill={skill} skillId={skillId} datos={datos} practica={practica} error={error}
              onCambio={(id, v) => { setDatos((d) => ({ ...d, [id]: v })); setError(""); }}
              onFalta={setError}
              onEjemplo={() => { setDatos({ ...tarea.ejemplo }); mostrarAviso("Datos de ejemplo restaurados"); }}
              onEnviar={enviar} onVolver={() => ir("skill")} />
          )}
          {pantalla === "grafica" && <Grafica modo={modo} onVolver={() => ir("tareas")} />}
          {pantalla === "procesando" && skill && <Procesando skill={skill} practica={practica} pasoActual={pasoIA} />}
          {pantalla === "resultado" && tarea && skill && resultado && (
            <Resultado tarea={tarea} skill={skill} texto={resultado.texto} planta={catalogo?.planta ?? "Central Renovable"} origen={resultado.origen} practica={practica}
              onOtroSkill={() => ir("skill")} onOtraTarea={() => ir("tareas")} onAviso={mostrarAviso} />
          )}
        </div>
      </main>
      {tutorial && <Tutorial onCerrar={cerrarTutorial} />}
      {aviso && <div className="toast" role="status"><CircleCheck size={20} aria-hidden="true" /> {aviso}</div>}
    </>
  );
}
