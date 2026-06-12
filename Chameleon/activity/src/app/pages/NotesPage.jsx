import React, { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDiscordSdk } from '../../hooks/useDiscordSdk'
import {
    api,
    NoteCardGrid,
    NoteModal,
    CreateNoteModal,
    TagFilterBar,
    ManageTagsModal,
    Icon,
    noteKeys,
} from '@chameleon/shared'

export function NotesPage({ system, onOpenSettings }) {
    const { session } = useDiscordSdk()
    const queryClient = useQueryClient()
    const [selectedNote, setSelectedNote] = useState(null)
    const [showCreate, setShowCreate] = useState(false)
    const [filter, setFilter] = useState('all')
    const [selectedTags, setSelectedTags] = useState([])
    const [showManageTags, setShowManageTags] = useState(false)
    const [viewVariant, setViewVariant] = useState('grid')

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

    const deleteTagMutation = useMutation({
        mutationFn: (tag) => api.deleteNoteTag(tag),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: noteKeys.tags() })
            queryClient.invalidateQueries({ queryKey: noteKeys.lists() })
        },
    })

    const notes = notesData?.notes || []

    const handleNoteCreated = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: noteKeys.lists() })
        queryClient.invalidateQueries({ queryKey: noteKeys.tags() })
    }, [queryClient])

    const handleNoteUpdated = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: noteKeys.lists() })
        queryClient.invalidateQueries({ queryKey: noteKeys.tags() })
    }, [queryClient])

    const handleNoteDeleted = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: noteKeys.lists() })
        queryClient.invalidateQueries({ queryKey: noteKeys.tags() })
        setSelectedNote(null)
    }, [queryClient])

    const handleToggleTag = useCallback((tag) => {
        setSelectedTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        )
    }, [])

    const handleClearTags = useCallback(() => {
        setSelectedTags([])
    }, [])

    const handleDeleteTag = useCallback((tag) => {
        deleteTagMutation.mutate(tag)
        setSelectedTags(prev => prev.filter(t => t !== tag))
    }, [deleteTagMutation])

    if (isLoading && !notes.length) {
        return (
            <div className="status-screen">
                <div className="spinner" />
                <p>Loading notes...</p>
            </div>
        )
    }

    return (
        <div className="notes-page">
            <header className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h1>Your Notes</h1>
                        <p>{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button
                            className={`btn btn-ghost btn-sm ${viewVariant === 'grid' ? 'active' : ''}`}
                            onClick={() => setViewVariant('grid')}
                            title="Grid view"
                        >
                            ▦
                        </button>
                        <button
                            className={`btn btn-ghost btn-sm ${viewVariant === 'list' ? 'active' : ''}`}
                            onClick={() => setViewVariant('list')}
                            title="List view"
                        >
                            ☰
                        </button>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={onOpenSettings}
                            title="Settings"
                            style={{ padding: '6px', minWidth: 'auto' }}
                        >
                            <Icon name="settings" size={16} />
                        </button>
                    </div>
                </div>
            </header>

            <TagFilterBar
                tags={tags}
                selectedTags={selectedTags}
                onToggleTag={handleToggleTag}
                onClearTags={handleClearTags}
                onManageTags={() => setShowManageTags(true)}
                filter={filter}
                onFilterChange={setFilter}
            />

            <NoteCardGrid
                notes={notes}
                onNoteClick={setSelectedNote}
                variant={viewVariant}
            />

            <button className="fab" title="New note" onClick={() => setShowCreate(true)}>+</button>

            {selectedNote && (
                <NoteModal
                    note={selectedNote}
                    system={system}
                    onClose={() => setSelectedNote(null)}
                    onUpdated={handleNoteUpdated}
                    onDeleted={handleNoteDeleted}
                />
            )}

            {showCreate && (
                <CreateNoteModal
                    system={system}
                    onClose={() => setShowCreate(false)}
                    onCreated={handleNoteCreated}
                />
            )}

            {showManageTags && (
                <ManageTagsModal
                    tags={tags}
                    notes={notes}
                    onDelete={handleDeleteTag}
                    onClose={() => setShowManageTags(false)}
                />
            )}
        </div>
    )
}

export default NotesPage