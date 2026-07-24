import React from 'react';
import { clearAllLocalApplicationData } from '../services/storage';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Inside Edge ErrorBoundary caught error]:', error, errorInfo);
  }

  handleResetData = () => {
    clearAllLocalApplicationData();
    window.location.reload();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          padding: '24px',
          fontFamily: 'sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '540px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h1 style={{ color: '#ef4444', margin: '0 0 12px 0', fontSize: '1.8rem' }}>
              Application Recovery Mode
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '20px', lineHeight: '1.5' }}>
              Inside Edge encountered an unexpected runtime error. Your local data has been preserved, but you can choose to reload or perform a clean local data reset.
            </p>

            <div style={{
              backgroundColor: '#090d16',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              color: '#f87171',
              textAlign: 'left',
              marginBottom: '24px',
              fontFamily: 'monospace',
              maxHeight: '120px',
              overflowY: 'auto'
            }}>
              {this.state.error?.toString() || 'Unknown error'}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                🔄 Reload Application
              </button>
              <button
                onClick={this.handleResetData}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ⚠️ Reset Local App Data
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
