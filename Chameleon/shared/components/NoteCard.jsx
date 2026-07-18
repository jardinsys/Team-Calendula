import React from 'react'
import { Icon } from '../icons.jsx'

const DEFAULT_NOTE_COLOR = '#8b5cf6'

function stripHeaders(text) {
    return text.replace(/^#{1,3}\s+/gm, '')
}

// Strip HTML tags and decode common entities for clean preview
function stripHtml(text) {
    if (!text) return ''
    return text
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .trim()
}

function NoteCard({ note, onClick, variant = 'grid' }) {
    const color = note.color || DEFAULT_NOTE_COLOR

    return (
        <div
            className={`note-card note-card-${variant}`}
            style={{
                '--note-color': color,
                '--note-gradient': `linear-gradient(180deg, ${color}20 0%, ${color}08 30%, transparent 60%)`,
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
                {note.pinned && <span className="note-pin"><Icon name="pin" size={14} /></span>}
                <div className="note-card-title">{note.title || 'Untitled'}</div>
                {note.contentPreview && (
                    <div className="note-card-preview">{stripHtml(note.contentPreview)}</div>
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
                <div className="empty-icon"><Icon name="fileText" size={48} /></div>
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