// System Setup Page
// Initial setup for new users with disorder selection

const { useState, useMemo } = require('react');
const { useNavigate } = require('react-router-dom');
const { useMutation } = require('@tanstack/react-query');
const { useAuth } = require('../context/AuthContext');
const api = require('../api/client');

// ═══════════════════════════════════════════
// DISORDER MAP (inline for CommonJS)
// ═══════════════════════════════════════════

const DISORDER_MAP = {
    'DID':           { fullName: 'Dissociative Identity Disorder', source: 'DSM', isSystem: true, isFragmented: false },
    'OSDD-1A':       { fullName: 'Other Specified Dissociative Disorder, Type 1A', source: 'DSM', extraQuestion: true,
                       extraQuestionText: 'Do you experience distinct identity states (alters)?',
                       extraQuestionYes: { isSystem: true, isFragmented: false },
                       extraQuestionNo:  { isSystem: false, isFragmented: true } },
    'OSDD-1B':       { fullName: 'Other Specified Dissociative Disorder, Type 1B', source: 'DSM', isSystem: true, isFragmented: false },
    'OSDD-2':        { fullName: 'Other Specified Dissociative Disorder, Type 2', source: 'DSM', isSystem: false, isFragmented: true },
    'OSDD-3':        { fullName: 'Other Specified Dissociative Disorder, Type 3', source: 'DSM', isSystem: false, isFragmented: true },
    'OSDD-4':        { fullName: 'Other Specified Dissociative Disorder, Type 4', source: 'DSM', isSystem: false, isFragmented: true },
    'Amnesia':        { fullName: 'Dissociative Amnesia', source: 'DSM', isSystem: false, isFragmented: false },
    'Dereal/Depers': { fullName: 'Derealization/Depersonalization Disorder', source: 'DSM', isSystem: false, isFragmented: false, isDissociative: true },
    'UDD':           { fullName: 'Unspecified Dissociative Disorder', source: 'DSM', isSystem: false, isFragmented: false },
    'P-DID':         { fullName: 'Partial Dissociative Identity Disorder', source: 'ICD', isSystem: true, isFragmented: false },
    'Possession Trance': { fullName: 'Possession Trance Disorder', source: 'ICD', extraQuestion: true,
                       extraQuestionText: 'Do you experience distinct entities or spirits taking control of your body?',
                       extraQuestionYes: { isSystem: true, isFragmented: false },
                       extraQuestionNo:  { isSystem: false, isFragmented: true } },
    'Trance':        { fullName: 'Dissociative Trance Disorder', source: 'ICD', isSystem: false, isFragmented: true },
    'DNSD':          { fullName: 'Dissociative Neurological Symptom Disorder', source: 'ICD', extraQuestion: true,
                       extraQuestionText: 'Would you describe it as states you\'d want to track?',
                       extraQuestionYes: { isSystem: false, isFragmented: true },
                       extraQuestionNo:  { isSystem: false, isFragmented: false } },
};

const DISORDER_DEFINITIONS = {
    'DID': 'Characterized by two or more distinct identity states with recurring memory gaps.',
    'OSDD-1A': 'Distinct personality states without the clear separation or amnesia seen in DID.',
    'OSDD-1B': 'Distinct identity states with amnesia, but not meeting full DID criteria.',
    'OSDD-2': 'Identity disturbance from persistent questioning of identity, roles, or allegiances.',
    'OSDD-3': 'Acute dissociative reactions to stressful events, usually transient.',
    'OSDD-4': 'Distress from unresolved grief, chronic conflict, or practices involving dissociation.',
    'Amnesia': 'Inability to recall important personal information, usually of a traumatic nature.',
    'Dereal/Depers': 'Persistent feeling of being detached from your mind, body, or that the world is unreal.',
    'UDD': 'Dissociative symptoms that don\'t fit neatly into other categories.',
    'P-DID': 'Similar to DID but with less distinct identity states.',
    'Trance': 'Altered consciousness with narrowed awareness of the immediate surroundings.',
    'Possession Trance': 'Belief that an external entity has taken control of your body.',
    'DNSD': 'Neurological symptoms (paralysis, seizures) not explained by a neurological condition.',
};

const DSM_OPTIONS = ['DID', 'OSDD-1A', 'OSDD-1B', 'OSDD-2', 'OSDD-3', 'OSDD-4', 'Amnesia', 'Dereal/Depers', 'UDD'];
const ICD_OPTIONS = ['P-DID', 'Trance', 'Possession Trance', 'DNSD'];

