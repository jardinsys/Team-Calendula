// Notes Page
// Unified note management with React Query + shared components

import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { Icon } from '@chameleon/shared'

const NOTE_COLORS = [
    '#8b5cf6', '#ED4245', '#E67E22', '#F1C40F',
    '#57F287', '#3498DB', '#9B59B6', '#EB459E', '#95A5A6'
]

const noteKeys = {
    all: ['notes'] as const,
    lists: () => [...noteKeys.all, 'list'] as const,
    list: (filters: any) => [...noteKeys.lists(), filters] as const,
    tags: () => [...noteKeys.all, 'tags'] as const,
}

function TagInput({ tags, onChange, existingTags = [] }: { tags: string[], onChange: (tags: string[]) => void, existingTags?: string[] }) {
    const [input, setInput] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)

    const filtered = existingTags.filter(
        t => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase())
    ).slice(0, 8)

    const addTag = (tag: string) => {
        const trimmed = tag.trim().toLowerCase()
        if (trimmed && !tags.includes(trimmed)) {
            onChange([...tags, trimmed])
        }
        setInput('')
        setShowSuggestions(false)
    }

    const removeTag = (tag: string) => {
        onChange(tags.filter(t => t !== tag))
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            if (input.trim()) addTag(input)
        }
        if (e.key === 'Backspace' && !input && tags.length > 0) {
            removeTag(tags[tags.length - 1])
        }
    }

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '6px 10px', border: '1px solid var(--border, #333)', borderRadius: '8px', minHeight: '38px', alignItems: 'center' }}>
                {tags.map(tag => (
                    <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', background: 'var(--accent-subtle, rgba(139,92,246,0.15))', color: 'var(--accent, #c4b5fd)', fontSize: '0.75rem' }}>
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: '0.9rem' }}>×</button>
                    </span>
                ))}
                <input
                    type="text"
                    value={input}
                    onChange={e => { setInput(e.target.value); setShowSuggestions(true) }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setInput('') || setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder={tags.length === 0 ? 'Add tag...' : ''}
                    style={{ flex: 1, minWidth: 80, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text, #fff)', fontSize: '0.85rem', padding: '4px 0' }}
                />
            </div>
            {showSuggestions && filtered.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0 0 8px 8px', maxHeight: 160, overflowY: 'auto' }}>
                    {filtered.map(tag => (
                        <button key={tag} type="button" onMouseDown={e => { e.preventDefault(); addTag(tag) }} style={{ display: 'block', width: '100%', padding: '6px 10px', background: 'none', border: 'none', textAlign: 'left', color: '#aaa', cursor: 'pointer', fontSize: '0.85rem' }}>
                            #{tag}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

function NotesPage() {
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState('all')
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [showNewNote, setShowNewNote] = useState(false)
    const [newNote, setNewNote] = useState({ title: '', content: '', tags: [] as string[], color: NOTE_COLORS[0] })

    const { data: notesData, isLoading } = useQuery({
        queryKey: noteKeys.list({ filter, tags: selectedTags }),
        queryFn: async () => {
            const tagParam = selectedTags.length > 0 ? selectedTags.join(',') : undefined
            return api.getNotes(filter, tagParam, 0, 100)
        },
    })

    const { data: tags = [] } = useQuery({
        queryKey: noteKeys.tags(),
        queryFn: () => api.getNoteTags(),
    })

    const createMutation = useMutation({
        mutationFn: (data: any) => api.createNote(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: noteKeys.lists() })
            queryClient.invalidateQueries({ queryKey: noteKeys.tags() })
            setShowNewNote(false)
            setNewNote({ title: '', content: '', tags: [], color: NOTE_COLORS[0] })
        },
    })

    const notes = notesData?.notes || []

    const handleCreateNote = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newNote.content.trim()) return
        createMutation.mutate({
            title: newNote.title.trim() || undefined,
            content: newNote.content,
            tags: newNote.tags,
            color: newNote.color === NOTE_COLORS[0] ? undefined : newNote.color,
        })
    }

    const handleToggleTag = (tag: string) => {
        setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
    }

    return (
        <div className="notes-page">
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <h1>Notes</h1>
                    <p style={{ color: 'var(--text-secondary, #aaa)', fontSize: '0.85rem' }}>
                        {notes.length} note{notes.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowNewNote(true)}>
                    + New Note
                </button>
            </header>

            {/* Filter bar */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: 12, flexWrap: 'wrap' }}>
                {['all', 'owned', 'shared'].map(f => (
                    <button
                        key={f}
                        className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                        onClick={() => { setFilter(f); setSelectedTags([]) }}
                    >
                        {f === 'all' ? 'All' : f === 'owned' ? 'Owned' : 'Shared'}
                    </button>
                ))}
            </div>

            {/* Tag filter */}
            {tags.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: 16, flexWrap: 'wrap' }}>
                    {selectedTags.length > 0 && (
                        <button className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '2px 8px' }} onClick={() => setSelectedTags([])}>
                            Clear ×
                        </button>
                    )}
                    {tags.map(tag => (
                        <button
                            key={tag}
                            className={`btn ${selectedTags.includes(tag) ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: '0.7rem', padding: '2px 10px' }}
                            onClick={() => handleToggleTag(tag)}
                        >
                            #{tag}
                        </button>
                    ))}
                </div>
            )}

            {/* Notes grid */}
            {isLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#aaa' }}>Loading notes...</div>
            ) : notes.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                    {notes.map(note => (
                        <div
                            key={note._id}
                            style={{
                                padding: 12,
                                borderRadius: 12,
                                background: `radial-gradient(ellipse at top left, ${note.color || '#8b5cf6'}28 0%, ${note.color || '#8b5cf6'}12 40%, var(--bg-card, #1a1a2e) 75%)`,
                                border: '1px solid rgba(255,255,255,0.07)',
                                cursor: 'pointer',
                            }}
                            onClick={() => window.location.href = `/app/notes/${note._id}`}
                        >
                            {note.pinned && <span style={{ fontSize: '0.75rem' }}><Icon name="pin" size={12} /> </span>}
                            <h3 style={{ fontSize: '0.95rem', margin: '0 0 4px' }}>{note.title || 'Untitled'}</h3>
                            {note.contentPreview && (
                                <p style={{
                                    fontSize: '0.8rem', color: '#aaa', margin: '0 0 8px',
                                    overflow: 'hidden', display: '-webkit-box',
                                    WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                                    whiteSpace: 'pre-line',
                                }}>
                                    {note.contentPreview.replace(/^#{1,3}\s+/gm, '')}
                                </p>
                            )}
                            {note.tags?.length > 0 && (
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                                    {note.tags.slice(0, 3).map(tag => (
                                        <span key={tag} style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 10, background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div style={{ fontSize: '0.7rem', color: '#666' }}>
                                {new Date(note.updatedAt).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: 32, color: '#666' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 12 }}><Icon name="fileText" size={48} /></div>
                    <h3>No notes yet</h3>
                    <p>Create your first note to get started!</p>
                </div>
            )}

            {/* Create note modal */}
            {showNewNote && (
                <div className="modal-overlay" onClick={() => setShowNewNote(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ padding: 20, borderRadius: 12, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 500, width: '100%' }}>
                        <h2 style={{ marginBottom: 16 }}>New Note</h2>
                        <form onSubmit={handleCreateNote}>
                            <div className="form-group">
                                <label>Title</label>
                                <input
                                    type="text"
                                    value={newNote.title}
                                    onChange={e => setNewNote({ ...newNote, title: e.target.value })}
                                    placeholder="Note title (optional)"
                                    className="text-input"
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label>Content</label>
                                <textarea
                                    value={newNote.content}
                                    onChange={e => setNewNote({ ...newNote, content: e.target.value })}
                                    placeholder="Write your note in markdown..."
                                    className="text-input"
                                    rows={6}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Tags</label>
                                <TagInput
                                    tags={newNote.tags}
                                    onChange={tags => setNewNote({ ...newNote, tags })}
                                    existingTags={tags}
                                />
                            </div>
                            <div className="form-group">
                                <label>Color</label>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {NOTE_COLORS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setNewNote({ ...newNote, color })}
                                            style={{
                                                width: 28, height: 28, borderRadius: '50%', backgroundColor: color,
                                                border: newNote.color === color ? '2px solid white' : '2px solid transparent',
                                                cursor: 'pointer'
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowNewNote(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || !newNote.content.trim()}>
                                    {createMutation.isPending ? 'Creating...' : 'Create Note'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default NotesPage