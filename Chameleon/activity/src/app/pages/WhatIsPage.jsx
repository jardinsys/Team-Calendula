import React from 'react'

export function WhatIsPage({ onNavigate }) {
  return (
    <div className="what-is-page">
      <h1>What is Systemiser?</h1>

      <p>
        <span className="highlight">Systemiser</span> is a tool designed for
        plural systems — people who share a body with multiple alters, headmates,
        or identities.
      </p>

      <p>
        It gives your system a shared space to manage profiles, track who's
        fronting, share notes, and stay connected with friends — all from
        within Discord or the web app.
      </p>

      <p>
        Each member of your system can have their own{' '}
        <span className="highlight">profile</span> with a name, avatar,
        description, pronouns, and more. You can track{' '}
        <span className="highlight">who's fronting</span> right now, manage
        layers, and keep a history of switches.
      </p>

      <p>
        <span className="highlight">Notes</span> let you write down thoughts,
        memories, or anything else — shared across your system or kept private.
        You can tag notes and link them to specific alters.
      </p>

      <p>
        <span className="highlight">Friends</span> lets you connect with other
        systems. You can see each other's front status and share information
        based on privacy settings you control.
      </p>

      <p>
        Everything is configurable — from the names you use (system, DID
        system, polycule, etc.) to who can see what. Your system, your rules.
      </p>

      <div style={{ marginTop: 'var(--space-2xl)', display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
        <button
          className="btn-gradient btn-gradient-primary"
          onClick={() => onNavigate('register')}
        >
          Get Started
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => onNavigate(null)}
          style={{ height: '89px', padding: '0 36px', fontSize: '1.1rem' }}
        >
          ← Back
        </button>
      </div>
    </div>
  )
}

export default WhatIsPage
