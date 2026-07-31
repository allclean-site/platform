/**
 * Modal dialog primitive — the keyboard and screen-reader behaviour every modal is expected to have.
 *
 * Built once so both the media picker and the publish dialog behave identically: announced as a
 * dialog, closable with Escape, focus moved inside on open, kept inside while open, and returned to
 * whatever opened it on close. Without this a keyboard user could tab out of an open modal into the
 * page behind it and lose their place, and a screen reader would never announce that a dialog opened.
 *
 * References: WAI-ARIA Authoring Practices, Dialog (Modal) pattern; WCAG 2.1.2 No Keyboard Trap and
 * 2.4.3 Focus Order.
 */

import React, { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  label, onClose, className = "", boxClassName = "", children,
}: {
  /** Accessible name, announced when the dialog opens. */
  label: string;
  onClose: () => void;
  /** Class for the backdrop. */
  className?: string;
  /** Class for the dialog panel itself. */
  boxClassName?: string;
  children: React.ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement as HTMLElement | null;
    // Move focus into the dialog so the next Tab stays inside it.
    const first = boxRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? boxRef.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab") return;
      const items = Array.from(boxRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
        .filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first2 = items[0], last = items[items.length - 1];
      // Wrap around instead of escaping into the page behind the dialog.
      if (e.shiftKey && document.activeElement === first2) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first2.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      returnTo.current?.focus?.();   // give focus back to the control that opened us
    };
  }, [onClose]);

  return (
    <div className={className} onClick={onClose}>
      <div ref={boxRef} className={boxClassName} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
