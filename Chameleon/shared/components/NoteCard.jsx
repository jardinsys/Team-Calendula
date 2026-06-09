import React from 'react'

const DEFAULT_NOTE_COLOR = '#8b5cf6'

function stripHeaders(text) {
    return text.replace(/^#{1,3}\s+/gm, '')
}

function NoteCard({ note, onClick, variant = 'grid' }) {
    const color = note.color || DEFAULT_NOTE_COLOR

    return (
        <div
            className={`note-card note-card-${variant}`}
            style={{
                '--note-color': color,
                '--note-gradient': `radial-gradient(ellipse at top left, ${color}50 025%, ${color}12 60%, var(--bg-card) 100%)`,
            }}
            onClick={() => onClick?.(note)}
            role="button"
            tabIndex={0}
        >
            {variant === 'grid' && note.media?.[0]?.media?.url && (
                <img
                    className="note-card-image"
                    src={note.media[0].media.url}
                    alt=""
                    loading="lazy"
                />
            )}
            <div className="note-card-body">
                {note.pinned && <span className="note-pin">📌</span>}
                <div className="note-card-title">{note.title || 'Untitled'}</div>
                {note.contentPreview && (
                    <div className="note-card-preview">{stripHeaders(note.contentPreview)}</div>
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
                    {new Date(note.updatedAt).toLocaleDateString()}
                </div>
            </div>
        </div>
    )
}

function NoteCardGrid({ notes, onNoteClick, variant = 'grid' }) {
    if (!notes?.length) {
        return (
            <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h3>No notes yet</h3>
                <p>Create your first note to get started!</p>
            </div>
        )
    }

    return (
        <div className={`notes-${variant}`}>
            {notes.map(note => (
                <NoteCard
                    key={note._id}
                    note={note}
                    onClick={onNoteClick}
                    variant={variant}
                />
            ))}
        </div>
    )
}

export { NoteCard, NoteCardGrid }