# DRAFT SCRIPT — ACM Talk (v3, deck-aligned)

**Audience: computer engineers, potential designers and developers** — engineering-first register throughout (design spaces, architecture, allocation of engineering attention). A full spoken draft (~1,950 words ≈ 14:15 at a natural conference pace), NOT to be read verbatim on stage — it is the working text the slides are built from and rehearsed against. Slide numbers match the built deck (`docs/acm-presentation/slides/index.html`, 16 slides incl. references).

**v3 changes (deck-aligned revision — the "v2 draft" Jardin requested):** rewritten to match the built deck after the revision round. Slide 3 is now the funding funnel (sector wave first, health zoom second, AI demoted to context — CB Insights 37%); slide 6 carries the three usage bars + JeeP quote + two risk fact boxes; slide 8 is the taxonomy landscape with funded/under-served status chips; slide 13 has app connectivity (no app names); slide 14 shows the real product family (TrigIn before Canary, all links dashed); slide 16 is references. HIPAA line dropped from the closing beat (aspiration language stays available for Q&A only). Page numbers fixed to /16.

**[brackets] = stage directions.** Every number spoken has a source entry in `reference-tech-gap-facts.md`, `reference-chatbot-facts.md`, or the `acm-abstract.md` ledger.

**Language policy:** README-derived features are translated into clinical vocabulary. Never speak: "alters," "headmates," "fronting," "switching," "system" (as community term), "plurality." README equivalents → talk equivalents: alters → identity states; front/switch → transitions / which identity state is present; status/battery/caution → status and functioning tracking; privacy buckets → granular, viewer-tiered privacy; import from PluralKit/Simply Plural/Tupperbox/Octocon → interoperability with existing records and tools.

---

## Slide 1 — Title (0:30)

Good morning. I'm [Jardin], from Tennessee State University. Today I want to show you a design space most of this room has never been asked to look at — and software being built to serve it.

## Slide 2 — Hook (0:30)

We are in a crisis — though you might not know it. Not the one making headlines. A quieter one, in how the world builds — and doesn't build — for mental health.

## Slide 3 — Where the money goes (1:15)

We're living through the fastest innovation cycle in software history, and venture money shows where it points. Here's one quarter of global venture funding, by sector: AI leads. Health and biotech is right behind it. Hardware, fintech — real money, real momentum. [beat] For scale: over the full year, AI took a record thirty-seven percent of all venture funding — an all-time high. Now zoom in on health: all of US digital health raised about ten billion dollars in 2024. And inside that, mental health — one point four billion. [beat] To be clear, that's actually the best case: mental health is the top-funded clinical area in digital health, six years running. [beat] The wave is real. Mental health gets a sliver of it.

## Slide 4 — The scale + uneven neglect (1:00)

The scale behind that sliver: more than one billion people worldwide live with a mental health condition, yet support and treatment reach only a fraction of those affected. That's the World Health Organization's 2025 assessment. And the neglect is not even. Some conditions attract significant research funding and technology investment. Others draw disproportionately little support relative to their real-world burden. Where the data can't isolate a condition cleanly, the defensible claim is the pattern — not a number. So I'll stay qualitative.

## Slide 5 — The technology gap (1:15)

Here's what makes this urgent for us as builders. Software platforms, real-time collaboration, AI, and privacy engineering have made assistive mental-health technology newly feasible — so the gap should be closing. Instead: global mental-health research funding declined after 2020, and by 2023 had fallen back to its 2014 level. Governments spend a median of just two percent of health budgets on mental health. Where technology investment does reach mental health, it concentrates in a narrow set of generic formats — teletherapy platforms, meditation apps, mood trackers — aimed at the most common conditions. Even that is shrinking: mental-health startups' share of digital-health venture funding has roughly halved since 2021.

The need is there. The capability is there. The investment isn't.

## Slide 6 — AI: the evidence (1:00)

Now — the part every room relates to. Quick show of hands: how many of you know someone who talks to ChatGPT about things they'd tell a therapist? [beat] Mine's up too.

