// Single source of truth for verdict presentation.
//
// These colours used to live in two places — AdaptationBanner's `style`
// computed and VerdictStrip's `colorFor()` — which drifted apart as soon as
// anything else needed them. Everything that renders a verdict now calls
// verdictStyle().

export type Verdict = "progress" | "hold" | "regress" | "stop";

export interface VerdictStyle {
  label: string;
  /** Solid fill: badges, strip cells, dots. */
  solid: string;
  /** Background tint for panels. Never used for text. */
  soft: string;
  /** Text colour that passes AA on a light surface. */
  text: string;
  border: string;
  /** Text colour for use *on* the solid fill. */
  onSolid: string;
}

const NEUTRAL: VerdictStyle = {
  label: "unknown",
  solid: "bg-subtle",
  soft: "bg-raised",
  text: "text-muted",
  border: "border-line",
  onSolid: "text-white",
};

const STYLES: Record<Verdict, VerdictStyle> = {
  progress: {
    label: "progress",
    solid: "bg-verdict-progress",
    soft: "bg-verdict-progress-soft",
    text: "text-verdict-progress",
    border: "border-verdict-progress/30",
    onSolid: "text-white",
  },
  hold: {
    label: "hold",
    solid: "bg-verdict-hold",
    soft: "bg-verdict-hold-soft",
    text: "text-verdict-hold",
    border: "border-verdict-hold/30",
    onSolid: "text-white",
  },
  regress: {
    label: "regress",
    solid: "bg-verdict-regress",
    soft: "bg-verdict-regress-soft",
    text: "text-verdict-regress",
    border: "border-verdict-regress/30",
    onSolid: "text-white",
  },
  stop: {
    label: "stop",
    solid: "bg-verdict-stop",
    soft: "bg-verdict-stop-soft",
    text: "text-verdict-stop",
    border: "border-verdict-stop/40",
    onSolid: "text-white",
  },
};

// The `default` case matters: the old AdaptationBanner switch had none, so an
// unexpected verdict string returned undefined and the template threw on
// `style.wrapper` at render time. A neutral style degrades instead.
export function verdictStyle(verdict: string | null | undefined): VerdictStyle {
  if (verdict && verdict in STYLES) return STYLES[verdict as Verdict];
  return NEUTRAL;
}

export function isVerdict(v: string | null | undefined): v is Verdict {
  return !!v && v in STYLES;
}
