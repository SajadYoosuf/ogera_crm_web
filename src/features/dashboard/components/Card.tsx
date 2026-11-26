import Link from "next/link";
import type { ReactNode } from "react";

export function Card({ id, title, hint, action, children }: {
  id?: string; title: string; hint?: string; action?: { label: string; href: string }; children: ReactNode;
}) {
  const headingId = `${id ?? title.replace(/\W+/g, "-").toLowerCase()}-title`;
  return (
    <section id={id} aria-labelledby={headingId} className="flex min-w-0 scroll-mt-24 flex-col rounded-[14px] border border-[#E7E7EA] bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-[14.5px] font-bold text-[#1A1C21]">{title}</h2>
          {hint && <p className="text-xs text-[#6B7080]">{hint}</p>}
        </div>
        {action && (
          // Padded out to a comfortable tap target on phones without moving the heading.
          <Link href={action.href} className="-my-3 -mr-2 inline-flex min-h-11 shrink-0 items-center px-2 text-xs font-semibold text-[#0E7A4F] hover:underline sm:my-0 sm:mr-0 sm:min-h-0 sm:px-0">{action.label}</Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-[#F7F7F9] px-3 py-5 text-center text-sm text-[#6B7080]">{children}</p>;
}

export type Tile = {
  label: string;
  value: number | string;
  hint?: string;
  /** Colours the number when it asks for action; the hint always says why in words. */
  tone?: "danger" | "warning";
  /** A page ("/dashboard/…") or a section of this one ("#queue"). */
  href?: string;
};

export function Tiles({ items, label }: { items: Tile[]; label: string }) {
  // Three tiles share one row on a phone, so the list below them starts higher up.
  const columns = items.length === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-3";
  return (
    <ul aria-label={label} className={`grid gap-2 sm:gap-3 ${columns} xl:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]`}>
      {items.map((tile) => {
        const alert = Number(tile.value) > 0 || typeof tile.value === "string";
        const colour = alert && tile.tone === "danger" ? "text-[#B42323]" : alert && tile.tone === "warning" ? "text-[#9A5B00]" : "text-[#1A1C21]";
        const body = (
          <>
            <span className="block text-xs font-medium text-[#6B7080]">{tile.label}</span>
            <span className={`mt-1 block text-[26px] font-bold leading-8 ${colour}`} style={{ fontFamily: "'Sora', 'DM Sans', sans-serif" }}>{tile.value}</span>
            {tile.hint && <span className="mt-0.5 block text-[11.5px] text-[#6B7080]">{tile.hint}</span>}
          </>
        );
        const box = "block h-full rounded-[14px] border border-[#E7E7EA] bg-white p-3 sm:p-4";
        const link = `${box} transition-colors hover:border-[#9ED8B8]`;
        return (
          <li key={tile.label} className="min-w-0">
            {!tile.href ? <div className={box}>{body}</div>
              : tile.href.startsWith("#") ? <a href={tile.href} className={link}>{body}</a>
              : <Link href={tile.href} className={link}>{body}</Link>}
          </li>
        );
      })}
    </ul>
  );
}
