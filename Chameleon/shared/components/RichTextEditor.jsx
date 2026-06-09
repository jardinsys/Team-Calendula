import React, { useState, useCallback, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlock from '@tiptap/extension-code-block'
import { Markdown } from 'tiptap-markdown'

const TOOLBAR_BUTTONS = [
    { id: 'bold', label: 'B', command: 'toggleBold', style: { fontWeight: 700 } },
    { id: 'italic', label: 'I', command: 'toggleItalic', style: { fontStyle: 'italic' } },
    { id: 'underline', label: 'U', command: 'toggleUnderline', style: { textDecoration: 'underline' } },
    { id: 'strike', label: 'S', command: 'toggleStrike', style: { textDecoration: 'line-through' } },
    { id: 'highlight', label: 'H', command: 'toggleHighlight', style: { backgroundColor: 'rgba(255,255,0,0.2)' } },
    { id: 'code', label: '<>', command: 'toggleCode', style: { fontFamily: 'monospace', fontSize: '0.85em' } },
    { id: 'sep1', separator: true },
    { id: 'h1', label: 'H1', command: () => 'toggleHeading', args: { level: 1 } },
    { id: 'h2', label: 'H2', command: () => 'toggleHeading', args: { level: 2 } },
    { id: 'h3', label: 'H3', command: () => 'toggleHeading', args: { level: 3 } },
    { id: 'sep2', separator: true },
    { id: 'bulletList', label: '\u2022', command: 'toggleBulletList' },
    { id: 'orderedList', label: '1.', command: 'toggleOrderedList' },
    { id: 'taskList', label: '\u2611', command: 'toggleTaskList' },
    { id: 'sep3', separator: true },
    { id: 'blockquote', label: '\u201C', command: 'toggleBlockquote' },
    { id: 'codeBlock', label: '{ }', command: 'toggleCodeBlock' },
    { id: 'horizontalRule', label: '\u2014', command: 'setHorizontalRule' },
    { id: 'sep4', separator: true },
    { id: 'link', label: '\uD83D\uDD17', command: 'setLink' },
]

function RichTextEditor({ content, onChange, placeholder, readOnly = false, mode = 'rich', onModeChange, height = 200 }) {
    const [markdownSource, setMarkdownSource] = useState('')
    const [linkUrl, setLinkUrl] = useState('')
    const [showLinkInput, setShowLinkInput] = useState(false)

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                codeBlock: false,
            }),
            Underline,
            Highlight,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { class: 'editor-link' },
            }),
            TaskList,
            TaskItem.configure({ nested: true }),
            CodeBlock,
            Markdown.configure({
                html: true,
                transformPastedText: true,
                transformCopiedText: true,
            }),
        ],
        content: content || '',
        editable: !readOnly && mode === 'rich',
        onUpdate: ({ editor }) => {
            const md = editor.storage.markdown.getMarkdown()
            setMarkdownSource(md)
            onChange?.(md)
        },
        editorProps: {
            attributes: {
                class: 'rich-text-editor-content',
                style: `min-height: ${height}px`,
            },
        },
    })

    useEffect(() => {
        if (editor && mode === 'rich') {
            const currentMd = editor.storage.markdown.getMarkdown()
            if (currentMd !== content && content !== undefined) {
                editor.commands.setContent(content || '')
            }
        }
    }, [content, editor, mode])

    useEffect(() => {
        if (editor) {
            editor.setEditable(!readOnly && mode === 'rich')
        }
    }, [editor, readOnly, mode])

    useEffect(() => {
        if (mode === 'markdown' && content !== undefined) {
            setMarkdownSource(content || '')
        }
    }, [mode, content])

    const handleMarkdownChange = useCallback((e) => {
        const val = e.target.value
        setMarkdownSource(val)
        onChange?.(val)
    }, [onChange])

    const handleToolbarClick = useCallback((btn) => {
        if (!editor) return

        if (btn.id === 'link') {
            const { href } = editor.getAttributes('link')
            if (href) {
                editor.chain().focus().unsetLink().run()
            } else {
                setShowLinkInput(true)
            }
            return
        }

        if (typeof btn.command === 'function') {
            const cmd = btn.command()
            if (cmd && btn.args) {
                editor.chain().focus()[cmd](btn.args).run()
            } else if (cmd) {
                editor.chain().focus()[cmd]().run()
            }
        } else if (typeof btn.command === 'string') {
            editor.chain().focus()[btn.command]().run()
        }
    }, [editor])

    const handleLinkSubmit = useCallback(() => {
        if (linkUrl && editor) {
            editor.chain().focus().setLink({ href: linkUrl }).run()
        }
        setLinkUrl('')
        setShowLinkInput(false)
    }, [linkUrl, editor])

    const isActive = useCallback((btn) => {
        if (!editor) return false
        if (btn.id === 'link') return editor.isActive('link')
        if (btn.id === 'bold') return editor.isActive('bold')
        if (btn.id === 'italic') return editor.isActive('italic')
        if (btn.id === 'underline') return editor.isActive('underline')
        if (btn.id === 'strike') return editor.isActive('strike')
        if (btn.id === 'highlight') return editor.isActive('highlight')
        if (btn.id === 'code') return editor.isActive('code')
        if (btn.id === 'h1') return editor.isActive('heading', { level: 1 })
        if (btn.id === 'h2') return editor.isActive('heading', { level: 2 })
        if (btn.id === 'h3') return editor.isActive('heading', { level: 3 })
        if (btn.id === 'bulletList') return editor.isActive('bulletList')
        if (btn.id === 'orderedList') return editor.isActive('orderedList')
        if (btn.id === 'taskList') return editor.isActive('taskList')
        if (btn.id === 'blockquote') return editor.isActive('blockquote')
        if (btn.id === 'codeBlock') return editor.isActive('codeBlock')
        return false
    }, [editor])

    return (
        <div className="rich-text-editor">
            <div className="editor-header">
                <div className="editor-toolbar">
                    {TOOLBAR_BUTTONS.map(btn => {
                        if (btn.separator) {
                            return <span key={btn.id} className="toolbar-separator" />
                        }
                        return (
                            <button
                                key={btn.id}
                                type="button"
                                className={`toolbar-btn ${isActive(btn) ? 'active' : ''}`}
                                style={btn.style}
                                onClick={() => handleToolbarClick(btn)}
                                title={btn.id}
                            >
                                {btn.label}
                            </button>
                        )
                    })}
                </div>
                <div className="editor-mode-toggle">
                    <button
                        type="button"
                        className={`mode-btn ${mode === 'rich' ? 'active' : ''}`}
                        onClick={() => onModeChange?.('rich')}
                    >
                        Rich Text
                    </button>
                    <button
                        type="button"
                        className={`mode-btn ${mode === 'markdown' ? 'active' : ''}`}
                        onClick={() => onModeChange?.('markdown')}
                    >
                        Markdown
                    </button>
                </div>
            </div>

            {showLinkInput && (
                <div className="link-input-bar">
                    <input
                        type="url"
                        className="text-input"
                        placeholder="https://..."
                        value={linkUrl}
                        onChange={e => setLinkUrl(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                handleLinkSubmit()
                            }
                            if (e.key === 'Escape') {
                                setShowLinkInput(false)
                                setLinkUrl('')
                            }
                        }}
                        autoFocus
                    />
                    <button type="button" className="btn btn-primary" onClick={handleLinkSubmit}>
                        Apply
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => { setShowLinkInput(false); setLinkUrl('') }}>
                        Cancel
                    </button>
                </div>
            )}

            {mode === 'rich' ? (
                <div className="editor-body">
                    <EditorContent editor={editor} />
                    {placeholder && !readOnly && editor?.isEmpty && (
                        <div className="editor-placeholder">{placeholder}</div>
                    )}
                </div>
            ) : (
                <div className="editor-body editor-markdown">
                    <textarea
                        className="markdown-textarea"
                        value={markdownSource}
                        onChange={handleMarkdownChange}
                        placeholder={placeholder || 'Write markdown...'}
                        readOnly={readOnly}
                        style={{ minHeight: height }}
                    />
                </div>
            )}
        </div>
    )
}

export { RichTextEditor }
export default RichTextEditor