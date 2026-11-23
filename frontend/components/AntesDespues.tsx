import { Fragment, type ReactNode } from "react";
import { ArrowRightLeft, CircleCheck, CircleX, Pencil, Plus, TriangleAlert } from "lucide-react";
import type { Comparacion, HojaRevisada, LineaHoja, Marca } from "@/lib/types";

const ETIQUETA: Record<Marca, string> = {
  error: "Error", falta: "Falta", aviso: "Orden", nuevo: "Agregado", corregido: "Corregido", movido: "Movido", pendiente: "Por completar",
};
const ICONO: Record<Marca, typeof CircleX> = {
  error: CircleX, falta: CircleX, aviso: TriangleAlert, nuevo: Plus, corregido: CircleCheck, movido: ArrowRightLeft, pendiente: Pencil,
};

const esFilaTabla = (t: string) => /^ {2,}\S/.test(t) && t.trim().split(/\s{2,}/).length > 1;
const sinMarkdown = (t: string) => t.replace(/^\s*#{1,6}\s+/, "").replace(/\*\*/g, "");
const esSeccion = (t: string) => {
  const m = sinMarkdown(t).trim().match(/^\d+[.)]\s+(.+)$/);
  if (!m) return false;
  const letras = m[1].replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  return letras.length >= 4 && letras.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, "").length / letras.length > 0.6;
};

/** Resalta los marcadores [completar]. */
const texto = (t: string): ReactNode =>
  t.split(/(\[completar\])/).map((p, i) => (p === "[completar]" ? <mark key={i}>[completar]</mark> : <Fragment key={i}>{p}</Fragment>));

function Nota({ l }: { l: LineaHoja }) {
  if (!l.m || !l.nota) return null;
  const Icono = ICONO[l.m];
  return <span className="hl-nota"><Icono size={13} aria-hidden="true" /> <b>{ETIQUETA[l.m]}</b> · {l.nota}</span>;
}

/** Una hoja del documento, línea por línea, con las marcas al lado de cada línea que las tiene. */
export function Hoja({ lineas }: { lineas: LineaHoja[] }) {
  const iTitulo = lineas.findIndex((l) => l.t.trim() && l.m !== "falta");
  const iSeccion = lineas.findIndex((l) => l.m !== "falta" && esSeccion(l.t));
  const salida: ReactNode[] = [];

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const marca = l.m ? ` m-${l.m}` : "";
    if (l.m === "falta") {
      salida.push(<p key={i} className="hl hl-falta m-falta"><CircleX size={15} aria-hidden="true" /> {l.t}</p>);
      continue;
    }
    if (!l.t.trim()) {
      salida.push(<div key={i} className="hl-aire" />);
      continue;
    }
    if (esFilaTabla(l.t)) {
      const filas: LineaHoja[] = [];
      while (i < lineas.length && lineas[i].m !== "falta" && esFilaTabla(lineas[i].t)) filas.push(lineas[i++]);
      i--;
      const conCabecera = filas.length > 1 && !/\d/.test(filas[0].t);
      salida.push(
        <div key={i} className="tabla-scroll">
          <table className="doc-tabla hoja-tabla">
            <tbody>
              {filas.map((f, j) => (
                <tr key={j} className={f.m ? `m-${f.m}` : undefined}>
                  {f.t.trim().split(/\s{2,}/).map((c, k) => (conCabecera && j === 0 ? <th key={k} scope="col">{c}</th> : <td key={k}>{c}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const kv = (iSeccion < 0 || i < iSeccion) && i !== iTitulo ? l.t.match(/^([^:]{2,40}):\s*(.*)$/) : null;
    const clase = i === iTitulo ? " hl-titulo" : esSeccion(l.t) ? " hl-seccion" : /^\s*[•\-☐]\s/.test(l.t) ? " hl-vineta" : "";
    salida.push(
      <p key={i} className={`hl${clase}${marca}`}>
        <span>{kv ? <><b>{kv[1]}:</b> {texto(kv[2])}</> : texto(l.t)}</span>
        <Nota l={l} />
      </p>,
    );
  }
  return <div className="hoja">{salida}</div>;
}

function Cabecera({ titulo, sub, h }: { titulo: string; sub: string; h: HojaRevisada }) {
  return (
    <header className="ad-cab">
      <div><b>{titulo}</b><span>{sub}</span></div>
      <span className={`ad-sello ${h.aceptado ? "si" : "no"}`}>
        {h.aceptado ? <CircleCheck size={15} aria-hidden="true" /> : <CircleX size={15} aria-hidden="true" />}
        {h.aceptado ? "Pasa" : "No pasa"} · {h.cumple} de {h.total}
      </span>
    </header>
  );
}

/** Las dos hojas: el documento como llegó (con lo que está mal o falta) y cómo queda corregido. */
export default function AntesDespues({ c }: { c: Comparacion }) {
  if (c.antes.aceptado) {
    return (
      <div className="ad uno">
        <section aria-label="El documento">
          <Cabecera titulo="El documento" sub="No necesita cambios" h={c.antes} />
          <Hoja lineas={c.antes.lineas} />
        </section>
      </div>
    );
  }
  return (
    <>
      <ul className="ad-leyenda" aria-label="Qué significa cada color">
        <li className="m-error"><CircleX size={14} aria-hidden="true" /> Error o falta algo</li>
        <li className="m-aviso"><TriangleAlert size={14} aria-hidden="true" /> Fuera de orden o por completar</li>
        <li className="m-nuevo"><CircleCheck size={14} aria-hidden="true" /> Agregado o corregido</li>
      </ul>
      <div className="ad">
        <section aria-label="Antes: el documento como llegó">
          <Cabecera titulo="Antes" sub="Como llegó, con lo que está mal o falta" h={c.antes} />
          <Hoja lineas={c.antes.lineas} />
        </section>
        <section aria-label="Después: el documento corregido">
          <Cabecera titulo="Después" sub="Corregido según el formato oficial" h={c.despues} />
          <Hoja lineas={c.despues.lineas} />
        </section>
      </div>
    </>
  );
}
