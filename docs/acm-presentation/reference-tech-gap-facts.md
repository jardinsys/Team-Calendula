# Reference Sheet — Technology-Gap Facts (grounded)

Collected Nov 2026 for the ACM talk. Companion sheets: `reference-chatbot-facts.md` (AI/chatbot detail — now a supporting beat only) and the facts ledger in `acm-abstract.md`. Lead with THIS sheet's facts; the chatbot material follows briefly.

## The neglect, in research-funding terms

- **Global mental-health research funding entered a steep decline after 2020 and by 2023 had fallen back to 2014 levels in real terms** — after a decade of growth. IAMHRF open-data analysis (~110,000 grants, 40 funders, 2014–2023). Sources: iamhrf.org/funding-landscape; Nature comment *d41586-026-01550-4* ("Mental-health research is too often invisible").
- **~80% of global mental-health research funding comes from the United States** (Nature comment, same analysis) — a concentration fact, usable if the room pushes on "where does it go."
- **Governments spend a median of only ~2% of total health budgets on mental-health services** — much less in LMICs (WHO Mental Health Atlas 2020/2024 data). Source: Europe PMC MED/42553331 (Global South systematic review).
- **Mental health receives less than 10% of total public medical research funding** (Australia portfolio analysis: broad mental health ≈ 7.5% of NHMRC disease-specific funding in 2021, $102.3M of $1.35B). Source: ScienceDirect S2666606523001049. Note: same general territory as the abstract's IAMHRF "under 1% for some conditions" evidence — keep condition-level claims qualitative per the abstract's discipline.

## The neglect, in technology-investment terms (the talk's lead argument)

- **Mental health has been the most venture-funded clinical area in digital health for seven consecutive years** (~$14B into US mental-health startups since 2020; peak ~$4.8B in 2021) — **BUT its share of overall digital-health venture funding has roughly HALVED since 2020–21** (16.1% then, about half that now). Sources: Rock Health H1 2026 funding overview; market overview at massivelybetterhealthcare.com. → The honest line is "concentrated and shrinking," NOT "technology ignores mental health."
- **Where that investment lands: generic formats** — virtual therapy platforms, digital therapeutics, wellness apps (Rock Health company categories; 419 companies). Nothing in the category structure suggests purpose-built tools for under-represented conditions like dissociative disorders.
- **In AI specifically, mental health draws less venture capital than decision support, drug discovery, or diagnostics** — ~2/3 of healthcare AI investment goes to those higher-complexity domains; "areas such as mental health, public health, and rehabilitation attract less AI venture capital, reflecting scalability and data limitations rather than a lack of need." Source: npj Digital Medicine AI-startup mapping *s41746-026-02595-5*. ← This is the strongest single sentence for the talk: the shortfall is admitted to be structural, not a lack of need.
- **Direct-to-consumer digital health: mental health is the most-targeted domain** (16.7% of 478 companies) — again concentrated consumer wellness/therapy, same concentration pattern. Source: PMC12661595.

## Context facts (use sparingly, on the scale slides)

- Treatment gap: exceeds 75% across most of Latin America/Caribbean, surpasses 85% in many Asian LMICs, can exceed 90% for common disorders in parts of sub-Saharan Africa; in the African region ~10% of the population lives with a mental disorder and fewer than 1 in 10 receives treatment. Source: Europe PMC MED/42553331. → These are SYSTEM-capacity numbers, not tech-investment numbers — scale-slide material.
- LMICs spend a median of less than USD 2 per person annually on mental health vs over USD 80 in high-income countries (WHO Mental Health Atlas).

## ⚠ Flags for slide/speech use

- **Rock Health fact cuts both ways.** "Most-funded clinical area in digital health, 7 years running" is the steelman a reviewer will raise. Pre-empt it: the investment is real but concentrated in generic formats for common conditions, and its share is shrinking. Never say "technology ignores mental health."
- **"Bland" is an editorial judgment** — Jardin's instinct, and probably true, but no source says "mental-health apps are bland." The grounded version is "generic formats aimed at the most common conditions; nothing purpose-built for under-represented conditions." Keep the editorial flavor for spoken delivery, not for slide text or citations.
- **Trend claims over percentages where possible**, matching the abstract's discipline: "fell back to 2014 levels," "roughly halved since 2021." If exact numbers are used, attribute them (16.1%, 2% median, <10%).
- The 2%-of-budgets and treatment-gap numbers are service-system facts — useful context, but don't present them as technology facts.
- IAMHRF is already the abstract's underlying evidence base (its earlier 75,000-grant report) — the 2014–2023 update is consistent, not contradictory. If asked, the abstract's qualitative wording stands.

