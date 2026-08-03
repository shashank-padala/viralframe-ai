const items = [
  {
    t: "Context-aware correction",
    d: "Names and technical terms, fixed against the whole transcript rather than one line at a time.",
  },
  {
    t: "Layout-aware placement",
    d: "Keeps captions off your face and off the content, including the corner your webcam sits in.",
  },
  {
    t: "One emphasised word per card",
    d: "On about a third of cards. Emphasise everything and you've emphasised nothing.",
  },
  {
    t: "An editable transcript",
    d: "Click a word to jump to that moment; find-and-replace across the whole video.",
  },
  {
    t: "A faithful subtitle file",
    d: "Verbatim, for accessibility.",
  },
  {
    t: "YouTube metadata",
    d: "Title, description, chapters and hashtags, generated from the corrected transcript so your product names are spelled right.",
  },
];

export function WhatYouGet() {
  return (
    <section className="border-b border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <h2 className="text-[clamp(1.6rem,4vw,2.5rem)] font-bold leading-tight">What you get</h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <div key={i.t} className="bg-background p-6">
              <p className="font-display font-medium">{i.t}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{i.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}