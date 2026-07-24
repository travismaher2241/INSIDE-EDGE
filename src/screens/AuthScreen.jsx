import React, { useState } from 'react';

export default function AuthScreen({ onLoginSuccess, onEnableTesterAccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please provide a valid coach email address.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    onLoginSuccess({
      uid: 'coach_' + btoa(email.toLowerCase()).replace(/=/g, ''),
      email: email.toLowerCase(),
      name: email.split('@')[0],
      isLocalSession: true
    });
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-floor)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>🏏</span>
            <h1 className="scoreboard-font" style={{ color: 'var(--color-training)', margin: 0, fontSize: '1.6rem' }}>
              INSIDE EDGE
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            Cricket Coaching Operating System — Local Workstation Mode
          </p>
        </div>

        <div style={{ background: 'rgba(58, 134, 255, 0.1)', border: '1px solid rgba(58, 134, 255, 0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '0.8rem', color: '#60a5fa' }}>
          🔒 <strong>Privacy Boundary:</strong> Local Workstation Mode. All roster and training data remains encrypted on this device.
        </div>

        <h2 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>
          {isSignUp ? 'Register Coach Workstation' : 'Coach Login'}
        </h2>

        {error && (
          <div style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '8px', fontSize: '0.8rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label htmlFor="auth-email">Coach Email Address</label>
            <input 
              id="auth-email"
              type="email" 
              placeholder="coach@cricketclub.org" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Workstation Passphrase</label>
            <input 
              id="auth-password"
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button type="submit" className="btn btn-training" style={{ padding: '12px', fontSize: '1rem', marginTop: '8px' }}>
            {isSignUp ? 'Register Workstation' : 'Sign In'}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <button 
            type="button" 
            className="icon-btn" 
            onClick={() => setIsSignUp(!isSignUp)}
            style={{ color: 'var(--color-squad)', padding: 0 }}
          >
            {isSignUp ? 'Already have an account? Log in' : 'Need an account? Sign up'}
          </button>
          <button 
            type="button" 
            className="icon-btn" 
            onClick={() => alert('Local Workstation Mode: Password reset is handled locally via Reset App Data in Settings.')}
            style={{ padding: 0 }}
          >
            Password Help
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onEnableTesterAccess}
            style={{ fontSize: '0.8rem', width: '100%' }}
          >
            🛠️ Development Prototype Direct Access
          </button>
        </div>
      </div>
    </div>
  );
}