Look at the pattern. Roughly one in four adults have used AI chatbots for mental-health support. Among people with an ongoing condition: about one in two. And in one clinical sample, four out of five people in treatment had never told their therapist. [beat] One participant put it plainly: "If I have a therapy session next week, I sort of use Pi to sort of prepare for it… that gives me much more clarity." [beat]

Nobody's first choice for their deepest struggles is a chatbot — it's the option that was actually available. The use of AI is the trace evidence of the gap. And it isn't risk-free: OpenAI's own reported data showed over a million users a week in conversations with explicit indicators of potential suicide planning, and a study presented at ACM's own FAcCT conference found therapy chatbots stigmatize severe conditions and fail to interrupt suicidal intent. People are telling us exactly where the demand is — with tools that were never built for it.

## Slide 7 — Team Calendula: a solution to part of this (1:15)

Team Calendula is an independent software project — my solution to part of this, specifically for trauma-based disorders.

And we know the model works when a condition gets attention. PTSD — a condition with sustained investment — has a government-built suite of free apps, even virtual-reality exposure therapy reaching over 170 VA clinical sites. [If pushed in Q&A: PTSD is deliberately NOT my example of neglect — it's proof the model works.] But PTSD is not the only condition in that class that deserves focus. It's the proof. Team Calendula is for the rest of that class.

And every product in the family begins the same way: with rigorous research into the condition it serves, before a single feature is designed.

## Slide 8 — The landscape (1:00)

How big is "the rest"? Here's the map from our research library, built on the DSM-5. The trauma- and stressor-related chapter alone: post-traumatic stress disorder, acute stress disorder — and adjustment disorders, all six of them, from F43.20 to F43.25. Then reactive attachment disorder and disinhibited social engagement disorder. And the starred class: dissociative disorders — where no purpose-built software exists. [beat] The gold chip is the funded one: PTSD, with specialized apps built. The grey chips are the rest — no purpose-built apps. [beat]

And this understates it. These are the causal classes; there are other condition classes — depressive, anxiety, personality, substance-use — where trauma can be a major factor in cause.

This is not one niche condition. It's a class of conditions the field recognizes — and software has not.

## Slide 9 — Systemiser: continuity by design (1:15) — FIRST dissociative mention

Systemiser is Team Calendula's first product — built for dissociative disorders. It's designed around a single unifying need: continuity.

Dissociative symptoms disrupt memory, identity, and the organization of daily life. The thread of a person's own story — who was present, what happened, what needs doing — can break without warning. Systemiser's purpose is to hold that thread: to restore continuity of memory, identity, and daily organization when symptoms disrupt them.

Everything else I'm about to show you is that one sentence, made concrete.

## Slide 10 — Capabilities (1:30)

That continuity breaks down into concrete capabilities.

First: representing the distinct identity states that characterize these conditions, and tracking transitions between them — which identity state is present, and how it changes over time.

Second: a structured record of events, status, and functioning. Records of what happened, how it went, and how capacity is doing — and the record links automatically to the identity state present when it was created. A record you can return to when memory can't be trusted to hold it.

Third: sharing that is selective by design. A granular privacy model with viewer-tiered visibility — what a stranger sees, what a friend sees, what stays entirely private. Sensitive information demands granular control.

[Feature expansion lands here — Jardin's list, pending. Candidates drawn from the build, in clinical dress: interoperability with existing records and tools; additional condition-tracking granularity. Keep "capability, in development" framing — tested status comes on slide 12.]

## Slide 11 — Built as an ecosystem, with planned gateways (0:45)

None of this works as one app on one device. Systemiser is being built as an application ecosystem — desktop, mobile, and web — with a real-time collaboration layer and privacy-focused, cloud-hosted data storage.

And it plans gateways into third-party platform categories: messaging and collaboration platforms such as Discord and Slack; in-vehicle assistants such as Apple CarPlay and Android Auto. Planned — roadmap, not shipped.

## Slide 12 — Honest status (0:45)

So — what actually works today? Here is the honest line.

Prototype testing has exercised four core feature cycles to date: identity-state representation and transitions. Status and functioning tracking. Privacy-gated sharing. And collaborative information management. That is what exists in testing. That is the line I won't blur.

## Slide 13 — Roadmap (0:45)

And here is what's next. Under active development: grounding techniques and crisis-support tools — disorder-specific needs the first four cycles don't yet address. Grounding is a standard clinical strategy for dissociative episodes.

Beyond that, the roadmap extends continuity into daily organization — reminders, offline access, accessibility work — and app connectivity: Systemiser connecting with future Team Calendula apps and with partnered apps and resources. [Do not name future apps here.]

## Slide 14 — Beyond Systemiser: the family (0:45)

And the model is the point. The family has names on it: TrigIn, planned, for trigger management. Canary, planned, as a pre-crisis companion. And more, condition by condition — each product condition-specific, built on the same rigorous research, with connectivity across the family. The gateway categories are reusable across every product.

The trajectory: a growing family of products addressing more under-represented conditions over time — closing the mental-health technology gap condition by condition. And that trajectory isn't hypothetical — early conversations with clinicians and organizations are already underway.

## Slide 15 — Close (0:45)

So: technology has rebuilt sector after sector — and left this one behind. The need is documented. The capability exists. The attention is the missing piece. Team Calendula targets that gap condition by condition — starting with Systemiser, whose four tested cycles are the beginning, not the promise.

One condition at a time — that is how the gap closes.

Thank you. I'm happy to take questions.

## Slide 16 — References

[Leave on screen through Q&A. Sources are on the slide; the two fact sheets back every number.]

---

## Pacing notes

- 16 slides: 15 spoken ≈ 14:15 at 140 wpm; references slide up during Q&A (5 min). ~45s buffer absorbs the hands beat and the slide-10 expansion.
- Longest argument slides: 3 (funnel) and 5 — rehearse "The need is there. The capability is there. The investment isn't." until automatic.
- Slide 6 is deliberately the longest evidence slide; the three bars are one gradient — do not stop on each, flow general → conditions → concealment.
- Lines that must sound like Jardin (rephrase freely): slide 2 crisis line, slide 6 "trace evidence" sentence, slide 9's record sentence, slide 15 "One condition at a time."
- If over time in rehearsal, first cuts: slide 4's "defensible claim is the pattern" sentence (move to Q&A prep), slide 8's "understates it" tail, slide 13's roadmap tail.
- ⚠ Verify before final: "170+ VA clinical sites" (attribute as VA sites); "initial networking underway" (qualitative, no partnership claims); Canary/TrigIn spoken only as "planned" on slide 14; HIPAA stays "aim/striving toward," never "compliant/certified," Q&A only; dissociative disorders never spoken before slide 9.

## Q&A prep (Jardin's likely questions)

- **Why the quarter snapshot on slide 3?** Crunchbase publishes the sector split quarterly; the annual split for non-AI sectors isn't cleanly published. Say "one quarter, labeled as such" — the CB Insights 37% carries the annual AI context.
- **Why is mental health's $1.4B a problem if it's the top-funded clinical area?** Exactly — steelman it: that's the best case, and it's a sliver of what AI took. The abstract's claim is qualitative ("disproportionately little") — the slide numbers illustrate it, the abstract doesn't depend on them.
- **Is Canary an AI product?** Yes, planned — an application people can vent to and be guided through episodes before a crisis. Not a therapist. Say only what's needed; don't oversell.
- **HIPAA?** Aspirational: the aim is clinical-grade, HIPAA-aligned privacy as the ecosystem matures. Independent project, not inside medical systems yet.
- **Where's the dissociative-disorders funding number?** Never isolated in a source; the under-1% claim covers the broad less-represented class, DID is positioned as an instance of it, not a separately measured statistic.
