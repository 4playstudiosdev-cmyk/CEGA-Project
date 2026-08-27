import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { getCourseBadge } from './courseBadge';
import { compareRollNumbers } from './rollNumberSort';
import QrDisplay from './QrDisplay';
import cegaLogo from './assets/cega-logo.png';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://attendance-portal-backend-production.up.railway.app';
const DEVICE_ID_KEY = 'cega_attendance_device_id';

// Har device (browser) ko ek permanent random ID deta hai — QR bar-bar
// scan karke alag-alag students ke naam se attendance marna rokne ke
// liye backend isi ID se check karta hai (localStorage me save rehti
// hai, browser data clear na ho to hamesha wahi ID milegi).
function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

export default function AttendancePortal({ onOpenAdmin, qrToken }) {
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [courses, setCourses] = useState([]);
  const [courseStudents, setCourseStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    async function fetchCourses() {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('id, code, name, students_table');

        if (error) {
          console.error('Supabase fetch error:', error);
        } else if (data && data.length > 0) {
          setCourses(data);
        }
      } catch (err) {
        console.error('Fetch exception:', err);
      }
    }
    fetchCourses();
  }, []);

  // Course badalte hi us course ke registered students (roll_number +
  // name) load karo — dropdown isi list se banega.
  useEffect(() => {
    setStudentId('');
    setStudentName('');
    setCourseStudents([]);

    const course = courses.find((c) => c.id === selectedCourse);
    if (!course?.students_table) return;

    let cancelled = false;
    setStudentsLoading(true);

    supabase
      .from(course.students_table)
      .select('roll_number, name')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Students fetch error:', error);
          return;
        }
        const sorted = (data || []).slice().sort((a, b) => compareRollNumbers(a.roll_number, b.roll_number));
        setCourseStudents(sorted);
      })
      .finally(() => {
        if (!cancelled) setStudentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCourse, courses]);

  const selectedStudent = courseStudents.find((s) => s.roll_number === studentId);
  // Naam sirf tab editable hai jab is roll number ka koi canonical naam
  // record me abhi tak set nahi hua (pehli attendance hi naam set karti
  // hai) — warna dropdown se aaya naam fixed rehta hai, edit nahi hota.
  const nameIsLocked = Boolean(selectedStudent?.name);

  const handleStudentIdChange = (e) => {
    const rollNumber = e.target.value;
    setStudentId(rollNumber);
    const student = courseStudents.find((s) => s.roll_number === rollNumber);
    setStudentName(student?.name || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!qrToken) {
      setStatus({ type: 'error', message: "Please scan today's QR code to mark attendance." });
      return;
    }

    if (!selectedCourse || !studentId || !studentName.trim()) {
      setStatus({ type: 'error', message: 'Please fill all fields.' });
      return;
    }

    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId.trim(),
          student_name: studentName.trim(),
          course_id: selectedCourse,
          token: qrToken,
          device_id: getDeviceId(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const serverDetail = typeof errorData.detail === 'string'
          ? errorData.detail
          : JSON.stringify(errorData.detail) || 'Server error occurred.';
        // 400-series = expected/validated errors (already friendly text
        // from backend, e.g. "This Student ID is not registered...") —
        // show as-is. 500-series = genuine server error, keep technical prefix.
        throw new Error(response.status < 500 ? serverDetail : `Server Error (${response.status}): ${serverDetail}`);
      }

      const resultData = await response.json().catch(() => ({}));

      setStatus({
        type: 'success',
        message: resultData.warning
          ? `Attendance marked successfully! ⚠ ${resultData.warning}`
          : 'Attendance marked successfully!',
      });
      setStudentId('');
      setStudentName('');
      setSelectedCourse('');
    } catch (err) {
      console.error('Submission error:', err);
      setStatus({ type: 'error', message: err.message || 'Network error / Server unreachable.' });
    } finally {
      setLoading(false);
    }
  };

  const selectedCourseObj = courses.find((c) => c.id === selectedCourse);
  const selectedBadge = selectedCourseObj ? getCourseBadge(selectedCourseObj.name) : null;
  const canSubmit = Boolean(selectedCourse) && studentId.trim() !== '' && studentName.trim() !== '' && !loading;

  return (
    <div className="page-dark">
      <header className="navbar-dark">
        <div className="brand">
          <img src={cegaLogo} alt="CEGA" className="brand-logo-img" />
          <span>CEGA</span>
        </div>
        <button type="button" className="btn btn-outline-dark btn-sm" onClick={onOpenAdmin}>
          🔒 Admin Login
        </button>
      </header>

      <main className="page-center">
        <div className="card-dark form-card">
          <div className="form-header">
            <h1 className="h1">Student<br />Attendance</h1>
            <p className="muted-mono">CEGA Official Verification Portal</p>
          </div>

          {status.message && (
            <div className={status.type === 'success' ? 'alert alert-success' : 'alert alert-error'}>
              {status.message}
            </div>
          )}

          {!qrToken ? (
            <div className="qr-blocked-state">
              <p className="h2" style={{ fontSize: '18px', marginBottom: 'var(--space-4)' }}>
                Scan Today's QR Code
              </p>
              <QrDisplay size={260} hint={false} />
            </div>
          ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="field-group">
              <label className="field-label" htmlFor="course-select">Select Course</label>
              <div
                className="select-accent-wrap"
                style={selectedBadge ? { '--accent': selectedBadge.text } : undefined}
              >
                <select
                  id="course-select"
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="input-dark select-dark"
                  required
                >
                  <option value="">Select active module...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedCourseObj && (
                <span
                  className="course-pill"
                  style={{ color: selectedBadge.text, background: selectedBadge.bg, alignSelf: 'flex-start' }}
                >
                  {selectedCourseObj.code}
                </span>
              )}
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="student-id">Student ID</label>
              <select
                id="student-id"
                value={studentId}
                onChange={handleStudentIdChange}
                className="input-dark select-dark"
                disabled={!selectedCourse || studentsLoading}
                required
              >
                <option value="">
                  {!selectedCourse
                    ? 'Select a course first...'
                    : studentsLoading
                    ? 'Loading students...'
                    : 'Select your Student ID...'}
                </option>
                {courseStudents.map((s) => (
                  <option key={s.roll_number} value={s.roll_number}>
                    {s.roll_number}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="student-name">Full Name</label>
              <input
                id="student-name"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder={nameIsLocked ? '' : 'First time? Type your name here'}
                className="input-dark"
                readOnly={nameIsLocked}
                required
              />
            </div>

            <button type="submit" disabled={!canSubmit} className="btn btn-primary btn-block btn-lg">
              {loading ? 'Processing…' : (
                <>
                  <span>👤✓</span>
                  Mark Attendance
                </>
              )}
            </button>
          </form>
          )}
        </div>
      </main>
    </div>
  );
}
