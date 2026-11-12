# ACM Talk Outline — Team Calendula and Systemiser (15 minutes) — v2

**Audience (Jardin, Nov 2026 — governs every slide): computer engineers, potential designers and developers.** Engineering-first register: design spaces, architecture, platform constraints. The human stakes carry the why; the engineering carries the how.

Source of truth: `acm-abstract.md` v7. Framing constraints from `handoff-summary.md` apply throughout (clinical vocabulary only, singular first person, honest build status, continuity framing, no community terminology).

**v2 structural changes (Jardin's calls):** dissociative disorders NOT mentioned before Systemiser (slides 3–8 disorder-agnostic, first mention slide 9); AI = lighter separate slide 6; Team Calendula framed as "a solution to part of this, for trauma-based disorders — PTSD isn't the only one in that class"; new slide 8 (trauma-related condition landscape, AndColon mapping visual candidate); ecosystem + gateways merged (slide 11); privacy bar = *striving toward* clinical-grade/HIPAA-aligned, never achieved; status + roadmap slides concrete-pending.

## Problem statement (reference — NOT the spoken introduction)

Engineer-facing recast (Jardin's reframe for slide 3) + the scale sentence:

> Software has rebuilt sector after sector — finance, transport, logistics, communication — yet a few sectors technology touches have barely moved, and mental health is one of them. More than one billion people live with mental-health conditions, support reaches only a fraction, and within that population, conditions drawing disproportionately little research support relative to their real-world burden remain invisible to technology — even as software advances make assistive mental-health technology newly feasible, making the gap more urgent rather than less.

Role: anchor for slides 3–5. The spoken introduction opens with the crisis line instead. Does NOT claim: a funding percentage, "no care at all," or a separately measured dissociative-disorder funding statistic. Does NOT name any specific disorder cluster before slide 9.

## Speech skeleton (per the outline template)

**Title:** Team Calendula and Systemiser: Building Software for Under-Represented Mental Health Conditions

**General purpose:** To inform (with a persuasive through-line).

**Specific purpose:** To show an engineering audience an under-served design space in mental-health software and how Team Calendula addresses part of it — trauma-related conditions — beginning with dissociative disorders.

**Thesis / central idea:** Technology has transformed most sectors but left mental-health software concentrated on a few common conditions; Team Calendula targets under-represented, trauma-related conditions, and its first product, Systemiser, serves dissociative disorders by restoring continuity of memory, identity, and daily organization — with four core feature cycles exercised in prototype testing to date.

## Introduction (~2 min)

- **I. Attention getter.** *(Full beat-by-beat in `speaker-notes.md` slide 2.)* "We are in a crisis — though you might not know it." + pivot to what technology builds and what it doesn't. NO audience question, NO AI mention, NO disorder names.
- **II. Engineer-facing problem statement** (the recast above — slide 3's opening claim; the WHO number follows on slide 4).
- **III. Preview of main points.** "I'll show where technology's attention has gone, where it hasn't, my response to part of that gap, and the first product built on it."

*Transition (full sentence):* "First — the design space."

## Body

- **I. The problem: innovation everywhere, some sectors left behind (~2.5 min)** — abstract S1–S2, engineer-facing (slides 3–4)
  - A. Fastest innovation cycle in software history; whole sectors rebuilt; mental health barely moved.
  - B. Scale: 1 billion+ people with mental-health conditions, support reaches a fraction (WHO, Sept 2025); neglect is uneven across conditions — some attract funding and tech investment, others draw little relative to burden.
    - 1. Qualitative claim only — no percentage on any slide.
    - 2. NO specific disorder clusters named yet (Jardin's rule — focus condition revealed with Systemiser).
- **II. The technology gap (~1.5 min)** — abstract S3 + tech-gap facts (slide 5)
  - A. Advances in platforms, real-time collaboration, AI, privacy engineering make assistive mental-health tech newly feasible.
  - B. The allocation evidence (facts in `reference-tech-gap-facts.md`): research funding fell back to 2014 levels (IAMHRF); tech investment concentrates in generic formats for common conditions and its share is shrinking (Rock Health); AI investment skips mental health, "rather than a lack of need" (npj Digital Medicine).
  - C. Therefore the gap is growing more urgent, not less.
- **III. AI: the telling extra (~1 min, lighter tone)** — slide 6, separate slide (Jardin's call)
  - A. Hands question (show-of-hands, self-included) → people improvise with tools never built for it.
  - B. The use of AI is the trace evidence of the gap; one sober risk line (OpenAI-reported data; ACM FAcCT study). Not anti-AI. Detail: `reference-chatbot-facts.md`.
- **IV. Team Calendula: a solution to part of this (~1.5 min)** — abstract S4 (slide 7)
  - A. An independent software project (never "company") for trauma-based disorders — Jardin's framing.
  - B. PTSD as proof-of-model only (VA app suite + Bravemind VR, 170+ VA clinical sites); PTSD is NOT the only condition in that class that deserves focus — never named as a target.
  - C. Rigorous research per product: every product begins with research into the condition it serves.
- **V. The landscape: how many trauma-related conditions (~1 min)** — NEW slide 8
  - A. DSM-5 trauma- and stressor-related chapter: PTSD, acute stress disorder, adjustment disorders, reactive attachment disorder, disinhibited social engagement disorder, prolonged grief disorder (DSM-5-TR).
  - B. Closely tied condition classes around the chapter; AndColon research mapping is cataloguing them (visual candidate: AndColon screenshot — ⚠ contains a dissociative-disorders category; Jardin decides).
  - C. Dissociative disorders NOT named here.
- **VI. Systemiser (~4.5 min)** — abstract S5–S7, Systemiser-specific content clustered (slides 9–13)
  - A. Continuity by design — unifying need: continuity when dissociative symptoms disrupt memory, identity, and daily organization. FIRST mention of dissociative disorders (slide 9).
  - B. Capabilities: identity states + transitions; structured record (auto-linked to the identity state present when created); granular viewer-tiered privacy. (+ additional features pending Jardin's list)
  - C. Built as an ecosystem with planned gateways (MERGED slide): desktop, mobile, web; real-time collaboration layer; privacy-focused cloud storage; gateways into messaging/collaboration (Discord, Slack) and in-vehicle (CarPlay, Android Auto) — "planned," never shipped claims.
  - D. Honest status: four core feature cycles exercised in prototype testing (identity-state representation/transitions, status/functioning tracking, privacy-gated sharing, collaborative information management). Never claim a working or shipped product. *(Concrete-pending — Jardin may firm up.)*
  - E. Roadmap: grounding + crisis-support tools under active development; daily-organization extensions (reminders, offline, accessibility). *(Concrete-pending.)*
- **VII. Team Calendula: beyond Systemiser (~1 min)** — abstract S8, the general model (slide 14)
  - A. The reusable model: condition-specific products + rigorous research per product; gateway categories reusable across the family.
  - B. Privacy bar worded as aspiration: "with the aim of clinical-grade, HIPAA-aligned privacy as the ecosystem matures" — NEVER asserted as achieved (not inside medical systems yet).
  - C. Trajectory: growing family of products, more under-represented conditions over time; "early conversations with clinicians and organizations already underway" (qualitative, Jardin-supplied).
  - D. No named future conditions (PTSD stays proof-of-model, never a target).

*Transition:* "That's the trajectory. Let me close."

## Conclusion (~1 min)

- **I. Review of main points.** Technology rebuilt sector after sector and left this one behind; the need is documented, the capability exists, attention is the missing piece; Team Calendula targets the gap condition by condition, starting with Systemiser — four tested cycles are the beginning, not the promise.
- **II. Signal the end.** Closing line invites questions. *(Draft: "One condition at a time — that is how the gap closes. Thank you.")* ⚠ Jardin to rephrase.

## Timing budget (per slide, sums to 14:30 + ~30s buffer)

| Slide | Section | Seconds |
|---|---|---|
| 1 | Title | 30 |
| 2 | Hook (crisis line) | 30 |
| 3 | Innovation everywhere, sectors left behind | 60 |
| 4 | Scale + uneven neglect | 60 |
| 5 | Technology gap | 90 |
| 6 | AI: the telling extra | 45 |
| 7 | Team Calendula: a solution to part of this | 75 |
| 8 | Landscape: trauma-related conditions | 60 |
| 9 | Systemiser: continuity (first DD mention) | 75 |
| 10 | Systemiser: capabilities (+ expansion pending) | 90 |
| 11 | Systemiser: ecosystem + gateways (merged) | 60 |
| 12 | Systemiser: tested cycles (concrete-pending) | 45 |
| 13 | Systemiser: roadmap (concrete-pending) | 45 |
| 14 | Beyond Systemiser | 45 |
| 15 | Close | 60 |
| **Total** | | **14:30** |

Buffer: ~30s — absorbs the hands beat and slide-10 expansion.

## Slide mapping (visual-first, no document dump)

| Slide | Content | Abstract source |
|---|---|---|
| 1 | Title + author + affiliation | form fields |
| 2 | Hook: "a crisis you might not know" (no question, no AI) | — |
| 3 | Innovation everywhere; sectors left behind | S1–S3 recast |
| 4 | Scale (1 billion+) + uneven neglect (qualitative, no disorder names) | S1–S2 |
| 5 | Technology gap: funding decline, concentration, shrinking, "rather than a lack of need" | S3 |
| 6 | AI: the telling extra (hands question, trace evidence, one risk line) | — |
| 7 | Team Calendula: a solution to part of this (trauma-based; PTSD = proof-of-model) | S4 |
| 8 | Landscape: DSM-5 trauma chapter + condition classes (+ AndColon visual candidate) | S4 elaboration |
| 9 | Systemiser: continuity framing (FIRST dissociative mention) | S5 |
| 10 | Capabilities: states, transitions, auto-linked record, tiered privacy (+ features TBD) | S5 |
| 11 | Ecosystem + planned gateways (merged) | S6–S7 |
| 12 | Tested: four cycles (honest status; concrete-pending) | S7 |
| 13 | Roadmap: grounding + crisis tools (concrete-pending) | S7 |
| 14 | Beyond Systemiser: reusable model, aspiring privacy bar, networking | S8 |
| 15 | Closing / questions | S8 |

Visuals: diagrams and framing only. No placeholder or demo imagery implying a shipped product.
