/**
 * A group of toolbar buttons that behaves the way assistive technology expects.
 *
 * A row of icon buttons is one control, not many: the WAI-ARIA toolbar pattern says Tab reaches the
 * group once and the arrow keys move between the buttons inside it. Without that, reaching the canvas
 * from the top bar means tabbing past every device, zoom and history button one at a time — which is
 * exactly the kind of thing that makes keyboard use unpleasant enough that people give up.
 *
 * Reference: WAI-ARIA Authoring Practices, Toolbar pattern (roving tabindex).
 */

import React, { useEffect, useRef, useState } from "react";

export function Toolbar({
  label, className = "", children,
}: {
  /** Accessible name for the group, e.g. "Устройство". */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const items = () =>
    Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])
      .filter((el) => el.offsetParent !== null);

  // Exactly one button is tabbable; the rest are reachable with the arrow keys.
  useEffect(() => {
    const list = items();
    list.forEach((el, i) => { el.tabIndex = i === Math.min(active, list.length - 1) ? 0 : -1; });
  });

  const onKeyDown = (e: React.KeyboardEvent) => {
    const list = items();
    if (!list.length) return;
    const cur = list.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (cur + 1) % list.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (cur - 1 + list.length) % list.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = list.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setActive(next);
    list[next].focus();
  };

  return (
    <div ref={ref} role="toolbar" aria-label={label} className={className} onKeyDown={onKeyDown}
      onFocus={(e) => {
        const i = items().indexOf(e.target as HTMLElement);
        if (i >= 0) setActive(i);
      }}>
      {children}
    </div>
  );
}
