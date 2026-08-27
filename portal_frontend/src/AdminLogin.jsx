import React, { useState } from 'react';
import cegaLogo from './assets/cega-logo.png';

export default function AdminLogin({ onBackToStudent, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    setTimeout(() => {
      if (email === 'pirzadafawadinc@gmail.com' && password === '@pirzadacega@123') {
        if (onLoginSuccess) onLoginSuccess();
      } else {
        setError('Invalid credentials.');
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="page-dark">
      <header className="navbar-dark">
        <div className="brand">
          <img src={cegaLogo} alt="CEGA" className="brand-logo-img" />
          <span>CEGA</span>
        </div>
      </header>

      <main className="page-center">
        <div className="card-dark form-card">
          <h2 className="h2 text-center">Admin Portal</h2>
          <p className="muted-mono text-center" style={{ marginBottom: 'var(--space-6)' }}>
            Secure Administrator Access
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="field-group">
              <label className="field-label" htmlFor="admin-email">Username or Email</label>
              <div className="input-icon-wrap">
                <span className="input-icon">👤</span>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@cega.edu"
                  className="input-dark"
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="admin-password">Password</label>
              <div className="input-icon-wrap">
                <span className="input-icon">🔒</span>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-dark"
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-block btn-lg">
              {loading ? 'Authenticating…' : 'Login as Admin →'}
            </button>
          </form>

          <div className="form-footer-link">
            <a href="#forgot" className="link-blue">Forgot Password?</a>
          </div>

          <div className="divider" />

          <div className="text-center">
            <button type="button" onClick={onBackToStudent} className="link-muted-btn">
              ← Back to Student Portal
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
