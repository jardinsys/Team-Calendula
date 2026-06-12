import React, { useRef, useState } from 'react'
import api from '../api/client.js'

const SIZE_MAP = { sm: 64, md: 96, lg: 128 }

function ImageUpload({ currentImage, onUpload, onRemove, label, size = 'md', type, entityId, field }) {
    const fileRef = useRef(null)
    const [uploading, setUploading] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const px = SIZE_MAP[size] || SIZE_MAP.md

    const handleFile = async (file) => {
        if (!file || !file.type.startsWith('image/')) return
        setUploading(true)
        try {
            let result
            if (type && entityId && field) {
                const endpoint = `/${type}s/${entityId}/${field}`
                const formData = new FormData()
                formData.append('file', file)
                result = await api.uploadImage(endpoint, formData)
            }
            if (onUpload) await onUpload(result || file)
        } catch (err) {
            console.error('[ImageUpload] Upload failed:', err)
        } finally {
            setUploading(false)
        }
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer?.files?.[0]
        if (file) handleFile(file)
    }

    const handleChange = (e) => {
        const file = e.target.files?.[0]
        if (file) handleFile(file)
        e.target.value = ''
    }

    const handleRemove = (e) => {
        e.stopPropagation()
        onRemove?.()
    }

    return (
        <div className="image-upload" style={{ width: px, height: px }}>
            <div
                className={`image-upload-zone ${dragOver ? 'image-upload-zone--dragover' : ''}`}
                style={{ width: px, height: px }}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
            >
                {currentImage ? (
                    <img src={currentImage} alt="" className="image-upload-img" style={{ width: px, height: px }} />
                ) : (
                    <div className="image-upload-placeholder" style={{ width: px, height: px }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                        </svg>
                    </div>
                )}
                {uploading && (
                    <div className="image-upload-overlay">
                        <div className="spinner" />
                    </div>
                )}
                {!uploading && (
                    <div className="image-upload-hover">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                        </svg>
                        <span>Change</span>
                    </div>
                )}
                {currentImage && !uploading && onRemove && (
                    <button className="image-upload-remove" onClick={handleRemove} title="Remove image">
                        ×
                    </button>
                )}
            </div>
            {label && <div className="image-upload-label">{label}</div>}
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleChange}
            />
        </div>
    )
}

export default ImageUpload