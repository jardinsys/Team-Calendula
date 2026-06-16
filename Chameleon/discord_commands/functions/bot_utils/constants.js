// Constants extracted from `bot_utils/index.js`.
// Re-exported through the `bot_utils` barrel so all consumers keep the same API.

// Items per page for pagination
const ITEMS_PER_PAGE = 10;

const INDEXABLE_NAME_REGEX = /^[a-zA-Z0-9\-_]+$/;

// Entity colors for consistent styling
const ENTITY_COLORS = {
    alter: '#fb4fd9',
    state: '#00e1da',
    group: '#ffdb28',
    system: '#007bd8',
    profile: '#f28200',
    error: '#e9162d',
    success: '#1fb819',
    info: '#8f2be7'
};

// DSM and ICD type definitions for system type validation
const DSM_TYPES = ['DID', 'Amnesia', 'Dereal/Depers', 'OSDD-1A', 'OSDD-1B', 'OSDD-2', 'OSDD-3', 'OSDD-4', 'UDD'];
const ICD_TYPES = ['P-DID', 'Trance', 'DNSD', 'Possession Trance'];

// ═══════════════════════════════════════════
// DISORDER MAP (CommonJS version for Discord bot)
// ═══════════════════════════════════════════

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const DISORDER_MAP = {
    // DSM-5
    'DID':           { fullName: 'Dissociative Identity Disorder', source: 'DSM', isSystem: true, isFragmented: true, isDissociative: true },
    'OSDD-1A':       { fullName: 'Other Specified Dissociative Disorder, Type 1A', source: 'DSM', extraQuestion: true,
                      extraQuestionText: 'How do you experience your identity states or parts?',
                      extraQuestionYesLabel: 'They are distinct alters',
                      extraQuestionNoLabel: 'They are just fragmented states',
                      extraQuestionYes: { isSystem: true, isFragmented: true, isDissociative: true },
                      extraQuestionNo:  { isSystem: false, isFragmented: true, isDissociative: true } },
    'OSDD-1B':       { fullName: 'Other Specified Dissociative Disorder, Type 1B', source: 'DSM', isSystem: true, isFragmented: true, isDissociative: true },
    'OSDD-2':        { fullName: 'Other Specified Dissociative Disorder, Type 2', source: 'DSM', isSystem: false, isFragmented: true, isDissociative: true },
    'OSDD-3':        { fullName: 'Other Specified Dissociative Disorder, Type 3', source: 'DSM', isSystem: false, isFragmented: true, isDissociative: true },
    'OSDD-4':        { fullName: 'Other Specified Dissociative Disorder, Type 4', source: 'DSM', isSystem: false, isFragmented: true },
    'Amnesia':        { fullName: 'Dissociative Amnesia', source: 'DSM', extraQuestion: true,
                      extraQuestionText: 'Do you have "with Fugue" subtype?\nDoes your memory loss include episodes of wandering or traveling to unfamiliar places?',
                      extraQuestionYesLabel: 'Yes (Fugue)',
                      extraQuestionNoLabel: 'No',
                      extraQuestionYes: { key: 'Amnesia-Fugue', isSystem: false, isFragmented: true },
                      extraQuestionNo:  { key: 'Amnesia', isSystem: false, isFragmented: false } },
    'Amnesia-Fugue':  { fullName: 'Dissociative Amnesia with Fugue', source: 'DSM', isSystem: false, isFragmented: true, isDissociative: true, dissociativeStateName: 'Fugue' },
    'Dereal/Depers': { fullName: 'Depersonalization-Derealization Disorder', source: 'DSM', isSystem: false, isFragmented: false, isDissociative: true },
    'UDD':           { fullName: 'Unspecified Dissociative Disorder', source: 'DSM', isSystem: false, isFragmented: false },
    // ICD-11
    'P-DID':         { fullName: 'Partial Dissociative Identity Disorder', source: 'ICD', isSystem: true, isFragmented: true, isDissociative: true },
    'Possession Trance': { fullName: 'Possession Trance Disorder', source: 'ICD', extraQuestion: true,
                      extraQuestionText: 'Do you want to track the entities/spirits themselves?',
                      extraQuestionYesLabel: 'Yes',
                      extraQuestionNoLabel: 'No, just the trance states',
                      extraQuestionYes: { isSystem: true, isFragmented: true },
                      extraQuestionNo:  { isSystem: false, isFragmented: true } },
    'Trance':        { fullName: 'Dissociative Trance Disorder', source: 'ICD', isSystem: false, isFragmented: true, isDissociative: true, dissociativeStateName: 'Trance' },
    'DNSD':          { fullName: 'Dissociative Neurological Symptom Disorder', source: 'ICD', extraQuestion: true,
                      extraQuestionText: 'Do you want to track your neurological symptoms and situations using states?',
                      extraQuestionYesLabel: 'Yes',
                      extraQuestionNoLabel: 'No',
                      extraQuestionYes: { isSystem: false, isFragmented: true },
                      extraQuestionNo:  { isSystem: false, isFragmented: false } },
};

const DSM_DISORDER_OPTIONS = ['DID', 'OSDD-1A', 'OSDD-1B', 'OSDD-2', 'OSDD-3', 'OSDD-4', 'Amnesia', 'Dereal/Depers', 'UDD'];
const ICD_DISORDER_OPTIONS = ['P-DID', 'Trance', 'Possession Trance', 'DNSD'];

// ==== TERMINOLOGY HELPERS ====

const NEUTRAL_TERMS = {
    label: 'Profile',
    title: '',
    error: 'Registration',
    ownership: 'profile',
    ownershipCap: 'Profile'
};

function getSystemTerm(system, { context = 'label' } = {}) {
    if (!system?.sys_type?.isSystem) {
        return NEUTRAL_TERMS[context] || NEUTRAL_TERMS.label;
    }
    const synonym = system.systemSynonym || 'system';
    switch (context) {
        case 'title': return synonym.charAt(0).toUpperCase() + synonym.slice(1);
        case 'error': return synonym.charAt(0).toUpperCase() + synonym.slice(1);
        case 'ownership': return synonym.toLowerCase();
        case 'ownershipCap': return synonym.charAt(0).toUpperCase() + synonym.slice(1);
        default: return synonym.charAt(0).toUpperCase() + synonym.slice(1);
    }
}

function getAlterTerm(system, { plural = false } = {}) {
    return plural
        ? (system?.alterSynonym?.plural || 'alters')
        : (system?.alterSynonym?.singular || 'alter');
}

module.exports = {
    ITEMS_PER_PAGE,
    INDEXABLE_NAME_REGEX,
    ENTITY_COLORS,
    DSM_TYPES,
    ICD_TYPES,
    DISORDER_MAP,
    DSM_DISORDER_OPTIONS,
    ICD_DISORDER_OPTIONS,
    NEUTRAL_TERMS,
    getSystemTerm,
    getAlterTerm,
    escapeRegex
};
