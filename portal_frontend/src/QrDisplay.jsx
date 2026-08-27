import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://attendance-portal-backend-production.up.railway.app';

// Shared "Today's QR" content — Admin Dashboard ke QR tab, standalone public
// /?display=qr page, aur home page (token missing) ka blocked-state, teeno
// isi ek component ko reuse karte hain. Sirf public GET /api/v1/qr/today
// call karta hai — koi admin-only data (attendance records, students list)
// yahan touch nahi hota. Outer container caller khud provide karta hai
// (context ke hisaab se card/padding alag ho sakta hai), is liye ye
// component sirf apna content return karta hai, wrapper card nahi.
export default function QrDisplay({ size = 260, hint = true }) {
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchQr = async () => {
      setQrError('');
      try {
        const response = await fetch(`${BACKEND_URL}/api/v1/qr/today`);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Failed to load QR code.');
        }
        const data = await response.json();
        if (!cancelled) setQrData(data);
      } catch (err) {
        if (!cancelled) setQrError(err.message || 'Failed to load QR code.');
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    };

    setQrLoading(true);
    fetchQr();
    // Har 60s me re-check — raat 12 baje (naya din) naya QR khud-ba-khud
    // is screen par bhi bina manual refresh ke aa jayega.
    const interval = setInterval(fetchQr, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (qrLoading) {
    return (
      <div className="state-msg">
        <div className="spinner" />
        Generating QR code...
      </div>
    );
  }

  if (qrError) {
    return <div className="alert alert-error" style={{ maxWidth: 360 }}>{qrError}</div>;
  }

  if (!qrData) return null;

  return (
    <>
      <div className="qr-frame">
        <span className="qr-corner-l" />
        <span className="qr-corner-r" />
        <QRCodeSVG
          value={`${window.location.origin}/?token=${qrData.token}`}
          size={size}
          bgColor="#ffffff"
          fgColor="#0B0F14"
          level="M"
        />
      </div>
      {hint && (
        <p className="text-body" style={{ color: '#9CA3AF', marginTop: 'var(--space-4)', maxWidth: 360 }}>
          Display this QR code on the screen/projector — students will scan it
          with their phone and land straight on the attendance form.
          It will automatically expire and refresh at midnight.
        </p>
      )}
    </>
  );
}
