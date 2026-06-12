// ═══════════════════════════════════════════
// DISSOCIATIVE DISORDER MAPPING
// Single source of truth for Discord bot + embedded app + webapp
// ═══════════════════════════════════════════

// Each disorder maps to its full name, source classification, and
// which booleans it auto-sets on sys_type. Disorders with
// `extraQuestion: true` need a follow-up before resolving.
// Disorders with `hasSubtypes: true` have a dropdown of subtypes.

export const DISORDER_MAP = {
    // ═══ DSM-5 ═══

    // System disorders (isSystem + isFragmented)
    'DID': {
        fullName: 'Dissociative Identity Disorder',
        source: 'DSM',
        isSystem: true,
        isFragmented: true,
    },

    // OSDD parent — all types under this
    'OSDD': {
        fullName: 'Other Specified Dissociative Disorder',
        source: 'DSM',
        hasSubtypes: true,
        subtypes: ['OSDD-1', 'OSDD-2', 'OSDD-3', 'OSDD-4'],
    },

    // OSDD-1 parent — has subtypes 1A and 1B
    'OSDD-1': {
        fullName: 'Type 1 — Identity alteration',
        source: 'DSM',
        hasSubtypes: true,
        subtypes: ['OSDD-1A', 'OSDD-1B'],
    },

    // OSDD-1A — extra question
    'OSDD-1A': {
        fullName: 'Type 1A — Distinct identity states without amnesia',
        source: 'DSM',
        extraQuestion: true,
        extraQuestionText: 'How do you experience your identity states or parts?',
        extraQuestionYesLabel: 'They are distinct alters',
        extraQuestionNoLabel: 'They are just fragmented states',
        extraQuestionYes: { isSystem: true, isFragmented: true },
        extraQuestionNo: { isSystem: false, isFragmented: true },
    },

    // OSDD-1B — direct select
    'OSDD-1B': {
        fullName: 'Type 1B — Identity states with amnesia',
        source: 'DSM',
        isSystem: true,
        isFragmented: true,
    },

    // Fragmented only
    'OSDD-2': {
        fullName: 'Type 2 — Identity disturbance',
        source: 'DSM',
        isSystem: false,
        isFragmented: true,
    },
    'OSDD-3': {
        fullName: 'Type 3 — Acute dissociative reactions',
        source: 'DSM',
        isSystem: false,
        isFragmented: true,
    },
    'OSDD-4': {
        fullName: 'Type 4 — Distress from unresolved grief or spiritual practices',
        source: 'DSM',
        isSystem: false,
        isFragmented: true,
    },

    // Amnesia with fugue extra question
    'Amnesia': {
        fullName: 'Dissociative Amnesia',
        source: 'DSM',
        extraQuestion: true,
        extraQuestionText: 'Do you have "with Fugue" subtype?\n Does your memory loss include episodes of wandering or traveling to unfamiliar places?',
        extraQuestionYesLabel: 'Yes (Fugue)',
        extraQuestionNoLabel: 'No',
        extraQuestionYes: { key: 'Amnesia-Fugue', isSystem: false, isFragmented: true },
        extraQuestionNo: { key: 'Amnesia', isSystem: false, isFragmented: false },
    },
    'Amnesia-Fugue': {
        fullName: 'Dissociative Amnesia with Fugue',
        source: 'DSM',
        isSystem: false,
        isFragmented: true,
    },

    // Dissociative only
    'Dereal/Depers': {
        fullName: 'Depersonalization-Derealization Disorder',
        source: 'DSM',
        isSystem: false,
        isFragmented: false,
        isDissociative: true,
    },

    // Catch-all
    'UDD': {
        fullName: 'Unspecified Dissociative Disorder',
        source: 'DSM',
        isSystem: false,
        isFragmented: false,
    },

    // ═══ ICD-11 ═══

    // System disorders (isSystem + isFragmented)
    'P-DID': {
        fullName: 'Partial Dissociative Identity Disorder',
        source: 'ICD',
        isSystem: true,
        isFragmented: true,
    },

    // Fragmented only
    'Trance': {
        fullName: 'Dissociative Trance Disorder',
        source: 'ICD',
        isSystem: false,
        isFragmented: true,
    },

    // Extra question needed
    'Possession Trance': {
        fullName: 'Possession Trance Disorder',
        source: 'ICD',
        extraQuestion: true,
        extraQuestionText: 'Do you want to track the entities/spirits themselves?',
        extraQuestionYesLabel: 'Yes',
        extraQuestionNoLabel: 'No, just the trance states',
        extraQuestionYes: { isSystem: true, isFragmented: true },
        extraQuestionNo: { isSystem: false, isFragmented: true },
    },

    // Extra question needed
    'DNSD': {
        fullName: 'Dissociative Neurological Symptom Disorder',
        source: 'ICD',
        extraQuestion: true,
        extraQuestionText: 'Do you want to track your neurological symptoms and situations using states?',
        extraQuestionYesLabel: 'Yes',
        extraQuestionNoLabel: 'No',
        extraQuestionYes: { isSystem: false, isFragmented: true },
        extraQuestionNo: { isSystem: false, isFragmented: false },
    },

    // Dissociative only
    'Depersonalization-Derealization': {
        fullName: 'Depersonalization-Derealization Disorder',
        source: 'ICD',
        isSystem: false,
        isFragmented: false,
        isDissociative: true,
    },
};

