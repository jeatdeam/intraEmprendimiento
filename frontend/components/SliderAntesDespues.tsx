"use client";
/**
 * Slider after/before genérico (basado en la plantilla del skill "slider-after-before").
 *
 * Cada grupo tiene dos hojas: a la izquierda (capa de arriba, recortada) el "antes" y a la derecha
 * (capa de fondo) el "después". La línea se mueve sola del centro al borde en sintonía con la barra de la
 * bolita; se puede arrastrar. Con la rueda del mouse sobre el slider se desplazan las dos hojas a la vez.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";

export interface GrupoSlider {
  clave: string;
  titulo: string;           // nombre del documento (arriba del slider)
  sub: string;              // detalle bajo el título
  izq: ReactNode;           // hoja del "antes"
  der: ReactNode;           // hoja del "después"
  selloIzq?: ReactNode;     // sello sobre cada hoja (p. ej. "No pasa · 9 de 12")
  selloDer?: ReactNode;
}

type Direction = "left" | "right";

const DURATION = 5000;
// velocidad constante de la línea: del centro al borde (50%) en DURATION
const SPEED = 50 / DURATION;
// radio de las esquinas del slider; los textos en arco se calculan a partir de él
const RADIUS = 48;

export default function SliderAntesDespues({ grupos, izq = "Formato normal", der = "Formato con skill", izqCorta = "Normal",
  derCorta = "Con skill", ayuda = true }: {
  grupos: GrupoSlider[]; izq?: string; der?: string; izqCorta?: string; derCorta?: string; ayuda?: boolean;
}) {
  const n = grupos.length;
  const [current, setCurrent] = useState(0);
  // hacia dónde viaja la línea durante el grupo: derecha = siguiente, izquierda = anterior
  const [direction, setDirection] = useState<Direction>("right");
  const [dragging, setDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const capaRef = useRef<HTMLDivElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLSpanElement | null>(null);
  const clipRefs = useRef<(HTMLDivElement | null)[]>([]);
  // las dos hojas de cada grupo (para desplazarlas juntas con la rueda)
  const hojasRefs = useRef<(HTMLDivElement | null)[][]>([]);
  const currentRef = useRef(0);

  // estado de la animación en refs para no re-renderizar en cada frame
  const position = useRef(50);
  const fill = useRef(0);
  // tramo actual: desde dónde parten la línea y la barra, y cuánto dura (se recalcula al soltar el arrastre)
  const segment = useRef({ position: 50, fill: 0, duration: DURATION, elapsed: 0 });

  const paint = useCallback(() => {
    if (lineRef.current) lineRef.current.style.left = `${position.current}%`;
    const clip = clipRefs.current[current];
    if (clip) clip.style.clipPath = `inset(0 ${100 - position.current}% 0 0)`;
    if (fillRef.current) fillRef.current.style.width = `${fill.current * 100}%`;
  }, [current]);

  const goTo = useCallback((index: number, dir: Direction) => {
    setDirection(dir);
    setCurrent(((index % n) + n) % n);
  }, [n]);

  // si cambian los documentos (se cargó otro), se vuelve al primero
  const claves = grupos.map((c) => c.clave).join("|");
  useEffect(() => { setCurrent(0); setDirection("right"); }, [claves]);

  // cada grupo empieza con la línea al centro, la duración normal y las hojas arriba
  useEffect(() => {
    currentRef.current = current;
    position.current = 50;
    fill.current = 0;
    segment.current = { position: 50, fill: 0, duration: DURATION, elapsed: 0 };
    hojasRefs.current[current]?.forEach((h) => { if (h) h.scrollTop = 0; });
    paint();
  }, [current, paint]);

  // la línea viaja del punto de partida al borde en sintonía con la barra de la bolita
  useEffect(() => {
    if (dragging) return;
    const target = direction === "right" ? 100 : 0;
    let frame: number;
    let last = performance.now();

    const tick = (now: number) => {
      const seg = segment.current;
      seg.elapsed += now - last;
      last = now;
      const t = seg.duration > 0 ? Math.min(1, seg.elapsed / seg.duration) : 1;
      position.current = seg.position + (target - seg.position) * t;
      fill.current = seg.fill + (1 - seg.fill) * t;
      paint();

      if (t >= 1) {
        goTo(current + (direction === "right" ? 1 : -1), direction);
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [current, direction, dragging, goTo, paint]);

  // rueda del mouse: desplaza las dos hojas del grupo actual a la vez (si ya no hay más, deja bajar la página)
  useEffect(() => {
    const capa = capaRef.current;
    if (!capa) return;
    const rueda = (e: WheelEvent) => {
      const hojas = (hojasRefs.current[currentRef.current] ?? []).filter(Boolean) as HTMLDivElement[];
      const puede = hojas.some((h) => (e.deltaY > 0 ? h.scrollTop + h.clientHeight < h.scrollHeight - 1 : h.scrollTop > 0));
      if (!puede) return;
      e.preventDefault();
      hojas.forEach((h) => { h.scrollTop += e.deltaY; });
    };
    capa.addEventListener("wheel", rueda, { passive: false });
    return () => capa.removeEventListener("wheel", rueda);
  }, []);

  const updatePosition = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const percent = ((clientX - rect.left) / rect.width) * 100;
    position.current = Math.min(100, Math.max(0, percent));
    paint();
  };

  const handlePointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    // solo clic principal: el clic derecho abre el menú y nunca llega a soltarse aquí
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    updatePosition(e.clientX);
  };

  const handlePointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (dragging) updatePosition(e.clientX);
  };

  // al soltar, la línea sigue desde donde quedó a la misma velocidad:
  // si se retrocedió, el grupo dura más (hasta 10s desde el borde opuesto); si se adelantó, dura menos
  const endDrag = useCallback(() => {
    const target = direction === "right" ? 100 : 0;
    segment.current = {
      position: position.current,
      fill: fill.current,
      duration: Math.abs(target - position.current) / SPEED,
      elapsed: 0,
    };
    setDragging(false);
  }, [direction]);

  // si el navegador pierde el "soltar" (alt+tab, soltar fuera de la ventana, captura cancelada)
  // el arrastre termina igual para que la animación no se quede congelada
  useEffect(() => {
    if (!dragging) return;
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("blur", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("blur", endDrag);
    };
  }, [dragging, endDrag]);

  if (!n) return null;
  const g = grupos[current];

  return (
    <div className="baf-wrap">
      <p className="baf-titulo">
        <b>{g.titulo}</b>
        <span>{g.sub}{n > 1 ? ` — documento ${current + 1} de ${n}` : ""}</span>
      </p>
      <div ref={containerRef} style={{ borderRadius: RADIUS }} className="baf"
        aria-label={`Comparador: ${izq.toLowerCase()} a la izquierda, ${der.toLowerCase()} a la derecha`}>

        {/* imagen 2 (formato con skill) de fondo e imagen 1 (formato normal) recortada encima */}
        {grupos.map((c, i) => (
          <div key={c.clave} className={`baf-grupo ${i === current ? "on" : ""}`} aria-hidden={i !== current}>
            <div className="baf-capa baf-despues">
              <div className="baf-cab">{c.selloDer}</div>
              <div className="baf-hoja" ref={(el) => { (hojasRefs.current[i] ??= [])[1] = el; }}>{c.der}</div>
            </div>
            <div className="baf-capa baf-antes" ref={(el) => { clipRefs.current[i] = el; }} style={{ clipPath: "inset(0 50% 0 0)" }}>
              <div className="baf-cab">{c.selloIzq}</div>
              <div className="baf-hoja" ref={(el) => { (hojasRefs.current[i] ??= [])[0] = el; }}>{c.izq}</div>
            </div>
          </div>
        ))}

        {/* en celular las etiquetas van cortas para no chocar con las flechas pequeñas */}
        <CornerLabel corner="top-left" text={izq} clase="solo-escritorio" />
        <CornerLabel corner="bottom-right" text={der} clase="solo-escritorio" />
        <CornerLabel corner="top-left" text={izqCorta} clase="solo-movil" />
        <CornerLabel corner="bottom-right" text={derCorta} clase="solo-movil" />

        {/* deslizador: línea delgada con un tirador central de 10x25px */}
        <div ref={capaRef} className="baf-arrastre"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onLostPointerCapture={() => dragging && endDrag()}>
          <div ref={lineRef} className="baf-linea" style={{ left: "50%" }}>
            <div className="baf-tirador" />
          </div>
        </div>

        {/* botones estilo iOS abajo a la derecha: solo aparecen al pasar el cursor (desde 640px) */}
        {n > 1 && (
          <div className="baf-botones">
            <IosArrowButton direction="left" onClick={() => goTo(current - 1, "left")} />
            <IosArrowButton direction="right" onClick={() => goTo(current + 1, "right")} />
          </div>
        )}

        {/* indicadores; en celular las flechas van pequeñas a los lados de las bolitas */}
        <div className="baf-indicadores">
          {n > 1 && <IosArrowButton direction="left" compact onClick={() => goTo(current - 1, "left")} />}
          <div className="baf-bolitas">
            {grupos.map((c, i) => (
              <button key={c.clave} type="button" aria-label={`Ir al documento ${i + 1}: ${c.titulo}`}
                onClick={() => goTo(i, i < current ? "left" : "right")}
                className={`baf-bolita ${i === current ? "on" : ""}`}>
                {i === current && <span ref={fillRef} className="baf-relleno" style={{ width: 0 }} />}
              </button>
            ))}
          </div>
          {n > 1 && <IosArrowButton direction="right" compact onClick={() => goTo(current + 1, "right")} />}
        </div>
      </div>
      {ayuda && (
        <p className="hint baf-ayuda">
          Arrastra la línea para comparar. Usa la rueda del mouse sobre el documento para bajar en las dos hojas a la vez.
        </p>
      )}
    </div>
  );
}

