# DRAFT SCRIPT — ACM Talk (v2)

**Audience: computer engineers, potential designers and developers** — engineering-first register throughout (design spaces, architecture, allocation of engineering attention). A full spoken draft (~1,900 words ≈ 14:30 at a natural conference pace), NOT to be read verbatim on stage — it is the working text the slides are built from and rehearsed against. Slide numbers match `talk-outline.md` v2 / `speaker-notes.md` v2 (15 slides).

**v2 changes (Jardin's calls):** slides 3–8 disorder-agnostic (dissociative disorders first named on slide 9); AI as its own lighter slide 6; Team Calendula = "a solution to part of this, for trauma-based disorders"; new slide 8 (trauma-condition landscape); slides 9+10 merged into 11; privacy bar = aspiration wording; status/roadmap concrete-pending.

**[brackets] = stage directions.** Every number spoken has a source entry in `reference-tech-gap-facts.md`, `reference-chatbot-facts.md`, or the `acm-abstract.md` ledger.

**Language policy:** README-derived features are translated into clinical vocabulary. Never speak: "alters," "headmates," "fronting," "switching," "system" (as community term), "plurality." README equivalents → talk equivalents: alters → identity states; front/switch → transitions / which identity state is present; status/battery/caution → status and functioning tracking; privacy buckets → granular, viewer-tiered privacy; import from PluralKit/Simply Plural/Tupperbox/Octocon → interoperability with existing records and tools.

---

## Slide 1 — Title (0:30)

Good morning. I'm [Jardin], from Tennessee State University. Today I want to show you a design space most of this room has never been asked to look at — and software being built to serve it.

## Slide 2 — Hook (0:30)

We are in a crisis — though you might not know it. Not the one making headlines. A quieter one, in how the world builds — and doesn't build — for mental health.

## Slide 3 — Innovation everywhere, a few sectors left behind (1:00)

We're living through the fastest innovation cycle in software history. Finance, transport, logistics, communication — entire sectors rebuilt within a decade. And yet a few sectors technology touches have barely moved. [beat] This talk is about one of them: mental health — and about what it looks like when the same engineering attention finally points at it.

## Slide 4 — The scale + uneven neglect (1:00)

The scale: more than one billion people worldwide live with a mental health condition, yet support and treatment reach only a fraction of those affected. That's the World Health Organization's 2025 assessment. And the neglect is not even. Some conditions attract significant research funding and technology investment. Others draw disproportionately little support relative to their real-world burden. Where the data can't isolate a condition cleanly, the defensible claim is the pattern — not a number. So I'll stay qualitative.

## Slide 5 — The technology gap (1:30)

Here's what makes this urgent for us as builders. Software platforms, real-time collaboration, AI, and privacy engineering have made assistive mental-health technology newly feasible — so the gap should be closing. Instead: global mental-health research funding declined after 2020, and by 2023 had fallen back to its 2014 level. Governments spend a median of just two percent of health budgets on mental health. Where technology investment does reach mental health, it concentrates in a narrow set of generic formats — teletherapy platforms, meditation apps, mood trackers — aimed at the most common conditions. Even that is shrinking: mental-health startups' share of digital-health venture funding has roughly halved since 2021. And in AI specifically, mental health draws less investment than decision support or drug discovery — acknowledged, in the research itself, to reflect scalability and data limitations, "rather than a lack of need."

The need is there. The capability is there. The investment isn't.

## Slide 6 — AI: the telling extra (0:45)

Now — the part every room relates to. Quick show of hands: how many of you know someone who talks to ChatGPT about things they'd tell a therapist? [beat] Mine's up too.

Nobody's first choice for their deepest struggles is a chatbot — it's the option that was actually available. The use of AI is the trace evidence of the gap. And it isn't risk-free: OpenAI's own reported data showed over a million users a week in conversations with explicit indicators of potential suicide planning, and a study presented at ACM's own FAcCT conference found therapy chatbots stigmatize severe conditions and fail to interrupt suicidal intent. People are telling us exactly where the demand is — with tools that were never built for it.

## Slide 7 — Team Calendula: a solution to part of this (1:15)

Team Calendula is an independent software project — my solution to part of this, specifically for trauma-based disorders.

And we know the model works when a condition gets attention. PTSD — a condition with sustained investment — has a government-built suite of free apps, even virtual-reality exposure therapy reaching over 170 VA clinical sites. [If pushed in Q&A: PTSD is deliberately NOT my example of neglect — it's proof the model works.] But PTSD is not the only condition in that class that deserves focus. It's the proof. Team Calendula is for the rest of that class.

And every product in the family begins the same way: with rigorous research into the condition it serves, before a single feature is designed.

## Slide 8 — The landscape: how many trauma-related conditions (1:00)

How big is "the rest"? The DSM-5's trauma- and stressor-related chapter alone spans post-traumatic stress disorder, acute stress disorder, adjustment disorders, reactive attachment disorder, disinhibited social engagement disorder — and, added in DSM-5-TR, prolonged grief disorder. Around that chapter sit closely tied condition classes our research mapping is actively cataloguing.

This is not one niche condition. It's a class of conditions the field recognizes — and software has not.

[Visual candidate: the AndColon research-library category screenshot — ⚠ it visibly contains a dissociative-disorders category, which collides with the "dissociative disorders only at Systemiser" rule. Jardin decides: include as-is (a category map, not a focus), crop, or use the DSM-5 chapter list alone.]

## Slide 9 — Systemiser: continuity by design (1:15) — FIRST dissociative mention

Systemiser is Team Calendula's first product — built for dissociative disorders. It's designed around a single unifying need: continuity.

Dissociative symptoms disrupt memory, identity, and the organization of daily life. The thread of a person's own story — who was present, what happened, what needs doing — can break without warning. Systemiser's purpose is to hold that thread: to restore continuity of memory, identity, and daily organization when symptoms disrupt them.

Everything else I'm about to show you is that one sentence, made concrete.

## Slide 10 — Systemiser: capabilities (1:30) — EXPANSION POINT

That continuity breaks down into concrete capabilities.

First: representing the distinct identity states that characterize these conditions, and tracking transitions between them — which identity state is present, and how it changes over time.

Second: a structured record of events, status, and functioning. Records of what happened, how it went, and how capacity is doing — and the record links automatically to the identity state present when it was created. A record you can return to when memory can't be trusted to hold it.

Third: sharing that is selective by design. A granular privacy model with viewer-tiered visibility — what a stranger sees, what a friend sees, what stays entirely private. Sensitive information demands granular control.

[Feature expansion lands here — Jardin's list, pending. Candidates drawn from the build, in clinical dress: interoperability with existing records and tools; additional condition-tracking granularity. Keep "capability, in development" framing — tested status comes on slide 12.]

## Slide 11 — Systemiser: built as an ecosystem — with planned gateways (1:00) — MERGED

None of this works as one app on one device. Systemiser is being built as an application ecosystem — desktop, mobile, and web — with a real-time collaboration layer and privacy-focused, cloud-hosted data storage.

And it plans gateways into third-party platform categories: messaging and collaboration platforms such as Discord and Slack; in-vehicle assistants such as Apple CarPlay and Android Auto. Planned — roadmap, not shipped.

## Slide 12 — Systemiser: honest status (0:45) — concrete-pending

So — what actually works today? Here is the honest line.

Prototype testing has exercised four core feature cycles to date: identity-state representation and transitions. Status and functioning tracking. Privacy-gated sharing. And collaborative information management. That is what exists in testing. That is the line I won't blur.

## Slide 13 — Systemiser: roadmap (0:45) — concrete-pending

And here is what's next. Under active development: grounding techniques and crisis-support tools — disorder-specific needs the first four cycles don't yet address. Grounding is a standard clinical strategy for dissociative episodes. Beyond that: the roadmap extends continuity into daily organization — reminders, offline access, and accessibility work including screen-reader and motion-sensitivity support.

## Slide 14 — Team Calendula: beyond Systemiser (0:45)

And the model is the point. Each product in the family is condition-specific, built on that same rigorous research into the condition it serves. The gateway categories are reusable across every product. The privacy bar — with the aim of clinical-grade, HIPAA-aligned privacy as the ecosystem matures — is a family standard, not a feature.

The trajectory: a growing family of products addressing more under-represented conditions over time — closing the mental-health technology gap condition by condition. And that trajectory isn't hypothetical — early conversations with clinicians and organizations are already underway.

## Slide 15 — Close (1:00)

So: technology has rebuilt sector after sector — and left this one behind. The need is documented. The capability exists. The attention is the missing piece. Team Calendula targets that gap condition by condition — starting with Systemiser, whose four tested cycles are the beginning, not the promise.

One condition at a time — that is how the gap closes.

Thank you. I'm happy to take questions.

---

## Pacing notes

- ~1,900 spoken words → ~14:30 at 140 wpm; ~30s buffer absorbs the hands beat and slide-10 expansion.
- Longest argument slide: 5 — rehearse "The need is there. The capability is there. The investment isn't." until automatic.
- Lines that must sound like Jardin (rephrase freely): slide 2 crisis line, slide 3's closing question, slide 9's record sentence, slide 15 "One condition at a time."
- If over time in rehearsal, first cuts: slide 4's "defensible claim is the pattern" sentence (move to Q&A prep), slide 13's roadmap tail, slide 7's PTSD elaboration.
- ⚠ Verify before final: "170+ VA clinical sites" (attribute as VA sites); "initial networking underway" (qualitative, no partnership claims); HIPAA stays "aim/striving toward," never "compliant/certified"; dissociative disorders never spoken before slide 9.
