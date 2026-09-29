"use client";

import { Minus, Plus } from "lucide-react";

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
}

export default function Stepper({ value, min, max, onChange, label }: StepperProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      {label && <span className="text-xs font-medium text-text-muted">{label}</span>}
      <div className="flex items-center gap-3 rounded-full border border-border-subtle bg-card px-2 py-1">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-main transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Harf sayısını azalt"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-5 text-center text-lg font-semibold tabular-nums text-text-main">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-main transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Harf sayısını artır"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
