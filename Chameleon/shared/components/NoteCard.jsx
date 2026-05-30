import React from 'react'

const DEFAULT_NOTE_COLOR = '#8b5cf6'

function NoteCard({ note, onClick }) {
    return (
        <div
            className="note-card"
            style={{ '--note-color': note.color || DEFAULT_NOTE_COLOR }}
            onClick={() => onClick?.(note)}
            role="button"
            tabIndex={0}
        >
            {note.media?.[0]?.media?.url && (
                <img
                    className="note-card-image"
                    src={note.media[0].media.url}
                    alt=""
                    loading="lazy"
                />
            )}
            <div className="note-card-title">{note.title || 'Untitled'}</div>
            {note.contentPreview && (
                <div className="note-card-preview">{note.contentPreview}</div>
            )}
            {note.tags?.length > 0 && (
                <div className="note-card-tags">
                    {note.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="note-card-tag">{tag}</span>
                    ))}
                    {note.tags.length > 3 && (
                        <span className="note-card-tag">+{note.tags.length - 3}</span>
                    )}
                </div>
            )}
            <div className="note-card-meta">
                {note.pinned && '📌 '}{new Date(note.updatedAt).toLocaleDateString()}
            </div>
        </div>
    )
}

function NoteCardGrid({ notes, onNoteClick }) {
    if (!notes?.length) {
        return (
            <div className="empty-state">
                <span className="empty-icon" />
                <h3>No notes yet</h3>
                <p>Create your first note to get started!</p>
            </div>
        )
    }

    return (
        <div className="notes-grid">
            {notes.map(note => (
                <NoteCard key={note._id} note={note} onClick={onNoteClick} />
            ))}
        </div>
    )
}

export { NoteCard, NoteCardGrid }
