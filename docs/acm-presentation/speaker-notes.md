# Extended Speaker Notes — ACM Talk Flow (15 min) — v2

**AUDIENCE (Jardin, Nov 2026 — governs every slide): computer engineers, potential designers and developers.** Register: engineering-first — design spaces, architecture, platform constraints, allocation of engineering attention. The human stakes carry the *why*; the engineering carries the *how*. Not a clinical audience, not an advocacy audience.

Source of truth: `talk-outline.md` v2 + `draft-script.md` v2. Facts: `reference-tech-gap-facts.md`, `reference-chatbot-facts.md`, `acm-abstract.md` ledger. Framing constraints from `handoff-summary.md` apply (clinical vocabulary only, singular first person, honest build status, continuity framing, no community terminology).

**v2 structural changes (Jardin's calls):**
- Dissociative disorders are NOT mentioned before Systemiser — slides 3–8 are disorder-agnostic; first mention = slide 9 (Systemiser).
- AI/chatbots = a lighter, SEPARATE slide (slide 6), right after the technology gap.
- Team Calendula framed as "a solution to part of this, specifically for trauma-based disorders — PTSD is not the only condition in that class."
- New slide 8: how many trauma-related conditions there are (DSM-5 chapter + AndColon research-mapping visual candidate).
- Ecosystem + gateways merged into slide 11 (Jardin asked; agreed — frees budget for the two new slides).
- Privacy bar wording = *striving toward / with the aim of* clinical-grade, HIPAA-aligned — never presented as achieved (not inside medical systems yet).
- Status + roadmap slides (12–13) marked concrete-pending: Jardin may firm up before final.

Timing sums to 14:30, ~30s buffer.

---

## Slide 1 — Title (0:30)

**Goal:** Land, establish credibility, promise an engineering story.

**Spoken:** "Good morning. I'm [Jardin], from Tennessee State University. Today I want to show you a design space most of this room has never been asked to look at — and software being built to serve it."

**Visual:** Title, author, affiliation. Calm, dark, high contrast. Title settles once.

**Transition:** Straight into the crisis line.

## Slide 2 — Hook (0:30)

**Goal:** Tension. No AI, no question, no numbers.

**Spoken:** "We are in a crisis — though you might not know it. Not the one making headlines. A quieter one, in how the world builds — and doesn't build — for mental health."

**Visual:** Nearly empty slide — big text only. The emptiness IS the design.

**Transition:** "Let me show you what I mean."

## Slide 3 — Innovation everywhere, a few sectors left behind (1:00) — REFRAMED (Jardin)

**Goal:** Engineer-facing problem framing: technology transforms sectors; mental health is the laggard.

**Spoken:** "We're living through the fastest innovation cycle in software history. Finance, transport, logistics, communication — entire sectors rebuilt within a decade. And yet a few sectors technology touches have barely moved. [beat] This talk is about one of them: mental health — and about what it looks like when the same engineering attention finally points at it."

**Guardrails:** No disorder names, no AI, no statistics yet. This is the design-space claim; the evidence lands on slides 4–5.

**Visual:** Sector icons transforming (before/after morph), one sector greyed and static.

**Transition:** "How left behind? Let's put numbers on it."

## Slide 4 — The scale + uneven neglect (1:00)

**Goal:** Scale, then the allocation claim. NO specific disorder clusters named (Jardin's rule — the focus condition is revealed with Systemiser, slide 9).

**Spoken:** "The scale: more than one billion people live with a mental health condition, yet support reaches only a fraction — mental health is among the most under-resourced areas of modern health care. That's the WHO's 2025 assessment. And the neglect is not even. Some conditions attract significant research funding and technology investment. Others draw disproportionately little relative to their real-world burden. Where the data can't isolate a condition cleanly, the defensible claim is the pattern — not a number. So I'll stay qualitative."

**Guardrails:** No disorder names. No percentages.

**Visual:** 1,000,000,000+ counter animation; "fraction reached" (one lit segment of many); then two-column contrast — well-resourced vs. little support relative to burden.

**Transition:** "And the technology story makes it sharper."

## Slide 5 — The technology gap (1:30) — LONGEST ARGUMENT SLIDE

**Goal:** Engineer-facing allocation evidence. NO AI beat (moved to slide 6), NO dissociative mention.

**Spoken:** "Here's what makes this urgent for us as builders. Software platforms, real-time collaboration, AI, and privacy engineering have made assistive mental-health technology newly feasible — so the gap should be closing. Instead: global mental-health research funding declined after 2020, and by 2023 had fallen back to its 2014 level. Governments spend a median of just two percent of health budgets on mental health. Where technology investment does reach mental health, it concentrates in a narrow set of generic formats — teletherapy platforms, meditation apps, mood trackers — aimed at the most common conditions. Even that is shrinking: mental-health startups' share of digital-health venture funding has roughly halved since 2021. And in AI specifically, mental health draws less investment than decision support or drug discovery — acknowledged, in the research itself, to reflect scalability and data limitations, 'rather than a lack of need.' The need is there. The capability is there. The investment isn't."

**Fact-discipline:** IAMHRF decline, WHO Atlas 2%, Rock Health share-halved, npj quote — all sourced in `reference-tech-gap-facts.md`. Trend wording preferred; attribute exact numbers.

**Balance-guardrail (steelman to pre-empt):** Mental health IS the most-funded clinical area in digital-health venture, seven years running. The defensible claim is "concentrated in generic formats for common conditions, shrinking, and nothing purpose-built for under-represented conditions" — never "technology ignores mental health." The npj quote — "rather than a lack of need" — gets its own line on the slide.

**Visual:** Split: "where tech investment flows" (teletherapy / wellness apps / AI decision-support icons) vs. "purpose-built tools for under-represented conditions:" [empty]. The empty right side is the thesis in visual form.

**Transition:** "Now — the part every room relates to."

## Slide 6 — AI: the telling extra (0:45) — LIGHTER TONE, still grounded (Jardin's call: separate slide)

**Goal:** The relatable AI beat on its own slide. Light entrance, serious exit.

**Spoken:** "Quick show of hands — how many of you know someone who talks to ChatGPT about things they'd tell a therapist? [beat] Mine's up too. Nobody's first choice for their deepest struggles is a chatbot — it's the option that was actually available. The use of AI is the trace evidence of the gap. And it isn't risk-free: OpenAI's own reported data showed over a million users a week in conversations with explicit indicators of potential suicide planning, and a study presented at ACM's own FAcCT conference found therapy chatbots stigmatize severe conditions and fail to interrupt suicidal intent. People are telling us exactly where the demand is — with tools that were never built for it."

**Fact-discipline:** OpenAI figures = self-reported company data via congressional testimony — never present as peer-reviewed. Trace-evidence grounding (elevated use among people with ongoing conditions ~49% Rousmaniere; stigma/isolation in severe-condition case studies PMC13520130; availability the top cited driver PMC13579130) in `reference-chatbot-facts.md`. ⚠ Never claim "AI users are unserved people" — most surveyed users were also in professional care.

**Guardrails:** Not anti-AI — the beat is evidence of demand. The humor lands on the hands, never on harmed users.

**Visual:** Big chat-bubble icon; hands-count animation; the risk stat appears as one sober line at the end.

**Transition:** "So that's the design space. Here's my response to part of it."

## Slide 7 — Team Calendula: a solution to part of this (1:15)

**Goal:** Jardin's framing: a solution for trauma-based disorders; PTSD as proof-of-model; explicitly NOT the only condition in that class.

**Spoken:** "Team Calendula is an independent software project — my solution to part of this, specifically for trauma-based disorders. And we know the model works when a condition gets attention: PTSD — a condition with sustained investment — has a government-built suite of free apps, even virtual-reality exposure therapy reaching over 170 VA clinical sites. But PTSD is not the only condition in that class that deserves focus. It's the proof the model works. Team Calendula is for the rest of that class. And every product in the family begins the same way: with rigorous research into the condition it serves, before a single feature is designed."

**Guardrails:** PTSD = proof-of-model only, never a target (well-served by technology; a reviewer can refute "under-represented PTSD" in one sentence). "Independent software project" — never "company." Slide 8 shows how big "the rest" is.

**Visual:** One line: "A solution to part of this — for trauma-based conditions." PTSD strip stays off-slide (spoken only).

**Transition:** "How big is 'the rest'?"

## Slide 8 — The landscape: how many trauma-related conditions (1:00) — NEW

**Goal:** Show the breadth of the target class. Dissociative disorders NOT named (first mention = slide 9).

**Spoken:** "The DSM-5's trauma- and stressor-related chapter alone spans post-traumatic stress disorder, acute stress disorder, adjustment disorders, reactive attachment disorder, disinhibited social engagement disorder — and, added in DSM-5-TR, prolonged grief disorder. Around that chapter sit closely tied condition classes our research mapping is actively cataloguing. This is not one niche condition. It's a class of conditions the field recognizes — and software has not."

**Guardrails:** ⚠ AndColon screenshot decision: the research-library category screenshot is a strong "we're mapping this" visual, but it visibly contains a dissociative-disorders category — which collides with the "dissociative disorders only at Systemiser" rule. Jardin decides: include as-is (a category map, not a focus), crop, or use the DSM-5 chapter list alone. Taxonomy guardrail: DSM-5 places dissociative disorders in their own chapter, separate from trauma- and stressor-related disorders — say "closely tied classes around that chapter," never "all of these are trauma disorders."

**Visual:** DSM-5 chapter list as the spine; optional AndColon screenshot as the mapping proof.

**Transition:** "And into that space, my first product."

## Slide 9 — Systemiser: continuity by design (1:15) — FIRST MENTION of dissociative disorders

**Goal:** Land the unifying frame; reveal the focus condition here.

**Spoken:** "Systemiser is Team Calendula's first product — built for dissociative disorders. It's designed around a single unifying need: continuity. Dissociative symptoms disrupt memory, identity, and the organization of daily life — the thread of a person's own story. Systemiser's purpose is to hold that thread: to restore continuity of memory, identity, and daily organization when symptoms disrupt them. Everything else I show you is that one sentence, made concrete."

**Guardrails:** This is the talk's only reveal moment for the focus condition — slides 3–8 deliberately never named it. Clinical vocabulary only (Cleveland Clinic / Mayo Clinic grounding lives in the abstract ledger).

**Visual:** Broken-thread → mended-thread motif; the emotional-center animation moment.

**Transition:** "That continuity breaks down into concrete capabilities."

## Slide 10 — Systemiser: capabilities (1:30) — EXPANSION POINT

**Goal:** Concrete features; capability framing (tested status comes only on slide 12).

**Spoken:** "First: representing the distinct identity states that characterize these conditions, and tracking transitions between them — which identity state is present, and how it changes over time. Second: a structured record of events, status, and functioning — and the record links automatically to the identity state present when it was created. A record you can return to when memory can't be trusted to hold it. Third: sharing that is selective by design — a granular privacy model with viewer-tiered visibility. Sensitive information demands granular control."

**Expansion:** Additional features incoming (Jardin's list, pending). README-derived candidates in clinical dress: interoperability with existing records and tools; finer-grained condition tracking. Never claim "tested" on this slide.

**Visual:** Three-panel diagram assembling one at a time: states/transitions timeline, structured record, privacy gates.

**Transition:** "None of this works as one app on one device."

## Slide 11 — Systemiser: built as an ecosystem — with planned gateways (1:00) — MERGED (old slides 9+10, Jardin asked; agreed)

**Goal:** Build scale + ambition on one slide; gateways correctly labeled planned.

**Spoken:** "Systemiser is being built as an application ecosystem — desktop, mobile, and web — with a real-time collaboration layer and privacy-focused, cloud-hosted data storage. And it plans gateways into third-party platform categories: messaging and collaboration platforms such as Discord and Slack; in-vehicle assistants such as Apple CarPlay and Android Auto. Planned — roadmap, not shipped."

**Guardrails:** "Planned" verbatim on the slide for gateways. Discord is ONE gateway, not the platform. No screenshots implying a shipped product.

**Visual:** Left half: device triangle + collaboration layer beneath. Right half: hub-and-spoke, spokes labeled "planned," animating outward.

**Transition:** "So — what actually works today? The honest line."

## Slide 12 — Systemiser: honest status — four tested cycles (0:45) — concrete-pending

**Goal:** Credibility through precision.

**Spoken:** "Prototype testing has exercised four core feature cycles to date: identity-state representation and transitions. Status and functioning tracking. Privacy-gated sharing. Collaborative information management. That is what exists in testing. That is the line I won't blur."

**Marked:** Jardin may firm up with more concrete status detail before final.

**Guardrails:** NEVER claim a working or shipped product. This is where reviewers decide whether to trust the roadmap.

**Visual:** Four checked cycle nodes on a track.

**Transition:** "And here is what's next."

## Slide 13 — Systemiser: roadmap — grounding + crisis tools (0:45) — concrete-pending

**Goal:** Direction without overclaiming.

**Spoken:** "Under active development: grounding techniques and crisis-support tools — disorder-specific needs the first four cycles don't yet address. Grounding is a standard clinical strategy for dissociative episodes. Beyond that, the roadmap extends continuity into daily organization: reminders, offline access, and accessibility work — screen-reader support, keyboard navigation, motion-sensitivity options."

**Marked:** Jardin may make status/roadmap more concrete before final (slides 12–13 both flagged).

**Guardrails:** "Under active development" wording, verbatim, on slide and in speech.

**Visual:** Dashed roadmap extension from slide 12's track — visually distinct (dashed = not tested).

**Transition:** "Systemiser is the first case study — the model is the point."

## Slide 14 — Team Calendula: beyond Systemiser (0:45)

**Goal:** Generalize the model; family-standard privacy worded as aspiration; networking beat.

**Spoken:** "Each product in the family is condition-specific, built on rigorous research into the condition it serves. The gateway categories are reusable across every product. And the privacy bar — with the aim of clinical-grade, HIPAA-aligned privacy as the ecosystem matures — is a family standard, not a feature. The trajectory: a growing family of products addressing more under-represented conditions over time — closing the mental-health technology gap condition by condition. And that trajectory isn't hypothetical: early conversations with clinicians and organizations are already underway."

**Guardrails:** ⚠ HIPAA wording = "with the aim of / striving toward" — NEVER asserted as achieved (Jardin's explicit call: not inside medical systems yet). No named future conditions (PTSD stays proof-of-model). "Initial networking" = qualitative, no partnership claims (Jardin-supplied).

**Visual:** Family-of-products trajectory; gateway-category icons repeating across nodes; future nodes abstract.

**Transition:** "That's the trajectory. Let me close."

## Slide 15 — Close (1:00)

**Goal:** Review, end on mission, invite questions.

**Spoken:** "So: technology has rebuilt sector after sector — and left this one behind. The need is documented; the capability exists; the attention is the missing piece. Team Calendula targets that gap condition by condition — starting with Systemiser, whose four tested cycles are the beginning, not the promise. One condition at a time — that is how the gap closes. Thank you. I'm happy to take questions."

**Visual:** Typographic closer, slow fade.

**Buffer:** ~30s — absorbs the hands beat and slide-10 expansion.

---

## Rehearsal checklist (run in order)

1. Full timed run — flag any slide over budget.
2. Hands beat (slide 6): hold the beat after asking; the humor lands on the hands, never on harmed users.
3. Verify dissociative disorders are NOT spoken anywhere before slide 9.
4. Verify HIPAA is only ever "aim / striving toward," never asserted as achieved.
5. Slide 5 pivot: rehearse "The need is there. The capability is there. The investment isn't." until automatic.
6. Verify every spoken number has a source entry; OpenAI figures framed as company-reported.
7. Decide the AndColon screenshot question (slide 8) before slide design begins.
8. Verify no community terminology anywhere in the spoken notes.
