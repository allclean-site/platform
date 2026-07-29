/**
 * Backdrop: just a purple perspective grid scrolling toward the viewer (synthwave floor). Fixed behind
 * the app; the moving lines show in the frame around the app and through the glass sidebar/rim.
 * Theme-aware via --rb-* tokens. Always animates.
 */

import React from "react";
import "../styles/retrobg.css";

export function RetroBg() {
  return (
    <div id="retrobg" aria-hidden="true">
      <div id="retrobg-glow" />
      <div id="retrobg-grid" />
    </div>
  );
}
