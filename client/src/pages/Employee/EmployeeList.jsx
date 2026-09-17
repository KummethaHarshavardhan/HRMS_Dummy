import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import EmployeeTable from "../../components/employee/EmployeeTable.jsx";
import ConfirmModal from "../../components/Modal/ConfirmModal.jsx";

import {
  getAllEmployees,
  deleteEmployee,
} from "../../services/employeeService.js";
import { getAllDepartments } from "../../services/profileService.js";
import "../../components/employee/emp.shared.css";
import "./EmployeeList.css";
import {
  FiUserPlus,
  FiUsers,
  FiCheckCircle,
  FiCalendar,
  FiSlash,
  FiLayers,
  FiShield,
  FiSearch,
} from "react-icons/fi";

import { normalizeRole } from "../../utils/permission.js";

function StatCard({ icon, label, value, colorClass }) {
  return (
    <div className="emp-stat-card">
      <div className={`emp-stat-icon ${colorClass}`}>{icon}</div>
      <div className="emp-stat-content">
        <div className="emp-stat-label">{label}</div>
        <div className={`emp-stat-value ${colorClass}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

export default function EmployeeList() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const normRole = normalizeRole(user?.role);
  const isAdmin = normRole === "admin";
  const isHR = normRole === "hr_manager";
  const canEdit = isAdmin || isHR;
  const canDelete = isAdmin || isHR;

  const [employees, setEmployees] = useState([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [departments, setDepartments] = useState([]);

  // Search, Filter & Sort States
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Active");
  const [roleFilter, setRoleFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("All Departments");
  const [sortField, setSortField] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    onLeave: 0,
    terminated: 0,
  });

  const searchTimer = useRef(null);

  useEffect(() => {
    getAllDepartments()
      .then((data) => setDepartments(data?.departments || data?.data || (Array.isArray(data) ? data : [])))
      .catch(() => setDepartments([]));
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const [allData, activeData, inactiveData] = await Promise.all([
        getAllEmployees({ status: "all", page: 1, limit: 1 }),
        getAllEmployees({ status: "Active", page: 1, limit: 1 }),
        getAllEmployees({ status: "Inactive", page: 1, limit: 1 }),
      ]);
      const total = allData?.totalEmployees || 0;
      const active = activeData?.totalEmployees || 0;
      const terminated = inactiveData?.totalEmployees || 0;
      setStats({
        total,
        active,
        onLeave: 0,
        terminated,
      });
    } catch {}
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAllEmployees({
        search,
        status,
        page: currentPage,
        limit: PAGE_SIZE,
      });

      let emps = data?.employees || [];

      // Apply department filtering
      if (deptFilter !== "All Departments") {
        emps = emps.filter(
          (e) =>
            (e.department_id?.departmentName || e.department) === deptFilter,
        );
      }

      // Apply role filtering
      if (roleFilter) {
        emps = emps.filter((e) => {
          const r = e.user_id?.role || e.role || e.designation || "";
          return r.toLowerCase().includes(roleFilter.toLowerCase());
        });
      }

      // Apply sorting
      emps.sort((a, b) => {
        let valA = "";
        let valB = "";

        if (sortField === "name") {
          valA = (a.user_id?.name || a.name || "").toLowerCase();
          valB = (b.user_id?.name || b.name || "").toLowerCase();
        } else if (sortField === "employee_code") {
          valA = (a.employee_code || "").toLowerCase();
          valB = (b.employee_code || "").toLowerCase();
        } else if (sortField === "department") {
          valA = (a.department_id?.departmentName || a.department || "").toLowerCase();
          valB = (b.department_id?.departmentName || b.department || "").toLowerCase();
        } else if (sortField === "designation") {
          valA = (a.designation || a.role || "").toLowerCase();
          valB = (b.designation || b.role || "").toLowerCase();
        } else if (sortField === "date_of_joining") {
          valA = new Date(a.date_of_joining || a.createdAt || 0).getTime();
          valB = new Date(b.date_of_joining || b.createdAt || 0).getTime();
        } else if (sortField === "status") {
          valA = (a.employment_status || a.status || "").toLowerCase();
          valB = (b.employment_status || b.status || "").toLowerCase();
        }

        if (typeof valA === "string") {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? valA - valB : valB - valA;
      });

      setEmployees(emps);
      setTotalEmployees(data?.totalEmployees || emps.length);
      setTotalPages(
        data?.totalPages ||
          Math.ceil((data?.totalEmployees || emps.length) / PAGE_SIZE) ||
          1,
      );
    } catch (err) {
      setError(err.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, [search, status, deptFilter, roleFilter, sortField, sortAsc, currentPage]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setCurrentPage(1);
    }, 350);
  };

  const handleStatusChange = (e) => {
    setStatus(e.target.value);
    setCurrentPage(1);
  };

  const handleRoleChange = (e) => {
    setRoleFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleDept = (dept) => {
    setDeptFilter(dept);
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEmployee(deleteTarget._id || deleteTarget.id);
      const name = deleteTarget.user_id?.name || deleteTarget.name || "Employee";
      showToast('success', `Employee ${name} deactivated successfully.`);
      setDeleteTarget(null);
      await fetchEmployees();
      await fetchStats();
    } catch (err) {
      const errMsg = err.message || "Failed to deactivate employee";
      setError(errMsg);
      showToast('error', errMsg);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleView = (emp) => navigate(`/employee/${emp._id || emp.id}`);
  const handleEdit = (emp) => {
    if (!canEdit) {
      showToast('error', "You do not have permission to edit employee details.");
      return;
    }
    navigate(`/employee/${emp._id || emp.id}/edit`);
  };
  const handleDelete = (emp) => {
    if (!canDelete) {
      showToast('error', "You do not have permission to deactivate employees.");
      return;
    }
    setDeleteTarget(emp);
  };
  const handleAdd = () => {
    if (!canEdit) {
      showToast('error', "You do not have permission to add a new employee.");
      return;
    }
    navigate("/employee/add");
  };

  return (
    <div className="emp-page">
      <div className="emp-page-header">
        <div className="emp-page-header-text">
          <h1>Employee Directory</h1>
          <p>
            Manage your global workforce of {stats.total.toLocaleString()}{" "}
            employees.
          </p>
        </div>

        <div className="emp-header-actions">
          {isAdmin && (
            <>
              <button
                type="button"
                className="emp-btn-secondary"
                onClick={() => navigate("/employee/departments")}
                title="Manage Departments"
                aria-label="Manage Departments"
              >
                <FiLayers size={16} />
                Departments
              </button>

              <button
                type="button"
                className="emp-btn-secondary"
                onClick={() => navigate("/employee/roles")}
                title="Manage Roles"
                aria-label="Manage Roles"
              >
                <FiShield size={16} />
                Roles
              </button>
            </>
          )}

          {canEdit && (
            <button
              type="button"
              className="emp-btn-primary"
              onClick={handleAdd}
              id="add-employee-btn"
              aria-label="Add New Employee"
            >
              <FiUserPlus size={16} />
              Add New Employee
            </button>
          )}
        </div>
      </div>

      {error && <div className="emp-alert error">{error}</div>}

      <div className="emp-stats-row">
        <StatCard
          icon={<FiUsers size={22} />}
          label="Total Employees"
          value={stats.total}
          colorClass="purple"
        />
        <StatCard
          icon={<FiCheckCircle size={22} />}
          label="Active"
          value={stats.active}
          colorClass="blue"
        />
        <StatCard
          icon={<FiCalendar size={22} />}
          label="On Leave"
          value={stats.onLeave}
          colorClass="yellow"
        />
        <StatCard
          icon={<FiSlash size={22} />}
          label="Terminated"
          value={stats.terminated}
          colorClass="red"
        />
      </div>

      {/* Directory Filter Toolbar */}
      <div className="emp-directory-toolbar">
        <div className="emp-directory-search-wrap">
          <input
            type="text"
            className="emp-directory-search-input"
            placeholder="Search by Employee ID, Name, Email, Department..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div className="emp-directory-filters" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            className="emp-directory-filter-select"
            value={status}
            onChange={handleStatusChange}
            aria-label="Filter by Employment Status"
          >
            <option value="Active">Active Employees (Default)</option>
            <option value="Inactive">Inactive / Relieved</option>
            <option value="all">All Employees (Include Relieved)</option>
          </select>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              cursor: "pointer",
              color: "var(--text-secondary, #64748b)",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              id="show-inactive-toggle"
              checked={status === "all" || status === "Inactive"}
              onChange={(e) => {
                const nextStatus = e.target.checked ? "all" : "Active";
                setStatus(nextStatus);
                setCurrentPage(1);
              }}
            />
            Show inactive/relieved employees
          </label>

          <select
            className="emp-directory-filter-select"
            value={roleFilter}
            onChange={handleRoleChange}
            aria-label="Filter by Role"
          >
            <option value="">All Roles</option>
            <option value="Employee">Employee</option>
            <option value="HR Manager">HR Manager</option>
            <option value="Admin">Admin</option>
          </select>
        </div>
      </div>

      <EmployeeTable
        employees={employees}
        totalEmployees={totalEmployees}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        deptFilter={deptFilter}
        departments={departments}
        sortField={sortField}
        sortAsc={sortAsc}
        onSort={handleSort}
        onDeptFilter={handleDept}
        onPage={setCurrentPage}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        canEdit={canEdit}
        canDelete={canDelete}
        loading={loading}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Deactivate Employee?"
        message={`Are you sure you want to deactivate ${deleteTarget?.user_id?.name || deleteTarget?.name || "this employee"} (${deleteTarget?.employee_code || "EMP"})? Historical records across payroll, leave, and attendance will be preserved.`}
        confirmText="Deactivate"
        variant="danger"
        loading={deleting}
      />

      <footer className="emp-footer">
        <div>© 2026 Infinetra HRMS. All rights reserved.</div>
        <div className="emp-footer-links">
          <span>Enterprise Workforce Edition</span>
        </div>
      </footer>
    </div>
  );
}