"use client";
import { useEffect, useRef } from "react";

/**
 * Aerogenerador hecho de puntos pequeños que gira despacio sobre la fotografía de fondo (three.js).
 * Con "reducir movimiento" se queda quieto, y se detiene mientras la pestaña está oculta.
 */
export default function FondoHelice() {
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas) return;
    let cancelado = false;
    let limpiar = () => {};

    import("three").then((THREE) => {
      if (cancelado) return;
      const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const escena = new THREE.Scene();
      const camara = new THREE.OrthographicCamera(0, 1, 1, 0, -1000, 1000);

      // Azar con semilla: la nube de puntos sale igual en cada visita
      let s = 7;
      const azar = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const material = (opacidad: number, tam: number) =>
        new THREE.PointsMaterial({ color: 0xf6f4f0, size: tam, sizeAttenuation: false, transparent: true, opacity: opacidad, depthWrite: false });
      const nube = (pts: number[], mat: InstanceType<typeof THREE.PointsMaterial>) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        return new THREE.Points(g, mat);
      };

      // Tres aspas (longitud 1): anchas cerca del buje y afinadas hacia la punta
      const aspas: number[] = [];
      for (let k = 0; k < 3; k++) {
        const giro = (k * 2 * Math.PI) / 3;
        for (let i = 0; i < 2600; i++) {
          const r = 0.06 + Math.pow(azar(), 0.8) * 0.94;
          const ancho = 0.085 * Math.pow(1 - r, 0.7) + 0.012;
          const u = (azar() * 2 - 1) * ancho * (azar() < 0.35 ? 1 : azar());
          const x = u + ancho * 0.45, y = r;
          aspas.push(x * Math.cos(giro) - y * Math.sin(giro), x * Math.sin(giro) + y * Math.cos(giro), (azar() - 0.5) * 0.04);
        }
      }
      // Buje
      for (let i = 0; i < 500; i++) {
        const a = azar() * Math.PI * 2, r = Math.sqrt(azar()) * 0.06;
        aspas.push(Math.cos(a) * r, Math.sin(a) * r, 0);
      }
      // Torre: columna que se ensancha hacia abajo
      const torre: number[] = [];
      for (let i = 0; i < 1800; i++) {
        const t = azar();
        torre.push((azar() * 2 - 1) * (0.012 + 0.028 * t), -0.05 - t * 2.2, 0);
      }

      const rotor = nube(aspas, material(0.62, 1.7));
      const mastil = nube(torre, material(0.34, 1.5));
      const molino = new THREE.Group();
      molino.add(mastil, rotor);
      escena.add(molino);

      const ajustar = () => {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        camara.right = w; camara.top = h;
        camara.updateProjectionMatrix();
        const largo = Math.min(w, h) * (w < 700 ? 0.42 : 0.46);
        molino.scale.setScalar(largo);
        molino.position.set(w < 700 ? w * 0.5 : w * 0.8, h * 0.56, 0);
      };
      ajustar();
      window.addEventListener("resize", ajustar);

      let cuadro = 0, antes = performance.now();
      const pintar = (ahora: number) => {
        rotor.rotation.z -= ((ahora - antes) / 1000) * 0.35;
        antes = ahora;
        renderer.render(escena, camara);
        if (!quieto) cuadro = requestAnimationFrame(pintar);
      };
      const alCambiar = () => {
        cancelAnimationFrame(cuadro);
        if (!document.hidden && !quieto) { antes = performance.now(); cuadro = requestAnimationFrame(pintar); }
      };
      document.addEventListener("visibilitychange", alCambiar);
      rotor.rotation.z = 0.4;
      pintar(performance.now());

      limpiar = () => {
        cancelAnimationFrame(cuadro);
        window.removeEventListener("resize", ajustar);
        document.removeEventListener("visibilitychange", alCambiar);
        rotor.geometry.dispose(); mastil.geometry.dispose();
        (rotor.material as InstanceType<typeof THREE.PointsMaterial>).dispose();
        (mastil.material as InstanceType<typeof THREE.PointsMaterial>).dispose();
        renderer.dispose();
      };
    });

    return () => { cancelado = true; limpiar(); };
  }, []);

  return <canvas ref={lienzo} className="fondo-helice" />;
}
