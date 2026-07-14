import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { api, DISORDER_MAP, DISORDER_DEFINITIONS, DSM_OPTIONS, ICD_OPTIONS, Icon, resolveSysTypeFromDisorder, resolveSysTypeFromExtraAnswer, resolveSysTypeFromMultiAnswer } from '@chameleon/shared'
import { useSystemSession } from '../../hooks/useSystemSession'
import { getParentStep, REGISTRATION_ROOT, REGISTER_STEPS } from '../navigation/registrationFlow'

// ═══════════════════════════════════════════
// Step 1: Category Selection
// ═══════════════════════════════════════════

function CategoryStep({ onSelect, onBack }) {
  return (
    <div className="register-step">
      <h2>Do you have a dissociative condition?</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
        This helps us set up your profile with the right features.
        You can always change this later in settings.
      </p>

      <div className="category-grid">
        <button className="category-card" onClick={() => onSelect('DSM')}>
          <span className="category-icon"><Icon name="fileText" size={24} /></span>
          <span className="category-label">DSM-5</span>
          <span className="category-desc">Diagnostic and Statistical Manual</span>
        </button>
        <button className="category-card" onClick={() => onSelect('ICD')}>
          <span className="category-icon"><Icon name="globe" size={24} /></span>
          <span className="category-label">ICD-10/11</span>
          <span className="category-desc">International Classification</span>
        </button>
        <button className="category-card" onClick={() => onSelect('OTHER')}>
          <span className="category-icon"><Icon name="pencil" size={24} /></span>
          <span className="category-label">Other</span>
          <span className="category-desc">Other conditions or Custom identifiers</span>
        </button>
        <button className="category-card" onClick={() => onSelect('NONE')}>
          <span className="category-icon">—</span>
          <span className="category-label">None</span>
          <span className="category-desc">No specific condition</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
        <button className="btn btn-back" onClick={onBack} style={{ flex: 1 }}>
          ← Back
        </button>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════
// Step 2: Disorder Selection (expandable cards)
// ═══════════════════════════════════════════

function DisorderStep({ category, onSelect, onBack, onStartOver }) {
  const options = category === 'DSM' ? DSM_OPTIONS : ICD_OPTIONS
  const [expandedKey, setExpandedKey] = useState(null)
  const [selectedSubtype, setSelectedSubtype] = useState(null)
  const [selectedSubtype2, setSelectedSubtype2] = useState(null)
  const [extraAnswer, setExtraAnswer] = useState(null)
  const [multiSelections, setMultiSelections] = useState([])

  const handleToggle = (key) => {
    setExpandedKey(expandedKey === key ? null : key)
    setSelectedSubtype(null)
    setSelectedSubtype2(null)
    setExtraAnswer(null)
    setMultiSelections([])
  }

  const handleSubtypeSelect = (subtypeKey) => {
    setSelectedSubtype(subtypeKey)
    setSelectedSubtype2(null)
    setExtraAnswer(null)
    setMultiSelections([])
  }

  const handleSubtype2Select = (subtypeKey) => {
    setSelectedSubtype2(subtypeKey)
    setExtraAnswer(null)
    setMultiSelections([])
  }

  const handleMultiToggle = (index) => {
    setMultiSelections(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  const handleSelect = (key) => {
    const mapping = DISORDER_MAP[key]
    if (mapping?.extraQuestion && extraAnswer === null) return
    if (mapping?.extraQuestionMulti && multiSelections.length < (mapping.extraQuestionMin || 1)) return
    onSelect(key, mapping?.extraQuestionMulti ? multiSelections : extraAnswer, category)
  }

  // Render a selectable item (leaf node with possible extra question)
  const renderItem = (key, showDefinition = true) => {
    const mapping = DISORDER_MAP[key]
    const definition = DISORDER_DEFINITIONS[key]
    const hasExtraQ = mapping.extraQuestion
    const hasMultiQ = mapping.extraQuestionMulti

    return (
      <div className="subtype-details">
        {showDefinition && definition && (
          <p className="subtype-definition">{definition}</p>
        )}

        {hasExtraQ && (
          <div className="disorder-extra-question">
            <p>{mapping.extraQuestionText}</p>
            <div className="extra-question-btns">
              <button
                className={`extra-btn ${extraAnswer === true ? 'active' : ''}`}
                onClick={() => setExtraAnswer(true)}
              >
                {mapping.extraQuestionYesLabel || 'Yes'}
              </button>
              <button
                className={`extra-btn ${extraAnswer === false ? 'active' : ''}`}
                onClick={() => setExtraAnswer(false)}
              >
                {mapping.extraQuestionNoLabel || 'No'}
              </button>
            </div>
          </div>
        )}

        {hasMultiQ && (
          <div className="disorder-extra-question">
            <p style={{ whiteSpace: 'pre-line' }}>{mapping.extraQuestionText}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {mapping.extraQuestionOptions.map((opt, i) => (
                <label
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: multiSelections.includes(i) ? 'var(--accent-subtle, rgba(196,181,253,0.12))' : 'var(--bg-card, rgba(26,26,40,0.55))',
                    border: `1px solid ${multiSelections.includes(i) ? 'var(--accent, #c4b5fd)' : 'var(--glass-border, rgba(255,255,255,0.07))'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={multiSelections.includes(i)}
                    onChange={() => handleMultiToggle(i)}
                    style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: 'var(--accent, #c4b5fd)' }}
                  />
                  <div>
                    <div style={{ fontFamily: 'var(--font-accent, Quicksand)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text, #ffffff)' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body, Nunito)', fontSize: '0.78rem', color: 'var(--text-secondary, #9898a8)', marginTop: '2px' }}>
                      {opt.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          className="btn-gradient btn-gradient-primary disorder-select-btn"
          onClick={() => handleSelect(key)}
          disabled={(hasExtraQ && extraAnswer === null) || (hasMultiQ && multiSelections.length < (mapping.extraQuestionMin || 1))}
        >
          Select this
        </button>
      </div>
    )
  }

  // Render a subtype dropdown (has subtypes)
  const renderSubtypes = (mapping, depth = 0) => {
    return (
      <div className="disorder-subtypes" style={{ marginLeft: depth > 0 ? 'var(--space-md)' : 0 }}>
        <div className="subtype-btns">
          {mapping.subtypes.map(subtypeKey => {
            const subtypeMapping = DISORDER_MAP[subtypeKey]
            const currentSelected = depth === 0 ? selectedSubtype : selectedSubtype2
            const isSelected = currentSelected === subtypeKey

            return (
              <div key={subtypeKey}>
                <button
                  className={`subtype-btn ${isSelected ? 'active' : ''}`}
                  onClick={() => depth === 0 ? handleSubtypeSelect(subtypeKey) : handleSubtype2Select(subtypeKey)}
                >
                  <span>{subtypeMapping.fullName}</span>
                  {subtypeMapping.hasSubtypes && <span className="subtype-arrow"><Icon name="chevronRight" size={14} /></span>}
                </button>

                {/* Nested subtypes */}
                {isSelected && subtypeMapping.hasSubtypes && (
                  <div className="subtype-nested">
                    {renderSubtypes(subtypeMapping, depth + 1)}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Show selected leaf item details */}
        {selectedSubtype && depth === 0 && !DISORDER_MAP[selectedSubtype]?.hasSubtypes && (
          renderItem(selectedSubtype, true)
        )}
        {selectedSubtype2 && depth === 1 && (
          renderItem(selectedSubtype2, true)
        )}
      </div>
    )
  }

  return (
    <div className="register-step">
      <h2>{category === 'DSM' ? 'DSM-5 Conditions' : 'ICD-11 Conditions'}</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
        Select the condition that best describes your experience.
      </p>

      <div className="disorder-list">
        {options.map(key => {
          const mapping = DISORDER_MAP[key]
          const definition = DISORDER_DEFINITIONS[key]
          const isExpanded = expandedKey === key
          const hasSubtypes = mapping.hasSubtypes

          return (
            <div key={key} className={`disorder-card ${isExpanded ? 'expanded' : ''}`}>
              <button
                className="disorder-card-header"
                onClick={() => handleToggle(key)}
              >
                <span className="disorder-name">{mapping.fullName}</span>
                {hasSubtypes && <span className="disorder-parent-badge">{mapping.subtypes.length} types</span>}
                <span className={`disorder-arrow ${isExpanded ? 'open' : ''}`}><Icon name="chevronDown" size={14} /></span>
              </button>

              {isExpanded && (
                <div className="disorder-card-body">
                  {hasSubtypes ? (
                    renderSubtypes(mapping)
                  ) : (
                    <>
                      <p className="disorder-definition">{definition}</p>
                      {renderItem(key, false)}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
        <button className="btn btn-back" onClick={onBack} style={{ flex: 1 }}>
          ← Back
        </button>
        <button className="btn btn-back" onClick={onStartOver} style={{ flex: 1 }}>
          Start Over
        </button>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════
// Step 3: Other — manual selection
// ═══════════════════════════════════════════

function OtherStep({ onResolve, onBack, onStartOver }) {
  const [isSystem, setIsSystem] = useState(false)
  const [isFragmented, setIsFragmented] = useState(false)
  const [isDissociative, setIsDissociative] = useState(false)
  const [conditionName, setConditionName] = useState('')

  const handleContinue = () => {
    onResolve({
      name: conditionName.trim() || 'Custom',
      dd: {},
      isSystem,
      isFragmented,
      isDissociative,
      onboardingCompleted: true,
    })
  }

  return (
    <div className="register-step">
      <h2>Custom Profile</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
        Set up your profile manually.
      </p>

      <div className="register-form">
        <div className="form-group">
          <label>What might you call it? (optional)</label>
          <input
            className="text-input"
            type="text"
            value={conditionName}
            onChange={e => setConditionName(e.target.value)}
            placeholder="e.g. Complex Trauma Response"
            maxLength={100}
          />
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isSystem}
              onChange={e => setIsSystem(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            You also... are a system
          </label>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            You have distinct identity states (alters)
          </p>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isFragmented}
              onChange={e => setIsFragmented(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            You also... experience fragmented states
          </label>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Altered states of mind without distinct alters
          </p>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isDissociative}
              onChange={e => setIsDissociative(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            You also... dissociate
          </label>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Feel detached from yourself or the world around you
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
        <button className="btn btn-back" onClick={onBack} style={{ flex: 1 }}>
          ← Back
        </button>
        <button className="btn btn-back" onClick={onStartOver} style={{ flex: 1 }}>
          Start Over
        </button>
        <button
          className="btn-gradient btn-gradient-primary"
          onClick={handleContinue}
          style={{ flex: 2 }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════
// Step 4: Name entry + confirmation
// ═══════════════════════════════════════════

function NameStep({ disorderKey, extraAnswer, sysType, onConfirm, onBack, onStartOver, discordUser }) {
  const [systemName, setSystemName] = useState('')

  const typeName = useMemo(() => {
    if (sysType?.name && sysType.name !== 'None') return sysType.name
    if (disorderKey && DISORDER_MAP[disorderKey]) return DISORDER_MAP[disorderKey].fullName
    return null
  }, [disorderKey, sysType])

  const displayName = useMemo(() => {
    return discordUser?.globalName || discordUser?.username || 'there'
  }, [discordUser])

  const statusParts = []
  if (sysType?.isSystem) statusParts.push('System')
  if (sysType?.isFragmented) statusParts.push('Fragmented')
  if (sysType?.isDissociative) statusParts.push('Dissociative')
  if (statusParts.length === 0) statusParts.push('Basic')

  const handleConfirm = () => {
    // sys_type.name is always the disorder name (never changes)
    const finalSysType = {
      ...sysType,
      name: typeName || 'None',
    }
    // systemName is the profile/system name (separate from sys_type)
    onConfirm(finalSysType, systemName.trim() || null)
  }

  return (
    <div className="register-step">
      <h2>Almost done!</h2>

      <div className="summary-card" style={{ textAlign: 'left', marginBottom: 'var(--space-lg)' }}>
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

      <div className="register-form">
        <div className="form-group">
          <label>System name (optional)</label>
          <input
            className="text-input"
            type="text"
            value={systemName}
            onChange={e => setSystemName(e.target.value)}
            placeholder={displayName}
            maxLength={100}
          />
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Leave blank to use your Discord display name.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
        <button className="btn btn-back" onClick={onBack} style={{ flex: 1 }}>
          ← Back
        </button>
        <button className="btn btn-back" onClick={onStartOver} style={{ flex: 1 }}>
          Start Over
        </button>
        <button
          className="btn-gradient btn-gradient-primary"
          onClick={handleConfirm}
          style={{ flex: 2 }}
        >
          Create Profile
        </button>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════
// Step 3: Import decision → deferred to import page
// ═══════════════════════════════════════════

function ImportStep({ sysType, onComplete, onBack, onStartOver, onNavigate }) {
  const handleNewSystem = () => {
    onComplete({ systemName: '', import: false })
  }

  const handleImport = () => {
    if (onNavigate) onNavigate('register-import')
  }

  return (
    <div className="register-step">
      <h2>Set Up Your System</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
        Since your condition involves a system, you can import from another tool or start fresh.
      </p>

      <div className="import-options">
        <button
          className="import-option-btn"
          onClick={handleImport}
        >
          <span className="import-option-title">Import from Another Tool</span>
          <span className="import-option-desc">Preview and import your existing alters and data</span>
        </button>

        <button
          className="import-option-btn"
          onClick={handleNewSystem}
        >
          <span className="import-option-title">Start a New System</span>
          <span className="import-option-desc">Begin fresh and create your first alter</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
        <button className="btn btn-back" onClick={onBack} style={{ flex: 1 }}>
          ← Back
        </button>
        <button className="btn btn-back" onClick={onStartOver} style={{ flex: 1 }}>
          Start Over
        </button>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════
// Step 6: Who's in Front? (for new isSystem)
// ═══════════════════════════════════════════

function FirstAlterStep({ onComplete, onBack, saving }) {
  const [alterNames, setAlterNames] = useState([''])
  const [activeIndex, setActiveIndex] = useState(0)

  const handleNameChange = (index, value) => {
    const updated = [...alterNames]
    updated[index] = value
    setAlterNames(updated)
  }

  const handleAddAlter = () => {
    setAlterNames([...alterNames, ''])
    setActiveIndex(alterNames.length)
  }

  const handleRemoveAlter = (index) => {
    if (alterNames.length <= 1) return
    const updated = alterNames.filter((_, i) => i !== index)
    setAlterNames(updated)
    if (activeIndex >= updated.length) {
      setActiveIndex(updated.length - 1)
    }
  }

  const handleComplete = () => {
    const validNames = alterNames.filter(n => n.trim())
    onComplete(systemName, validNames)
  }

  const handleSkip = () => {
    onComplete(systemName, [])
  }

  return (
    <div className="register-step">
      <h2>So...Who is in front?</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
        Add the names of who's currently fronting. You can always add more later.
      </p>

      <div className="register-form">
        <div className="alter-names-list">
          {alterNames.map((name, index) => (
            <div key={index} className="alter-name-row">
              <input
                className="text-input"
                type="text"
                value={name}
                onChange={e => handleNameChange(index, e.target.value)}
                placeholder={index === 0 ? "e.g. Host, Main, or a name" : "Another name"}
                maxLength={100}
                autoFocus={index === activeIndex}
              />
              {alterNames.length > 1 && (
                <button
                  className="alter-remove-btn"
                  onClick={() => handleRemoveAlter(index)}
                  title="Remove"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <button className="alter-add-btn" onClick={handleAddAlter}>
          <span className="alter-add-icon">+</span>
          <span>Add another</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
        <button className="btn btn-back" onClick={onBack} style={{ flex: 1 }}>
          ← Back
        </button>
        <button className="btn btn-ghost" onClick={handleSkip} style={{ flex: 1 }} disabled={saving}>
          Skip for now
        </button>
        <button
          className="btn-gradient btn-gradient-primary"
          onClick={handleComplete}
          style={{ flex: 2 }}
          disabled={saving}
        >
          {alterNames.some(n => n.trim()) ? 'Create & Finish' : 'Finish Setup'}
        </button>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// Main Register Page — Staged Flow
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════

export function RegisterPage({ onNavigate, onRegistered, refreshSystem, discordUser, pageParams, onBack }) {
  const {
    session,
    update,
    setSystemName,
    setSysType,
    setMembers,
    setFront,
    commit,
    committing,
    error: sessionError,
    reset,
    deriveFlags,
    buildPayload,
  } = useSystemSession()

  const startStep = pageParams?.startStep || 1
  const [step, setStep] = useState(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem('reg_local'))
      if (s?.ts && Date.now() - s.ts > 15 * 60 * 1000) {
        sessionStorage.removeItem('reg_local')
        return startStep
      }
      return s?.step || startStep
    } catch { return startStep }
  })
  const [category, setCategory] = useState(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem('reg_local'))
      if (s?.ts && Date.now() - s.ts > 15 * 60 * 1000) return null
      return s?.category || null
    } catch { return null }
  })
  const [extraAnswer, setExtraAnswer] = useState(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem('reg_local'))
      if (s?.ts && Date.now() - s.ts > 15 * 60 * 1000) return null
      return s?.extraAnswer || null
    } catch { return null }
  })
  const [disorderKey, setDisorderKey] = useState(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem('reg_local'))
      if (s?.ts && Date.now() - s.ts > 15 * 60 * 1000) return null
      return s?.disorderKey || null
    } catch { return null }
  })
  const [error, setError] = useState(null)

  // Sync step when returning from registration import with a target step
  useEffect(() => {
    if (pageParams?.startStep) {
      setStep(pageParams.startStep)
    }
  }, [pageParams?.startStep])

  // Persist local registration state so it survives remounting
  useEffect(() => {
    sessionStorage.setItem('reg_local', JSON.stringify({ step, category, extraAnswer, disorderKey, ts: Date.now() }))
  }, [step, category, extraAnswer, disorderKey])

  // Derive sysType from session
  const resolvedSysType = session.sysType
  const { isSystem, isFragmented, isDissociative } = deriveFlags(resolvedSysType)

  const handleStartOver = useCallback(() => {
    // Always go back to landing
    sessionStorage.removeItem('reg_local')
    setStep(1)
    setCategory(null)
    setDisorderKey(null)
    setExtraAnswer(null)
    update({ sysType: null, systemName: '', members: [], front: null, stagedImports: [] })
    reset?.()
    onNavigate?.(null)
  }, [onNavigate, update, reset])

  // Step 1 → Step 2 or Step 3
  const handleCategorySelect = (cat) => {
    setCategory(cat)
    if (cat === 'OTHER') {
      setStep(3)
    } else if (cat === 'NONE') {
      const noneSysType = {
        name: 'None', dd: {},
        isSystem: false,
        isFragmented: false,
        isDissociative: false,
        onboardingCompleted: true,
      }
      update({ sysType: noneSysType })
      setStep(4)
    } else {
      setStep(2)
    }
  }

  // Step 2 → Step 4 (disorder selected)
  const handleDisorderSelect = (key, extraAns, sourceCategory) => {
    setDisorderKey(key)
    setExtraAnswer(extraAns)

    const mapping = DISORDER_MAP[key]
    const source = sourceCategory || category
    let sysType

    if (mapping.extraQuestionMulti && Array.isArray(extraAns)) {
      sysType = resolveSysTypeFromMultiAnswer(key, extraAns)
    } else if (mapping.extraQuestion && extraAns !== null) {
      const result = extraAns ? mapping.extraQuestionYes : mapping.extraQuestionNo
      const finalKey = result.key || key
      setDisorderKey(finalKey)
      const finalMapping = DISORDER_MAP[finalKey] || mapping
      sysType = {
        name: finalMapping.fullName,
        dd: source === 'DSM' ? { DSM: finalKey } : { ICD: finalKey },
        isSystem: result.isSystem,
        isFragmented: result.isFragmented,
        isDissociative: result.isDissociative || finalMapping.isDissociative || false,
        dissociativeStateName: finalMapping.dissociativeStateName || 'Dissociated',
        onboardingCompleted: true,
      }
    } else {
      sysType = {
        name: mapping.fullName,
        dd: source === 'DSM' ? { DSM: key } : { ICD: key },
        isSystem: mapping.isSystem || false,
        isFragmented: mapping.isFragmented || false,
        isDissociative: mapping.isDissociative || false,
        dissociativeStateName: mapping.dissociativeStateName || 'Dissociated',
        onboardingCompleted: true,
      }
    }

    update({ sysType })

    // If isSystem OR isFragmented, go to ImportStep (step 3) first, then NameStep (step 4)
    if (sysType.isSystem || sysType.isFragmented) {
      setStep(3)
    } else {
      setStep(4)
    }
  }

  // Step 3 → Step 4 (other resolved)
  const handleOtherResolve = (sysType) => {
    update({ sysType })
    // If isSystem or isFragmented, route to ImportStep (same as DSM/ICD disorders)
    if (sysType.isSystem || sysType.isFragmented) {
      setStep(3) // Re-render step 3, now showing ImportStep
    } else {
      setStep(4)
    }
  }

  // Called when sysType has isSystem OR isFragmented (or both)
  const handleImportStepComplete = (choice) => {
    if (choice.systemName) setSystemName(choice.systemName)
    if (choice.import) {
      // Explicit guard: only allow import when system type supports alters or states
      if (!resolvedSysType?.isSystem && !resolvedSysType?.isFragmented) {
        setStep(4)
        return
      }
      update({
        importMode: true,
        importSources: choice.importSources || [],
        importEntityTypeMode: choice.entityTypeMode,
        importEntityTypeSelections: choice.entityTypeSelections || {},
      })
      if (onNavigate) onNavigate('register-import')
    } else {
      setStep(4)
    }
  }

  // Step 4 (NameStep) — system name collected, then go to FirstAlterStep or finish
  const handleNameConfirm = (finalSysType, systemName) => {
    update({ sysType: finalSysType })
    if (systemName) setSystemName(systemName)
    // FirstAlterStep only for isSystem (alters). Others skip to auto-commit.
    if (finalSysType.isSystem) {
      setStep(5) // FirstAlterStep
    } else {
      setStep(6) // Auto-commit (no alters to add)
    }
  }

  // Step 5 (FirstAlterStep) — collect first alters, then final commit
  const handleFirstAlterComplete = async (alterNames) => {
    setError(null)
    try {
      if (alterNames && alterNames.length > 0) {
        // Add first alters to staged session
        const members = alterNames.filter(n => n.trim()).map((name, i) => ({
          name: name.trim(),
          entityType: 'alter',
          _id: `temp_alter_${Date.now()}_${i}`,
        }))
        setMembers(members)
      }

      // Include staged imports from ImportPage if any
      if (session?.stagedImports) {
        update({ stagedImports: session.stagedImports })
      }

      // Build front layers preset
      const layers = buildPresetLayers(resolvedSysType)
      if (layers.length > 0) {
        setFront({ layers, status: '', caution: '' })
      }

      // Final commit - creates everything atomically (including staged imports)
      const result = await commit()
      if (result?.system) {
        if (resolvedSysType?.isDissociative) {
          // Note: dissociative state is auto-created by createSystemFromPayload
        }
        if (onRegistered) onRegistered()
      }
    } catch (err) {
      console.error('[Register] Error:', err)
      setError(err.message || 'Failed to create profile')
    }
  }

  // Step 7 (finish) — auto-commit when imported users land here
  const hasFinishedRef = useRef(false)
  useEffect(() => {
    if (step >= 6 && !hasFinishedRef.current) {
      hasFinishedRef.current = true
      handleFirstAlterComplete([])
    }
  }, [step])

  // Preset layers based on sys_type (moved inside for closure access)
  const buildPresetLayers = (sysType) => {
    const layers = []
    if (sysType?.isDissociative && !sysType?.isSystem && !sysType?.isFragmented) {
      layers.push({ _id: `layer_${Date.now()}_1`, name: 'Actively', color: '#8b5cf6', shifts: [] })
    } else if (sysType?.isFragmented && !sysType?.isSystem) {
      layers.push({ _id: `layer_${Date.now()}_1`, name: 'Primary States', color: '#8b5cf6', shifts: [] })
      layers.push({ _id: `layer_${Date.now()}_2`, name: 'Secondary States', color: '#7c3aed', shifts: [] })
      layers.push({ _id: `layer_${Date.now()}_3`, name: 'Tertiary States', color: '#6d28d9', shifts: [] })
    } else if (sysType?.isSystem && sysType?.isFragmented) {
      layers.push({ _id: `layer_${Date.now()}_1`, name: 'Primary Front', color: '#8b5cf6', shifts: [] })
      layers.push({ _id: `layer_${Date.now()}_2`, name: 'Co-Front', color: '#7c3aed', shifts: [] })
      layers.push({ _id: `layer_${Date.now()}_3`, name: 'Co-conscious', color: '#6d28d9', shifts: [] })
      layers.push({ _id: `layer_${Date.now()}_4`, name: 'Back of Front', color: '#5b21b6', shifts: [] })
    }
    return layers
  }

  // Back navigation — linked list: follow parent pointer
  const handleBack = () => {
    // Determine current step ID based on what's actually rendered
    let currentStepId
    if (step === 3) {
      currentStepId = (category === 'OTHER' && !resolvedSysType?.isSystem && !resolvedSysType?.isFragmented)
        ? 'other' : 'import'
    } else {
      currentStepId = REGISTER_STEPS[step - 1]?.id
    }

    const ctx = {
      isSystem: resolvedSysType?.isSystem,
      isFragmented: resolvedSysType?.isFragmented,
      category,
    }
    const parentId = getParentStep(currentStepId, ctx)
    if (parentId) {
      const idx = REGISTER_STEPS.findIndex((s) => s.id === parentId)
      update({ importMode: false })
      return setStep(idx + 1)
    }
    onBack?.()
  }


  return (
    <div className="register-page">
      {step === 1 && <CategoryStep onSelect={handleCategorySelect} onBack={handleStartOver} />}
      {step === 2 && (
        <DisorderStep
          category={category}
          onSelect={handleDisorderSelect}
          onBack={handleBack}
          onStartOver={handleStartOver}
        />)}
      {step === 3 && (resolvedSysType?.isSystem || resolvedSysType?.isFragmented) && (
        <ImportStep
          sysType={resolvedSysType}
          onComplete={handleImportStepComplete}
          onBack={handleBack}
          onStartOver={handleStartOver}
          onNavigate={onNavigate}
        />)}
      {step === 3 && category === 'OTHER' && !resolvedSysType?.isSystem && !resolvedSysType?.isFragmented && (
        <OtherStep
          onResolve={handleOtherResolve}
          onBack={handleBack}
          onStartOver={handleStartOver}
        />)}
      {step === 4 && (
        <NameStep
          disorderKey={disorderKey}
          extraAnswer={extraAnswer}
          sysType={resolvedSysType}
          onConfirm={handleNameConfirm}
          onBack={handleBack}
          onStartOver={handleStartOver}
          discordUser={discordUser}
        />)}
      {step === 5 && (
        <FirstAlterStep
          systemName={session.systemName}
          onComplete={handleFirstAlterComplete}
          onBack={handleBack}
          saving={committing}
        />)}
      {step >= 6 && (
        <div className="register-step">
          <h2>Finishing your setup...</h2>
          <div className="spinner" style={{ margin: 'var(--space-lg) auto' }} />
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
            Creating your profile with imported data...
          </p>
        </div>
      )}
      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', marginTop: 'var(--space-md)' }}>{error}</p>
      )}
      {sessionError && (
        <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', marginTop: 'var(--space-md)' }}>{sessionError}</p>
      )}
      {committing && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 'var(--space-md)' }}>
          Creating your profile...
        </p>
      )}
    </div>
  )
}


export default RegisterPage