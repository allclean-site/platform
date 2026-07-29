/**
 * Backdrop: a flowing "ribbon" of ~30 parallel violet lines over a purple gradient (the "violet waves"
 * reference). Technique = a canvas flow-field: every line shares one travelling centerline; a per-column
 * cos() "twist" factor scales their perpendicular offset, so where it crosses zero the lines collapse
 * into a bright bundle (the ribbon seen edge-on / vortex) and where it peaks they fan out — the running
 * phase makes it twist and flow. Colours come from --rb-* tokens (re-read on theme change). Always on.
 */

import React, { useEffect, useRef } from "react";
import "../styles/retrobg.css";

export function RetroBg() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, raf = 0;
    let color = "#a97cff";
    const readColor = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--rb-line").trim();
      if (v) color = v;
    };
    readColor();
    const mo = new MutationObserver(readColor);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const N = 34, STEP = 8;
    const draw = (ms: number) => {
      const t = ms * 0.001;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      const th = H * 0.26; // ribbon half-thickness
      for (let i = 0; i < N; i++) {
        const fi = i / (N - 1);                 // 0..1 across the ribbon
        ctx.globalAlpha = 0.09 + 0.05 * Math.sin(fi * Math.PI);
        ctx.beginPath();
        for (let x = 0; x <= W; x += STEP) {
          const u = x / W;
          // travelling centerline (big slow S across the screen)
          const base = H * 0.5
            + Math.sin(u * 3.1 + t * 0.45) * H * 0.17
            + Math.sin(u * 1.3 - t * 0.30) * H * 0.10;
          // twist factor: 0 → lines collapse into a bright bundle (edge-on); ±1 → fan out
          const twist = Math.cos(u * 3.3 - t * 0.55);
          const y = base + (fi - 0.5) * 2 * th * twist;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); mo.disconnect(); };
  }, []);

  return <canvas id="retrobg" ref={ref} aria-hidden="true" />;
}