// Short definitions for UI display (DSM-5 & ICD-11 aligned)
export const DISORDER_DEFINITIONS = {
    // DSM-5
    'DID': 'Presence of two or more distinct personality states with recurrent gaps in memory for everyday events, personal information, and/or traumatic events.',
    'OSDD-1A': 'Distinct identity states that are not clearly defined as in DID, or identity alteration that does not involve amnesia.',
    'OSDD-1B': 'Distinct identity states with amnesia, but not meeting enough criteria for a full DID diagnosis (e.g., only one amnesia criterion).',
    'OSDD-2': 'Identity disturbance from persistent and intense questioning of identity, roles, or allegiances, often related to prolonged trauma.',
    'OSDD-3': 'Acute dissociative reactions to stressful events, usually transient and limited in duration (hours to days).',
    'OSDD-4': 'Distress from unresolved grief, chronic conflict, or religious/spiritual practices involving dissociation.',
    'Amnesia': 'Inability to recall important personal information, usually of a traumatic or stressful nature, that is too extensive for ordinary forgetfulness.',
    'Amnesia-Fugue': 'Dissociative amnesia with sudden travel or purposeful movement away from home or work, often with assumption of a new identity.',
    'Dereal/Depers': 'Persistent or recurrent experiences of feeling detached from your mind or body (depersonalization) and/or feeling the world around you is unreal (derealization).',
    'UDD': 'Dissociative symptoms that cause clinically significant distress or impairment but do not meet criteria for any specific dissociative disorder.',
    // ICD-11
    'P-DID': 'Identity alteration with some amnesia, but less distinct identity states than DID (ICD-11: 6B61).',
    'Trance': 'Altered state of consciousness with narrowed awareness of immediate surroundings, experienced as involuntary and distressing (ICD-11: 6B62).',
    'Possession Trance': 'Belief that a spirit, deity, or external entity has taken control of your body, experienced as involuntary and distressing (ICD-11: 6B63).',
    'DNSD': 'Neurological symptoms like paralysis, seizures, or inability to move that cannot be explained by a neurological condition (ICD-11: 8A06).',
    'Depersonalization-Derealization': 'Persistent feelings of being detached from yourself or feeling the world is unreal (ICD-11: 6B64).',
};

// Ordered lists for UI select menus / lists (by diagnostic code)
export const DSM_OPTIONS = ['DID', 'OSDD', 'Amnesia', 'Dereal/Depers', 'UDD'];
export const ICD_OPTIONS = ['P-DID', 'Amnesia', 'Possession Trance', 'Trance', 'DNSD', 'Depersonalization-Derealization'];

// ═══════════════════════════════════════════
// HELPER: Resolve sys_type from a disorder key
// ═══════════════════════════════════════════

export function resolveSysTypeFromDisorder(disorderKey) {
    const mapping = DISORDER_MAP[disorderKey];
    if (!mapping) return null;

    return {
        name: mapping.fullName,
        dd: mapping.source === 'DSM' ? { DSM: disorderKey } : { ICD: disorderKey },
        isSystem: mapping.isSystem || false,
        isFragmented: mapping.isFragmented || false,
        isDissociative: mapping.isDissociative || false,
        onboardingCompleted: true,
    };
}

// Resolve sys_type from extra question answer
export function resolveSysTypeFromExtraAnswer(disorderKey, answer) {
    const mapping = DISORDER_MAP[disorderKey];
    if (!mapping || !mapping.extraQuestion) return null;

    const result = answer ? mapping.extraQuestionYes : mapping.extraQuestionNo;
    return {
        name: mapping.fullName,
        dd: mapping.source === 'DSM' ? { DSM: disorderKey } : { ICD: disorderKey },
        isSystem: result.isSystem,
        isFragmented: result.isFragmented,
        isDissociative: mapping.isDissociative || false,
        onboardingCompleted: true,
    };
}
