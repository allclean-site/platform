/**
 * Backdrop: flowing violet wave-lines over a purple gradient (abstract "violet waves"). Several sine
 * paths at different heights/amplitudes/speeds drift horizontally in a seamless loop (parallax).
 * Fixed behind the app; theme-aware via --rb-* tokens (white+violet light / deep-violet dark).
 */

import React from "react";
import "../styles/retrobg.css";

const VW = 1200, VH = 800, WAVELEN = 300; // viewBox + one wavelength (drift distance)

/** Smooth sine-ish wave path (quadratic arcs), wide enough to stay covered while drifting one wavelength. */
function wave(y: number, amp: number): string {
  const half = WAVELEN / 2;
  let d = `M ${-WAVELEN} ${y}`;
  let up = true;
  for (let x = -WAVELEN; x < VW + WAVELEN; x += half) {
    d += ` Q ${x + half / 2} ${up ? y - amp : y + amp} ${x + half} ${y}`;
    up = !up;
  }
  return d;
}

// y, amplitude, stroke-opacity, width, duration(s), reverse
const WAVES: [number, number, number, number, number, boolean][] = [
  [110, 46, 0.5, 2.0, 23, false],
  [220, 30, 0.3, 1.5, 31, true],
  [330, 58, 0.22, 2.5, 18, false],
  [440, 26, 0.42, 1.5, 27, true],
  [540, 42, 0.28, 2.0, 21, false],
  [640, 34, 0.5, 1.5, 35, true],
  [730, 52, 0.2, 3.0, 16, false],
];

export function RetroBg() {
  return (
    <div id="retrobg" aria-hidden="true">
      <svg id="retrobg-waves" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice">
        {WAVES.map(([y, amp, op, w, dur, rev], i) => (
          <path key={i} className="rbw" d={wave(y, amp)}
            style={{ strokeOpacity: op, strokeWidth: w, animationDuration: `${dur}s`, animationDirection: rev ? "reverse" : "normal" }} />
        ))}
      </svg>
    </div>
  );
}
