import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { getAllSalaries, deactivateSalary } from '../../../services/payrollService';
import { normalizeRole } from '../../../utils/permission';
import SearchBar from '../../../components/Payroll/SearchBar';
import SalaryCard from '../../../components/Payroll/SalaryCard';
import StatusBadge from '../../../components/Payroll/StatusBadge';
import LoadingState from '../../../components/Payroll/LoadingState';
import ErrorState from '../../../components/Payroll/ErrorState';
import EmptyState from '../../../components/Payroll/EmptyState';
import Pagination from '../../../components/Payroll/Pagination';
import ConfirmModal from '../../../components/Modal/ConfirmModal';
import formatCurrency from '../../../utils/formatCurrency';
import { getEmployeeDisplay } from '../../../utils/payrollConstants';
import { FiEye, FiEdit2, FiTrash2 } from 'react-icons/fi';
import '../../../components/Payroll/payrollTheme.css';
import './SalaryList.css';

export default function SalaryList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = normalizeRole(user?.role) === 'admin';
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

  // Sorting state
  const [sortField, setSortField] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Deactivate Modal State
  const [deactivateId, setDeactivateId] = useState(null);
  const [deactivating, setDeactivating] = useState(false);

  const fetchSalaries = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAllSalaries();
      if (res?.success) {
        setSalaries(res.data || []);
      } else {
        setError(res?.message || 'Failed to load salaries');
      }
    } catch (err) {
      setError(err.message || 'Error fetching salary structures');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaries();
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Filter salaries by search term (code, name, or dept)
  const filteredSalaries = useMemo(() => {
    let result = salaries.filter((s) => {
      const empDisplay = getEmployeeDisplay(s.employeeId);
      const searchLower = searchTerm.toLowerCase();
      return (
        (empDisplay.code && empDisplay.code.toLowerCase().includes(searchLower)) ||
        (empDisplay.name && empDisplay.name.toLowerCase().includes(searchLower)) ||
        (empDisplay.dept && empDisplay.dept.toLowerCase().includes(searchLower)) ||
        (empDisplay.label && empDisplay.label.toLowerCase().includes(searchLower))
      );
    });

    result.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortField === 'name') {
        const empA = getEmployeeDisplay(a.employeeId);
        const empB = getEmployeeDisplay(b.employeeId);
        valA = empA.name || '';
        valB = empB.name || '';
      } else if (sortField === 'basicSalary') {
        valA = a.basicSalary || 0;
        valB = b.basicSalary || 0;
      } else if (sortField === 'netSalary') {
        valA = a.netSalary || 0;
        valB = b.netSalary || 0;
      } else if (sortField === 'effectiveFrom') {
        valA = new Date(a.effectiveFrom || 0).getTime();
        valB = new Date(b.effectiveFrom || 0).getTime();
      }

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return result;
  }, [salaries, searchTerm, sortField, sortAsc]);

  // Pagination logic
  const itemsPerPage = 8;
  const totalPages = Math.ceil(filteredSalaries.length / itemsPerPage);
  const paginatedSalaries = filteredSalaries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const confirmDeactivate = async () => {
    if (!deactivateId) return;
    setDeactivating(true);
    try {
      const res = await deactivateSalary(deactivateId);
      if (res?.success) {
        setSalaries((prev) => prev.filter((item) => item._id !== deactivateId));
        setDeactivateId(null);
        showToast('success', 'Salary structure deactivated successfully.');
      }
    } catch (err) {
      showToast('error', err.message || 'Failed to deactivate salary');
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) return <LoadingState message="Loading Salary Structures..." />;
  if (error) return <ErrorState message={error} onRetry={fetchSalaries} />;

  return (
    <div className="payroll-container">
      {/* Header Banner */}
      <div className="payroll-header">
        <div>
          <h1 className="payroll-header-title">Salary Management</h1>
          <p className="payroll-header-subtitle">
            Configure, view, and update base employee salary structures.
          </p>
        </div>
        {/* Admin-only: Create New Salary button */}
        {isAdmin && (
          <div className="payroll-header-actions">
            <button
              className="pr-btn pr-btn-primary"
              onClick={() => navigate('/payroll/salaries/add')}
              aria-label="Create New Salary"
            >
              + Create New Salary
            </button>
          </div>
        )}
      </div>

      {/* Filter and Controls Toolbar */}
      <div className="salary-toolbar">
        <SearchBar
          value={searchTerm}
          onChange={(val) => {
            setSearchTerm(val);
            setCurrentPage(1);
          }}
          placeholder="Search by Employee Code, Name, Department..."
        />
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            Table
          </button>
          <button
            className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            Cards
          </button>
        </div>
      </div>

      {/* Main List Content */}
      {filteredSalaries.length === 0 ? (
        <EmptyState
          title="No Salary Records Found"
          message={searchTerm ? 'No salary record matches your search query.' : 'No salary structures have been created yet.'}
          actionText={isAdmin ? '+ Create Salary Structure' : undefined}
          onAction={isAdmin ? () => navigate('/payroll/salaries/add') : undefined}
        />
      ) : viewMode === 'grid' ? (
        <>
          <div className="payroll-grid">
            {paginatedSalaries.map((salary) => (
              <SalaryCard
                key={salary._id}
                salary={salary}
                onView={(id) => navigate(`/payroll/salaries/${id}`)}
                onEdit={isAdmin ? (id) => navigate(`/payroll/salaries/${id}/edit`) : undefined}
                onDeactivate={isAdmin ? (id) => setDeactivateId(id) : undefined}
              />
            ))}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredSalaries.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </>
      ) : (
        <div className="payroll-card">
          <div className="payroll-table-wrapper">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                    Employee {sortField === 'name' ? (sortAsc ? '↑' : '↓') : '↕'}
                  </th>
                  <th onClick={() => handleSort('basicSalary')} style={{ cursor: 'pointer' }}>
                    Basic Salary {sortField === 'basicSalary' ? (sortAsc ? '↑' : '↓') : '↕'}
                  </th>
                  <th>HRA</th>
                  <th>Allowances</th>
                  <th>Bonus</th>
                  <th>Deductions</th>
                  <th>Gross Salary</th>
                  <th onClick={() => handleSort('netSalary')} style={{ cursor: 'pointer' }}>
                    Net Salary {sortField === 'netSalary' ? (sortAsc ? '↑' : '↓') : '↕'}
                  </th>
                  <th onClick={() => handleSort('effectiveFrom')} style={{ cursor: 'pointer' }}>
                    Effective Date {sortField === 'effectiveFrom' ? (sortAsc ? '↑' : '↓') : '↕'}
                  </th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSalaries.map((item) => {
                  const empDisplay = getEmployeeDisplay(item.employeeId);

                  return (
                    <tr key={item._id}>
                      <td>
                        <div className="employee-cell">
                          <span className="emp-code">{empDisplay.code || '—'}</span>
                          {empDisplay.name && (
                            <span className="emp-name">{empDisplay.name}</span>
                          )}
                        </div>
                      </td>
                      <td>{formatCurrency(item.basicSalary)}</td>
                      <td>{formatCurrency(item.hra)}</td>
                      <td>{formatCurrency(item.allowances)}</td>
                      <td>{formatCurrency(item.bonus)}</td>
                      <td className="text-danger">-{formatCurrency(item.deductions)}</td>
                      <td className="font-strong">{formatCurrency(item.grossSalary)}</td>
                      <td className="font-strong text-success">{formatCurrency(item.netSalary)}</td>
                      <td>
                        {item.effectiveFrom ? new Date(item.effectiveFrom).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td>
                        <StatusBadge status={item.isActive} type="active" />
                      </td>
                      <td className="text-right">
                        <div className="table-actions">
                          <button
                            className="pr-btn pr-btn-secondary pr-btn-sm"
                            onClick={() => navigate(`/payroll/salaries/${item._id}`)}
                            title="View Salary Details"
                            aria-label="View Salary Details"
                          >
                            <FiEye size={15} />
                          </button>
                          {isAdmin && (
                            <button
                              className="pr-btn pr-btn-secondary pr-btn-sm"
                              onClick={() => navigate(`/payroll/salaries/${item._id}/edit`)}
                              title="Edit Salary Structure"
                              aria-label="Edit Salary Structure"
                            >
                              <FiEdit2 size={15} />
                            </button>
                          )}
                          {isAdmin && item.isActive && (
                            <button
                              className="pr-btn pr-btn-danger pr-btn-sm"
                              onClick={() => setDeactivateId(item._id)}
                              title="Deactivate Salary Structure"
                              aria-label="Deactivate Salary Structure"
                            >
                              <FiTrash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredSalaries.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deactivateId)}
        onClose={() => setDeactivateId(null)}
        onConfirm={confirmDeactivate}
        title="Deactivate Salary Structure?"
        message="Are you sure you want to deactivate this salary structure? This will mark it inactive in the database."
        confirmText="Deactivate"
        variant="danger"
        loading={deactivating}
      />
    </div>
  );
}