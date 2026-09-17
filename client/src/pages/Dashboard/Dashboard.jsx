import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { normalizeRole } from '../../utils/permission.js';

// Import existing API service functions
import { getAllEmployees } from '../../services/employeeService.js';
import { getDepartments } from '../../services/departmentService.js';
import { getTodayAttendance, getAttendanceHistory } from '../../services/attendanceService.js';
import { getLeaveHistory, getAdminAllLeaves } from '../../services/leaveService.js';

// Import reusable components
import Button from '../../components/Button/Button.jsx';
import Card from '../../components/Card/Card.jsx';
import Table from '../../components/Table/Table.jsx';
import Modal from '../../components/Modal/Modal.jsx';
import Loader from '../../components/Loader/Loader.jsx';
import {
  FiUsers,
  FiClock,
  FiCalendar,
  FiLayers,
  FiDollarSign,
  FiBarChart2,
  FiSettings,
  FiUser,
  FiAlertTriangle,
  FiInfo,
  FiZap,
  FiCheckCircle,
} from 'react-icons/fi';
import './Dashboard.css';

// Helper to format time string/date cleanly (e.g. 09:08 AM)
function formatTime(dateVal) {
  if (!dateVal) return '-';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch (e) {
    return '-';
  }
}

// Helper to format working hours decimal to hours & minutes
function formatWorkingHours(hours) {
  if (hours === undefined || hours === null || hours === '') return '-';
  const num = Number(hours);
  if (isNaN(num) || num <= 0) return '-';
  const totalMins = Math.round(num * 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs} hrs ${mins} mins`;
}

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Normalized Role flags ───────────────────────────────────────────────────
  const normRole   = normalizeRole(user?.role);
  const isAdmin    = normRole === 'admin';
  const isHR       = normRole === 'hr_manager';
  const isEmployee = normRole === 'employee';
  const isAdminOrHR = isAdmin || isHR;

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');

  // Real Data States — org-wide (Admin/HR)
  const [employees, setEmployees] = useState([]);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [departmentCount, setDepartmentCount] = useState(0);
  const [adminLeaves, setAdminLeaves] = useState([]);

  // Real Data States — personal (all roles)
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [leaveHistory, setLeaveHistory] = useState([]);

  // Modal State
  const [isAnnounceModalOpen, setIsAnnounceModalOpen] = useState(false);

  // ── 1. Fetch Real Backend Data on Mount ──────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function fetchDashboardData() {
      setLoading(true);
      setApiError('');

      try {
        const promises = [
          getTodayAttendance().catch((err) => {
            console.warn('Today attendance not recorded yet:', err.message);
            return { data: null };
          }),
          getLeaveHistory().catch((err) => {
            console.warn('Leave history fetch failed:', err.message);
            return { data: [] };
          }),
        ];

        if (isAdminOrHR) {
          promises.push(
            getAllEmployees({ page: 1, limit: 10 }).catch((err) => {
              console.error('Employees fetch error:', err.message);
              return { employees: [], totalEmployees: 0 };
            }),
            getDepartments().catch((err) => {
              console.error('Departments fetch error:', err.message);
              return { data: [] };
            }),
            getAdminAllLeaves().catch((err) => {
              console.error('Admin all leaves fetch error:', err.message);
              return { data: [] };
            })
          );
        } else {
          promises.push(
            getAttendanceHistory().catch((err) => {
              console.warn('Attendance history fetch failed:', err.message);
              return { data: [] };
            }),
            getAllEmployees({ page: 1, limit: 10 }).catch((err) => {
              console.error('Co-workers fetch error:', err.message);
              return { employees: [], totalEmployees: 0 };
            })
          );
        }

        const results = await Promise.all(promises);

        if (!isMounted) return;

        // 1. Personal Attendance
        const todayAttRes = results[0];
        const rawToday = todayAttRes?.data !== undefined ? todayAttRes.data : todayAttRes;
        setTodayAttendance(rawToday || null);

        // 2. Personal Leave History
        const leaveRes = results[1];
        const rawLeaves = Array.isArray(leaveRes?.data)
          ? leaveRes.data
          : Array.isArray(leaveRes)
          ? leaveRes
          : [];
        setLeaveHistory(rawLeaves);

        if (isAdminOrHR) {
          // 3. Organization Employees
          const empRes = results[2];
          const empList = Array.isArray(empRes?.employees)
            ? empRes.employees
            : Array.isArray(empRes?.data)
            ? empRes.data
            : Array.isArray(empRes)
            ? empRes
            : [];
          setEmployees(empList);
          setEmployeeCount(empRes?.totalEmployees ?? empList.length);

          // 4. Organization Departments
          const deptRes = results[3];
          const deptList = Array.isArray(deptRes?.data)
            ? deptRes.data
            : Array.isArray(deptRes?.departments)
            ? deptRes.departments
            : Array.isArray(deptRes)
            ? deptRes
            : [];
          setDepartments(deptList);
          setDepartmentCount(deptList.length);

          // 5. Admin Organization Leaves
          const adminLeavesRes = results[4];
          const allOrgLeaves = Array.isArray(adminLeavesRes?.data)
            ? adminLeavesRes.data
            : Array.isArray(adminLeavesRes)
            ? adminLeavesRes
            : [];
          setAdminLeaves(allOrgLeaves);
        } else {
          // 3. Employee Attendance History
          const attHistRes = results[2];
          const rawHist = Array.isArray(attHistRes?.data)
            ? attHistRes.data
            : Array.isArray(attHistRes)
            ? attHistRes
            : [];
          setAttendanceHistory(rawHist);

          // 4. Employee Co-workers
          const empRes = results[3];
          const empList = Array.isArray(empRes?.employees)
            ? empRes.employees
            : Array.isArray(empRes?.data)
            ? empRes.data
            : Array.isArray(empRes)
            ? empRes
            : [];
          setEmployees(empList);
          setEmployeeCount(empRes?.totalEmployees ?? empList.length);
        }
      } catch (error) {
        console.error('Fatal Dashboard data load error:', error);
        if (isMounted) {
          setApiError(error.message || 'Failed to load live dashboard statistics.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, [isAdminOrHR]);

  // ── 2. Computed KPI Metrics ─────────────────────────────────────────────────
  const pendingLeaveCount = useMemo(() => {
    if (isAdminOrHR) {
      return adminLeaves.filter((l) => (l.status || '').toLowerCase() === 'pending').length;
    }
    return leaveHistory.filter((l) => (l.status || '').toLowerCase() === 'pending').length;
  }, [isAdminOrHR, adminLeaves, leaveHistory]);

  const employeesOnLeaveCount = useMemo(() => {
    if (!isAdminOrHR) return 0;
    return adminLeaves.filter((l) => (l.status || '').toLowerCase() === 'approved').length;
  }, [isAdminOrHR, adminLeaves]);

  // Format attendance display times
  const checkInTimeStr = formatTime(todayAttendance?.checkIn || todayAttendance?.checkInTime);
  const checkOutTimeStr = formatTime(todayAttendance?.checkOut || todayAttendance?.checkOutTime);
  const workingHoursStr = formatWorkingHours(todayAttendance?.workingHours);

  // ── 3. Quick Action Navigation Handlers ─────────────────────────────────────
  const handleNavDirectory = () => navigate('/employee');
  const handleNavAttendance = () => navigate('/attendance-dashboard');
  const handleNavLeave = () => navigate('/leave');
  const handleNavPayroll = () => navigate('/payroll');
  const handleNavReports = () => navigate('/reports');
  const handleNavSettings = () => navigate('/settings');
  const handleProfile = () => navigate('/profile');

  // ── 4. Workforce Table Column Definitions ───────────────────────────────────
  const employeeColumns = [
    {
      key: 'name',
      header: 'Employee Name',
      width: '36%',
      minWidth: '220px',
      render: (row) => {
        const empName =
          row.user_id?.name ||
          row.name ||
          (row.firstName ? `${row.firstName} ${row.lastName || ''}`.trim() : null) ||
          '-';
        const empEmail = row.user_id?.email || row.email || '-';
        const empCode = row.employee_code || '';
        const initials = empName !== '-' ? empName.slice(0, 2).toUpperCase() : 'E';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} title={`${empName} (${empEmail})`}>
            <div className="activity-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {empName} {empCode && <span style={{ color: '#4f46e5', fontWeight: 600, fontSize: '11px' }}>({empCode})</span>}
              </strong>
              <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{empEmail}</span>
            </div>
          </div>
        );
      }
    },
    {
      key: 'department',
      header: 'Department',
      width: '22%',
      minWidth: '140px',
      render: (row) => {
        const deptObj = row.department_id || row.department;
        const deptStr = typeof deptObj === 'object' && deptObj !== null
          ? (deptObj.departmentName || deptObj.name || deptObj.department_name || '-')
          : (deptObj || '-');
        return <span title={deptStr}>{deptStr}</span>;
      }
    },
    {
      key: 'role',
      header: 'Role / Designation',
      width: '24%',
      minWidth: '150px',
      render: (row) => {
        const roleStr = row.designation || row.role || row.user_id?.role || '-';
        return <span title={roleStr}>{roleStr}</span>;
      }
    },
    {
      key: 'status',
      header: 'Status',
      width: '18%',
      minWidth: '110px',
      render: (row) => {
        const status = row.employment_status || row.status || 'Active';
        const isAct = status.toLowerCase() === 'active';
        return (
          <span className={`status-badge ${isAct ? 'status-badge-active' : 'status-badge-inactive'}`}>
            ● {status}
          </span>
        );
      }
    }
  ];

  return (
    <div className="dashboard-container">

      {/* ── Dashboard Welcome Header ────────────────────────────────────────── */}
      <div className="dashboard-header">
        <div className="dashboard-header-intro">
          <h1>Welcome back, {user?.name || 'Colleague'}!</h1>
          <p>
            {isAdmin
              ? 'Administrator Overview & System Metrics'
              : isHR
              ? 'HR Management Portal & Live Workforce Indicators'
              : 'Personal Workforce Workspace & Live Status'}
          </p>
        </div>
        <div className="dashboard-actions">
          {isAdminOrHR && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNavReports}
              aria-label="View Analytics"
              className="dashboard-action-btn"
            >
              <FiBarChart2 style={{ marginRight: 6 }} /> Analytics
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={isEmployee ? handleNavLeave : handleNavDirectory}
            aria-label={isEmployee ? "Apply Leave" : "Directory Hub"}
            className="dashboard-action-btn"
          >
            {isEmployee ? (
              <>
                <FiCalendar style={{ marginRight: 6 }} /> Apply Leave
              </>
            ) : (
              <>
                <FiUsers style={{ marginRight: 6 }} /> Directory Hub
              </>
            )}
          </Button>
        </div>
      </div>

      {/* API Warning Notice if any endpoint failed */}
      {apiError && (
        <div className="system-notice-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <div className="system-notice-content">
            <p><FiAlertTriangle style={{ marginRight: 6 }} /> System Notice</p>
            <span>{apiError}</span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          1. STATISTICS SUMMARY GRID
         ══════════════════════════════════════════════════════════════════════ */}
      <div className={`stats-grid ${isEmployee ? 'stats-grid--employee' : ''}`}>

        {/* ── Admin Top Stat Card 1: Total Employees ── */}
        {isAdmin && (
          <div className="stat-card-custom">
            <div className="stat-icon-wrapper stat-icon-blue">
              <FiUsers size={22} />
            </div>
            <div className="stat-details">
              <p>Total Employees</p>
              {loading ? (
                <Loader.Spinner size="sm" />
              ) : (
                <h2>{employeeCount}</h2>
              )}
              <span className="stat-trend stat-trend-up">
                <FiCheckCircle size={12} /> {employees.length} records loaded
              </span>
            </div>
          </div>
        )}

        {/* ── HR Manager Top Stat Card 1 & Admin/Employee: Today's Attendance ── */}
        <div className="stat-card-custom">
          <div className="stat-icon-wrapper stat-icon-green">
            <FiClock size={22} />
          </div>
          <div className="stat-details">
            <p>Today's Attendance</p>
            {loading ? (
              <Loader.Spinner size="sm" />
            ) : todayAttendance ? (
              <h2 style={{ fontSize: '20px' }}>
                {todayAttendance.status || 'Present'}
              </h2>
            ) : (
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                Not recorded
              </span>
            )}
            <span className="stat-trend stat-trend-up">
              {todayAttendance ? `Check In: ${checkInTimeStr}` : 'Real-time Log'}
            </span>
          </div>
        </div>

        {/* ── Pending Leave Requests / My Pending Leaves ── */}
        <div className="stat-card-custom">
          <div className="stat-icon-wrapper stat-icon-amber">
            <FiCalendar size={22} />
          </div>
          <div className="stat-details">
            <p>{isEmployee ? 'My Pending Leaves' : 'Pending Leave Requests'}</p>
            {loading ? (
              <Loader.Spinner size="sm" />
            ) : (
              <h2>{pendingLeaveCount}</h2>
            )}
            <span className="stat-trend stat-trend-neutral">
              {isEmployee
                ? `${leaveHistory.length} total application${leaveHistory.length !== 1 ? 's' : ''}`
                : `${adminLeaves.length} total application${adminLeaves.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {/* ── Employee Stat Card 3: Team Members ── */}
        {isEmployee && (
          <div className="stat-card-custom">
            <div className="stat-icon-wrapper stat-icon-blue">
              <FiUsers size={22} />
            </div>
            <div className="stat-details">
              <p>Team Members</p>
              {loading ? (
                <Loader.Spinner size="sm" />
              ) : (
                <h2>{employeeCount}</h2>
              )}
              <span className="stat-trend stat-trend-up">
                <FiCheckCircle size={12} /> {employees.length} active colleagues
              </span>
            </div>
          </div>
        )}

        {/* ── HR Manager Card 3: Total Employees ── */}
        {isHR && (
          <div className="stat-card-custom">
            <div className="stat-icon-wrapper stat-icon-blue">
              <FiUsers size={22} />
            </div>
            <div className="stat-details">
              <p>Total Employees</p>
              {loading ? (
                <Loader.Spinner size="sm" />
              ) : (
                <h2>{employeeCount}</h2>
              )}
              <span className="stat-trend stat-trend-up">
                <FiCheckCircle size={12} /> {employees.length} records loaded
              </span>
            </div>
          </div>
        )}

        {/* ── HR Manager Card 4: Employees On Leave ── */}
        {isHR && (
          <div className="stat-card-custom">
            <div className="stat-icon-wrapper stat-icon-purple">
              <FiCalendar size={22} />
            </div>
            <div className="stat-details">
              <p>Employees On Leave</p>
              {loading ? (
                <Loader.Spinner size="sm" />
              ) : (
                <h2>{employeesOnLeaveCount}</h2>
              )}
              <span className="stat-trend stat-trend-neutral">
                Approved active leave
              </span>
            </div>
          </div>
        )}

        {/* ── Admin Card 4: Total Departments ── */}
        {isAdmin && (
          <div className="stat-card-custom">
            <div className="stat-icon-wrapper stat-icon-purple">
              <FiLayers size={22} />
            </div>
            <div className="stat-details">
              <p>Total Departments</p>
              {loading ? (
                <Loader.Spinner size="sm" />
              ) : (
                <h2>{departmentCount}</h2>
              )}
              <span className="stat-trend stat-trend-up">
                <FiCheckCircle size={12} /> {departments.length} active units
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. MAIN DASHBOARD CONTENT GRID
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="dashboard-grid">

        {/* ── Left Column ────────────────────────────────────────────────────── */}
        <div className="dashboard-main-column">

          {/* Quick Actions — filtered per role */}
          <Card
            title="Quick Actions"
            subtitle={isEmployee ? 'Fast access to your workspace' : 'Fast access to essential workforce modules'}
          >
            <div className={`quick-actions-grid ${isEmployee ? 'quick-actions-grid--employee' : ''}`}>

              {/* Directory — Admin & HR Manager */}
              {isAdminOrHR && (
                <button type="button" className="quick-action-item" onClick={handleNavDirectory} aria-label="Workforce Directory">
                  <span className="quick-action-icon">
                    <FiUsers size={20} />
                  </span>
                  <span className="quick-action-text">
                    <span className="quick-action-title">Directory</span>
                    <span className="quick-action-desc">View/manage employees</span>
                  </span>
                </button>
              )}

              {/* Attendance — all roles */}
              <button type="button" className="quick-action-item" onClick={handleNavAttendance} aria-label="Attendance Tracking">
                <span className="quick-action-icon">
                  <FiClock size={20} />
                </span>
                <span className="quick-action-text">
                  <span className="quick-action-title">Attendance</span>
                  <span className="quick-action-desc">
                    {isEmployee ? 'My check-in & history' : 'Check attendance & history'}
                  </span>
                </span>
              </button>

              {/* Leave — all roles */}
              <button type="button" className="quick-action-item" onClick={handleNavLeave} aria-label="Leave Management">
                <span className="quick-action-icon">
                  <FiCalendar size={20} />
                </span>
                <span className="quick-action-text">
                  <span className="quick-action-title">
                    {isEmployee ? 'My Leave' : 'Leave Management'}
                  </span>
                  <span className="quick-action-desc">
                    {isEmployee ? 'Apply & track leave' : 'Review/approve leave requests'}
                  </span>
                </span>
              </button>

              {/* Payroll — Admin & HR Manager ONLY — Employee must NOT see this */}
              {isAdminOrHR && (
                <button type="button" className="quick-action-item" onClick={handleNavPayroll} aria-label="Payroll Management">
                  <span className="quick-action-icon">
                    <FiDollarSign size={20} />
                  </span>
                  <span className="quick-action-text">
                    <span className="quick-action-title">Payroll</span>
                    <span className="quick-action-desc">View/manage salary info</span>
                  </span>
                </button>
              )}

              {/* Reports — Admin & HR Manager */}
              {isAdminOrHR && (
                <button type="button" className="quick-action-item" onClick={handleNavReports} aria-label="HR Analytics and Reports">
                  <span className="quick-action-icon">
                    <FiBarChart2 size={20} />
                  </span>
                  <span className="quick-action-text">
                    <span className="quick-action-title">Reports</span>
                    <span className="quick-action-desc">HR analytics/reports</span>
                  </span>
                </button>
              )}

              {/* Settings / Profile — all roles */}
              <button type="button" className="quick-action-item" onClick={isEmployee ? handleProfile : handleNavSettings} aria-label={isEmployee ? "My Profile" : "Account Settings"}>
                <span className="quick-action-icon">
                  {isEmployee ? <FiUser size={20} /> : <FiSettings size={20} />}
                </span>
                <span className="quick-action-text">
                  <span className="quick-action-title">
                    {isEmployee ? 'My Profile' : 'Settings'}
                  </span>
                  <span className="quick-action-desc">{isEmployee ? 'Account details' : 'Account settings'}</span>
                </span>
              </button>

            </div>
          </Card>

          {/* Workforce Directory Table — Admin & HR Manager */}
          {isAdminOrHR && (
            <Card
              title="Workforce Directory"
              subtitle="Live employee data from backend API"
              action={
                <Button variant="outline" size="sm" onClick={handleNavDirectory} aria-label="Manage Directory">
                  Manage Directory
                </Button>
              }
            >
              <Table
                columns={employeeColumns}
                data={employees}
                loading={loading}
                emptyText="No employee records found in system database."
                maxHeight="380px"
              />
            </Card>
          )}

          {/* My Team / Co-Workers Table — Employee only */}
          {isEmployee && (
            <Card
              title="My Team / Co-Workers"
              subtitle="Colleagues in your organization"
            >
              <Table
                columns={employeeColumns}
                data={employees}
                loading={loading}
                emptyText="No teammates found in your organization."
                maxHeight="350px"
              />
            </Card>
          )}

          {/* My Attendance History — Employee only */}
          {isEmployee && (
            <Card title="My Attendance History" subtitle="Your recent attendance records">
              {loading ? (
                <Loader.Skeleton rows={3} />
              ) : attendanceHistory.length === 0 ? (
                <div className="hrms-table-empty" style={{ padding: '24px 16px' }}>
                  <FiClock size={32} color="#94a3b8" />
                  <span className="hrms-table-empty-text" style={{ fontWeight: 600, color: '#475569' }}>
                    No attendance history found.
                  </span>
                </div>
              ) : (
                <div className="activity-list">
                  {attendanceHistory.slice(0, 5).map((item, idx) => {
                    const dateStr = item.date
                      ? new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '-';
                    return (
                      <div key={item._id || idx} className="activity-item">
                        <div className="activity-avatar" style={{ background: '#ecfdf5', color: '#047857' }}>
                          <FiCalendar size={16} />
                        </div>
                        <div className="activity-details">
                          <strong>{dateStr}</strong>
                          <p>
                            In: {formatTime(item.checkIn || item.checkInTime)} &nbsp;|&nbsp;
                            Out: {formatTime(item.checkOut || item.checkOutTime)}
                          </p>
                        </div>
                        <span className="activity-time">
                          <span className={`status-badge ${item.status?.toLowerCase() === 'present' ? 'status-badge-active' : 'status-badge-leave'}`}>
                            {item.status || 'Present'}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* ── Right Column ───────────────────────────────────────────────────── */}
        <div className="dashboard-side-column">

          {/* Today's Attendance Card — all roles */}
          <Card title="Today's Attendance" subtitle="Real-time check-in status">
            {loading ? (
              <Loader.Skeleton rows={3} />
            ) : !todayAttendance ? (
              <div className="hrms-table-empty" style={{ padding: '24px 16px' }}>
                <FiClock size={32} color="#94a3b8" />
                <span className="hrms-table-empty-text" style={{ fontWeight: 600, color: '#475569' }}>
                  No attendance recorded today
                </span>
              </div>
            ) : (
              <div className="activity-list">
                <div className="activity-item">
                  <div className="activity-details">
                    <strong>Check In Time</strong>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                      {checkInTimeStr}
                    </p>
                  </div>
                </div>

                <div className="activity-item">
                  <div className="activity-details">
                    <strong>Check Out Time</strong>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                      {checkOutTimeStr}
                    </p>
                  </div>
                </div>

                <div className="activity-item">
                  <div className="activity-details">
                    <strong>Status</strong>
                    <p>
                      <span className="status-badge status-badge-active">
                        ● {todayAttendance.status || 'Present'}
                      </span>
                    </p>
                  </div>
                </div>

                {workingHoursStr !== '-' && (
                  <div className="activity-item">
                    <div className="activity-details">
                      <strong>Working Hours</strong>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                        {workingHoursStr}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Leave Applications Card */}
          <Card
            title={isEmployee ? 'My Leave Applications' : 'Leave Applications'}
            subtitle={isEmployee ? 'Your personal leave history' : 'Leave applications for HR review'}
          >
            {loading ? (
              <Loader.Skeleton rows={3} />
            ) : (isEmployee ? leaveHistory : adminLeaves).length === 0 ? (
              <div className="hrms-table-empty" style={{ padding: '20px' }}>
                <FiCalendar size={28} color="#94a3b8" />
                <span className="hrms-table-empty-text">No leave records found.</span>
              </div>
            ) : (
              <div className="activity-list">
                {(isEmployee ? leaveHistory : adminLeaves).slice(0, 4).map((item, idx) => {
                  const empName = item.employee?.name || item.employeeName || (isEmployee ? 'My Leave' : 'Employee');
                  return (
                    <div key={item._id || item.id || idx} className="activity-item">
                      <div className="activity-avatar">
                        {(item.leaveType || item.type || 'L').charAt(0).toUpperCase()}
                      </div>
                      <div className="activity-details">
                        <strong>{item.leaveType || item.type || 'Leave Request'}</strong>
                        <p>
                          {isAdminOrHR && <span style={{ fontWeight: 600, color: '#3b82f6' }}>{empName} — </span>}
                          {item.reason || item.description || `Status: ${item.status || 'Pending'}`}
                        </p>
                      </div>
                      <span className="activity-time">
                        <span className={`status-badge ${item.status?.toLowerCase() === 'approved' ? 'status-badge-active' : 'status-badge-leave'}`}>
                          {item.status || 'Pending'}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Info Modal */}
      <Modal
        isOpen={isAnnounceModalOpen}
        onClose={() => setIsAnnounceModalOpen(false)}
        title="System Information"
        size="md"
        footer={
          <Button variant="primary" size="sm" onClick={() => setIsAnnounceModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div>
          <h4>HRMS Backend Integration</h4>
          <p>This dashboard displays real-time backend API data.</p>
        </div>
      </Modal>
    </div>
  );
}

export default Dashboard;