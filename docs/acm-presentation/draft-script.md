# DRAFT SCRIPT — ACM Talk (v3.4, deck-aligned)

**Audience: computer engineers, potential designers and developers** — engineering-first register throughout (design spaces, architecture, allocation of engineering attention). A full spoken draft (~1,900 words ≈ 14:30 at a natural conference pace), NOT to be read verbatim on stage — it is the working text the slides are built from and rehearsed against. Slide numbers match the built deck (`docs/acm-presentation/slides/index.html`, 18 slides incl. references).

**v3.4 changes (rebuilt from the current deck, Jardin's call: script follows the slides):** running order confirmed as the deck renders it — slide 5 is **AI: the evidence**, slide 6 is **the technology gap** (the v3.3 swap note said gap-first, but the deck renders AI-first; the gap slide's "and now, generic AI chatbots" now lands as a callback to slide 5) · slide 6 gains a spoken nod to the on-slide npj quote ("rather than a lack of need") · slide 9 landscape now names **prolonged grief disorder** (deck panel) · slide 11 capabilities gains the **Custom viewer tier** ("user decides per field") and its bracket now points tested-status to slide 12 · timing table rebuilt for 17 spoken slides and arithmetically verified: **14:30** (the old table claimed 14:15 over "16 spoken" — it dropped a slide and undercounted).

**v3.3.2 changes: new slide 7 "PTSD: proof the model works" (VA app suite, VR exposure at 170+ VA sites, VA-concentrated access as the catch) — deck now 18 slides · slide 5 closer is now "The investment is where?" with the PTSD asterisk ·**

**v3.3.1 changes: honest-status moved behind capabilities (slide 12); technical smalls stay on the ecosystem slide (13) · slide 3 closer-look line · slide 7 "is" + "there is proof" · slide 9 thread flow re-sequenced ·**

