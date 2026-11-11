# ACM Talk Outline — Team Calendula and Systemiser (15 minutes)

Source of truth: `acm-abstract.md` v7. Framing constraints from `handoff-summary.md` apply throughout (clinical vocabulary only, singular first person, honest build status, continuity framing).

## Problem statement (reference — NOT the spoken introduction)

Compressed from abstract sentences 1–3 (the eLearn doc's 1–2 sentence form):

> More than one billion people live with mental-health conditions, yet support reaches only a fraction of them — and within that population, conditions drawing disproportionately little research support relative to their real-world burden remain invisible to technology. As software advances make assistive mental-health technology newly feasible, this gap between what technology could do and what it serves grows more urgent rather than less.

Role: anchor for the problem section (slides 2–3). The spoken introduction opens differently (see attention getter below). Does NOT claim: a funding percentage, "no care at all," or a separately measured dissociative-disorder funding statistic.

## Speech skeleton (per the outline template)

**Title:** Team Calendula and Systemiser: Building Software for Under-Represented Mental Health Conditions

**General purpose:** To inform (with a persuasive through-line).

**Specific purpose:** To inform the audience how Team Calendula develops assistive software for conditions receiving little mainstream attention, beginning with dissociative disorders.

**Thesis / central idea:** Mental-health technology neglects under-represented conditions; Team Calendula's first product, Systemiser, addresses this gap for dissociative disorders by restoring continuity of memory, identity, and daily organization, with four core feature cycles exercised in prototype testing to date.

## Introduction (~2 min)

- **I. Attention getter.** *(Revised — full beat-by-beat in `speaker-notes.md` slide 2.)* "We are in a crisis — though you might not know it." + show-of-hands question ("know someone who talks to ChatGPT about things they'd tell a therapist"), self-included, then pivot: "That tells you where technology's attention is going. Let me show you where it isn't." Chatbot risk evidence deliberately held for Section II (slide 5). Sources: `reference-chatbot-facts.md`.
- **II. Problem statement** (the compressed 1–2 sentences above — spoken here as the setup, not as a label).
- **III. Preview of main points.** "I'll show why this gap is urgent, how Team Calendula addresses it, and what Systemiser — its first product — already does in prototype."

*Transition (full sentence):* "First, the scale of the problem."

## Body

- **I. The problem: vast need, uneven neglect (~3 min)** — abstract S1–S2
  - A. Mental health is among the most under-resourced areas of modern health care; 1 billion+ people, support reaches only a fraction (WHO, Sept 2025).
  - B. Neglect is uneven: some conditions attract significant research funding and technology investment; others draw disproportionately little relative to their real-world burden.
    - 1. Qualitative claim only — no percentage on any slide.
    - 2. Dissociative disorders introduced here as an instance of the under-served class, not as a separately measured statistic.
- **II. The moment: the technology gap (~2 min)** — abstract S3 + tech-gap facts
  - A. Advances in software platforms, real-time collaboration, AI, and privacy engineering make assistive mental-health technology newly feasible.
  - B. The neglect, in technology terms (leads — facts in `reference-tech-gap-facts.md`): research funding fell back to 2014 levels (IAMHRF); tech investment concentrates in generic formats for common conditions and its share is shrinking (Rock Health); AI investment specifically skips mental health, "rather than a lack of need" (npj Digital Medicine).
  - C. AI chatbots as a brief supporting beat only (~2 sentences: people improvising therapy from tools never designed for it, documented risks per ACM FAcCT study) — NOT a focus. Detail: `reference-chatbot-facts.md`.
  - D. Therefore the gap between what technology could do and what it serves is growing more urgent, not less.

*Transition:* "Team Calendula exists to narrow this gap."

- **III. Team Calendula: the response (~1.5 min)** — abstract S4
  - A. An independent software project (not a registered company — say "project," never "company").
  - B. Builds technology for conditions with little mainstream attention; first focus: dissociative disorders.
- **IV. Systemiser: continuity by design (~3.5 min)** — abstract S5
  - A. Unifying need: continuity when dissociative symptoms disrupt memory, identity, and the organization of daily life.
  - B. Capabilities:
    - 1. Represent distinct identity states; track transitions between them.
    - 2. Structured record of events, status, and functioning — bridges memory gaps.
    - 3. Granular privacy model: share details selectively.
  - C. Continuity framing carries the slide, not a feature list.
- **V. Built as an ecosystem (~2 min)** — abstract S6–S7
  - A. Desktop, mobile, and web; real-time collaboration layer; privacy-focused cloud-hosted storage.
  - B. Planned gateways into third-party platform categories: messaging/collaboration (Discord, Slack), in-vehicle (Apple CarPlay, Android Auto).
    - 1. "Planned" — gateways are roadmap, not shipped.
    - 2. Framing: platforms that already shape daily digital life, turned toward assistive purposes.
- **VI. Honest status: tested vs. in development (~1.5 min)** — abstract S7
  - A. Four core feature cycles exercised in prototype testing: identity-state representation and transitions; status and functioning tracking; privacy-gated sharing; collaborative information management.
  - B. Under active development (roadmap, not tested): grounding techniques and crisis-support tools.
    - 1. Never claim a working or shipped product.

*Transition:* "Systemiser is the first case study — not the last word."

## Conclusion (~1.5 min)

- **I. Review of main points.** The gap is vast and unevenly neglected; feasibility is rising; Team Calendula targets the gap condition by condition, starting with Systemiser.
- **II. Broader trajectory (abstract S8).** A growing family of products addressing more under-represented conditions over time — closing the mental-health technology gap condition by condition.
- **III. Signal the end.** Closing line invites questions. *(Draft: "One condition at a time — that is how the gap closes. Thank you.")* ⚠ Jardin to rephrase.

## Timing budget (sums to 15 min)

| Section | Minutes |
|---|---|
| Introduction | 2 |
| I. Problem | 3 |
| II. Feasibility | 2 |
| III. Team Calendula | 1.5 |
| IV. Systemiser | 3.5 |
| V. Ecosystem | 2 |
| VI. Status | 1.5 |
| Conclusion | 1.5 |
| **Total** | **15** |

## Slide mapping (visual-first, no document dump)

| Slide | Content | Abstract source |
|---|---|---|
| 1 | Title + author + affiliation | form fields |
| 2 | Problem: 1 billion+, fraction reached | S1 |
| 3 | Problem: uneven neglect (qualitative) | S2 |
| 4 | Feasibility → widening gap | S3 |
| 5 | Team Calendula: mission, first focus | S4 |
| 6 | Systemiser: continuity framing | S5 |
| 7 | Capabilities: states, transitions, record, privacy | S5 |
| 8 | Ecosystem: desktop/mobile/web + collaboration layer | S6 |
| 9 | Planned gateways by platform category | S7 |
| 10 | Tested: four cycles (honest status) | S7 |
| 11 | Roadmap: grounding + crisis tools | S7 |
| 12 | Trajectory: condition by condition | S8 |
| 13 | Closing / questions | S8 |

Visuals: diagrams and framing only. No placeholder or demo imagery implying a shipped product.
