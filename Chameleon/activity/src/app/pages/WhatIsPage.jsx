import React from 'react'

export function WhatIsPage({ onNavigate }) {
  return (
    <div className="what-is-page">
      <h1>What is Systemiser?</h1>

      <p>
        <span className="highlight">Systemiser</span> is intended to be a tool designed for
        those with dissociative disorders, those who generally need a tool to manage multiple states of mind, or other related needs.
      </p>

      <p>
        This current version you playing is a relatively basic starting point, but it will eventually give a wide array of features to help with
        organization, tracking, and the ability to aid during mental episodes. This is currently within Discord, but will eventually have 
        standalone applications on webapp, desktop, and mobile devices.
      </p>

      <p>
        That's all for now, but if you have any questions, feel free to join the current makeshift <a href="https://discord.com/invite/DWNckqXxES" target="_blank" rel="noopener noreferrer">support and testing server</a>!
        - <span className="highlight">JardinSys</span>
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
