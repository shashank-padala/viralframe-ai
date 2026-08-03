import { Check, Minus } from "lucide-react";

// A comparison where one column wins every row reads as marketing and is
// believed by nobody. The competitors here genuinely are better at several
// things, so those rows are conceded plainly -- it makes the rows we do win
// worth something, and it keeps every claim defensible.
//
// Every row compares what each tool is *built to optimise*. There are no
// accuracy statistics, because we have not run that benchmark, and
// publishing numbers we cannot substantiate about named companies is not a
// risk worth taking for a landing page.

interface Row {
  label: string;
  detail: string;
  us: boolean;
  them: boolean;
}

const ROWS: Row[] = [
  {
    label: "Fixes misheard names from context",
    detail: "“mid construct” → semiconductor, before you ever see it",
    us: true,
    them: false,
  },
  {
    label: "Learns your vocabulary",
    detail: "A word you correct once stays corrected in every later video",
    us: true,
    them: false,
  },
  {
    label: "Places captions around your layout",
    detail: "Reads each shot and keeps text off your face and off the content",
    us: true,
    them: false,
  },
  {
    label: "Editable transcript with find-and-replace",
    detail: "Fix a recurring word across the whole video in one action",
    us: true,
    them: false,
  },
  {
    label: "Never rewrites what you said",
    detail: "Corrections swap words the recogniser got wrong — never your grammar",
    us: true,
    them: false,
  },
  {
    label: "Unlimited exports on a flat monthly plan",
    detail: "Their model, and a good one if you publish constantly",
    us: false,
    them: true,
  },
  {
    label: "Mobile app and template library",
    detail: "Years of polish we are not going to match soon",
    us: false,
    them: true,
  },
];

function Cell({ yes }: { yes: boolean }) {
  return yes ? (
    <Check className="mx-auto h-4 w-4 text-brand" aria-label="yes" />
  ) : (
    <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="no" />
  );
}

export function Comparison() {
  return (
    <section id="comparison" className="border-y border-border/60 bg-surface/40">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <div className="text-xs font-semibold uppercase tracking-widest text-brand">
          Honestly compared
        </div>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
          They&apos;re built for volume.{" "}
          <span className="font-display italic text-highlight">
            This is built to be right the first time.
          </span>
        </h2>
        <p className="mt-5 max-w-2xl text-muted-foreground">
          CapCut, Opus Clip, VEED and Submagic are good tools, and if you speak the English
          their models were trained on they will serve you well. This is for everyone else —
          where the captions come back nearly right, and &ldquo;nearly&rdquo; costs you twenty
          minutes a video.
        </p>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="py-4 pr-4 font-medium text-muted-foreground">What it optimises for</th>
                <th className="w-32 px-3 py-4 text-center font-semibold">ViralFrame</th>
                <th className="w-40 px-3 py-4 text-center font-medium text-muted-foreground">
                  CapCut · Opus · VEED
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b border-border/60 last:border-0">
                  <td className="py-4 pr-4">
                    <div className="font-medium">{row.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{row.detail}</div>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <Cell yes={row.us} />
                  </td>
                  <td className="px-3 py-4 text-center">
                    <Cell yes={row.them} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
