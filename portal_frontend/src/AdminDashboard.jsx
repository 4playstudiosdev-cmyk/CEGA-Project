import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { getCourseBadge } from './courseBadge';
import QrDisplay from './QrDisplay';
import { compareRollNumbers } from './rollNumberSort';
import cegaLogo from './assets/cega-logo.png';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://attendance-portal-backend-production.up.railway.app';

export default function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('attendance');
  const [attendance, setAttendance] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [markingRollNumber, setMarkingRollNumber] = useState(null);

  // Registration Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({
    roll_number: '',
    name: '',
    course_id: ''
  });

  useEffect(() => {
    fetchData();

    // Realtime Auto-Fetch on New Attendance Insert
    const attendanceSub = supabase
      .channel('public:attendance_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_logs' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceSub);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Courses
      const { data: coursesData } = await supabase.from('courses').select('*');
      if (coursesData) {
        setCourses(coursesData);
        if (coursesData.length > 0) {
          setNewStudent(prev => ({ ...prev, course_id: coursesData[0].id }));
        }
      }
      const coursesList = coursesData || [];

      // 2. Fetch Attendance Records
      const { data: attendanceData, error: attError } = await supabase
        .from('attendance_logs')
        .select(`
          id,
          student_id,
          student_name,
          captured_at,
          course_id,
          courses ( code, name )
        `)
        .order('captured_at', { ascending: false });

      if (attError) console.warn('Attendance fetch warning:', attError);
      setAttendance(attendanceData || []);

      // 3. Fetch Registered Students — har course ki apni alag table hai
      // (students_unity, students_unreal, ...), courses.students_table
      // batata hai kaunsi. Sabko fetch karke ek list me merge karte hain,
      // course_id/courses ko locally attach kar dete hain (JSX ka baaki
      // hissa ek hi flat list expect karta hai).
      const coursesWithTable = coursesList.filter(c => c.students_table);
      const perCourseResults = await Promise.all(
        coursesWithTable.map(c =>
          supabase.from(c.students_table).select('id, roll_number, name')
        )
      );

      let allStudents = [];
      perCourseResults.forEach((res, i) => {
        const course = coursesWithTable[i];
        if (res.error) {
          console.warn(`Students fetch warning (${course.students_table}):`, res.error);
          return;
        }
        const tagged = (res.data || []).map(s => ({
          ...s,
          course_id: course.id,
          courses: { code: course.code, name: course.name },
        }));
        allStudents = allStudents.concat(tagged);
      });

      // DB-level string-sort galat order deta (UNREAL-10 UNREAL-2 se
      // pehle) — numeric-aware compareRollNumbers se client-side sort.
      allStudents.sort((a, b) => compareRollNumbers(a.roll_number, b.roll_number));
      setStudents(allStudents);

    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Manual Student Registration Handler — jo course select hua uski
  // students_table me insert karte hain (har course ki apni alag table).
  const handleRegisterStudent = async (e) => {
    e.preventDefault();
    try {
      const courseId = newStudent.course_id || (courses[0]?.id || null);
      const course = courses.find(c => c.id === courseId);
      if (!course?.students_table) {
        throw new Error('Students table is not configured for this course.');
      }

      const { data, error } = await supabase
        .from(course.students_table)
        .insert([
          {
            roll_number: newStudent.roll_number.trim(),
            name: newStudent.name.trim(),
          }
        ])
        .select('id, roll_number, name');

      if (error) throw error;

      if (data) {
        const tagged = data.map(s => ({
          ...s,
          course_id: course.id,
          courses: { code: course.code, name: course.name },
        }));
        setStudents(prev =>
          [...prev, ...tagged].sort((a, b) => compareRollNumbers(a.roll_number, b.roll_number))
        );
      }
      setIsModalOpen(false);
      setNewStudent({
        roll_number: '',
        name: '',
        course_id: courses[0]?.id || ''
      });
    } catch (err) {
      alert('Failed to register student: ' + err.message);
    }
  };

  // Filter calculations (course + search, dono ek sath apply hote hain)
  const search = searchQuery.trim().toLowerCase();

  const filteredAttendance = attendance
    .filter(item => selectedCourse === 'ALL' || item.course_id === selectedCourse)
    .filter(item =>
      !search ||
      (item.student_name || '').toLowerCase().includes(search) ||
      (item.student_id || '').toLowerCase().includes(search)
    );

  const filteredStudents = students
    .filter(item => selectedCourse === 'ALL' || item.course_id === selectedCourse)
    .filter(item =>
      !search ||
      (item.name || '').toLowerCase().includes(search) ||
      (item.roll_number || '').toLowerCase().includes(search)
    );

  // Export Function — ab poora "Batch Attendance Register" format backend
  // se generate hota hai (har course ki sheet, P/A matrix, Hours/%).
  // Dashboard ka course-filter isko affect nahi karta — ye hamesha
  // complete official register export karta hai.
  const exportToExcel = async () => {
    setExporting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/export/attendance-report`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Export failed.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Batch_Attendance_Register_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Manual Attendance — admin seedha "Registered Students" list se ek
  // click me student ko present mark kar sakta hai (QR/photo nahi
  // chahiye). Realtime subscription (upar) khud Attendance Log tab
  // refresh kar degi jab naya record insert hoga.
  const handleMarkAttendance = async (stu) => {
    setMarkingRollNumber(stu.roll_number);
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/attendance/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: stu.course_id, roll_number: stu.roll_number }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Could not mark attendance.');
      }
      alert(data.message);
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setMarkingRollNumber(null);
    }
  };

  return (
    <div className="admin-shell">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={cegaLogo} alt="CEGA" className="brand-logo-img" />
          <h2 className="sidebar-title">CEGA Admin</h2>
        </div>

        <nav className="sidebar-nav">
          <button
            onClick={() => setActiveTab('attendance')}
            className={activeTab === 'attendance' ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
          >
            📊 Attendance Log
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={activeTab === 'students' ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
          >
            🎓 Registered Students
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={activeTab === 'qr' ? 'sidebar-nav-item active' : 'sidebar-nav-item'}
          >
            📱 Today's QR
          </button>
        </nav>

        <button onClick={onLogout} className="btn btn-ghost-red">
          🚪 Logout
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <div>
            <h1 className="h1">
              {activeTab === 'attendance' && 'Student Attendance Records'}
              {activeTab === 'students' && 'Registered Students Directory'}
              {activeTab === 'qr' && "Today's QR Code"}
            </h1>
            <p className="text-muted" style={{ marginTop: 'var(--space-1)' }}>
              CEGA Educational Administration Panel
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {activeTab === 'attendance' && (
              <>
                <button onClick={fetchData} disabled={loading} className="btn btn-outline-blue">
                  {loading ? '⏳ Refreshing...' : '🔄 Refresh'}
                </button>
                <button onClick={exportToExcel} disabled={exporting} className="btn btn-outline-blue">
                  {exporting ? '⏳ Generating...' : '📥 Export to Excel'}
                </button>
              </>
            )}
            {activeTab === 'students' && (
              <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
                ➕ Register New Student
              </button>
            )}
          </div>
        </header>

        {activeTab === 'qr' ? (
          <>
            <div className="card-dark qr-panel">
              <QrDisplay />
            </div>
            <p className="text-muted" style={{ marginTop: 'var(--space-4)', fontSize: 13 }}>
              💡 Standalone full-screen link for reception/projector (no admin login needed):{' '}
              <code style={{ fontFamily: 'var(--font-mono)' }}>{window.location.origin}/?display=qr</code>
            </p>
          </>
        ) : (
          <>
            {/* Filter Bar */}
            <div className="card-light filter-card">
              <label className="field-label field-label-light">Filter by Course:</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="input-light select-light"
              >
                <option value="ALL">All Modules &amp; Courses</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search by name or ID..."
                className="input-light search-input"
              />
              <span className="pill pill-blue-tint count-pill">
                {activeTab === 'attendance' ? `${filteredAttendance.length} Records Found` : `${filteredStudents.length} Students Registered`}
              </span>
            </div>

            {/* Table Card */}
            <div className="card-light table-card">
              {loading ? (
                <div className="state-msg">
                  <div className="spinner" />
                  Loading data from server...
                </div>
              ) : activeTab === 'attendance' ? (
                /* Attendance Log Table */
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Name</th>
                        <th>Course</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendance.length > 0 ? (
                        filteredAttendance.map((item) => {
                          const badge = getCourseBadge(item.courses?.name || item.courses?.code || '');
                          return (
                            <tr key={item.id}>
                              <td className="td-bold">{item.student_id}</td>
                              <td>{item.student_name}</td>
                              <td>
                                <span className="course-pill" style={{ color: badge.text, background: badge.bg }}>
                                  {item.courses?.code || 'N/A'}
                                </span>
                              </td>
                              <td className="mono-muted">
                                {new Date(item.captured_at).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="4" className="state-msg">No attendance logs found for this filter.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Registered Students Table */
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Full Name</th>
                        <th>Assigned Course</th>
                        <th>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length > 0 ? (
                        filteredStudents.map((stu) => {
                          const badge = getCourseBadge(stu.courses?.name || stu.courses?.code || '');
                          const isMarking = markingRollNumber === stu.roll_number;
                          return (
                            <tr key={stu.id || stu.roll_number}>
                              <td className="td-bold">{stu.roll_number}</td>
                              <td>{stu.name || <span className="text-muted">— (waiting for first scan)</span>}</td>
                              <td>
                                <span className="course-pill" style={{ color: badge.text, background: badge.bg }}>
                                  {stu.courses?.code || 'N/A'} - {stu.courses?.name || ''}
                                </span>
                              </td>
                              <td>
                                <button
                                  onClick={() => handleMarkAttendance(stu)}
                                  disabled={isMarking || !stu.name}
                                  title={!stu.name ? 'Name is not set yet — the student must scan once themselves first' : ''}
                                  className="btn btn-outline-blue"
                                  style={{ fontSize: 12, padding: '6px 12px' }}
                                >
                                  {isMarking ? '...' : '✓ Mark Present'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="4" className="state-msg">No registered students found for this filter.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Student Registration Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="card-light modal-card">
            <h2 className="h2" style={{ marginBottom: 'var(--space-6)' }}>Register New Student</h2>
            <form onSubmit={handleRegisterStudent}>
              <div className="field-group">
                <label className="field-label field-label-light">Student ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UNITY-53"
                  value={newStudent.roll_number}
                  onChange={(e) => setNewStudent({ ...newStudent, roll_number: e.target.value })}
                  className="input-light"
                />
              </div>

              <div className="field-group">
                <label className="field-label field-label-light">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Muhammad Ali"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  className="input-light"
                />
              </div>

              <div className="field-group">
                <label className="field-label field-label-light">Course</label>
                <select
                  value={newStudent.course_id}
                  onChange={(e) => setNewStudent({ ...newStudent, course_id: e.target.value })}
                  className="input-light select-light"
                  style={{ width: '100%' }}
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary-light">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
