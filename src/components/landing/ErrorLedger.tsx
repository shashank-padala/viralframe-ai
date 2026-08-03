import { captionErrors } from "@/lib/errors";

const COUNT_WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
  "Nine", "Ten", "Eleven", "Twelve",
];

export function ErrorLedger() {
  return (
    <section className="border-b border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <h2 className="max-w-2xl text-[clamp(1.5rem,3.6vw,2.25rem)] font-bold leading-tight">
          {COUNT_WORDS[captionErrors.length] ?? captionErrors.length} of the thirty-seven, from one
          real video.
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Nothing here is illustrative. These are the words the recogniser returned, and the words
          that were actually said.
        </p>

        <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-background">
          {captionErrors.map((e) => (
            <li
              key={e.wrong}
              className="grid items-baseline gap-x-3 gap-y-1 px-4 py-3.5 font-mono text-[13px] sm:grid-cols-[1fr_auto_1fr] sm:px-6 sm:text-sm"
            >
              <span className="uppercase">
                <span className="text-muted-foreground/60">{e.before} </span>
                <span className="text-[var(--wrong)] line-through decoration-[var(--wrong)]/60">
                  {e.wrong}
                </span>
              </span>
              <span aria-hidden className="hidden text-muted-foreground/50 sm:inline">
                →
              </span>
              <span className="uppercase">
                <span className="text-[var(--right)]">{e.right}</span>{" "}
                <span className="text-muted-foreground/60">{e.after}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          10 min · ~2,000 words spoken · 37 corrected · 641 caption cards
        </p>
      </div>
    </section>
  );
}