// Notes Page
// Note management with quick note creation

const React = require('react');
const { useState } = React;

const { useQuery, useMutation, useQueryClient } = require('@tanstack/react-query');
const api = require('../api/client');

function NotesPage() {
    const queryClient = useQueryClient();
    const [showNewNote, setShowNewNote] = useState(false);
    const [newNote, setNewNote] = useState({ title: '', content: '', tags: '' });

    // Fetch notes
    const { data, isLoading } = useQuery({
        queryKey: ['quickNotes'],
        queryFn: () => api.getQuickNotes()
    });

    // Create note mutation
    const createNoteMutation = useMutation({
        mutationFn: (noteData) => api.createQuickNote(noteData),
        onSuccess: () => {
            queryClient.invalidateQueries(['quickNotes']);
            setShowNewNote(false);
            setNewNote({ title: '', content: '', tags: '' });
        }
    });

    const handleCreateNote = (e) => {
        e.preventDefault();
        const tags = newNote.tags
            .split(',')
            .map(t => t.trim())
            .filter(t => t);

        createNoteMutation.mutate({
            title: newNote.title || `Note - ${new Date().toLocaleDateString()}`,
            content: newNote.content,
            tags
        });
    };

    return (
        <div className="notes-page">
            {/* Header */}
            <header className="page-header">
                <h1>📝 Notes</h1>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowNewNote(true)}
                >
                    + New Note
                </button>
            </header>

            {/* New Note Form */}
            {showNewNote && (
                <div className="modal-overlay" onClick={() => setShowNewNote(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2>Create Quick Note</h2>
                        <form onSubmit={handleCreateNote}>
                            <div className="form-group">
                                <label htmlFor="title">Title</label>
                                <input
                                    id="title"
                                    type="text"
                                    value={newNote.title}
                                    onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                                    placeholder="Note title..."
                                    className="text-input"
                                    autoFocus
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="content">Content</label>
                                <textarea
                                    id="content"
                                    value={newNote.content}
                                    onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                                    placeholder="Write your note..."
                                    className="text-input"
                                    rows={5}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="tags">Tags (comma-separated)</label>
                                <input
                                    id="tags"
                                    type="text"
                                    value={newNote.tags}
                                    onChange={(e) => setNewNote({ ...newNote, tags: e.target.value })}
                                    placeholder="tag1, tag2, tag3"
                                    className="text-input"
                                />
                            </div>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowNewNote(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={createNoteMutation.isPending}
                                >
                                    {createNoteMutation.isPending ? 'Creating...' : 'Create Note'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Tags Filter */}
            {data?.tags?.length > 0 && (
                <section className="tags-section">
                    <h3>🏷️ Tags</h3>
                    <div className="tags-list">
                        {data.tags.map(tag => (
                            <span key={tag} className="tag">{tag}</span>
                        ))}
                    </div>
                </section>
            )}

            {/* Notes List */}
            <section className="notes-list-section">
                {isLoading ? (
                    <div className="loading-placeholder">Loading notes...</div>
                ) : data?.notes?.length > 0 ? (
                    <div className="notes-grid">
                        {data.notes.map(note => (
                            <div
                                key={note._id}
                                className={`note-card ${note.pinned ? 'pinned' : ''}`}
                            >
                                <div className="note-header">
                                    <span className="note-icon">
                                        {note.pinned ? '📌' : '📝'}
                                    </span>
                                    <h3 className="note-title">{note.title}</h3>
                                </div>

                                {note.tags?.length > 0 && (
                                    <div className="note-tags">
                                        {note.tags.map(tag => (
                                            <span key={tag} className="tag small">{tag}</span>
                                        ))}
                                    </div>
                                )}

                                <div className="note-meta">
                                    <span className="note-date">
                                        {new Date(note.updatedAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <span className="empty-icon">📝</span>
                        <h3>No notes yet</h3>
                        <p>Create your first note to get started!</p>
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowNewNote(true)}
                        >
                            + Create Note
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}

module.exports = NotesPage;