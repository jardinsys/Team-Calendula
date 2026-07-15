import React, { useState, useEffect } from 'react'

/**
 * LoadingPage - A full-screen loading page with:
 * - Rive animation placeholder
 * - Hidden YouTube video infrastructure
 * - Progress indicator
 * - "While you wait" content
 */
export function LoadingPage({
    title = 'Loading...',
    subtitle = 'Please wait while we set things up',
    showProgress = false,
    progress = 0,
    showVideo = false,
    videoId = null,
    onComplete,
    timeout = 30000, // 30 second timeout
    children
}) {
    const [isTimedOut, setIsTimedOut] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsTimedOut(true)
        }, timeout)

        return () => clearTimeout(timer)
    }, [timeout])

    return (
        <div className="loading-page" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: 'var(--space-xl)',
            textAlign: 'center',
        }}>
            {/* Rive Animation Placeholder */}
            <div className="loading-animation" style={{
                width: '200px',
                height: '200px',
                marginBottom: 'var(--space-xl)',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 'var(--radius-xl)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--glass-border)',
            }}>
                {/* Rive animation will be loaded here */}
                <div className="spinner" style={{ width: '64px', height: '64px' }} />
            </div>

            {/* Title and subtitle */}
            <h2 style={{
                fontFamily: 'var(--font-accent)',
                fontSize: '1.5rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-sm)',
            }}>
                {title}
            </h2>

            <p style={{
                color: 'var(--text-secondary)',
                fontSize: '0.95rem',
                maxWidth: '400px',
                lineHeight: 1.6,
                marginBottom: 'var(--space-lg)',
            }}>
                {subtitle}
            </p>

            {/* Progress bar */}
            {showProgress && (
                <div style={{
                    width: '100%',
                    maxWidth: '300px',
                    height: '6px',
                    background: 'var(--glass-border)',
                    borderRadius: 'var(--radius-pill)',
                    overflow: 'hidden',
                    marginBottom: 'var(--space-lg)',
                }}>
                    <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: 'var(--accent)',
                        borderRadius: 'var(--radius-pill)',
                        transition: 'width 0.3s ease',
                    }} />
                </div>
            )}

            {/* While you wait content */}
            <div style={{
                marginTop: 'var(--space-xl)',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
            }}>
                {children || (
                    <p>Did you know? Systemiser supports importing from multiple platforms at once!</p>
                )}
            </div>

            {/* Hidden YouTube video infrastructure */}
            {showVideo && videoId && (
                <div className="loading-video" style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    pointerEvents: 'none',
                    zIndex: -1,
                }}>
                    <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=0&mute=1&controls=0`}
                        title="Systemiser Introduction"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{ opacity: 0 }}
                    />
                </div>
            )}

            {/* Timeout message */}
            {isTimedOut && (
                <div style={{
                    marginTop: 'var(--space-lg)',
                    padding: 'var(--space-md)',
                    background: 'rgba(253, 186, 116, 0.1)',
                    border: '1px solid rgba(253, 186, 116, 0.2)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--color-warning)',
                    fontSize: '0.85rem',
                }}>
                    This is taking longer than expected. You can try refreshing the page.
                </div>
            )}
        </div>
    )
}

/**
 * InlineLoader - A smaller loading indicator for inline use
 */
export function InlineLoader({ message = 'Loading...', size = 'small' }) {
    const sizeMap = {
        small: { width: '20px', height: '20px', fontSize: '0.85rem' },
        medium: { width: '32px', height: '32px', fontSize: '0.95rem' },
        large: { width: '48px', height: '48px', fontSize: '1.1rem' },
    }

    const style = sizeMap[size] || sizeMap.small

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            color: 'var(--text-secondary)',
        }}>
            <div className="spinner" style={{
                width: style.width,
                height: style.height,
            }} />
            <span style={{ fontSize: style.fontSize }}>{message}</span>
        </div>
    )
}

export default LoadingPage
