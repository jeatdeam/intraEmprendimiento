"use client";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUp, CircleAlert, CircleCheck, Copy, Layers, RotateCcw, Sparkles, X } from "lucide-react";
import { chatear } from "@/lib/api";
import { ETAPAS, buscarNodo, guia, type MensajeUI, type Nodo } from "@/lib/guiaChat";
import type { Area, Modo } from "@/lib/types";

const RAIZ = "__raiz";   // mensaje que vuelve a mostrar los temas de la etapa 1
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Negritas (**texto**) y código (`texto`) dentro de una línea. */
function enLinea(txt: string): ReactNode[] {
  return txt.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <b key={i}>{p.slice(2, -2)}</b>;
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return <code key={i}>{p.slice(1, -1)}</code>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

/** Markdown sencillo: párrafos, listas con viñetas o números y títulos. */
function Texto({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/\n{2,}/).map((b, i) => {
        const lineas = b.split("\n").filter((l) => l.trim());
        if (!lineas.length) return null;
        if (lineas.every((l) => /^\s*[-•*]\s+/.test(l)))
          return <ul key={i}>{lineas.map((l, j) => <li key={j}>{enLinea(l.replace(/^\s*[-•*]\s+/, ""))}</li>)}</ul>;
        if (lineas.every((l) => /^\s*\d+[.)]\s+/.test(l)))
          return <ol key={i}>{lineas.map((l, j) => <li key={j}>{enLinea(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>)}</ol>;
        if (lineas.length === 1 && /^#{1,4}\s/.test(lineas[0]))
          return <h3 key={i}>{enLinea(lineas[0].replace(/^#+\s*/, ""))}</h3>;
        return <p key={i}>{lineas.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{enLinea(l)}</Fragment>)}</p>;
      })}
    </>
  );
}

/** La última respuesta aparece escribiéndose poco a poco, como en un chat de verdad. */
function useEscribir(texto: string, activo: boolean, alTerminar: () => void) {
  const [n, setN] = useState(activo ? 0 : texto.length);
  useEffect(() => {
    if (!activo) { setN(texto.length); return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(texto.length); alTerminar(); return; }
    let i = 0;
    const paso = Math.max(2, Math.ceil(texto.length / 200));
    const id = setInterval(() => {
      i = Math.min(texto.length, i + paso);
      setN(i);
      if (i >= texto.length) { clearInterval(id); alTerminar(); }
    }, 16);
    return () => clearInterval(id);
  }, [texto, activo, alTerminar]);
  return texto.slice(0, n);
}

/** Indicador de las 3 etapas del camino guiado. */
function Etapas({ actual }: { actual: number }) {
  return (
    <span className="chat-etapas" aria-label={`Etapa ${Math.min(actual, ETAPAS)} de ${ETAPAS}`}>
      {Array.from({ length: ETAPAS }, (_, i) => (
        <i key={i} className={i < actual - 1 ? "hecha" : i === actual - 1 ? "on" : ""} />
      ))}
    </span>
  );
}

/** Las 3 opciones de la etapa siguiente (respuestas predefinidas). */
function Opciones({ nodos, etapa, onElegir }: { nodos: Nodo[]; etapa: number; onElegir: (n: Nodo) => void }) {
  return (
    <div className="chat-opciones">
      <span className="chat-opciones-t"><Etapas actual={etapa} /> Etapa {etapa} de {ETAPAS} · elige una opción</span>
      {nodos.map((n, i) => (
        <button key={n.id} className="chat-sug" onClick={() => onElegir(n)}>
          <span className="chat-num">{i + 1}</span> {n.etiqueta}
        </button>
      ))}
    </div>
  );
}

function Respuesta({ texto, etapa, animar, alTerminar, onCopiar, children }: {
  texto: string; etapa?: number; animar: boolean; alTerminar: () => void; onCopiar: () => void; children?: ReactNode;
}) {
  const visible = useEscribir(texto, animar, alTerminar);
  const listo = visible.length === texto.length;
  return (
    <div className="chat-ia">
      <span className="chat-avatar" aria-hidden="true"><Sparkles size={14} /></span>
      <div className="chat-cuerpo">
        {etapa !== undefined && (
          <span className="chat-sello"><Layers size={12} aria-hidden="true" /> Respuesta predefinida · Etapa {etapa} de {ETAPAS}</span>
        )}
        <div className="chat-md"><Texto texto={visible} /></div>
        {listo && (
          <>
            <button className="chat-accion" onClick={onCopiar} aria-label="Copiar respuesta">
              <Copy size={13} aria-hidden="true" /> Copiar
            </button>
            {children}
          </>
        )}
      </div>
    </div>
  );
}

export default function ChatIA({ area, modo, usuario, nombre, mensajes, onMensajes, onCerrar, onAviso }: {
  area: Area; modo: Modo; usuario: string; nombre: string;
  mensajes: MensajeUI[]; onMensajes: (m: MensajeUI[]) => void;
  onCerrar: () => void; onAviso: (msg: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState("");
  const [animar, setAnimar] = useState(-1);   // índice de la respuesta que se está escribiendo
  const lista = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const terminar = useRef(() => setAnimar(-1)).current;
  const raiz = useMemo(() => guia(area), [area]);
  const practica = modo === "practica";
  const primer = nombre.split(" ")[0];

  useEffect(() => { campo.current?.focus(); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onCerrar]);
  // Mantener a la vista lo último (también mientras la respuesta se va escribiendo)
  useEffect(() => {
    const el = lista.current;
    if (!el) return;
    const seguir = () => { el.scrollTop = el.scrollHeight; };
    seguir();
    const obs = new MutationObserver(seguir);
    obs.observe(el, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, []);
  // El campo crece con el texto, hasta un máximo
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [texto]);

  // Dónde va el camino guiado: según el último mensaje de la IA
  const ultimo = mensajes[mensajes.length - 1];
  const enGuia = ultimo?.role === "assistant" && ultimo.nodo !== undefined ? ultimo.nodo : null;
  const actual = enGuia && enGuia !== RAIZ ? buscarNodo(raiz, enGuia) : null;
  const opciones: Nodo[] = mensajes.length === 0 || enGuia === RAIZ ? raiz.hijos ?? [] : actual?.nodo.hijos ?? [];
  const etapaOpciones = actual ? actual.etapa + 1 : 1;
  const terminado = !!actual && !actual.nodo.hijos?.length;

  // Tocar una opción: se "escribe" como pregunta y llega su respuesta predefinida (sin llamar a la IA)
  async function elegir(n: Nodo) {
    if (pensando) return;
    const nuevos: MensajeUI[] = [...mensajes, { role: "user", content: n.etiqueta }];
    onMensajes(nuevos);
    setError("");
    setPensando(true);
    await esperar(650);
    onMensajes([...nuevos, { role: "assistant", content: n.respuesta, nodo: n.id }]);
    setAnimar(nuevos.length);
    setPensando(false);
  }

  // Pregunta escrita: esa sí va a la IA (o al simulador en modo práctica)
  async function enviar(contenido: string, base: MensajeUI[] = mensajes) {
    const limpio = contenido.trim();
    if (!limpio || pensando) return;
    // Escribir "1", "2" o "3" elige esa opción
    if (base === mensajes && /^[1-3]$/.test(limpio) && opciones[+limpio - 1] && animar < 0) {
      setTexto("");
      elegir(opciones[+limpio - 1]);
      return;
    }
    const nuevos: MensajeUI[] = [...base, { role: "user", content: limpio }];
    onMensajes(nuevos);
    setTexto("");
    setError("");
    setPensando(true);
    try {
      const historial = nuevos.slice(-40).map(({ role, content }) => ({ role, content }));
      const r = await chatear({ area, modo, usuario, mensajes: historial });
      onMensajes([...nuevos, { role: "assistant", content: r.texto }]);
      setAnimar(nuevos.length);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPensando(false);
      campo.current?.focus();
    }
  }

  function reintentar() {
    const u = mensajes[mensajes.length - 1];
    if (u?.role === "user") enviar(u.content, mensajes.slice(0, -1));
  }

  function nueva() {
    onMensajes([]);
    setError("");
    setAnimar(-1);
    campo.current?.focus();
  }

  const otroTema = () => {
    onMensajes([...mensajes, { role: "assistant", content: "¡Muy bien! Elige otro tema para seguir aprendiendo:", nodo: RAIZ }]);
    setAnimar(mensajes.length);
  };

  const copiar = async (t: string) => {
    try { await navigator.clipboard.writeText(t); onAviso("Respuesta copiada"); } catch { onAviso("No se pudo copiar"); }
  };

  const vacio = mensajes.length === 0;
  const verOpciones = !pensando && opciones.length > 0;

  return (
    <div className="modal-bg chat-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="chat glass" role="dialog" aria-modal="true" aria-labelledby="chat-t">
        <header className="chat-top">
          <span className="chat-avatar" aria-hidden="true"><Sparkles size={14} /></span>
          <div className="chat-titulo">
            <b id="chat-t">Usar IA</b>
            <span>{practica ? "Modo práctica · respuestas de ejemplo" : "Pregúntale lo que necesites"}</span>
          </div>
          {!vacio && (
            <button className="chat-icono" onClick={nueva} aria-label="Nueva conversación" title="Nueva conversación">
              <RotateCcw size={17} aria-hidden="true" />
            </button>
          )}
          <button className="chat-icono" onClick={onCerrar} aria-label="Cerrar chat" title="Cerrar">
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="chat-lista" ref={lista} aria-live="polite">
          {vacio && (
            <div className="chat-vacio">
              <span className="chat-logo" aria-hidden="true"><Sparkles size={26} /></span>
              <h2>{primer ? `¿En qué te ayudo hoy, ${primer}?` : "¿En qué te ayudo hoy?"}</h2>
              <p>
                Toca una opción y sigue el camino de <b>3 etapas</b> para aprender qué es un <b>skill</b>.
                Son <b>respuestas predefinidas</b>: ya están listas, igual que un skill tiene listas sus instrucciones.
                También puedes escribir tu propia pregunta abajo.
              </p>
              <Opciones nodos={opciones} etapa={1} onElegir={elegir} />
            </div>
          )}

          {mensajes.map((m, i) => {
            if (m.role === "user") return <div key={i} className="chat-yo"><p>{m.content}</p></div>;
            const info = m.nodo && m.nodo !== RAIZ ? buscarNodo(raiz, m.nodo) : null;
            const esUltimo = i === mensajes.length - 1;
            return (
              <Respuesta key={i} texto={m.content} etapa={info?.etapa} animar={i === animar} alTerminar={terminar}
                onCopiar={() => copiar(m.content)}>
                {esUltimo && verOpciones && <Opciones nodos={opciones} etapa={etapaOpciones} onElegir={elegir} />}
                {esUltimo && terminado && !pensando && (
                  <div className="chat-fin">
                    <span className="chat-fin-t"><CircleCheck size={16} aria-hidden="true" /> Completaste las {ETAPAS} etapas</span>
                    <p>Así funciona un skill: el camino se preparó una vez y responde al instante, siempre igual.</p>
                    <div className="chat-fin-btns">
                      <button className="chat-sug" onClick={otroTema}><Layers size={14} aria-hidden="true" /> Elegir otro tema</button>
                      <button className="chat-sug" onClick={nueva}><RotateCcw size={14} aria-hidden="true" /> Empezar de nuevo</button>
                    </div>
                  </div>
                )}
              </Respuesta>
            );
          })}

          {pensando && (
            <div className="chat-ia">
              <span className="chat-avatar latiendo" aria-hidden="true"><Sparkles size={14} /></span>
              <div className="chat-pensando" role="status"><i /><i /><i /><span className="sr">La IA está pensando…</span></div>
            </div>
          )}
          {error && (
            <p className="error chat-error" role="alert">
              <CircleAlert size={18} aria-hidden="true" /> {error}
              <button className="hbtn" onClick={reintentar}><RotateCcw size={15} aria-hidden="true" /> Reintentar</button>
            </p>
          )}
        </div>

        <form className="chat-caja" onSubmit={(e) => { e.preventDefault(); enviar(texto); }}>
          <textarea
            ref={campo} rows={1} value={texto} maxLength={8000}
            placeholder={verOpciones ? "Toca una opción, escribe su número o haz tu propia pregunta…" : "Escribe tu pregunta…"}
            aria-label="Escribe tu pregunta"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(texto); } }}
          />
          <button type="submit" className="chat-enviar" disabled={!texto.trim() || pensando} aria-label="Enviar pregunta">
            <ArrowUp size={18} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </form>
        <p className="chat-nota">La IA puede equivocarse: revisa lo que responde. No escribas contraseñas ni datos personales.</p>
      </div>
    </div>
  );
}
