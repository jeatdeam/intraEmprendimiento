import { Fragment, type ReactNode } from "react";
import { Logo } from "./Ilustraciones";

/**
 * Convierte el texto de la IA en un documento con formato de empresa.
 * Convenciones (las mismas que se le piden a la IA):
 *   - 1ª línea: título · "Código: … · Revisión: …" · líneas "Campo: valor"
 *   - "1. TÍTULO EN MAYÚSCULAS" = sección · "• " lista · "☐ " casilla · "1. texto" paso
 *   - líneas que empiezan con 2 espacios y columnas separadas por 2+ espacios = tabla
 */
type Bloque =
  | { t: "p"; txt: string }
  | { t: "sub"; txt: string }
  | { t: "lista"; items: string[] }
  | { t: "check"; items: string[] }
  | { t: "pasos"; items: string[] }
  | { t: "kv"; filas: [string, string][] }
  | { t: "tabla"; filas: string[][] };

interface Seccion { n?: string; titulo?: string; bloques: Bloque[] }

const letras = (s: string) => s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
const esMayus = (s: string) => { const l = letras(s); return l.length >= 4 && l.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, "").length / l.length > 0.6; };
const KV = /^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ()/%°.\-]{2,40}):\s+(.+)$/;

function parsear(texto: string) {
  const lineas = texto.replace(/\r/g, "").split("\n").filter((l) => !/^\s*[─━—=_\-]{5,}\s*$/.test(l));
  while (lineas.length && !lineas[0].trim()) lineas.shift();
  const titulo = (lineas.shift() ?? "").trim();
  let codigo = "";
  const subtitulos: string[] = [];
  const meta: [string, string][] = [];
  const secciones: Seccion[] = [{ bloques: [] }];
  let enCabecera = true;

  const agregar = (b: Bloque) => {
    const bs = secciones[secciones.length - 1].bloques;
    const ult = bs[bs.length - 1];
    if (ult && ult.t === b.t && "items" in ult && "items" in b) ult.items.push(...b.items);
    else if (ult && ult.t === "kv" && b.t === "kv") ult.filas.push(...b.filas);
    else if (ult && ult.t === "tabla" && b.t === "tabla") ult.filas.push(...b.filas);
    else bs.push(b);
  };

  for (const bruta of lineas) {
    const l = bruta.trim();
    if (!l) continue;
    const num = l.match(/^(\d+)[.)]\s+(.+)$/);
    if (num && esMayus(num[2])) { enCabecera = false; secciones.push({ n: num[1], titulo: num[2], bloques: [] }); continue; }
    if (!num && esMayus(l) && l.length < 70 && !KV.test(l)) { enCabecera = false; secciones.push({ titulo: l, bloques: [] }); continue; }
    if (/^c[oó]digo:/i.test(l) && enCabecera) { codigo = l.replace(/^c[oó]digo:\s*/i, ""); continue; }
    if (/^ {2,}\S/.test(bruta) && bruta.trim().split(/\s{2,}/).length > 1) { agregar({ t: "tabla", filas: [bruta.trim().split(/\s{2,}/)] }); continue; }
    if (/^[•\-*]\s+/.test(l)) { agregar({ t: "lista", items: [l.replace(/^[•\-*]\s+/, "")] }); continue; }
    if (/^☐\s*/.test(l)) { agregar({ t: "check", items: [l.replace(/^☐\s*/, "")] }); continue; }
    if (num) { agregar({ t: "pasos", items: [num[2]] }); continue; }
    const kv = l.match(KV);
    if (kv) {
      if (enCabecera && secciones.length === 1) meta.push([kv[1], kv[2]]);
      else agregar({ t: "kv", filas: [[kv[1], kv[2]]] });
      continue;
    }
    if (l.endsWith(":") && l.length < 60) { agregar({ t: "sub", txt: l.slice(0, -1) }); continue; }
    if (enCabecera && secciones.length === 1 && !meta.length && l.length < 80) { subtitulos.push(l); continue; }
    enCabecera = false;
    agregar({ t: "p", txt: l });
  }
  return { titulo, codigo, subtitulos, meta, secciones: secciones.filter((s) => s.titulo || s.bloques.length) };
}

