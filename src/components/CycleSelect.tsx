"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface CycleSelectOption<T> {
  value: T;
  label: string;
}

interface CycleSelectProps<T> {
  value: T;
  options: CycleSelectOption<T>[];
  onChange: (value: T) => void;
  label?: string;
}

export default function CycleSelect<T>({ value, options, onChange, label }: CycleSelectProps<T>) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  function go(delta: number) {
    const nextIndex = (index + delta + options.length) % options.length;
    onChange(options[nextIndex].value);
  }

  return (
    <div className="flex items-center justify-center gap-3">
      {label && <span className="text-xs font-medium text-text-muted">{label}</span>}
      <div className="flex items-center gap-3 rounded-full border border-border-subtle bg-card px-2 py-1">
        <button
          type="button"
          onClick={() => go(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-main transition-colors hover:bg-card-hover"
          aria-label="Önceki seçenek"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[4.5rem] text-center text-sm font-semibold text-text-main">
          {options[index].label}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-main transition-colors hover:bg-card-hover"
          aria-label="Sonraki seçenek"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
