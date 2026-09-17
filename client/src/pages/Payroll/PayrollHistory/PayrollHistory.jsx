import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDownload } from 'react-icons/fi';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { getAllPayrolls, markPayrollAsPaid, downloadPayslip } from '../../../services/payrollService';
import { normalizeRole } from '../../../utils/permission';
import { exportPayrollPDF } from '../../../utils/payrollPdfExport';
import { getMonthName, getEmployeeDisplay } from '../../../utils/payrollConstants';
import PayrollFilter from '../../../components/Payroll/PayrollFilter';
import SearchBar from '../../../components/Payroll/SearchBar';
import PayrollTable from '../../../components/Payroll/PayrollTable';
import LoadingState from '../../../components/Payroll/LoadingState';
import ErrorState from '../../../components/Payroll/ErrorState';
import EmptyState from '../../../components/Payroll/EmptyState';
import Pagination from '../../../components/Payroll/Pagination';
import '../../../components/Payroll/payrollTheme.css';
import './PayrollHistory.css';

export default function PayrollHistory({ scope = 'all' }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = ['admin', 'super_admin'].includes(normalizeRole(user?.role));
  const isEmployeeRole = normalizeRole(user?.role) === 'employee';
  const isMyPayroll = scope === 'my' || isEmployeeRole;
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [rowDownloadingId, setRowDownloadingId] = useState(null);

  // Filter States
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (scope === 'my') params.scope = 'my';
      else if (scope === 'employees') params.scope = 'employees';
      const res = await getAllPayrolls(params);
      if (res?.success) {
        setPayrolls(res.data || []);
      } else {
        setError(res?.message || 'Failed to load payroll history');
      }
    } catch (err) {
      setError(err.message || 'Error fetching payroll records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMonthFilter('');
    setYearFilter('');
    setStatusFilter('');
    setSearchTerm('');
    setCurrentPage(1);
    fetchHistory();
  }, [scope]);

  const handleMarkPaid = async (id) => {
    setActionLoading(true);
    try {
      const res = await markPayrollAsPaid(id);
      if (res?.success) {
        setPayrolls((prev) =>
          prev.map((item) =>
            item._id === id ? { ...item, status: 'Paid', paymentDate: new Date() } : item
          )
        );
        showToast('success', 'Payroll marked as paid successfully');
      }
    } catch (err) {
      showToast('error', err.message || 'Failed to mark payroll as paid');
    } finally {
      setActionLoading(false);
    }
  };

  // Client-side filtering over real API data
  const filteredPayrolls = payrolls.filter((item) => {
    // Strict Scope check: My Payroll must only show the logged-in user's payroll
    if (isMyPayroll) {
      const isOwnItem = (
        (item.employeeId?.user_id?._id && String(item.employeeId.user_id._id) === String(user?._id || user?.id)) ||
        (item.employeeId?.user_id && String(item.employeeId.user_id) === String(user?._id || user?.id)) ||
        (item.employeeId?.user_id?.email && user?.email && item.employeeId.user_id.email.toLowerCase() === user.email.toLowerCase()) ||
        (item.employeeSnapshot?.fullName && user?.name && item.employeeSnapshot.fullName.trim().toLowerCase() === user.name.trim().toLowerCase())
      );
      if (!isOwnItem) return false;
    } else if (scope === 'employees') {
      const isOwnItem = (
        (item.employeeId?.user_id?._id && String(item.employeeId.user_id._id) === String(user?._id || user?.id)) ||
        (item.employeeId?.user_id && String(item.employeeId.user_id) === String(user?._id || user?.id)) ||
        (item.employeeId?.user_id?.email && user?.email && item.employeeId.user_id.email.toLowerCase() === user.email.toLowerCase()) ||
        (item.employeeSnapshot?.fullName && user?.name && item.employeeSnapshot.fullName.trim().toLowerCase() === user.name.trim().toLowerCase())
      );
      if (isOwnItem) return false;
    }

    if (monthFilter && Number(item.month) !== Number(monthFilter)) return false;
    if (yearFilter && Number(item.year) !== Number(yearFilter)) return false;
    if (statusFilter && item.status !== statusFilter) return false;

    if (searchTerm) {
      const empDisplay = getEmployeeDisplay(item.employeeId, item.employeeSnapshot);
      const searchLower = searchTerm.toLowerCase();
      const monthStr = getMonthName(item.month).toLowerCase();
      const yearStr = String(item.year);
      const statusStr = (item.status || '').toLowerCase();

      return (
        (empDisplay.code && empDisplay.code.toLowerCase().includes(searchLower)) ||
        (empDisplay.name && empDisplay.name.toLowerCase().includes(searchLower)) ||
        (empDisplay.dept && empDisplay.dept.toLowerCase().includes(searchLower)) ||
        (empDisplay.label && empDisplay.label.toLowerCase().includes(searchLower)) ||
        monthStr.includes(searchLower) ||
        yearStr.includes(searchLower) ||
        statusStr.includes(searchLower)
      );
    }

    return true;
  });

  // Pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredPayrolls.length / itemsPerPage);
  const paginatedPayrolls = filteredPayrolls.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleResetFilters = () => {
    setMonthFilter('');
    setYearFilter('');
    setStatusFilter('');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleExportFilteredPDF = () => {
    if (filteredPayrolls.length === 0) {
      showToast('error', 'No payroll records match your selected filter criteria.');
      return;
    }
    setExportLoading(true);
    try {
      exportPayrollPDF({
        payrolls: filteredPayrolls,
        monthFilter,
        yearFilter,
        user,
      });
      showToast('success', 'Payslips statement PDF generated and downloaded successfully!');
    } catch (err) {
      showToast('error', err.message || 'Failed to generate PDF statement.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDownloadSinglePayslip = async (id) => {
    setRowDownloadingId(id);
    try {
      await downloadPayslip(id);
      showToast('success', 'Official payslip PDF downloaded successfully');
    } catch (err) {
      showToast('error', err.message || 'Failed to download payslip');
    } finally {
      setRowDownloadingId(null);
    }
  };

  const getDownloadButtonLabel = () => {
    const noun = isMyPayroll ? 'My Payslips' : 'Payslips';
    if (yearFilter && !monthFilter) {
      return `Download ${yearFilter} ${noun} (Month-wise)`;
    }
    if (yearFilter && monthFilter) {
      return `Download ${getMonthName(monthFilter)} ${yearFilter} Payslip`;
    }
    if (!yearFilter && monthFilter) {
      return `Download ${getMonthName(monthFilter)} ${noun} (All Years)`;
    }
    return `Download All ${noun} (${filteredPayrolls.length})`;
  };

  if (loading) return <LoadingState message="Loading Payroll Records..." />;
  if (error) return <ErrorState message={error} onRetry={fetchHistory} />;

  return (
    <div className="payroll-container">
      {/* Header Banner */}
      <div className="payroll-header">
        <div>
          <h1 className="payroll-header-title">
            {isMyPayroll ? (isEmployeeRole ? 'My Payslips & Payroll' : 'My Payroll') : 'Employees Payroll History'}
          </h1>
          <p className="payroll-header-subtitle">
            {isMyPayroll
              ? 'View and download your personal monthly payslips and payment history.'
              : 'Historical log of all generated and disbursed employee payroll runs.'}
          </p>
        </div>
        <div className="payroll-header-actions">
          <button
            className="pr-btn pr-btn-success"
            onClick={handleExportFilteredPDF}
            disabled={filteredPayrolls.length === 0 || exportLoading}
            title={
              yearFilter && !monthFilter
                ? `Download month-wise statement of all ${yearFilter} payslips`
                : !yearFilter && !monthFilter
                ? 'Download complete all-time payslips statement'
                : 'Download payslips statement for current filter'
            }
          >
            <FiDownload size={16} />
            {exportLoading ? 'Generating PDF...' : getDownloadButtonLabel()}
          </button>

          {!isEmployeeRole && (
            <button className="pr-btn pr-btn-primary" onClick={() => navigate('/payroll/dashboard')}>
              Dashboard Overview
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="history-controls-row">
        <SearchBar
          value={searchTerm}
          onChange={(val) => { setSearchTerm(val); setCurrentPage(1); }}
          placeholder={isMyPayroll ? "Search by Month, Year, Status..." : "Search by Employee Code, Name, or Department..."}
        />
        <PayrollFilter
          selectedMonth={monthFilter}
          selectedYear={yearFilter}
          selectedStatus={statusFilter}
          onMonthChange={(val) => { setMonthFilter(val); setCurrentPage(1); }}
          onYearChange={(val) => { setYearFilter(val); setCurrentPage(1); }}
          onStatusChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}
        />
      </div>

      {/* Main Table Card */}
      <div className="payroll-card">
        {filteredPayrolls.length === 0 ? (
          <EmptyState
            title={isMyPayroll ? "No Personal Payroll Records" : "No payroll records found."}
            message={
              isMyPayroll
                ? "Your personal payroll has not been generated for this period yet. Once processed, your payslips will appear here."
                : (monthFilter || yearFilter || statusFilter || searchTerm
                    ? 'No payroll records match your selected filter criteria.'
                    : 'No employee payroll records exist in the database.')
            }
            actionText={(!isMyPayroll || monthFilter || yearFilter || statusFilter || searchTerm) ? "Clear All Filters" : undefined}
            onAction={(!isMyPayroll || monthFilter || yearFilter || statusFilter || searchTerm) ? handleResetFilters : undefined}
          />
        ) : (
          <>
            <PayrollTable
              payrolls={paginatedPayrolls}
              onView={(id) => navigate(`/payroll/${id}`)}
              onDownload={handleDownloadSinglePayslip}
              downloadingId={rowDownloadingId}
              onMarkPaid={isAdmin && !isMyPayroll ? handleMarkPaid : undefined}
              isActionLoading={actionLoading}
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredPayrolls.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </div>
  );
}