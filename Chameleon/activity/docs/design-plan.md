# Systemiser Activity — Front-End Plan
Living document. Phases execute in order; each page pass: HTML preview → Penpot board → sign-off → JSX.

## Phase T — DONE
- `tokens.css` (layered, zero visual change) + Penpot `TOKENS v2` board (fonts hand-tuned by Jardin).

## Phase R — Registration REDESIGN (design-first, no code yet)
Current flow is hard to navigate — users get lost. Redesign before anything is wired in.

### Step 0 gate — ToS & Privacy (embedded template spec)
Two-tab `LegalPage` template, shown as a required gate before Register Start:
- **Header:** "Welcome to Systemiser" + one short line: "Before you join, please read our Terms and Privacy Policy."
- **Tabs:** [Terms] [Privacy] — underline-accent active state, lavender pill [I understand & agree →] disabled until scroll-to-end of at least one read, or an explicit checkbox "I've read both" (decide in preview round).
- **Privacy content must cover (plural-systems-aware):** system-level storage (one account = one system), alters/fronts/notes visibility defaults, who can see what (friends/system members only), mood check-in data usage, deletion/DSLR-style removal rights, name-change (deadname) handling — no history retention of prior legal names.
- **Consent record:** `{ acceptedTermsAt, privacyVersion }` stored on the system account — gate cannot proceed without it.
- Placement: replaces nothing, wraps the flow — first screen after auth handshake; back-navigation from Register Start returns to it.
- **NOTE:** template is embedded in this plan (this section) — not a loose separate template.

### Redesigned flow target (draft for preview round)
Navigation = **branching flow, no linear rail** (Jardin's direction):
- **No progress rail** — no fake sense of total steps; the step count legitimately varies per user
- **No skip options** — instead the flow *branches*: choices (import vs manual, condition selected) add/reshape the screens ahead; every screen offers exactly the choices relevant to it
- **Contextual tutorial embedded in navigation** — explanations of System/Entity/Fronting terms appear live on the screens where they're first needed, and tutorial content adapts to the condition the user selected (e.g. a DID-system import flow explains terms differently than a single-entity manual flow)
- Current navigation is directionally correct; it needs *expansion and redesign*, not replacement — keep its step ordering, fix the branching clarity and add the inline teaching layer

Step 0 gate (LegalPage) still applies before the flow begins.

Deliverables: `preview/registration.html` (+ per-step sections), Penpot page **"Registration Pass"**, review with Jardin, iterate, then implement.

## Phase P — Page passes (after Registration)
Order: Landing → System → Switch → Entity View+Form → Notes → Friends → Front History → Settings/Crisis/About/Loading → Bottom nav.
Each pass = HTML preview → Penpot board → sign-off → JSX, reusing tokens only.

## Later (explicitly deferred)
Mood check-in (bot-DM 3×/day, system-level) + mood/fronting/note calendar; system & entity cards with user background images (ring/gradient scrim rules per card size).