function resolveSysTypeFromDisorder(key) {
    const m = DISORDER_MAP[key];
    if (!m) return null;
    return {
        name: m.fullName,
        dd: m.source === 'DSM' ? { DSM: key } : { ICD: key },
        isSystem: m.isSystem || false,
        isFragmented: m.isFragmented || false,
        isDissociative: m.isDissociative || false,
        onboardingCompleted: true,
    };
}

function resolveSysTypeFromExtraAnswer(key, answer) {
    const m = DISORDER_MAP[key];
    if (!m || !m.extraQuestion) return null;
    const r = answer ? m.extraQuestionYes : m.extraQuestionNo;
    return {
        name: m.fullName,
        dd: m.source === 'DSM' ? { DSM: key } : { ICD: key },
        isSystem: r.isSystem,
        isFragmented: r.isFragmented,
        isDissociative: m.isDissociative || false,
        onboardingCompleted: true,
    };
}


// ═══════════════════════════════════════════
// STEP COMPONENTS
// ═══════════════════════════════════════════

function CategoryStep({ onSelect }) {
    return (
        <div className="setup-step">
            <h1>Do you identify with a dissociative condition?</h1>
            <p className="step-description">
                This helps us set up your profile with the right features.
                You can always change this later in settings.
            </p>

            <div className="user-type-options" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button className="type-option" onClick={() => onSelect('DSM')}>
                    <span className="type-icon">📋</span>
                    <h3>DSM-5</h3>
                    <p>Diagnostic and Statistical Manual</p>
                </button>
                <button className="type-option" onClick={() => onSelect('ICD')}>
                    <span className="type-icon">🌍</span>
                    <h3>ICD-10/11</h3>
                    <p>International Classification</p>
                </button>
                <button className="type-option" onClick={() => onSelect('OTHER')}>
                    <span className="type-icon">✏️</span>
                    <h3>Other</h3>
                    <p>Custom or self-identified</p>
                </button>
                <button className="type-option" onClick={() => onSelect('NONE')}>
                    <span className="type-icon">—</span>
                    <h3>None</h3>
                    <p>No specific condition</p>
                </button>
            </div>
        </div>
    );
}

