const ours = [
  {
    t: "Fixes misheard names from context",
    d: '"mid construct" → semiconductor, before you ever see it',
  },
  {
    t: "Learns your vocabulary",
    d: "Correct a word once, it stays corrected in every later video",
  },
  {
    t: "Places captions around your layout",
    d: "Reads each shot, keeps text off your face and off the content",
  },
  {
    t: "Editable transcript",
    d: "Find-and-replace across the whole video",
  },
  {
    t: "Never rewrites what you said",
    d: "Corrections swap misheard words only. Not grammar, not phrasing.",
  },
];

const theirs = [
  { t: "Unlimited exports on a flat monthly plan", d: "If volume is the constraint, they win this" },
  { t: "Mature mobile app and template library", d: "Years of polish we don't have" },
];

export function Comparison() {
  return (
    <section id="comparison" className="border-b border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <h2 className="max-w-3xl text-[clamp(1.6rem,4vw,2.5rem)] font-bold leading-tight">
          They&apos;re built for volume.
          <span className="block text-primary">This is built to be right the first time.</span>
        </h2>
        <p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground">
          CapCut, Opus Clip, VEED and Submagic are good tools, and if you speak the English their
          models were trained on they&apos;ll serve you well. This is for everyone else — where the
          captions come back nearly right, and &ldquo;nearly&rdquo; costs you twenty minutes a video.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-primary/40 bg-background p-5 sm:p-7">
            <p className="font-mono text-xs uppercase tracking-widest text-primary">
              What ViralFrame optimises for
            </p>
            <ul className="mt-5 space-y-5">
              {ours.map((r) => (
                <li key={r.t} className="border-l-2 border-primary/50 pl-4">
                  <p className="font-display font-medium">{r.t}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.d}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-background p-5 sm:p-7">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              What they optimise for — and genuinely do better
            </p>
            <ul className="mt-5 space-y-5">
              {theirs.map((r) => (
                <li key={r.t} className="border-l-2 border-border pl-4">
                  <p className="font-display font-medium">{r.t}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.d}</p>
                </li>
              ))}
            </ul>
            <p className="mt-8 border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground">
              We compare on what each tool is built to optimise, not on accuracy statistics. We
              haven&apos;t benchmarked anyone else&apos;s transcription, so we won&apos;t publish numbers about it.
              Upload a video you&apos;ve already published and judge ours directly.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}