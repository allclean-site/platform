/**
 * Textarea that grows to fit its content instead of showing an inner scrollbar. Height tracks the
 * scrollHeight on every value change (and on mount), so long answers just make the field taller.
 */

import React, { useLayoutEffect, useRef } from "react";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number };

export function AutoTextarea({ value, minRows = 2, className, style, onInput, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  useLayoutEffect(resize, [value]);

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      rows={minRows}
      onInput={(e) => { resize(); onInput?.(e); }}
      style={{ overflow: "hidden", resize: "none", ...style }}
      {...rest}
    />
  );
}
