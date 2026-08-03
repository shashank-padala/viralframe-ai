const steps = [
  {
    n: "01",
    t: "Upload your video",
    d: "Any length, any resolution. Landscape long-form is what this is built for.",
    who: "you",
  },
  {
    n: "02",
    t: "We fix it in context",
    d: "The whole transcript is read as one piece, so names get corrected the way a human would: by understanding the sentence around them.",
    who: "us",
  },
  {
    n: "03",
    t: "You check what's left",
    d: "Click any word to jump to that moment. Find-and-replace handles anything recurring.",
    who: "us",
  },
  {
    n: "04",
    t: "Export everything",
    d: "Captioned video at your source resolution, a subtitle file, and a YouTube title and description.",
    who: "us",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <h2 className="text-[clamp(1.6rem,4vw,2.5rem)] font-bold leading-tight">
          Four steps. One of them is your work.
        </h2>

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li
              key={s.n}
              className={`rounded-xl border p-5 ${
                s.who === "you"
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-card/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs tracking-widest text-muted-foreground">
                  {s.n}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-widest ${
                    s.who === "you" ? "text-primary" : "text-muted-foreground/70"
                  }`}
                >
                  {s.who === "you" ? "your work" : "automatic"}
                </span>
              </div>
              <p className="mt-4 font-display text-lg font-medium">{s.t}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}