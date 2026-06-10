import React, { useState, useCallback, useMemo } from 'react'
import { api, DISORDER_MAP, DISORDER_DEFINITIONS, DSM_OPTIONS, ICD_OPTIONS, resolveSysTypeFromDisorder, resolveSysTypeFromExtraAnswer } from '@chameleon/shared'

// ═══════════════════════════════════════════
// Step 1: Category Selection
// ═══════════════════════════════════════════

function CategoryStep({ onSelect }) {
  return (
    <div className="register-step">
      <h2>Do you identify with a dissociative condition?</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
        This helps us set up your profile with the right features.
        You can always change this later in settings.
      </p>

      <div className="category-grid">
        <button className="category-card" onClick={() => onSelect('DSM')}>
          <span className="category-icon">📋</span>
          <span className="category-label">DSM-5</span>
          <span className="category-desc">Diagnostic and Statistical Manual</span>
        </button>
        <button className="category-card" onClick={() => onSelect('ICD')}>
          <span className="category-icon">🌍</span>
          <span className="category-label">ICD-10/11</span>
          <span className="category-desc">International Classification</span>
        </button>
        <button className="category-card" onClick={() => onSelect('OTHER')}>
          <span className="category-icon">✏️</span>
          <span className="category-label">Other</span>
          <span className="category-desc">Custom or self-identified</span>
        </button>
        <button className="category-card" onClick={() => onSelect('NONE')}>
          <span className="category-icon">—</span>
          <span className="category-label">None</span>
          <span className="category-desc">No specific condition</span>
        </button>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════
// Step 2: Disorder Selection (expandable cards)
// ═══════════════════════════════════════════

function DisorderStep({ category, onSelect, onBack }) {
  const options = category === 'DSM' ? DSM_OPTIONS : ICD_OPTIONS
  const [expandedKey, setExpandedKey] = useState(null)
  const [extraAnswer, setExtraAnswer] = useState(null)

  const handleToggle = (key) => {
    setExpandedKey(expandedKey === key ? null : key)
    setExtraAnswer(null)
  }

  const handleSelect = (key) => {
    const mapping = DISORDER_MAP[key]
    if (mapping?.extraQuestion && extraAnswer === null) return // need to answer first
    onSelect(key, extraAnswer)
  }

  return (
    <div className="register-step">
      <h2>{category === 'DSM' ? 'DSM-5 Conditions' : 'ICD-10/11 Conditions'}</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
        Select the condition that best describes your experience.
      </p>

      <div className="disorder-list">
        {options.map(key => {
          const mapping = DISORDER_MAP[key]
          const definition = DISORDER_DEFINITIONS[key]
          const isExpanded = expandedKey === key
          const hasExtraQ = mapping.extraQuestion

          return (
            <div key={key} className={`disorder-card ${isExpanded ? 'expanded' : ''}`}>
              <button
                className="disorder-card-header"
                onClick={() => handleToggle(key)}
              >
                <span className="disorder-name">{mapping.fullName}</span>
                <span className={`disorder-arrow ${isExpanded ? 'open' : ''}`}>▼</span>
              </button>

              {isExpanded && (
                <div className="disorder-card-body">
                  <p className="disorder-definition">{definition}</p>

                  {hasExtraQ && (
                    <div className="disorder-extra-question">
                      <p>{mapping.extraQuestionText}</p>
                      <div className="extra-question-btns">
                        <button
                          className={`extra-btn ${extraAnswer === true ? 'active' : ''}`}
                          onClick={() => setExtraAnswer(true)}
                        >
                          Yes
                        </button>
                        <button
                          className={`extra-btn ${extraAnswer === false ? 'active' : ''}`}
                          onClick={() => setExtraAnswer(false)}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    className="btn-gradient btn-gradient-primary disorder-select-btn"
                    onClick={() => handleSelect(key)}
                    disabled={hasExtraQ && extraAnswer === null}
                  >
                    Select this
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button className="btn-ghost" onClick={onBack} style={{ marginTop: 'var(--space-md)', fontSize: '0.85rem' }}>
        ← Back
      </button>
    </div>
  )
}


// ═══════════════════════════════════════════
// Step 3: Other — manual selection
// ═══════════════════════════════════════════

function OtherStep({ onResolve, onBack }) {
  const [isSystem, setIsSystem] = useState(false)
  const [isFragmented, setIsFragmented] = useState(false)
  const [customName, setCustomName] = useState('')

  const handleContinue = () => {
    onResolve({
      name: customName.trim() || null,
      dd: {},
      isSystem,
      isFragmented,
      isDissociative: false,
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
            value={customName}
            onChange={e => setCustomName(e.target.value)}
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
            We are a system
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
            We experience fragmented states
          </label>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Altered states of mind without distinct alters
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
        <button className="btn-ghost" onClick={onBack} style={{ flex: 1 }}>
          ← Back
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

function NameStep({ disorderKey, extraAnswer, sysType, onConfirm, onBack }) {
  const [customName, setCustomName] = useState('')

  const typeName = useMemo(() => {
    if (sysType?.name && sysType.name !== 'None') return sysType.name
    if (disorderKey && DISORDER_MAP[disorderKey]) return DISORDER_MAP[disorderKey].fullName
    return null
  }, [disorderKey, sysType])

  const statusParts = []
  if (sysType?.isSystem) statusParts.push('System')
  if (sysType?.isFragmented) statusParts.push('Fragmented')
  if (sysType?.isDissociative) statusParts.push('Dissociative')
  if (statusParts.length === 0) statusParts.push('Basic')

  const handleConfirm = () => {
    const finalSysType = {
      ...sysType,
      name: customName.trim() || sysType?.name || typeName || 'None',
    }
    onConfirm(finalSysType)
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
          <label>Profile name (optional)</label>
          <input
            className="text-input"
            type="text"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            placeholder={typeName || 'Your profile name'}
            maxLength={100}
          />
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Leave blank to use "{typeName || 'None'}" as your profile name.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
        <button className="btn-ghost" onClick={onBack} style={{ flex: 1 }}>
          ← Back
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
// Main Register Page
// ═══════════════════════════════════════════

export function RegisterPage({ onNavigate, onRegistered }) {
  const [step, setStep] = useState(1)
  const [category, setCategory] = useState(null)
  const [disorderKey, setDisorderKey] = useState(null)
  const [extraAnswer, setExtraAnswer] = useState(null)
  const [resolvedSysType, setResolvedSysType] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Step 1 → Step 2 or Step 3
  const handleCategorySelect = (cat) => {
    setCategory(cat)
    if (cat === 'OTHER') {
      setStep(3) // Other manual step
    } else if (cat === 'NONE') {
      setResolvedSysType({
        name: 'None',
        dd: {},
        isSystem: false,
        isFragmented: false,
        isDissociative: false,
        onboardingCompleted: true,
      })
      setStep(4) // Name step
    } else {
      setStep(2) // Disorder selection
    }
  }

  // Step 2 → Step 4 (disorder selected)
  const handleDisorderSelect = (key, extraAns) => {
    setDisorderKey(key)
    setExtraAnswer(extraAns)

    const mapping = DISORDER_MAP[key]
    if (mapping.extraQuestion && extraAns !== null) {
      setResolvedSysType(resolveSysTypeFromExtraAnswer(key, extraAns))
    } else {
      setResolvedSysType(resolveSysTypeFromDisorder(key))
    }
    setStep(4)
  }

  // Step 3 → Step 4 (other resolved)
  const handleOtherResolve = (sysType) => {
    setResolvedSysType(sysType)
    setStep(4)
  }

  // Step 4 → Create
  const handleConfirm = async (finalSysType) => {
    setSaving(true)
    setError(null)

    try {
      await api.createSystem({
        sys_type: finalSysType,
      })

      // If dissociative, auto-create the "Dissociated" state
      if (finalSysType.isDissociative) {
        try {
          await api.createState({
            name: 'Dissociated',
            description: 'A dissociative state',
          })
        } catch (stateErr) {
          console.error('[Register] Failed to create Dissociated state:', stateErr)
        }
      }

      onRegistered?.()
    } catch (err) {
      console.error('[Register] Error:', err)
      setError(err.message || 'Failed to create profile')
      setSaving(false)
    }
  }

  // Back navigation
  const handleBack = () => {
    if (step === 4) {
      if (category === 'OTHER') setStep(3)
      else setStep(2)
    } else if (step === 3) {
      setStep(1)
    } else if (step === 2) {
      setStep(1)
      setCategory(null)
    }
  }

  return (
    <div className="register-page">
      {step > 1 && (
        <button
          className="btn-ghost"
          onClick={() => { setStep(1); setCategory(null); setDisorderKey(null); setResolvedSysType(null) }}
          style={{ fontSize: '0.75rem', marginBottom: 'var(--space-md)', alignSelf: 'flex-start' }}
        >
          ← Start over
        </button>
      )}

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
          extraAnswer={extraAnswer}
          sysType={resolvedSysType}
          onConfirm={handleConfirm}
          onBack={handleBack}
        />
      )}

      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', marginTop: 'var(--space-md)' }}>
          {error}
        </p>
      )}

      {saving && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 'var(--space-md)' }}>
          Creating your profile...
        </p>
      )}
    </div>
  )
}

export default RegisterPage
