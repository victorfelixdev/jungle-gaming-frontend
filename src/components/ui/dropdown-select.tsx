import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface DropdownOption<T extends string> {
  label: string;
  value: T;
}

export function DropdownSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  listLabel = ariaLabel,
  name,
  className,
  triggerClassName,
  menuClassName,
  align = "left",
}: {
  value: T;
  options: readonly DropdownOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  listLabel?: string;
  name?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  useEffect(() => {
    if (!open) return;
    optionRefs.current[selectedIndex]?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open, selectedIndex]);

  const choose = (next: T) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${ariaLabel} ${options[selectedIndex]?.label ?? ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "flex items-center justify-between gap-2 text-[var(--foreground)] outline-none hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]",
          triggerClassName,
        )}
      >
        {options[selectedIndex]?.label ?? ""}
        <ChevronDown size={15} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <div
          id={id}
          role="listbox"
          aria-label={listLabel}
          onKeyDown={(event) => {
            const index = optionRefs.current.findIndex((option) => option === document.activeElement);
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const offset = event.key === "ArrowDown" ? 1 : -1;
              optionRefs.current[(index + offset + options.length) % options.length]?.focus();
            } else if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              optionRefs.current[event.key === "Home" ? 0 : options.length - 1]?.focus();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              triggerRef.current?.focus();
            }
          }}
          className={cn(
            "absolute top-full z-30 mt-2 min-w-full overflow-hidden rounded-sm border border-[var(--border)] bg-[var(--surface-card)] p-1 shadow-[0_8px_20px_rgb(10_6_4_/_45%)]",
            align === "right" ? "right-0" : "left-0",
            menuClassName,
          )}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(node) => { optionRefs.current[index] = node; }}
              type="button"
              role="option"
              aria-selected={value === option.value}
              onClick={() => choose(option.value)}
              className={cn(
                "block w-full rounded-sm px-3 py-2 text-left text-xs outline-none hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)]",
                value === option.value
                  ? "bg-[var(--surface-raised)] text-[var(--accent)]"
                  : "text-[var(--foreground)]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
