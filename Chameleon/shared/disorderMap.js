// ═══════════════════════════════════════════
// DISSOCIATIVE DISORDER MAPPING
// Single source of truth for Discord bot + embedded app + webapp
// ═══════════════════════════════════════════

// Each disorder maps to its full name, source classification, and
// which booleans it auto-sets on sys_type. Disorders with
// `extraQuestion: true` need a follow-up before resolving.

export const DISORDER_MAP = {
    // ═══ DSM-5 ═══

    // Automatic isSystem
    'DID': {
        fullName: 'Dissociative Identity Disorder',
        source: 'DSM',
        isSystem: true,
        isFragmented: false,
    },
    'OSDD-1B': {
        fullName: 'Other Specified Dissociative Disorder, Type 1B',
        source: 'DSM',
        isSystem: true,
        isFragmented: false,
    },

    // Automatic isFragmented
    'OSDD-2': {
        fullName: 'Other Specified Dissociative Disorder, Type 2',
        source: 'DSM',
        isSystem: false,
        isFragmented: true,
    },
    'OSDD-3': {
        fullName: 'Other Specified Dissociative Disorder, Type 3',
        source: 'DSM',
        isSystem: false,
        isFragmented: true,
    },
    'OSDD-4': {
        fullName: 'Other Specified Dissociative Disorder, Type 4',
        source: 'DSM',
        isSystem: false,
        isFragmented: true,
    },

    // Extra question needed
    'OSDD-1A': {
        fullName: 'Other Specified Dissociative Disorder, Type 1A',
        source: 'DSM',
        extraQuestion: true,
        extraQuestionText: 'Do you experience distinct identity states (alters)?',
        extraQuestionYes: { isSystem: true, isFragmented: false },
        extraQuestionNo: { isSystem: false, isFragmented: true },
    },

    // Neither (none category)
    'Amnesia': {
        fullName: 'Dissociative Amnesia',
        source: 'DSM',
        isSystem: false,
        isFragmented: false,
    },
    'Dereal/Depers': {
        fullName: 'Derealization/Depersonalization Disorder',
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

    // ═══ ICD-10/11 ═══

    // Automatic isSystem
    'P-DID': {
        fullName: 'Partial Dissociative Identity Disorder',
        source: 'ICD',
        isSystem: true,
        isFragmented: false,
    },

    // Automatic isFragmented
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
        extraQuestionText: 'Do you experience distinct entities or spirits taking control of your body?',
        extraQuestionYes: { isSystem: true, isFragmented: false },
        extraQuestionNo: { isSystem: false, isFragmented: true },
    },

    // Extra question needed
    'DNSD': {
        fullName: 'Dissociative Neurological Symptom Disorder',
        source: 'ICD',
        extraQuestion: true,
        extraQuestionText: 'Would you describe it as states you\'d want to track?',
        extraQuestionYes: { isSystem: false, isFragmented: true },
        extraQuestionNo: { isSystem: false, isFragmented: false },
    },
};

// Short definitions for UI display
export const DISORDER_DEFINITIONS = {
    'DID': 'Characterized by two or more distinct identity states with recurring memory gaps for everyday events.',
    'OSDD-1A': 'Distinct personality states that are not as clearly defined as in DID, without amnesia between them.',
    'OSDD-1B': 'Distinct identity states with amnesia, but not meeting enough criteria for a full DID diagnosis.',
    'OSDD-2': 'Identity disturbance from persistent and intense questioning of identity, roles, or allegiances.',
    'OSDD-3': 'Acute dissociative reactions to stressful events, usually transient and limited in duration.',
    'OSDD-4': 'Distress from unresolved grief, chronic conflict, or religious/spiritual practices involving dissociation.',
    'Amnesia': 'Inability to recall important personal information, usually of a traumatic or stressful nature.',
    'Dereal/Depers': 'Persistent feeling of being detached from your mind, body, or feeling the world around you is unreal.',
    'UDD': 'Dissociative symptoms that cause distress but don\'t fit neatly into the other categories above.',
    'P-DID': 'Similar to DID but with less distinct identity states. Some identity alteration is present.',
    'Trance': 'A state of altered consciousness with narrowed awareness of the immediate surroundings.',
    'Possession Trance': 'Belief that a spirit, deity, or external entity has taken control of your body.',
    'DNSD': 'Neurological symptoms like paralysis or seizures that cannot be explained by a neurological condition.',
};

// Ordered lists for UI select menus / lists
export const DSM_OPTIONS = ['DID', 'OSDD-1A', 'OSDD-1B', 'OSDD-2', 'OSDD-3', 'OSDD-4', 'Amnesia', 'Dereal/Depers', 'UDD'];
export const ICD_OPTIONS = ['P-DID', 'Trance', 'Possession Trance', 'DNSD'];

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
