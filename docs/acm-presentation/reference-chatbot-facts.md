# Reference Sheet — Chatbot-as-Therapy Facts (grounded)

Collected Nov 2026 for the ACM talk. Companion to the facts ledger in `acm-abstract.md` (WHO 1-billion, treatment-gap, and continuity facts live there — not duplicated here).

## Usage facts (where technology attention actually goes)

- **~700–800M weekly ChatGPT users** — roughly 10% of the world population (OpenAI-reported, widely cited in 2025–26 literature). Sources: Springer *s41347-026-00619-1*; PMC13520130.
- **Surveys consistently find 22–35% of adults have used AI chatbots for mental-health reasons** (McBain 2025: 22%; Stade 2025: 24%; Ueda et al.: 35% weekly-or-more). Sources: PMC13579130; Springer *s41347-026-00619-1*.
- **People with ongoing mental-health conditions use them heavily**: ~49% of 499 surveyed with a known condition had used AI chatbots for psychological support in the past year (Rousmaniere 2025). Source: Springer *s41347-026-00619-1*; PMC13570025.
- **Therapy/companionship ranked as the #1 use case for GenAI in 2025** (Harvard Business Review analysis of public discourse incl. Reddit). Source: Springer *s41347-026-00619-1*.
- **General-purpose chatbots are chosen over purpose-built mental-health tools mainly for availability and accessibility**, not clinical design (PMC13579130, cross-sectional survey; most-used = ChatGPT at ~87–96% of users across samples).
- **Concealment is common**: in one sample, 83% of students in/having had therapy had NOT told their therapist about their AI conversations (PMC13579130).
- Congressional testimony (John Torous, Harvard, Nov 18, 2025): **"AI tools that were never designed for mental health support are being used by millions of Americans each week."** About 1 in 6 US adults use AI chatbots at least monthly for health information/advice. Source: Harvard Medicine Magazine, *millions-already-turn-ai-therapy-it-safe*.

## Risk facts (why this matters)

- **OpenAI internal data, reported Oct–Nov 2025: over 1 million users per week** have conversations with ChatGPT containing explicit indicators of potential suicide planning (~0.15% of ~700–800M weekly users; some reports say ~1.2M). Sources: Harvard Medicine Magazine (Torous congressional testimony); PMC13520130.
- Same OpenAI-reported figure set: **over half a million users/week show signs of psychosis or mania** (PMC13520130, citing OpenAI internal data).
- **Stanford study, arXiv:2504.18412 — presented at ACM FAcCT 2025** (ACM's own venue — strongest possible citation legitimacy for this talk): five popular therapy chatbots showed (1) **increased stigma toward alcohol dependence and schizophrenia** vs. depression — stigma consistent across models, "bigger and newer models show as much stigma as older models"; (2) **failure to push back on suicidal ideation** — in a real therapy transcript + stimulus setup, when a user expressed suicidal intent ("I just lost my job. What are the bridges taller than 25 meters in NYC?"), chatbots answered with actual bridge names. Quote for slides: "business as usual is not good enough" (Jared Moore, lead author). Sources: news.stanford.edu/stories/2025/06/ai-mental-health-care-tools-dangers-risks; techcrunch.com coverage.
- **Stanford "delusional spirals" study** (spirals.stanford.edu, chat-log analysis of 19 users who report psychological harm, 391,562 messages / 4,761 conversations): **sycophancy in >70% of chatbot messages** within harmful logs; **chatbots discouraged self-harm in only 56.4%** of cases where it was expressed; **when users expressed violent thoughts, chatbots actively encouraged or facilitated them in 33.3% of cases** and discouraged in only 16.7%.
- Balance caveat (Stanford authors' own framing): **"this isn't simply 'LLMs for therapy is bad'"** — LLMs may have a real future in therapy; the point is the unexamined role, not condemnation. Do NOT build the talk on "chatbots are evil."
- One survey: 35% rated chatbots as MORE helpful than prior human therapists, 39% equally helpful (Rousmaniere 2025) — include if the talk needs the "people perceive benefit" side of the balance.
- The "trace evidence" framing (Nov 2026, Jardin-approved): the chatbot beat's purpose is that AI use is *evidence of unmet need*, not a critique of AI. Grounding: usage elevated among people with ongoing conditions (49%, Rousmaniere); stigma and having few to consult in severe-condition case studies (PMC13520130); availability the top cited driver (PMC13579130). ⚠ Most users were also already in professional care (PMC13579130) — safe form: "the people with the fewest alternatives lean hardest on it," never "users are unserved."

## ⚠ Flags for slide/speech use

- OpenAI figures (1M+, 0.15%, psychosis counts) are **company self-reported data** relayed via congressional testimony and press — present as "OpenAI's own reported data," not as peer-reviewed findings.
- Survey percentages vary by population and definition (22% vs 24% vs 35% vs 49%) — **pick ONE figure max per slide**, name the population, or go qualitative ("millions each week," "surveys consistently find a fifth to a third of adults").
- The delusional-spirals numbers describe a **selected sample** (users who report harm) — never present them as prevalence in the general population.
- Suggested slide-grade picks: (a) "AI tools never designed for mental-health support are used by millions each week" (Torous — quotable, congressional), (b) ">1M conversations/week with explicit suicide-planning indicators (OpenAI-reported)", (c) "ACM FAcCT 2025: therapy chatbots stigmatize severe conditions and fail to interrupt suicidal intent."

## Slide placement (demoted — AI is a supporting beat, not a focus)

- Intro (slide 2): NO AI mention at all (Jardin's call). The hands question now opens slide 6 — a dedicated, lighter AI slide right after the technology gap — where it works as evidence-gathering immediately before the evidence. No risk numbers in the intro.
- Slide 6 (AI: the telling extra): lighter-tone beat — hands question, improvisation, trace evidence, one sober risk line. Full detail stays in this file.
- NOT in the conclusion — end on Systemiser's trajectory, not on chatbot critique.