function DisorderStep({ category, onSelect, onBack }) {
    const options = category === 'DSM' ? DSM_OPTIONS : ICD_OPTIONS;
    const [expandedKey, setExpandedKey] = useState(null);
    const [extraAnswer, setExtraAnswer] = useState(null);

    const handleToggle = (key) => {
        setExpandedKey(expandedKey === key ? null : key);
        setExtraAnswer(null);
    };

    const handleSelect = (key) => {
        const mapping = DISORDER_MAP[key];
        if (mapping?.extraQuestion && extraAnswer === null) return;
        onSelect(key, extraAnswer);
    };

    return (
        <div className="setup-step">
            <h1>{category === 'DSM' ? 'DSM-5 Conditions' : 'ICD-10/11 Conditions'}</h1>
            <p className="step-description">
                Select the condition that best describes your experience.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto', padding: '4px', textAlign: 'left' }}>
                {options.map(key => {
                    const mapping = DISORDER_MAP[key];
                    const definition = DISORDER_DEFINITIONS[key];
                    const isExpanded = expandedKey === key;
                    const hasExtraQ = mapping.extraQuestion;

                    return (
                        <div key={key} style={{
                            background: 'var(--bg-card, rgba(26,26,40,0.55))',
                            border: `1px solid ${isExpanded ? 'var(--accent, #c4b5fd)' : 'var(--glass-border, rgba(255,255,255,0.07))'}`,
                            borderRadius: '12px',
                            overflow: 'hidden',
                            transition: 'border-color 0.2s',
                        }}>
                            <button
                                onClick={() => handleToggle(key)}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px 16px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text, #ffffff)',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-accent, Quicksand)',
                                    fontSize: '0.95rem',
                                    fontWeight: 600,
                                    textAlign: 'left',
                                }}
                            >
                                <span>{mapping.fullName}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6b6b80)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                            </button>

                            {isExpanded && (
                                <div style={{ padding: '0 16px 16px', animation: 'slideDown 0.2s ease' }}>
                                    <p style={{ fontFamily: 'var(--font-body, Nunito)', fontSize: '0.85rem', color: 'var(--text-secondary, #9898a8)', lineHeight: 1.5, marginBottom: '12px' }}>
                                        {definition}
                                    </p>

                                    {hasExtraQ && (
                                        <div style={{ background: 'var(--bg-surface, rgba(38,38,58,0.5))', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                                            <p style={{ fontFamily: 'var(--font-body, Nunito)', fontSize: '0.9rem', color: 'var(--text, #ffffff)', marginBottom: '8px' }}>
                                                {mapping.extraQuestionText}
                                            </p>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => setExtraAnswer(true)}
                                                    style={{
                                                        flex: 1, padding: '8px 12px',
                                                        background: extraAnswer === true ? 'var(--accent-subtle, rgba(196,181,253,0.12))' : 'var(--bg-card, rgba(26,26,40,0.55))',
                                                        border: `1px solid ${extraAnswer === true ? 'var(--accent, #c4b5fd)' : 'var(--glass-border, rgba(255,255,255,0.07))'}`,
                                                        borderRadius: '8px',
                                                        color: extraAnswer === true ? 'var(--accent, #c4b5fd)' : 'var(--text-secondary, #9898a8)',
                                                        cursor: 'pointer', fontFamily: 'var(--font-accent, Quicksand)', fontSize: '0.85rem',
                                                    }}
                                                >Yes</button>
                                                <button
                                                    onClick={() => setExtraAnswer(false)}
                                                    style={{
                                                        flex: 1, padding: '8px 12px',
                                                        background: extraAnswer === false ? 'var(--accent-subtle, rgba(196,181,253,0.12))' : 'var(--bg-card, rgba(26,26,40,0.55))',
                                                        border: `1px solid ${extraAnswer === false ? 'var(--accent, #c4b5fd)' : 'var(--glass-border, rgba(255,255,255,0.07))'}`,
                                                        borderRadius: '8px',
                                                        color: extraAnswer === false ? 'var(--accent, #c4b5fd)' : 'var(--text-secondary, #9898a8)',
                                                        cursor: 'pointer', fontFamily: 'var(--font-accent, Quicksand)', fontSize: '0.85rem',
                                                    }}
                                                >No</button>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleSelect(key)}
                                        disabled={hasExtraQ && extraAnswer === null}
                                        style={{ width: '100%' }}
                                    >
                                        Select this
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="step-actions" style={{ marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
            </div>
        </div>
    );
}

function OtherStep({ onResolve, onBack }) {
    const [isSystem, setIsSystem] = useState(false);
    const [isFragmented, setIsFragmented] = useState(false);
    const [customName, setCustomName] = useState('');

    const handleContinue = () => {
        onResolve({
            name: customName.trim() || null,
            dd: {},
            isSystem,
            isFragmented,
            isDissociative: false,
            onboardingCompleted: true,
        });
    };

    return (
        <div className="setup-step">
            <h1>Custom Profile</h1>
            <p className="step-description">Set up your profile manually.</p>

            <div className="form-group">
                <label htmlFor="customName">What might you call it? (optional)</label>
                <input
                    id="customName"
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Complex Trauma Response"
                    className="text-input"
                    maxLength={100}
                />
            </div>

            <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={isSystem}
                        onChange={(e) => setIsSystem(e.target.checked)}
                        style={{ width: '18px', height: '18px' }}
                    />
                    We are a system
                </label>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #6b6b80)', marginTop: '4px' }}>
                    You have distinct identity states (alters)
                </p>
            </div>

            <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={isFragmented}
                        onChange={(e) => setIsFragmented(e.target.checked)}
                        style={{ width: '18px', height: '18px' }}
                    />
                    We experience fragmented states
                </label>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #6b6b80)', marginTop: '4px' }}>
                    Altered states of mind without distinct alters
                </p>
            </div>

            <div className="step-actions">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={handleContinue}>Continue</button>
            </div>
        </div>
    );
}

function NameStep({ disorderKey, sysType, onConfirm, onBack }) {
    const [customName, setCustomName] = useState('');

    const typeName = useMemo(() => {
        if (sysType?.name && sysType.name !== 'None') return sysType.name;
        if (disorderKey && DISORDER_MAP[disorderKey]) return DISORDER_MAP[disorderKey].fullName;
        return null;
    }, [disorderKey, sysType]);

    const statusParts = [];
    if (sysType?.isSystem) statusParts.push('System');
    if (sysType?.isFragmented) statusParts.push('Fragmented');
    if (sysType?.isDissociative) statusParts.push('Dissociative');
    if (statusParts.length === 0) statusParts.push('Basic');

    const handleConfirm = () => {
        onConfirm({
            ...sysType,
            name: customName.trim() || sysType?.name || typeName || 'None',
        });
    };

    return (
        <div className="setup-step">
            <h1>Almost done!</h1>

            <div className="summary-card" style={{ textAlign: 'left', marginBottom: '16px' }}>
                {typeName && (
                    <div className="summary-item">
                        <span className="label">Condition:</span>
                        <span className="value">{typeName}</span>
                    </div>
                )}
                <div className="summary-item">
                    <span className="label">Profile type:</span>
                    <span className="value">{statusParts.join(', ')}</span>
                </div>
            </div>

            <div className="form-group">
                <label htmlFor="profileName">Profile name (optional)</label>
                <input
                    id="profileName"
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={typeName || 'Your profile name'}
                    className="text-input"
                    maxLength={100}
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #6b6b80)', marginTop: '4px' }}>
                    Leave blank to use "{typeName || 'None'}" as your profile name.
                </p>
            </div>

            <div className="step-actions">
                <button className="btn btn-secondary" onClick={onBack}>Back</button>
                <button className="btn btn-primary" onClick={handleConfirm}>Create Profile</button>
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════
// MAIN SYSTEM SETUP
// ═══════════════════════════════════════════

function SystemSetup() {
    const navigate = useNavigate();
    const { updateSystem } = useAuth();

    const [step, setStep] = useState(1);
    const [category, setCategory] = useState(null);
    const [disorderKey, setDisorderKey] = useState(null);
    const [resolvedSysType, setResolvedSysType] = useState(null);

    const createSystemMutation = useMutation({
        mutationFn: async (sysType) => {
            const system = await api.createSystem({
                sys_type: sysType,
            });

            // Auto-create "Dissociated" state for Dereal/Depers users
            if (sysType.isDissociative) {
                try {
                    await api.createState({
                        name: 'Dissociated',
                        description: 'A dissociative state',
                    });
                } catch (err) {
                    console.error('[Setup] Failed to create Dissociated state:', err);
                }
            }

            return system;
        },
        onSuccess: (system) => {
            updateSystem(system);
            navigate('/app');
        }
    });

    const handleCategorySelect = (cat) => {
        setCategory(cat);
        if (cat === 'OTHER') {
            setStep(3);
        } else if (cat === 'NONE') {
            setResolvedSysType({
                name: 'None',
                dd: {},
                isSystem: false,
                isFragmented: false,
                isDissociative: false,
                onboardingCompleted: true,
            });
            setStep(4);
        } else {
            setStep(2);
        }
    };

    const handleDisorderSelect = (key, extraAnswer) => {
        setDisorderKey(key);
        const mapping = DISORDER_MAP[key];
        if (mapping.extraQuestion && extraAnswer !== null) {
            setResolvedSysType(resolveSysTypeFromExtraAnswer(key, extraAnswer));
        } else {
            setResolvedSysType(resolveSysTypeFromDisorder(key));
        }
        setStep(4);
    };

    const handleOtherResolve = (sysType) => {
        setResolvedSysType(sysType);
        setStep(4);
    };

    const handleConfirm = (finalSysType) => {
        createSystemMutation.mutate(finalSysType);
    };

    const handleBack = () => {
        if (step === 4) {
            if (category === 'OTHER') setStep(3);
            else setStep(2);
        } else if (step === 3) {
            setStep(1);
        } else if (step === 2) {
            setStep(1);
            setCategory(null);
        }
    };

    return (
        <div className="setup-page">
            <div className="setup-container">
                {/* Progress Indicator */}
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${(step / 4) * 100}%` }}
                    />
                </div>
                <div className="step-indicator">Step {step} of 4</div>

                {step === 1 && <CategoryStep onSelect={handleCategorySelect} />}
                {step === 2 && (
                    <DisorderStep
                        category={category}
                        onSelect={handleDisorderSelect}
                        onBack={handleBack}
                    />
                )}
                {step === 3 && (
                    <OtherStep
                        onResolve={handleOtherResolve}
                        onBack={handleBack}
                    />
                )}
                {step === 4 && (
                    <NameStep
                        disorderKey={disorderKey}
                        sysType={resolvedSysType}
                        onConfirm={handleConfirm}
                        onBack={handleBack}
                    />
                )}

                {createSystemMutation.isError && (
                    <div className="error-message" style={{ marginTop: '16px' }}>
                        Failed to create system: {createSystemMutation.error.message}
                    </div>
                )}
            </div>
        </div>
    );
}

module.exports = SystemSetup;
