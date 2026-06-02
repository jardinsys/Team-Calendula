import React, { useState, useEffect } from 'react'
import { useDiscordSdk } from '../../hooks/useDiscordSdk'
import { api, NoteCardGrid, NoteModal, CreateNoteModal } from '@chameleon/shared'

export function NotesPage() {
    const { session } = useDiscordSdk()
    const [notes, setNotes] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [selectedNote, setSelectedNote] = useState(null)
    const [showCreate, setShowCreate] = useState(false)
    const [filter, setFilter] = useState('all')
    const [selectedTag, setSelectedTag] = useState(null)
    const [tags, setTags] = useState([])
    const [manageTags, setManageTags] = useState(false)

    const fetchNotes = async () => {
        try {
            setLoading(true)
            const data = await api.getNotes(filter, selectedTag)
            setNotes(data.notes || [])
            setLoading(false)
        } catch (err) {
            setError(err.message)
            setLoading(false)
        }
    }

    const fetchTags = async () => {
        try {
            const data = await api.getNoteTags()
            setTags(data || [])
        } catch (err) {
            console.error('Tags fetch error:', err)
        }
    }

    useEffect(() => { fetchNotes() }, [filter, selectedTag])
    useEffect(() => { fetchTags() }, [])

    const handleNoteCreated = () => { fetchNotes(); fetchTags() }
    const handleNoteUpdated = () => { fetchNotes(); fetchTags() }
    const handleNoteDeleted = () => { fetchNotes(); fetchTags(); setSelectedNote(null) }

    const handleDeleteTag = async (tag) => {
        try {
            await api.deleteNoteTag(tag)
            if (selectedTag === tag) setSelectedTag(null)
            fetchTags()
            fetchNotes()
        } catch (err) {
            console.error('Delete tag error:', err)
        }
    }

    if (loading && !notes.length) {
        return (
            <div className="status-screen">
                <div className="spinner" />
                <p>Loading notes...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="empty-state">
                <span className="empty-icon" />
                <h3>Something went wrong</h3>
                <p>{error}</p>
            </div>
        )
    }

    return (
        <div>
            <header className="page-header">
                <h1>Your Notes</h1>
                <p>{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
            </header>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto' }}>
                {['all', 'owned', 'shared'].map(f => (
                    <button
                        key={f}
                        className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.75rem', padding: '4px 12px' }}
                        onClick={() => { setFilter(f); setSelectedTag(null) }}
                    >
                        {f === 'all' ? 'All' : f === 'owned' ? 'Owned' : 'Shared'}
                    </button>
                ))}
            </div>

            {tags.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                        className={`btn ${!selectedTag ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.7rem', padding: '2px 10px' }}
                        onClick={() => setSelectedTag(null)}
                    >
                        All tags
                    </button>
                    {tags.map(tag => (
                        <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <button
                                className={`btn ${selectedTag === tag ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ fontSize: '0.7rem', padding: '2px 10px' }}
                                onClick={() => manageTags ? null : setSelectedTag(selectedTag === tag ? null : tag)}
                            >
                                #{tag}
                            </button>
                            {manageTags && (
                                <button
                                    onClick={() => handleDeleteTag(tag)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #949ba4)', cursor: 'pointer', padding: '0 2px', fontSize: '0.8rem' }}
                                    title={`Delete tag "${tag}"`}
                                >×</button>
                            )}
                        </span>
                    ))}
                    <button
                        className="btn btn-ghost"
                        style={{ fontSize: '0.65rem', padding: '2px 8px' }}
                        onClick={() => setManageTags(!manageTags)}
                    >
                        {manageTags ? 'Done' : 'Manage'}
                    </button>
                </div>
            )}

            <NoteCardGrid notes={notes} onNoteClick={setSelectedNote} />

            <button className="fab" title="New note" onClick={() => setShowCreate(true)}>+</button>

            {selectedNote && (
                <NoteModal
                    note={selectedNote}
                    onClose={() => setSelectedNote(null)}
                    onUpdated={handleNoteUpdated}
                    onDeleted={handleNoteDeleted}
                />
            )}

            {showCreate && (
                <CreateNoteModal
                    onClose={() => setShowCreate(false)}
                    onCreated={handleNoteCreated}
                />
            )}
        </div>
    )
}

export default NotesPage