**v3.3 changes (Jardin's visual pass + addendum): voice-assistant gateway spoke added · fullscreen fill mode (F key: stage widens to cover the screen, no letterbox) · slide 3 drops "the wave is real", zoom bars enlarged · gateways rebranched (social + work, extensions & plugins, further categories) · slide 13: social battery + shared notes, end statement removed · slide 10: notes in the structured record · roadmap: to-do lists · arrow tooltip removed · softer slide fades ·**

**v3.1 changes (technical-depth pass, Jardin's calls after talking to other presenters):** ecosystem rebuilt as the **stack slide** (desktop, mobile, web, and social-media integration, with the real implemented stack: WebSocket sync, MongoDB + Redis + R2, OAuth2/JWT); gateways split to their own slide (Social platforms: Discord · Slack; In-vehicle: CarPlay/Android Auto — all planned); tested cycles name their implementing tech; daily-organization adds **mood check-ins + a mood/transitions/notes calendar** (planned, deferred in the design plan, still spoken); imports dropped from capabilities (Jardin: not wanted); **Q&A is not guaranteed — Jardin is confirming with the venue**; the Q&A-prep section stays but nothing load-bearing depends on it.

**[brackets] = stage directions.** Every number spoken has a source entry in `reference-tech-gap-facts.md`, `reference-chatbot-facts.md`, or the `acm-abstract.md` ledger.

**Language policy:** README-derived features are translated into clinical vocabulary. Never speak: "alters," "headmates," "fronting," "switching," "system" (as community term), "plurality." README equivalents → talk equivalents: alters → identity states; front/switch → transitions / which identity state is present; status/battery/caution → status and functioning tracking; privacy buckets → granular, viewer-tiered privacy; import from PluralKit/Simply Plural/Tupperbox/Octocon → interoperability with existing records and tools.

---

## Slide 1 — Title (0:30)

[Logos spin in and settle as the slide opens.] Good morning. I'm [Jardin], from Tennessee State University. Today I want to show you a design space most of this room has never been asked to look at — and software being built to serve it.

## Slide 2 — Hook (0:30)

We are in a crisis — though you might not know it. Not the one making headlines. A quieter one, in how the world builds — and doesn't build — for mental health.

## Slide 3 — Where the money goes (1:00)

[Bars grow, numbers count up as the panels build.] We're living through the fastest innovation cycle in software history, and venture money shows where it points. Here's one quarter of global venture funding, by sector: AI leads. Health and biotech is right behind it. Hardware, fintech. [beat] For scale: over the full year, AI took a record thirty-seven percent of all venture funding — an all-time high. Now zoom in on health: all of US digital health raised about ten billion dollars in 2024. And inside that, mental health — one point four billion. [beat] To be clear, that's actually the best case: mental health is the top-funded clinical area in digital health, six years running. [beat] The data shows where investment goes. What it leaves out deserves a closer look.

## Slide 4 — The scale + uneven neglect (1:00)

[Counter runs 1.4s.] The scale behind that sliver: more than one billion people worldwide live with a mental health condition, yet support and treatment reach only a fraction of those affected. That's the World Health Organization's 2025 assessment. And the neglect is not even — and it is measurable. The International Alliance for Mental Health Research Funders — IAMHRF — analyzed more than seventy-five thousand research grants: less than two percent of mental-health research funding targets the conditions that cause over half of mental-illness deaths. And ninety-five percent of that funding stays in high-income countries. [beat] Some conditions attract significant research funding and technology investment. Others draw disproportionately little support relative to their real-world burden.

## Slide 5 — AI: the evidence (0:55)

Now — the part every room relates to. Quick show of hands: how many of you know someone who talks to ChatGPT about things they'd tell a therapist? [beat] Mine's up too.

Look at the pattern. Roughly one in four adults have used AI chatbots for mental-health support. Among people with an ongoing condition: about one in two. And in one clinical sample, four out of five people in treatment had never told their therapist. [beat] One participant put it plainly: "If I have a therapy session next week, I sort of use Pi to sort of prepare for it… that gives me much more clarity." [beat]

Nobody's first choice for their deepest struggles is a chatbot — it's the option that was actually available. The use of AI is the trace evidence of the gap. And it isn't risk-free: OpenAI's own reported data showed over a million users a week in conversations with explicit indicators of potential suicide planning, and a study presented at ACM's own FAcCT conference found therapy chatbots stigmatize severe conditions and fail to interrupt suicidal intent. People are telling us exactly where the demand is — with tools that were never built for it.

## Slide 6 — The technology gap (1:10)

So why wasn't it built? Here's what makes this urgent for us as builders. Software platforms, real-time collaboration, AI, and privacy engineering have made assistive mental-health technology newly feasible — so the gap should be closing. Instead: global mental-health research funding declined after 2020, and by 2023 had fallen back to its 2014 level. Governments spend a median of just two percent of health budgets on mental health. And where technology investment does reach mental health, it concentrates in a narrow set of generic formats — teletherapy platforms, meditation apps, mood trackers — and now, generic AI chatbots — aimed at the most common conditions. [The npj quote sits on the slide: "rather than a lack of need" — investment skips mental health, not because the need is missing. Let it land.] [beat] And here is the part that makes this solvable: the reach already exists. A global meta-analysis — forty-eight studies, more than ten thousand people living with mental-health conditions — found smartphone ownership and internet use have nearly caught up with the general population: eighty-seven percent are online, and the majority say they want support through their mobile devices. The channel to reach the people who need help is already in their pockets.

The need is there. The capability is there. The investment is where? [asterisk on slide: PTSD is the standing exception — funded by government, proof next slide]

## Slide 7 — PTSD: proof the model works (0:45)

And we know the model works when a condition gets attention. PTSD — a condition with sustained investment — has a government-built suite of free apps, even virtual-reality exposure therapy reaching over 170 VA clinical sites. [If pushed in Q&A: PTSD is deliberately NOT my example of neglect — it's proof the model works.]

But here's the catch: that investment ran through the VA. The apps, the therapy, the sites — they exist for veterans. The other trauma-based conditions, and most people who live with them, are still on the outside.

There is proof of the model: where a condition gets sustained investment, purpose-built software follows. Who gets to benefit is the open question.

## Slide 8 — Team Calendula: a solution to part of this (0:45)

Team Calendula is an independent software project — it is a solution to part of this, specifically for trauma-based disorders.

The same model, pointed at the rest of the class. And every product in the family begins the same way: with rigorous research into the condition it serves, before a single feature is designed.

## Slide 9 — The landscape (0:50)

How big is "the rest"? Here's the map from our research library, built on the DSM-5. The trauma- and stressor-related chapter alone: post-traumatic stress disorder, acute stress disorder, prolonged grief disorder — and adjustment disorders, all six of them, from F43.20 to F43.25. Then reactive attachment disorder and disinhibited social engagement disorder. And the starred class: dissociative disorders — where no purpose-built software exists. [beat] The gold chip is the funded one; the grey chips are the rest. [beat]

And this understates it. These are the causal classes; there are other condition classes — depressive, anxiety, personality, substance-use — where trauma can be a major factor in cause.

This is not one niche condition. It's a class of conditions the field recognizes — and software has not.

## Slide 10 — Systemiser: continuity by design (1:15) — emotional center

[Systemiser is already named on the landscape slide; this slide is the reveal of the product.] Systemiser is Team Calendula's first product — built for dissociative disorders. It's designed around a single unifying need: continuity.

[thread draws, cuts named in order — Memory breaks, Identity, Daily organization, above the line]

Dissociative symptoms disrupt memory, identity, and the organization of daily life. The thread of a person's own story — who was present, what happened, what needs doing — can break without warning.

[one tap: the orange line mends the cuts — the labels stay — and the closing lines appear on their own]

Systemiser's purpose is to restore continuity of memory, identity, and daily organization when symptoms disrupt them.

Everything else I'm about to show you is that one sentence, made concrete.

## Slide 11 — Capabilities (1:15)

That continuity breaks down into concrete capabilities.

First: representing the distinct identity states that characterize these conditions, and tracking transitions between them — which identity state is present, and how it changes over time.

Second: a structured record of events, status, functioning, and notes. Records of what happened, how it went, and how capacity is doing — and the record links automatically to the identity state present when it was created. A record you can return to when memory can't be trusted to hold it.

Third: sharing that is selective by design. A granular privacy model with viewer-tiered visibility — what a stranger sees, what a friend sees, what stays entirely private. And a custom tier: the user decides visibility per field. Sensitive information demands granular control.

[Deck framing line: "Capabilities as designed, in development; tested status follows." Feature expansion lands here — Jardin's list, pending. No import-pipeline talk on this slide (Jardin's call).]

## Slide 12 — Honest status (0:45)

So — what actually works today? Here is the honest line.

Prototype testing has exercised four core feature cycles to date. Identity-state representation and transitions — which state is present, and how it changes over time. Status and functioning — per-state status, social battery, and caution. Privacy-gated sharing — stranger, friend, and private viewer tiers. And collaborative information management — shared notes with WebSocket presence, auto-linked to whoever was present. That is what exists in testing today.

## Slide 13 — Built as an application ecosystem (0:55)

None of this works as one app on one device. Systemiser is being built as an application ecosystem: desktop, mobile, web, and social-media integration.

And here is the actual engineering under it. A real-time collaboration layer — WebSocket sync, presence-aware, across every client. A privacy-focused data layer: MongoDB as the primary store, Redis as the cache, Cloudflare R2 for object storage. Access control with OAuth2 and JWT, running as containerized services. [beat] What's built and in testing: the chat-platform clients, the REST API, the web app. What's planned: standalone desktop and mobile apps, with offline mode. [beat]

The point is continuity that follows the person across every surface they already use.

## Slide 14 — Planned gateways (0:45)

And gateways extend that reach — planned, roadmap, not shipped. Social and work platforms — Discord, Slack, Microsoft Teams. Voice assistants — Amazon Alexa, Google Assistant, Siri. In-vehicle assistants — Apple CarPlay, Android Auto. Extensions and plugins — browser extensions, integrated plugins. Further categories — wearables, OS widgets — as the family grows.

This is the same idea turned outward: platforms that already shape daily digital life, turned toward assistive purposes.

## Slide 15 — Roadmap (0:50)

And here is what's next. Under active development: grounding techniques and crisis-support tools — disorder-specific needs the first four cycles don't yet address. Grounding is a standard clinical strategy for dissociative episodes.

Beyond that, the roadmap extends continuity into daily organization — reminders, to-do lists, offline access, mood check-ins, and a calendar that links mood, transitions, and notes into one thread — plus accessibility work: screen-reader support, keyboard navigation, motion-sensitivity options. And app connectivity: Systemiser connecting with future Team Calendula apps and with partnered apps and resources. [Do not name future apps here.]

## Slide 16 — Beyond Systemiser: the family (0:40)

And the model is the point. The family has names on it: TrigIn, planned, for trigger management. Canary, planned, as a pre-crisis companion. And more, condition by condition — each product condition-specific, built on the same rigorous research, with connectivity across the family. The gateway categories are reusable across every product.

The trajectory: a growing family of products addressing more under-represented conditions over time — closing the mental-health technology gap condition by condition. And that trajectory isn't hypothetical — early conversations with clinicians and organizations are already underway.

## Slide 17 — Close (0:40)

So: technology has rebuilt sector after sector — and left this one behind. The need is documented. The capability exists. The attention is the missing piece. Team Calendula targets that gap condition by condition — starting with Systemiser, whose four tested cycles are the beginning, not the promise.

One condition at a time — that is how the gap closes.

Thank you. I'm happy to take questions.

## Slide 18 — References

[Leave on screen after the close. Sources are on the slide; the two fact sheets back every number.]

---

## Pacing notes

- 18 slides: 17 spoken ≈ 14:30 at ~130–140 wpm (verified by arithmetic: 30+30+60+60+55+70+45+45+50+75+75+45+55+45+50+40+40 = 870 s = 14:30). ⚠ Q&A is NOT guaranteed — Jardin is confirming with the venue; the references slide reads on its own either way.
- Longest argument slides: 3 (funnel) and 6 (the gap) — rehearse "The need is there. The capability is there. The investment is where? [asterisk: PTSD is the standing exception]" until automatic.
- Slide 5 (AI) is the longest evidence slide; the three bars are one gradient — do not stop on each, flow general → conditions → concealment.
- Slide 10 is the emotional center — one tap on the mend; do not talk over it.
- Lines that must sound like Jardin (rephrase freely): slide 2 crisis line, slide 5 "trace evidence" sentence, slide 9's record sentence, slide 17 "One condition at a time."
- If over time in rehearsal, first cuts: slide 4's "defensible claim is the pattern" tail (move to Q&A prep), slide 9's causal-classes tail, slide 15's roadmap tail.
- ⚠ Verify before final: "170+ VA clinical sites" (attribute as VA sites); "initial networking underway" (qualitative, no partnership claims); Canary/TrigIn spoken only as "planned" on slide 16; HIPAA stays "aim/striving toward," never "compliant/certified," Q&A only; dissociative disorders never spoken before slide 9.

## Q&A prep (Jardin's likely questions)

- **Why the quarter snapshot on slide 3?** Crunchbase publishes the sector split quarterly; the annual split for non-AI sectors isn't cleanly published. Say "one quarter, labeled as such" — the CB Insights 37% carries the annual AI context.
- **Why is mental health's $1.4B a problem if it's the top-funded clinical area?** Exactly — steelman it: that's the best case, and it's a sliver of what AI took. The abstract's claim is qualitative ("disproportionately little") — the slide numbers illustrate it, the abstract doesn't depend on them.
- **Is Canary an AI product?** Yes, planned — an application people can vent to and be guided through episodes before a crisis. Not a therapist. Say only what's needed; don't oversell.
- ⚠ Q&A may not happen — if the venue gives no Q&A, the trusted-actions design, emoji-proxy engineering, and HIPAA aspiration simply don't get spoken; none of them are on slides.
- **HIPAA?** Aspirational: the aim is clinical-grade, HIPAA-aligned privacy as the ecosystem matures. Independent project, not inside medical systems yet.
- **Where's the dissociative-disorders funding number?** Never isolated in a source; the under-1% claim covers the broad less-represented class, DID is positioned as an instance of it, not a separately measured statistic.
