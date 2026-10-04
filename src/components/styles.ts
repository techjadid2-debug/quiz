type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

const variants: Record<Variant, string> = {
  primary: "bg-fg text-bg hover:opacity-90 transition-opacity",
  secondary: "border border-border bg-bg text-fg hover:bg-surface",
  ghost: "text-muted hover:text-fg hover:bg-surface",
  danger: "border border-border bg-bg text-danger hover:bg-danger-soft",
};

export function buttonClass(variant: Variant = "primary", extra = ""): string {
  return `${base} ${variants[variant]} ${extra}`.trim();
}

export const cardClass = "rounded-xl border border-border bg-bg p-5 sm:p-6";
