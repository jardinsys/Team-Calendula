# SPEAKER NOTES — quick reference (v3.2, notes-only)

**Companion to `draft-script.md` v3.2 — this is the on-stage glance sheet, not prose.** 17 slides, 16 spoken, **14:15** verified (30+30+60+60+75+60+75+50+75+90+60+45+45+55+45s). ⚠ Q&A not guaranteed — nothing load-bearing relies on it.

**Language policy (never say):** alters, headmates, fronting, switching, system (community), plurality. Say: identity states, transitions, status and functioning, granular privacy, interoperability.

**Guardrails (always):** dissociative disorders named only from slide 9 · "planned" for every roadmap item · HIPAA = aim/aspiration only, Q&A-only · independent software project, never company · PTSD = proof the model works, never my example of neglect · OpenAI figures = "OpenAI's own reported data" · no em dashes in slide text.

---

## 1 · Title (0:30)
- Greeting, name, Tennessee State University
- Hook: "a design space most of this room has never been asked to look at"
- [Logos spin in and settle as you begin]

## 2 · Hook (0:30)
- "We are in a crisis — though you might not know it"
- Not headlines: how the world builds (and doesn't build) for mental health

## 3 · Where the money goes (1:00)
- One quarter, global VC by sector: AI $19B · health & biotech $15B · hardware $13B · fintech $8B (Crunchbase)
- Annual context: AI = record **37%** of all venture funding, 2024 (CB Insights)
- Zoom: US digital health 2024 = **$10.1B**; mental health = **$1.4B** (Rock Health)
- Steelman: mental health is the top-funded clinical area, six years running — still a sliver
- Close: "The wave is real. Mental health gets a sliver of it."
- [Bars grow, numbers count up as panels build]

## 4 · Scale + neglect (1:00)
- **1 billion+** live with a mental health condition (WHO, Sept 2025); care reaches only a fraction
- Neglect is uneven: qualitative claim only — "the pattern, not a number"
- [Counter runs 1.4s]

## 5 · Technology gap (1:15)
- Feasible now: platforms, real-time collab, AI, privacy engineering
- Research funding fell back to **2014 levels** by 2023 (IAMHRF ~110k grants)
- Governments: median **2%** of health budgets (WHO Atlas)
- Investment concentrates: teletherapy, meditation, mood trackers; share of digital-health funding **roughly halved** since 2021 (Rock Health)
- Punch: "The need is there. The capability is there. The investment isn't."

## 6 · AI: the evidence (1:00)
- Hands: "know someone who talks to ChatGPT about things they'd tell a therapist?"
- Gradient: **1 in 4** adults (surveys 2025, 22–24%) → **1 in 2** with ongoing conditions (Rousmaniere, 499 surveyed) → **4 in 5** in treatment never told their therapist (one clinical sample)
- Quote: JeeP, 60 — "prepare for it… much more clarity" (npj Mental Health Research 2024)
- "Nobody's first choice… it's the option that was actually available. The use of AI is the trace evidence of the gap."
- Risk boxes: OpenAI self-reported **1M+/week** suicide-planning indicators · ACM FAcT 2025 (Stanford): stigma + no suicidal-intent interruption
- ⚠ Most users were already in care — "the people with the fewest alternatives lean hardest"

## 7 · Team Calendula (1:15)
- Independent software project, solution to part of this: trauma-based disorders
- PTSD = proof: VA app suite + VR exposure at 170+ **VA** sites ("where investment goes, software follows")
- "Not the only condition in that class that deserves focus. It's the proof."
- Every product: rigorous research first, features second

## 8 · The landscape (0:50)
- DSM-5 map: PTSD, acute stress, adjustment (F43.20–25), RAD, DSED; starred: dissociative disorders
- Chips: gold = funded/specialized apps exist (PTSD); grey = no purpose-built apps
- Tail: causal classes; depressive/anxiety/personality/substance-use where trauma is a major factor
- "A class of conditions the field recognizes — and software has not."

## 9 · Systemiser: continuity (1:15) ← FIRST dissociative mention, emotional center
- First product, built for dissociative disorders; unifying need: **continuity**
- Symptoms disrupt memory, identity, daily organization; the thread breaks
- "Systemiser's purpose is to hold that thread"
- "Everything else is that one sentence, made concrete"

## 10 · Capabilities (1:30) ← expansion slot (Jardin's pending list)
- Identity states + transitions: which identity state is present, how it changes
- Structured record: events, status, functioning; auto-linked to the identity state present
- Selective sharing: stranger / friend / private tiers
- Keep "capability, in development" framing — tested status is slide 13

## 11 · Ecosystem + stack (1:00)
- Desktop, mobile, web, social-media integration
- Real: WebSocket presence-aware sync · MongoDB + Redis + Cloudflare R2 · OAuth2/JWT, containerized
- Built: chat-platform clients, REST API, web app · Planned: standalone desktop/mobile, offline mode
- Close: "continuity that follows the person across every surface"

## 12 · Gateways (0:45)
- Planned spokes: social platforms (Discord · Slack), in-vehicle (CarPlay · Android Auto), further categories
- "Platforms that already shape daily digital life, turned toward assistive purposes"
- Planned — roadmap, not shipped

## 13 · Honest status (0:45) ← the line I won't blur
- Four cycles in prototype testing: identity-state representation/transitions (layer system, shift history) · status & functioning (per-state status, battery, caution) · privacy-gated sharing (per-field, per-tier buckets) · collaborative information (WebSocket presence, auto-linked)

## 14 · Roadmap (0:55)
- Grounding + crisis-support tools: under active development; grounding = standard clinical strategy
- Daily organization: reminders, offline, **mood check-ins**, **mood/transitions/notes calendar**, accessibility (screen reader, keyboard, motion sensitivity)
- App connectivity: future Team Calendula apps + partnered resources (no app names)

## 15 · Beyond Systemiser (0:45)
- Family on the slide: TrigIn (planned, trigger management) → Canary (planned, pre-crisis companion) → + more, condition by condition
- Connectivity across family; reusable gateway categories
- "Early conversations with clinicians and organizations already underway" (qualitative)

## 16 · Close (0:45)
- "Technology rebuilt sector after sector — and left this one behind. The need is documented. The capability exists. The attention is the missing piece."
- "Four tested cycles are the beginning, not the promise."
- "One condition at a time — that is how the gap closes."

## 17 · References
- Leave up after the close; all sources on the slide

---

## Rehearsal checklist
- [ ] Full timed run (target ≤14:30 spoken)
- [ ] Silence practice after the hands beat (slide 6) and before "One condition at a time"
- [ ] No banned vocabulary; every number has a source above
- [ ] Slides 3 and 5 rehearsed until automatic (longest argument beats)
- [ ] If over time, cut first: slide 4's "defensible claim" sentence, slide 8's causal-classes tail, slide 14's roadmap tail