// texto curvado sobre un arco concéntrico al borde redondeado de la esquina
function CornerLabel({ corner, text, clase = "" }: { corner: "top-left" | "bottom-right"; text: string; clase?: string }) {
  const extra = 120;
  const size = RADIUS + extra;
  const isTopLeft = corner === "top-left";
  const id = `baf-arc-${corner}-${clase}`;

  // arriba-izquierda: los glifos miran hacia afuera, la línea base queda a 22px del borde
  // abajo-derecha: los glifos miran hacia adentro, la línea base queda a 12px del borde
  const inset = isTopLeft ? 22 : 12;
  const r = RADIUS - inset;
  const path = isTopLeft
    ? `M ${inset},${size} L ${inset},${RADIUS} A ${r},${r} 0 0 1 ${RADIUS},${inset} L ${size},${inset}`
    : `M 0,${size - inset} L ${size - RADIUS},${size - inset} A ${r},${r} 0 0 0 ${size - inset},${size - RADIUS} L ${size - inset},0`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"
      className={`baf-arco ${isTopLeft ? "arriba" : "abajo"} ${clase}`}>
      <path id={id} d={path} fill="none" />
      <text>
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{text}</textPath>
      </text>
    </svg>
  );
}

function IosArrowButton({ direction, onClick, compact = false }: {
  direction: Direction; onClick: () => void; compact?: boolean;   // compact: versión de celular, siempre visible
}) {
  const isLeft = direction === "left";
  return (
    <button type="button" onClick={onClick} aria-label={isLeft ? "Documento anterior" : "Documento siguiente"}
      className={`baf-flecha ${compact ? "compacta" : ""}`}>
      <svg width={compact ? 7 : 10} height={compact ? 12 : 18} viewBox="0 0 10 18" fill="none" aria-hidden="true">
        <path d={isLeft ? "M9 1L1 9l8 8" : "M1 1l8 8-8 8"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
