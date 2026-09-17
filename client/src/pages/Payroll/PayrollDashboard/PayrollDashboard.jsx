import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { getAllPayrolls, generatePayroll, markPayrollAsPaid, getAllSalaries } from '../../../services/payrollService';
import { getAllEmployees } from '../../../services/employeeService';
import SummaryCard from '../../../components/Payroll/SummaryCard';
import PayrollTable from '../../../components/Payroll/PayrollTable';
import LoadingState from '../../../components/Payroll/LoadingState';
import ErrorState from '../../../components/Payroll/ErrorState';
import EmptyState from '../../../components/Payroll/EmptyState';
import formatCurrency, { formatCompactCurrency } from '../../../utils/formatCurrency';
import { MONTH_NAMES, YEARS_LIST, getEmployeeOptionLabel } from '../../../utils/payrollConstants';
import { normalizeRole } from '../../../utils/permission';
import { FiBarChart2, FiClock, FiCheckCircle, FiDollarSign, FiX, FiAlertTriangle } from 'react-icons/fi';
import '../../../components/Payroll/payrollTheme.css';
import './PayrollDashboard.css';

export default function PayrollDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = ['admin', 'super_admin'].includes(normalizeRole(user?.role));
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Payroll Generation Modal State
  const [showGenModal, setShowGenModal] = useState(false);
  const [genData, setGenData] = useState({
    employeeId: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    daysPresent: 22,
    totalWorkingDays: 22,
    bonus: 0,
  });
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [genSuccess, setGenSuccess] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const [payrollsRes, empsRes, salariesRes] = await Promise.all([
        getAllPayrolls(),
        getAllEmployees({ status: "Active" }),
        getAllSalaries(),
      ]);

      if (payrollsRes?.success) setPayrolls(payrollsRes.data || []);
      if (empsRes?.success) {
        const rawEmps = empsRes.data || empsRes.employees || [];
        setEmployees(rawEmps.filter((e) => e.employment_status !== "Inactive"));
      }
      if (salariesRes?.success) setSalaries(salariesRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load payroll dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleMarkPaid = async (id) => {
    try {
      const res = await markPayrollAsPaid(id);
      if (res?.success) {
        setPayrolls((prev) =>
          prev.map((p) => (p._id === id ? { ...p, status: 'Paid', paymentDate: new Date() } : p))
        );
        showToast('success', 'Payroll marked as paid successfully.');
      }
    } catch (err) {
      showToast('error', err.message || 'Failed to mark payroll as paid');
    }
  };

  // Check if chosen employee already has salary structure
  const selectedEmpSalary = salaries.find((s) => {
    const sEmpId = s.employeeId?._id || s.employeeId;
    return sEmpId === genData.employeeId;
  });

  const handleGenSubmit = async (e) => {
    e.preventDefault();
    setGenError('');
    setGenSuccess('');

    if (!genData.employeeId) {
      setGenError('Please select an employee.');
      return;
    }

    if (!selectedEmpSalary) {
      setGenError('This employee does not have an active salary structure. Please create one under Salary Management first.');
      return;
    }

    // Client-side duplicate check before API call
    const monthNum = parseInt(genData.month, 10);
    const yearNum = parseInt(genData.year, 10);
    const exists = payrolls.some((p) => {
      const pEmpId = p.employeeId?._id || p.employeeId;
      return pEmpId === genData.employeeId && Number(p.month) === monthNum && Number(p.year) === yearNum;
    });

    if (exists) {
      const monthLabel = MONTH_NAMES[monthNum - 1]?.label || monthNum;
      setGenError(`Payroll already exists for this employee for ${monthLabel} ${yearNum}.`);
      return;
    }

    setGenerating(true);
    try {
      const res = await generatePayroll({
        ...genData,
        month: monthNum,
        year: yearNum,
        daysPresent: Number(genData.daysPresent),
        totalWorkingDays: Number(genData.totalWorkingDays),
        bonus: Number(genData.bonus || 0),
      });

      if (res?.success) {
        setGenSuccess('Payroll generated successfully!');
        showToast('success', 'Payroll generated successfully!');
        setPayrolls((prev) => [res.data, ...prev]);
        setTimeout(() => {
          setShowGenModal(false);
          setGenSuccess('');
        }, 1200);
      }
    } catch (err) {
      const errMsg = err.message || 'Failed to generate payroll.';
      setGenError(errMsg);
      showToast('error', errMsg);
    } finally {
      setGenerating(false);
    }
  };

  // Metrics calculation
  const totalDisbursed = payrolls
    .filter((p) => p.status === 'Paid')
    .reduce((sum, p) => sum + (p.netSalary || 0), 0);

  const pendingDisbursement = payrolls
    .filter((p) => p.status === 'Generated' || p.status === 'Pending')
    .reduce((sum, p) => sum + (p.netSalary || 0), 0);

  const totalEmployeesWithSalary = salaries.length;
  const hasActiveSalaries = salaries.length > 0;

  if (loading) return <LoadingState message="Loading Payroll Dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={fetchDashboardData} />;

  return (
    <div className="payroll-container">
      {/* Header Banner */}
      <div className="payroll-header">
        <div>
          <h1 className="payroll-header-title">Payroll Management</h1>
          <p className="payroll-header-subtitle">
            Enterprise compensation processing, automated salary calculation & payslip distribution.
          </p>
        </div>
        <div className="payroll-header-actions">
          {isAdmin && (
            <button
              className="pr-btn pr-btn-primary"
              onClick={() => {
                setGenError('');
                setGenSuccess('');
                setShowGenModal(true);
              }}
            >
              + Generate Payroll
            </button>
          )}
          <button
            className="pr-btn pr-btn-secondary"
            onClick={() => navigate('/payroll/salaries')}
          >
            Salary Structures
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="payroll-summary-grid">
        <SummaryCard
          title="Total Paid Out"
          value={formatCompactCurrency(totalDisbursed)}
          subtitle={`${payrolls.filter((p) => p.status === 'Paid').length} processed disbursements`}
          icon={<FiCheckCircle />}
          variant="success"
        />
        <SummaryCard
          title="Pending Approval / Pay"
          value={formatCompactCurrency(pendingDisbursement)}
          subtitle={`${payrolls.filter((p) => p.status === 'Generated' || p.status === 'Pending').length} runs awaiting payment`}
          icon={<FiClock />}
          variant="warning"
        />
        <SummaryCard
          title="Salary Structures"
          value={totalEmployeesWithSalary}
          subtitle="Employees with configured salary"
          icon={<FiDollarSign />}
          variant="info"
        />
        <SummaryCard
          title="Total Payroll Runs"
          value={payrolls.length}
          subtitle="All-time generated compensation runs"
          icon={<FiBarChart2 />}
          variant="default"
        />
      </div>

      {/* Recent Payroll Runs Section */}
      <div className="payroll-section">
        <div className="payroll-section-header">
          <div>
            <h2 className="payroll-section-title">Recent Payroll Runs</h2>
            <p className="payroll-section-subtitle">Latest processed compensation cycles</p>
          </div>
          <button className="pr-btn pr-btn-secondary pr-btn-sm" onClick={() => navigate('/payroll/history')}>
            View Full History →
          </button>
        </div>

        {payrolls.length === 0 ? (
          <EmptyState
            title="No Payroll Runs Found"
            message="No payroll has been processed yet. Click 'Generate Payroll' to calculate employee compensation for this period."
            actionText={isAdmin ? "+ Generate First Payroll" : undefined}
            onAction={isAdmin ? () => setShowGenModal(true) : undefined}
          />
        ) : (
          <PayrollTable
            payrolls={payrolls.slice(0, 5)}
            onView={(id) => navigate(`/payroll/${id}`)}
            onMarkPaid={isAdmin ? handleMarkPaid : undefined}
          />
        )}
      </div>

      {/* Generate Payroll Modal */}
      {showGenModal && (
        <div className="pr-modal-overlay">
          <div className="pr-modal-content">
            <div className="modal-header">
              <h3>Generate Monthly Payroll</h3>
              <button
                className="close-btn"
                onClick={() => setShowGenModal(false)}
                aria-label="Close modal"
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <FiX size={18} />
              </button>
            </div>

            {!hasActiveSalaries && (
              <div className="modal-alert alert-error" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FiAlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>No active salary structures exist in the system. Please create a salary structure for an employee first.</span>
              </div>
            )}
            {genError && (
              <div className="modal-alert alert-error" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FiAlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>{genError}</span>
              </div>
            )}
            {genSuccess && (
              <div className="modal-alert alert-success" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FiCheckCircle size={18} style={{ flexShrink: 0 }} />
                <span>{genSuccess}</span>
              </div>
            )}

            <form onSubmit={handleGenSubmit} className="gen-form">
              <div className="form-group">
                <label>Select Employee *</label>
                <select
                  required
                  disabled={!hasActiveSalaries}
                  value={genData.employeeId}
                  onChange={(e) => setGenData({ ...genData, employeeId: e.target.value })}
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {getEmployeeOptionLabel(emp)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Month *</label>
                  <select
                    disabled={!hasActiveSalaries}
                    value={genData.month}
                    onChange={(e) => setGenData({ ...genData, month: e.target.value })}
                  >
                    {MONTH_NAMES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Year *</label>
                  <select
                    disabled={!hasActiveSalaries}
                    value={genData.year}
                    onChange={(e) => setGenData({ ...genData, year: e.target.value })}
                  >
                    {YEARS_LIST.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Days Present *</label>
                  <input
                    type="number"
                    min="0"
                    max="31"
                    required
                    disabled={!hasActiveSalaries}
                    value={genData.daysPresent}
                    onChange={(e) => setGenData({ ...genData, daysPresent: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Total Working Days *</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    disabled={!hasActiveSalaries}
                    value={genData.totalWorkingDays}
                    onChange={(e) => setGenData({ ...genData, totalWorkingDays: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Bonus (Optional)</label>
                <input
                  type="number"
                  min="0"
                  disabled={!hasActiveSalaries}
                  value={genData.bonus}
                  onChange={(e) => setGenData({ ...genData, bonus: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="pr-btn pr-btn-secondary"
                  onClick={() => setShowGenModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pr-btn pr-btn-primary"
                  disabled={genSubmitting || !hasActiveSalaries}
                >
                  {genSubmitting ? 'Generating...' : 'Generate Payroll'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}