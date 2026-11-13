# ACM Talk Outline — Team Calendula and Systemiser (15 minutes) — v3

> ⚠ v3.4 sync note: the deck is now **18 slides** and renders this running order — 1 title · 2 hook · 3 funding funnel · 4 scale + uneven neglect · **5 AI evidence · 6 technology gap** (AI-first, as the deck renders it; the gap slide's "and now, generic AI chatbots" reads as a callback) · 7 PTSD proof · 8 Team Calendula entrance · 9 landscape · 10 Systemiser continuity · 11 capabilities · 12 honest status · 13 ecosystem + stack · 14 planned gateways (split out of the ecosystem slide in v3.1) · 15 roadmap · 16 beyond Systemiser · 17 close · 18 references. `draft-script.md` v3.4 is the source of truth for spoken beats and timing.

**Audience (Jardin, Nov 2026 — governs every slide): computer engineers, potential designers and developers.** Engineering-first register: design spaces, architecture, platform constraints. The human stakes carry the why; the engineering carries the how.

Source of truth: `acm-abstract.md` v7. Framing constraints from `handoff-summary.md` apply throughout (clinical vocabulary only, singular first person, honest build status, continuity framing, no community terminology).

**Reveal rule (v3.4, matches the built deck):** slides 1–8 stay disorder-agnostic. The landscape slide (9) names **dissociative disorders** as the starred under-served class — that is the deliberate reveal, immediately followed by the Systemiser reveal (10). Never named before slide 9.

**Superseded v2 calls (history):** the v2 structure had gap-before-AI, PTSD folded into the Team Calendula beat, and ecosystem + gateways merged — all since restructured (PTSD its own slide 7; gateways their own slide 14).

## Problem statement (reference — NOT the spoken introduction)

Engineer-facing recast (Jardin's reframe) + the scale sentence:

> Software has rebuilt sector after sector — finance, transport, logistics, communication — yet a few sectors technology touches have barely moved, and mental health is one of them. More than one billion people live with mental-health conditions, support reaches only a fraction, and within that population, conditions drawing disproportionately little research support relative to their real-world burden remain invisible to technology — even as software advances make assistive mental-health technology newly feasible, making the gap more urgent rather than less.

Role: anchor for slides 3–6. The spoken introduction opens with the crisis line instead. Does NOT claim: a funding percentage, "no care at all," or a separately measured dissociative-disorder funding statistic. Does NOT name any specific disorder cluster before slide 9.

## Speech skeleton

**Title:** Team Calendula and Systemiser: Building Software for Under-Represented Mental Health Conditions

**General purpose:** To inform (with a persuasive through-line).

**Specific purpose:** To show an engineering audience an under-served design space in mental-health software and how Team Calendula addresses part of it — trauma-related conditions — beginning with dissociative disorders.

**Thesis / central idea:** Technology has transformed most sectors but left mental-health software concentrated on a few common conditions; Team Calendula targets under-represented, trauma-related conditions, and its first product, Systemiser, serves dissociative disorders by restoring continuity of memory, identity, and daily organization — with four core feature cycles exercised in prototype testing to date.

## Introduction (~1.5 min: slides 1–2)

- **I. Attention getter.** *(Full beat-by-beat in `speaker-notes.md` slide 2.)* "We are in a crisis — though you might not know it." + pivot to what technology builds and what it doesn't. NO audience question, NO AI mention, NO disorder names.
- **II. Engineer-facing problem statement** (the recast above — slide 3's opening claim; the WHO number follows on slide 4).
- **III. Preview of main points.** "I'll show where technology's attention has gone, where it hasn't, my response to part of that gap, and the first product built on it."

*Transition (full sentence):* "First — the design space."

## Body

- **I. The problem: innovation everywhere, some sectors left behind (~2 min)** — abstract S1–S2, engineer-facing (slides 3–4)
  - A. Fastest innovation cycle in software history; whole sectors rebuilt; mental health barely moved (funding funnel: sector wave first, health zoom second).
  - B. Scale: 1 billion+ people with mental-health conditions, support reaches a fraction (WHO, Sept 2025); neglect is uneven across conditions — measurable via IAMHRF (<2% funding vs >50% deaths; 95% high-income).
- **II. AI: the evidence (~1 min, lighter tone)** — slide 5
  - A. Hands question (show-of-hands, self-included) → people improvise with tools never built for it.
  - B. The use of AI is the trace evidence of the gap; two sober risk lines (OpenAI-reported data; ACM FAcCT study). Not anti-AI. Detail: `reference-chatbot-facts.md`.
- **III. The technology gap (~1 min)** — slide 6
  - A. Advances in platforms, real-time collaboration, AI, privacy engineering make assistive mental-health tech newly feasible.
  - B. The allocation evidence (facts in `reference-tech-gap-facts.md`): research funding fell back to 2014 levels (IAMHRF); median 2% of health budgets (WHO Atlas); tech investment concentrates in generic formats — and now generic AI chatbots (callback to slide 5); "rather than a lack of need" (npj Digital Medicine).
  - C. The reach exists (87% online, near-parity) — therefore solvable. Punch: "The investment is where?" + PTSD asterisk.
- **IV. PTSD: proof the model works (~45 s)** — slide 7
  - A. Sustained public investment → purpose-built software (VA app suite, VR exposure, 170+ VA clinical sites).
  - B. The catch: VA-concentrated access — for veterans. PTSD is proof-of-model only, never my example of neglect, never a target.
- **V. Team Calendula: a solution to part of this (~45 s)** — abstract S4 (slide 8)
  - A. An independent software project (never "company") for trauma-based disorders — Jardin's framing.
  - B. Rigorous research per product: every product begins with research into the condition it serves.
- **VI. The landscape: how many trauma-related conditions (~50 s)** — slide 9
  - A. DSM-5 trauma- and stressor-related chapter: PTSD, acute stress disorder, prolonged grief disorder, adjustment disorders (F43.20–25), reactive attachment disorder, disinhibited social engagement disorder.
  - B. The starred class: **dissociative disorders** (the reveal) — no purpose-built software exists.
  - C. Tail: other clusters where trauma can be a major causal factor (depressive, anxiety, personality, substance-use).
- **VII. Systemiser (~5 min)** — abstract S5–S7 (slides 10–15)
  - A. Continuity by design — unifying need: continuity when dissociative symptoms disrupt memory, identity, and daily organization (slide 10, emotional center, one-tap mend).
  - B. Capabilities: identity states + transitions; structured record auto-linked to the identity state present; granular viewer-tiered privacy incl. Custom per-field tier (+ additional features pending Jardin's list) (slide 11).
  - C. Honest status: four core feature cycles exercised in prototype testing (identity-state representation/transitions, status/functioning tracking, privacy-gated sharing, collaborative information management) (slide 12). Never claim a working or shipped product.
  - D. Ecosystem + stack: desktop, mobile, web, social platforms; WebSocket sync; MongoDB + Redis + R2; OAuth2/JWT; built vs planned split (slide 13).
  - E. Planned gateways: social+work (Discord · Slack · Teams), voice assistants (Alexa · Google Assistant · Siri), in-vehicle (CarPlay · Android Auto), extensions & plugins, further categories — all "planned," never shipped (slide 14).
  - F. Roadmap: grounding + crisis-support tools under active development; daily-organization extensions (reminders, to-do lists, mood check-ins, calendar, accessibility); app connectivity (slide 15).
- **VIII. Team Calendula: beyond Systemiser (~40 s)** — abstract S8 (slide 16)
  - A. The reusable model: condition-specific products + rigorous research per product (TrigIn, Canary — spoken only as "planned"); gateway categories reusable across the family; connectivity across the family.
  - B. Trajectory: growing family, more under-represented conditions over time; "early conversations with clinicians and organizations already underway" (qualitative, Jardin-supplied).
  - C. Privacy bar (aspiration wording) stays available for Q&A only — not on slides.

*Transition:* "That's the trajectory. Let me close."

## Conclusion (~40 s, slide 17)

- **I. Review of main points.** Technology rebuilt sector after sector and left this one behind; the need is documented, the capability exists, attention is the missing piece; Team Calendula targets the gap condition by condition, starting with Systemiser — four tested cycles are the beginning, not the promise.
- **II. Signal the end.** Closing line invites questions. *(Draft: "One condition at a time — that is how the gap closes. Thank you.")* ⚠ Jardin to rephrase.

## Timing budget (per slide, sums to 14:30 + ~30s buffer — verified by arithmetic)

| Slide | Section | Seconds |
|---|---|---|
| 1 | Title | 30 |
| 2 | Hook (crisis line) | 30 |
| 3 | Funding funnel: where the money goes | 60 |
| 4 | Scale + uneven neglect | 60 |
| 5 | AI: the evidence | 55 |
| 6 | Technology gap | 70 |
| 7 | PTSD: proof the model works | 45 |
| 8 | Team Calendula: a solution to part of this | 45 |
| 9 | Landscape: trauma-related conditions | 50 |
| 10 | Systemiser: continuity (emotional center) | 75 |
| 11 | Systemiser: capabilities (+ expansion pending) | 75 |
| 12 | Systemiser: honest status (four tested cycles) | 45 |
| 13 | Systemiser: ecosystem + stack | 55 |
| 14 | Systemiser: planned gateways | 45 |
| 15 | Roadmap | 50 |
| 16 | Beyond Systemiser | 40 |
| 17 | Close | 40 |
| **Total (17 spoken)** | | **14:30** |

Sum check: 30+30+60+60+55+70+45+45+50+75+75+45+55+45+50+40+40 = 870 s = 14:30. Slide 18 (references) is outside the timed budget.

Buffer: ~30s — absorbs the hands beat (slide 5) and the slide-10 mend pause.

## Slide mapping (visual-first, no document dump)

| Slide | Content | Abstract source |
|---|---|---|
| 1 | Title + author + affiliation | form fields |
| 2 | Hook: "a crisis you might not know" (no question, no AI) | — |
| 3 | Funding funnel: sector wave (AI $19B…), AI 37% context, health zoom ($10.1B / $1.4B) | S1–S3 recast |
| 4 | Scale (1 billion+) + uneven neglect (IAMHRF: <2% funding vs >50% deaths; 95% high-income) | S1–S2 |
| 5 | AI: the evidence (1-in-4 / 1-in-2 / 4-in-5 bars, JeeP quote, OpenAI + FAcCT risk boxes) | — |
| 6 | Technology gap: 2014-level funding, 2% median, generic formats (+ AI callback), reach meta-analysis, "rather than a lack of need", "The investment is where?" + PTSD asterisk | S3 |
| 7 | PTSD: proof the model works (VA suite, VR exposure, 170+ sites; VA-concentrated access) | S4 |
| 8 | Team Calendula: a solution to part of this (trauma-based) | S4 |
| 9 | Landscape: DSM-5 trauma chapter + ICD-10 codes, dissociative disorders starred (the reveal) | S4 elaboration |
| 10 | Systemiser: continuity framing (emotional center, thread + mend) | S5 |
| 11 | Capabilities: states, transitions, auto-linked record + notes, tiered privacy incl. Custom (+ features TBD) | S5 |
| 12 | Honest status: four tested cycles (plain-language) | S7 |
| 13 | Ecosystem + stack: desktop/mobile/web/social, collab layer, data layer, auth; built vs planned | S6–S7 |
| 14 | Planned gateways: social+work, voice, in-vehicle, extensions & plugins, further (all planned) | S7 |
| 15 | Roadmap: grounding + crisis tools, daily-organization incl. to-do lists, app connectivity | S7 |
| 16 | Beyond Systemiser: TrigIn, Canary, family model, connectivity, networking | S8 |
| 17 | Close: "One condition at a time" | S8 |
| 18 | References (unnumbered, outside the timed budget) | — |

Visuals: diagrams and framing only. No placeholder or demo imagery implying a shipped product.
