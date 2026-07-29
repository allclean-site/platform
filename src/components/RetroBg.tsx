/**
 * Retro synthwave backdrop — stars, sun, mountains, a city skyline and a scrolling perspective grid.
 * Fixed behind the app; the neon glows through the glass sidebar/rim. Theme-aware (neon night in dark,
 * pastel daytime in light) via the --rb-* tokens. Grid uses a perspective gradient plane (robust +
 * smoother than dozens of line divs). Animations pause under prefers-reduced-motion (see retrobg.css).
 */

import React from "react";
import "../styles/retrobg.css";

// [left%, top%, scale]
const STARS: [number, number, number][] = [
  [5, 55, 2], [7, 5, 2], [10, 45, 1], [12, 35, 1], [15, 39, 1], [20, 10, 1], [35, 50, 2], [40, 16, 2],
  [43, 28, 1], [45, 30, 3], [55, 18, 1], [60, 23, 1], [62, 44, 2], [67, 27, 1], [75, 10, 2], [80, 25, 1],
  [83, 57, 1], [90, 29, 2], [95, 5, 1], [96, 72, 1], [98, 70, 3],
];

// [left%, height%, width%, antenna]
const BUILDINGS: [number, number, number, boolean?][] = [
  [4, 20, 3], [6, 50, 1.5], [8, 25, 4], [12, 30, 3], [13, 55, 3, true], [17, 20, 4], [18.5, 70, 1.5],
  [20, 30, 4], [21.5, 80, 2, true], [25, 60, 4], [28, 40, 4], [30, 70, 4], [35, 65, 4, true], [38, 40, 3],
  [42, 60, 2], [43, 85, 4, true], [45, 40, 3], [48, 25, 3], [50, 80, 4], [52, 32, 5], [55, 55, 3, true],
  [58, 45, 4], [61, 90, 4], [66, 99, 4, true], [69, 30, 4], [73.5, 90, 2], [72, 70, 4], [75, 60, 4],
  [80, 40, 4], [83, 70, 4, true], [87, 60, 3, true], [93, 50, 3], [91, 30, 4], [94, 20, 3], [98, 35, 2],
];

export function RetroBg() {
  return (
    <div id="retrobg" aria-hidden="true">
      <div id="retrobg-sky">
        <div id="retrobg-stars">
          {STARS.map(([l, t, s], i) => (
            <span key={i} className="retrobg-star" style={{ left: `${l}%`, top: `${t}%`, transform: `scale(${s})` }} />
          ))}
        </div>
        <div id="retrobg-sunWrap"><div id="retrobg-sun" /></div>
        <div id="retrobg-mountains">
          <div id="retrobg-mountains-left" className="retrobg-mountain" />
          <div id="retrobg-mountains-right" className="retrobg-mountain" />
        </div>
        <div id="retrobg-city">
          {BUILDINGS.map(([l, h, w, a], i) => (
            <span key={i} className={"retrobg-building" + (a ? " retrobg-antenna" : "")}
              style={{ left: `${l}%`, height: `${h}%`, width: `${w}%` }} />
          ))}
        </div>
      </div>
      <div id="retrobg-ground">
        <div id="retrobg-lines" />
      </div>
    </div>
  );
}
