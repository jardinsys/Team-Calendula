# Extended Speaker Notes — ACM Talk Flow (15 min)

Authoritative flow document; refines the intro section of `talk-outline.md` (the revised opening lives here). Facts for slide 5 come from `reference-chatbot-facts.md`. All framing constraints from `handoff-summary.md` apply: clinical vocabulary only, singular first person, honest build status, continuity framing, no community terminology.

Timing sums to ~14.5 min, leaving ~30s of buffer in a 15-minute slot.

---

## Slide 1 — Title (0:30)

**Goal:** Land, establish credibility, promise a story.

**Spoken:** Title + name + Tennessee State University on screen. "Today I'm going to talk about a gap most of this room has never been asked to see — and about software being built to close it."

**Visual:** Title, author, affiliation, conference branding. Calm, dark, high contrast. Animation: title fades/settles once.

**Transition:** Straight into the crisis line.

## Slide 2 — Hook: crisis + hands (0:45)

**Goal:** Earn attention; make the problem feel near, not abstract.

**Spoken:** "We are in a crisis — though you might not know it. Raise your hand if you know someone who talks to ChatGPT about things they'd tell a therapist. [beat] Mine's up too. People are improvising support from whatever tools they can reach — because nothing purpose-built was ever offered to them. Hold that thought. It's a clue to a much bigger problem."

**Critique-guardrails:** The hands question is show-of-hands, not discussion — 15 seconds, move on. AI is NOT the focus of the talk — this slide mentions ChatGPT only as the audience's own lived example, then pivots to the neglect of purpose-built technology. No risk numbers here; the tech-gap facts (slide 5, `reference-tech-gap-facts.md`) carry the argument.

**Visual:** Nearly empty slide — big text, maybe a hand-count animation counting up. No data yet. The emptiness IS the design.

**Transition:** "Let me define that crisis properly."

## Slide 3 — Problem statement + scale (0:45)

**Goal:** State the problem precisely, with the one number that's source-backed.

**Spoken:** "More than one billion people live with a mental-health condition — yet support and treatment reach only a fraction of them. Mental health is one of the most under-resourced areas of modern health care. And within that population, the neglect is not evenly distributed." (WHO, Sept 2025 — the only hard number in the first half of the talk.)

**Visual:** 1,000,000,000+ as a counter animation; a "fraction reached" visual (one lit segment of many).

**Transition:** "Not evenly distributed — that's the part people miss."

## Slide 4 — Uneven neglect (1:30)

**Goal:** Name the root problem: allocation, not just scarcity.

**Spoken:** "Some conditions attract significant research funding and technology investment. Others draw disproportionately little support relative to their real-world burden. Dissociative disorders sit in that second group — conditions characterized by disruptions in memory, identity, and daily functioning, affecting real people, with almost nothing purpose-built for them. Note what I'm not saying: I'm not giving you a percentage, because the honest position is the qualitative one — the support these conditions draw is disproportionately small."

**Guardrails:** Qualitative claim only — no funding percentage on any slide. Dissociative disorders introduced as an instance of the under-served class, never as a separately measured statistic. Clinical vocabulary only.

**Visual:** Two-column contrast: "well-resourced conditions" vs. "disproportionately little support relative to burden" — no invented bar lengths, use an abstract scale visual.

**Transition:** "Here's what makes this urgent *now*."

## Slide 5 — The technology gap (2:00) — LONGEST ARGUMENT SLIDE

**Goal:** Ground the neglect in technology-investment facts (leading), with AI as a brief supporting beat — NOT the focus.

**Spoken:** "Software platforms, real-time collaboration, AI, and privacy engineering have made assistive mental-health technology newly feasible — so the gap should be closing. Instead, look at where technology actually invests. Global mental-health research funding declined after 2020, and by 2023 had fallen back to its 2014 level. Governments spend a median of just two percent of health budgets on mental health. And where technology investment does reach mental health, it concentrates in a narrow set of generic formats — teletherapy platforms, meditation apps, mood trackers — aimed at the most common conditions. Even that is shrinking: mental-health startups' share of digital-health venture funding has roughly halved since 2021, and in AI specifically, mental health draws less investment than decision support or drug discovery — acknowledged to reflect scalability and data limitations, 'rather than a lack of need.' Under-represented conditions like dissociative disorders get nothing purpose-built. So people improvise — millions turn to general-purpose chatbots as informal therapy, tools never designed for it, with documented risks. That is not a technology gap anymore. That is an allocation gap."

**Fact-discipline:** All numbers from `reference-tech-gap-facts.md` (IAMHRF decline to 2014 levels; WHO Atlas 2% median; Rock Health share-halved; npj Digital Medicine AI mapping) and `reference-chatbot-facts.md` (chatbot beat). Trend wording ("fell back," "roughly halved") preferred over percentages; attribute when exact numbers are used. If pressed on stage: OpenAI figures are self-reported company data relayed in congressional testimony.

**Balance-guardrail (the steelman to pre-empt):** Mental health IS the most-funded clinical area in digital-health venture, seven years running. Never say "technology ignores mental health" — the defensible claim is "concentrated in generic formats for common conditions, shrinking, and nothing purpose-built for under-represented conditions." "Bland" is spoken flavor only, never slide text. The npj quote — "rather than a lack of need" — is the talk's strongest single sentence; give it its own line on the slide.

**Visual:** Split screen: left, "where tech investment flows" (teletherapy / wellness apps / AI decision-support icons); right, "purpose-built tools for dissociative disorders:" [empty]. The empty right side is the thesis in visual form.

