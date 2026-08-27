import React from 'react';
import QrDisplay from './QrDisplay';
import cegaLogo from './assets/cega-logo.png';

// Public, admin-login ke bina accessible full-screen QR display —
// reception desk/projector/tablet par permanently khula rakhne ke liye.
// URL: <site>/?display=qr
export default function QrDisplayPage() {
  return (
    <div className="page-dark">
      <header className="navbar-dark">
        <div className="brand">
          <img src={cegaLogo} alt="CEGA" className="brand-logo-img" />
          <span>CEGA — Attendance Check-In</span>
        </div>
      </header>

      <main className="page-center">
        <div className="card-dark qr-panel" style={{ width: '100%', maxWidth: 480 }}>
          <QrDisplay />
        </div>
      </main>
    </div>
  );
}
