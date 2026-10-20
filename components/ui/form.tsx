import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-9", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2", className)} {...props} />;
}

/** Feld mit Beschriftung und optionalem Hinweis. */
export function Field({
  label,
  htmlFor,
  hint,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  optional?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">({optional})</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Checkbox({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 rounded border-input accent-primary" {...props} />
      {label}
    </label>
  );
}