**Transition:** "Team Calendula exists to narrow that gap."

## Slide 6 — Team Calendula: the response (1:30)

**Goal:** Introduce the project cleanly, single mission sentence.

**Spoken:** "Team Calendula is an independent software project created to narrow this gap — to build technology for conditions that receive little mainstream attention. Its first focus is dissociative disorders."

**Guardrails:** "Independent software project" — never "company," never "startup" (not a registered entity). Singular first person throughout ("my project," "I build").

**Visual:** One line: mission statement. Project name treatment. Minimal.

**Transition:** "Its first product is Systemiser."

## Slide 7 — Systemiser: continuity by design (1:45)

**Goal:** Land the unifying frame before any features.

**Spoken:** "Systemiser is designed around a single unifying need: continuity. Dissociative symptoms disrupt memory, identity, and the organization of daily life — the thread of a person's own story. Systemiser's purpose is to hold that thread: to restore continuity of memory, identity, and daily organization when symptoms break it."

**Guardrails:** Continuity framing carries the slide — features come next, but the *why* is this sentence. Clinical register (Cleveland Clinic / Mayo Clinic grounding lives in the abstract ledger).

**Visual:** A "broken thread → held thread" motif. This is the emotional center of the talk; give it the best animation moment (thread snapping, then mending).

**Transition:** "That continuity breaks down into four concrete capabilities."

## Slide 8 — Capabilities (1:45)

**Goal:** Concrete features, tested framing begins here.

**Spoken:** "First, users can represent the distinct identity states that characterize these conditions, and track transitions between them. Second, a structured record of events, status, and functioning bridges memory gaps — a record you can return to. Third, all of it is shared selectively: a granular privacy model, because sensitive information demands granular control."

**Guardrails:** Four tested cycles exist (slide 11 covers status honestly); on this slide speak capability, not completion. No screenshots of a product UI that doesn't exist — diagrams only.

**Visual:** Three-panel diagram: states/transitions timeline, structured record, privacy gates. Build-in animation: panels assemble one at a time.

**Transition:** "None of this works as one app on one device."

## Slide 9 — Built as an ecosystem (1:00)

**Goal:** Scale of the build, honestly framed as in-progress.

**Spoken:** "Systemiser is being built as an application ecosystem spanning desktop, mobile, and web — with a real-time collaboration layer and privacy-focused, cloud-hosted data storage."

**Visual:** Device triangle (desktop/mobile/web) + collaboration layer beneath. "Being built" visible in the wording on the slide itself.

**Transition:** "And it doesn't stop at Systemiser's own apps."

## Slide 10 — Planned gateways (1:00)

**Goal:** Ambition, correctly labeled as planned.

**Spoken:** "Systemiser plans gateways into third-party platform categories — messaging and collaboration platforms such as Discord and Slack, and in-vehicle assistants such as Apple CarPlay and Android Auto. The point is broader than any one integration: platforms that already shape daily digital life can be turned toward assistive purposes."

**Guardrails:** Gateways are roadmap, not shipped — the slide says "planned." Discord is ONE gateway, not the platform.

**Visual:** Hub-and-spoke diagram, spokes labeled "planned." Animation: spokes extend outward.

**Transition:** "So — what actually works today? Here is the honest line."

## Slide 11 — Honest status: four tested cycles (1:00)

**Goal:** Credibility through precision about what's tested.

**Spoken:** "Prototype testing has exercised four core feature cycles to date: identity-state representation and transitions; status and functioning tracking; privacy-gated sharing; and collaborative information management. That is what exists in testing. That is the line I won't blur."

**Guardrails:** NEVER claim a working or shipped product. This slide is where reviewers decide whether to trust you — precision here buys trust for the roadmap slide.

**Visual:** Four checked cycle nodes on a track.

**Transition:** "And here is what's next."

## Slide 12 — Roadmap: grounding + crisis tools (0:45)

**Goal:** Show direction without overclaiming.

**Spoken:** "Under active development: grounding techniques and crisis-support tools — disorder-specific needs that the first four cycles don't yet address. Grounding is a standard clinical strategy for dissociative episodes; crisis support is exactly where it sounds. Both are on the roadmap, not in the tested list."

**Guardrails:** "Under active development" wording, verbatim, on slide and in speech.

**Visual:** Dashed roadmap extension from slide 11's track — visually distinct (dashed = not tested).

**Transition:** "Systemiser is the first case study — not the last word."

## Slide 13 — Trajectory + close (1:00)

**Goal:** Zoom out, end on mission, invite questions.

**Spoken:** "I present Systemiser as the first case study in Team Calendula's broader trajectory: a growing family of products addressing more under-represented conditions over time — closing the mental-health technology gap condition by condition. One condition at a time — that is how the gap closes. Thank you. I'm happy to take questions."

**Visual:** Family-of-products trajectory graphic (Systemiser node highlighted, future nodes abstract). Final line as typographic closer with a slow fade.

**Buffer:** ~30s of the 15-minute slot remains unplanned — absorbs the hands-question beat or a slow slide transition.

---

## Rehearsal checklist (run in order)

1. Full run with timer — flag any slide over budget.
2. Hands-question beat: practice holding the beat AFTER asking (silence feels 3× longer to the speaker than the room).
3. Slide 5 is the risk slide: rehearse the pivot sentence ("That's not a technology gap anymore. That's an allocation gap.") until it's automatic.
4. Verify no community terminology anywhere in the spoken notes.
5. Verify every number spoken has a source in `acm-abstract.md` or `reference-chatbot-facts.md`.
