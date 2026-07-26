import React from "react";

/** Brand mark (self-colored SVG) + wordmark in currentColor so it adapts to light/dark. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo">
      <img src="/mark.svg" alt="" width={size} height={size} />
      <b className="logo__word">LeadGenium</b>
    </span>
  );
}
