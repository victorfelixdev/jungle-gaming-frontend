import { X } from "lucide-react";

export function CouponPill({ code, onRemove }: { code: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--primary)] bg-[var(--surface-raised)] py-1 pl-3 pr-1 text-xs font-bold text-[var(--accent)]">
      <span className="truncate">{code}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover cupom ${code}`}
        className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-[var(--surface-card)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </span>
  );
}