/** Resalta ACEPTADO / NO ACEPTADO y los marcadores [completar]. */
function Valor({ v }: { v: string }): ReactNode {
  if (/NO ACEPTADO/.test(v)) return <span className="sello no">{v.replace(/[✅❌]\s*/g, "")}</span>;
  if (/ACEPTADO/.test(v)) return <span className="sello si">{v.replace(/[✅❌]\s*/g, "")}</span>;
  const partes = v.split(/(\[completar\])/);
  return <>{partes.map((p, i) => (p === "[completar]" ? <mark key={i}>[completar]</mark> : <Fragment key={i}>{p}</Fragment>))}</>;
}

function Contenido({ b, firmas }: { b: Bloque; firmas: boolean }) {
  switch (b.t) {
    case "p": return <p><Valor v={b.txt} /></p>;
    case "sub": return <p className="doc-sub">{b.txt}</p>;
    case "lista": return <ul>{b.items.map((x, i) => <li key={i}><Valor v={x} /></li>)}</ul>;
    case "check": return <ul className="doc-check">{b.items.map((x, i) => <li key={i}><span className="caja" aria-hidden="true" />{x}</li>)}</ul>;
    case "pasos": return <ol>{b.items.map((x, i) => <li key={i}><Valor v={x} /></li>)}</ol>;
    case "tabla":
      return (
        <div className="tabla-scroll">
          <table className="doc-tabla"><tbody>
            {b.filas.map((f, i) => <tr key={i}>{f.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
          </tbody></table>
        </div>
      );
    case "kv":
      if (firmas) {
        return (
          <div className="firmas">
            {b.filas.map(([k, v]) => (
              <div key={k} className="firma">
                <span className="firma-linea">{/^_+$/.test(v) ? "" : v}</span>
                <span className="firma-rol">{k}</span>
              </div>
            ))}
          </div>
        );
      }
      return <dl className="doc-kv">{b.filas.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd><Valor v={v} /></dd></Fragment>)}</dl>;
  }
}

export default function Documento({ texto, planta }: { texto: string; planta: string }) {
  const d = parsear(texto);
  const [cod, rev] = d.codigo.split(/\s*·\s*/);
  const hoy = new Date().toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <article className="documento" aria-label={d.titulo}>
      <header className="doc-cabecera">
        <div className="doc-empresa">
          <Logo size={40} />
          <div><b>{planta}</b><span>{d.subtitulos.map((x) => x.replace(`${planta} — `, "")).join(" · ") || "Documento interno"}</span></div>
        </div>
        <h2 className="doc-titulo">{d.titulo}</h2>
        <dl className="doc-control">
          <dt>Código</dt><dd>{cod || "—"}</dd>
          <dt>Revisión</dt><dd>{rev?.replace(/^revisi[oó]n:\s*/i, "") || "—"}</dd>
          <dt>Emitido</dt><dd>{hoy}</dd>
        </dl>
      </header>

      {d.meta.length > 0 && (
        <dl className="doc-meta">
          {d.meta.map(([k, v]) => <div key={k}><dt>{k}</dt><dd><Valor v={v} /></dd></div>)}
        </dl>
      )}

      {d.secciones.map((s, i) => {
        const firmas = /FIRMA/i.test(s.titulo ?? "");
        return (
          <section key={i} className="doc-seccion">
            {s.titulo && <h3>{s.n && <span className="doc-num">{s.n}</span>}{s.titulo}</h3>}
            {s.bloques.map((b, j) => <Contenido key={j} b={b} firmas={firmas} />)}
          </section>
        );
      })}

      <footer className="doc-pie">
        <span>{cod ? `${cod} · ` : ""}Uso interno</span>
        <span>Generado con el Asistente IA · {hoy}</span>
      </footer>
    </article>
  );
}
