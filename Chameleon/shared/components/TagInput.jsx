import React, { useState, useRef, useCallback, useEffect } from 'react'

function TagInput({ tags = [], onChange, existingTags = [], placeholder = 'Add tag...', readOnly = false }) {
    const [input, setInput] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const inputRef = useRef(null)

    const filtered = existingTags.filter(
        t => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase())
    ).slice(0, 8)

    const addTag = useCallback((tag) => {
        const trimmed = tag.trim().toLowerCase()
        if (trimmed && !tags.includes(trimmed)) {
            onChange?.([...tags, trimmed])
        }
        setInput('')
        setShowSuggestions(false)
    }, [tags, onChange])

    const removeTag = useCallback((tag) => {
        onChange?.(tags.filter(t => t !== tag))
    }, [tags, onChange])

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            if (input.trim()) addTag(input)
        }
        if (e.key === 'Backspace' && !input && tags.length > 0) {
            removeTag(tags[tags.length - 1])
        }
        if (e.key === 'Escape') {
            setShowSuggestions(false)
        }
    }, [input, addTag, removeTag, tags])

    const handleBlur = useCallback(() => {
        setTimeout(() => {
            setShowSuggestions(false)
            if (input.trim()) addTag(input)
        }, 150)
    }, [input, addTag])

    return (
        <div className="tag-input-wrapper">
            <div className="tag-input-container">
                {tags.map(tag => (
                    <span key={tag} className="tag-chip">
                        <span className="tag-chip-text">{tag}</span>
                        {!readOnly && (
                            <button
                                type="button"
                                className="tag-chip-remove"
                                onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
                                title={`Remove "${tag}"`}
                            >
                                ×
                            </button>
                        )}
                    </span>
                ))}
                {!readOnly && (
                    <input
                        ref={inputRef}
                        className="tag-input-field"
                        type="text"
                        value={input}
                        onChange={e => { setInput(e.target.value); setShowSuggestions(true) }}
                        onKeyDown={handleKeyDown}
                        onFocus={() => input || setShowSuggestions(true)}
                        onBlur={handleBlur}
                        placeholder={tags.length === 0 ? placeholder : ''}
                    />
                )}
            </div>
            {showSuggestions && filtered.length > 0 && (
                <div className="tag-suggestions">
                    {filtered.map(tag => (
                        <button
                            key={tag}
                            type="button"
                            className="tag-suggestion-item"
                            onMouseDown={(e) => { e.preventDefault(); addTag(tag) }}
                        >
                            #{tag}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export { TagInput }
export default TagInput