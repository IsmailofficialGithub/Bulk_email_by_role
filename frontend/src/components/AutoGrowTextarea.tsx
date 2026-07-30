"use client";

import {
  useEffect,
  useRef,
  type TextareaHTMLAttributes,
} from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  maxHeight?: number;
};

export function AutoGrowTextarea({
  value,
  maxHeight = 280,
  className,
  onInput,
  ...props
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${Math.max(next, 88)}px`;
  }, [value, maxHeight]);

  return (
    <textarea
      {...props}
      ref={ref}
      value={value}
      className={className}
      onInput={(e) => {
        const el = e.currentTarget;
        el.style.height = "0px";
        el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
        onInput?.(e);
      }}
    />
  );
}