## PTSD contrast case (proof-of-model, NOT a target)

- Purpose in the talk: evidence that purpose-built software follows investment — NOT an example of a neglected condition. Never name PTSD as "under-represented"; the abstract's ledger flag is confirmed by these findings.
- **VA app suite** (free, government-built, publicly available): PTSD Coach (self-management), PTSD Family Coach, PE Coach and CPT Coach (treatment companions for evidence-based therapies). Sources: ptsd.va.gov/appvid/mobile (PE Coach pages + mobile app summary PDF); mobile.va.gov.
- **Bravemind** (USC Institute for Creative Technologies, Dr. Albert "Skip" Rizzo): clinical VR exposure-therapy system, multisensory (sight, sound, smell, vibration/haptics); in the largest RCT to date (Difede, Rothbaum, Rizzo et al., 2022) found **equivalent to Prolonged Exposure**, the best evidence-based PTSD treatment, with better outcomes in comorbid major depression; **distributed to over 170 clinical sites**; deployed at ~28–29 VA medical centers via SoldierStrong; adapted for military sexual trauma and Ukrainian war survivors. Sources: medvr.ict.usc.edu/projects/bravemind.html; marketplace.va.gov/innovations/bravemind; ict.usc.edu/research/projects/bravemind-virtual-reality-exposure-therapy.
- ⚠ The 170+ sites figure is VA/military-adjacent — attribute as "VA clinical sites." The app suite is VA-built (US/veterans-origin, publicly available to anyone).
- Taxonomy guardrail: DSM-5 places dissociative disorders in their own chapter, SEPARATE from trauma- and stressor-related disorders (ICD-11 recognizes complex PTSD as its own diagnosis). The talk's safe category claim is "conditions closely tied to trauma that receive little mainstream attention" — association, not chapter membership. PTSD belongs to the well-served side of the line; dissociative disorders to the under-served side.

## Slide 3 funding-funnel figures (added Nov 2026)

- **Crunchbase, Q3 2024 sector snapshot**: AI $19B, healthcare & biotech $15B, hardware $13B, fintech $8B (global venture funding by sector, one quarter). Annual AI series: 2022 $45.8B, 2023 ~$50B, 2024 $114B (as revised in 2026 reporting), 2025 $211B (+85% YoY, ~⅓ of global VC).
- **CB Insights, State of Venture 2024**: AI captured a record 37% of all venture funding (17% of deals) — both all-time highs; vertical sectors (fintech, digital health, retail tech) lost AI-deal share, 38% (2019) → 24% (2024).
- **Rock Health, 2024 year-end market overview**: US digital health raised $10.1B across 497 deals; mental health $1.4B — top-funded clinical area for the sixth straight year. Mental-health startups' share of digital-health funding roughly halved since 2021 (16.1% → ≈8%).
- Slide-3 guardrail: all three bar figures are full-year 2024 or explicitly quarter-labeled; never mix the Q3 sector snapshot with annual mental-health dollars in one bar set.

## Slide placement

- **Slide 5 (technology gap) leads with this sheet**: feasibility (S3) → research funding declined to 2014 levels → tech investment concentrated in generic formats and shrinking → AI investment skips mental health → "scalability and data limitations rather than a lack of need" → allocation gap. NO dissociative-disorders mention (Jardin's v2 rule — first DD mention is Systemiser, slide 9); keep the split-visual's right side generic ("under-represented conditions").
- **Slide 6 (AI: the telling extra, lighter tone)**: the chatbot beat lives here as its own slide (hands question + trace evidence + one risk line); details in `reference-chatbot-facts.md`.
- Context facts (treatment gap, 2% budgets) live on slides 3–4, not on slide 5.
- **Slide 7 (Team Calendula)**: PTSD contrast case as a spoken proof-of-model beat ("where investment goes, software follows" + "PTSD is not the only condition in that class"). PTSD never on the slide.
- **Slide 8 (landscape)**: DSM-5 trauma- and stressor-related chapter list; AndColon research-mapping screenshot as optional visual (⚠ contains a dissociative-disorders category — Jardin decides include/crop/replace).
