import "../employee/emp.shared.css";
import "../employee/EmployeeTable.css";
import { FiEye, FiEdit2, FiTrash2, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { HiOutlineUserGroup } from "react-icons/hi2";

const avatarColors = [
  "#7c3aed", "#2563eb", "#0891b2", "#059669",
  "#d97706", "#dc2626", "#9333ea", "#db2777",
];

function getColor(name = "") {
  const code = (name.charCodeAt(0) || 0) + (name.charCodeAt(1) || 0);
  return avatarColors[code % avatarColors.length];
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function StatusBadge({ status }) {
  const cls =
    status === "Active" ? "active" : status === "Inactive" ? "inactive" : "on-leave";
  return <span className={`emp-badge ${cls}`}>{status || "—"}</span>;
}

function Pagination({ currentPage, totalPages, totalEmployees, pageSize, onPage }) {
  const start = totalEmployees > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, totalEmployees);

  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="emp-pagination">
      <span className="emp-pagination-info">
        Showing {start} to {end} of {totalEmployees.toLocaleString()} results
      </span>
      <div className="emp-pagination-controls">
        <button
          type="button"
          className="emp-page-nav-btn"
          onClick={() => onPage(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <FiChevronLeft size={16} />
        </button>
        {pages.map((p, idx) =>
          p === "..." ? (
            <span key={`ellipsis-${idx}`} className="emp-page-dots">
              ...
            </span>
          ) : (
            <button
              type="button"
              key={p}
              className={`emp-page-num-btn${p === currentPage ? " active" : ""}`}
              onClick={() => onPage(p)}
              aria-label={`Page ${p}`}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          className="emp-page-nav-btn"
          onClick={() => onPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <FiChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default function EmployeeTable({
  employees = [],
  totalEmployees = 0,
  currentPage = 1,
  totalPages = 1,
  pageSize = 10,
  deptFilter = "All Departments",
  departments = [],
  sortField = "name",
  sortAsc = true,
  onSort,
  onDeptFilter,
  onPage,
  onView,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  loading = false,
}) {
  // Generate department filter tabs dynamically from real database departments
  const dynamicDepts = (departments || [])
    .map((d) => (typeof d === "string" ? d : d?.departmentName || d?.name || d?.department_name))
    .filter(Boolean);

  const empDepts = (employees || [])
    .map((e) => (typeof e?.department_id === "object" ? e?.department_id?.departmentName : e?.department))
    .filter(Boolean);

  const realDepts = Array.from(new Set([...dynamicDepts, ...empDepts]));
  const deptTabs = ["All Departments", ...realDepts];

  return (
    <div className="emp-table-container">
      <div className="emp-table-top-bar">
        <div className="emp-dept-tabs" role="tablist" aria-label="Department Filter Tabs">
          {deptTabs.map((tab) => (
            <button
              type="button"
              key={tab}
              role="tab"
              aria-selected={deptFilter === tab}
              className={`emp-dept-tab${deptFilter === tab ? " active" : ""}`}
              onClick={() => onDeptFilter?.(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="emp-loading">
          <span className="emp-spinner" />
          Loading employees...
        </div>
      ) : employees.length === 0 ? (
        <div className="emp-empty-state">
          <div className="emp-empty-icon"><HiOutlineUserGroup size={48} /></div>
          <p>No employees found in this directory view.</p>
        </div>
      ) : (
        <div className="emp-table-wrapper">
          <table className="emp-table" role="grid">
            <thead>
              <tr>
                <th
                  onClick={() => onSort?.("employee_code")}
                  style={{ cursor: "pointer" }}
                  aria-label="Sort by Employee ID"
                >
                  EMP ID {sortField === "employee_code" ? (sortAsc ? "↑" : "↓") : "↕"}
                </th>
                <th
                  onClick={() => onSort?.("name")}
                  style={{ cursor: "pointer" }}
                  aria-label="Sort by Employee Name"
                >
                  EMPLOYEE NAME {sortField === "name" ? (sortAsc ? "↑" : "↓") : "↕"}
                </th>
                <th
                  onClick={() => onSort?.("department")}
                  style={{ cursor: "pointer" }}
                  aria-label="Sort by Department"
                >
                  DEPARTMENT {sortField === "department" ? (sortAsc ? "↑" : "↓") : "↕"}
                </th>
                <th
                  onClick={() => onSort?.("designation")}
                  style={{ cursor: "pointer" }}
                  aria-label="Sort by Role"
                >
                  ROLE {sortField === "designation" ? (sortAsc ? "↑" : "↓") : "↕"}
                </th>
                <th
                  onClick={() => onSort?.("date_of_joining")}
                  style={{ cursor: "pointer" }}
                  aria-label="Sort by Join Date"
                >
                  JOIN DATE {sortField === "date_of_joining" ? (sortAsc ? "↑" : "↓") : "↕"}
                </th>
                <th
                  onClick={() => onSort?.("status")}
                  style={{ cursor: "pointer" }}
                  aria-label="Sort by Status"
                >
                  STATUS {sortField === "status" ? (sortAsc ? "↑" : "↓") : "↕"}
                </th>
                <th style={{ textAlign: "center", minWidth: "120px" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const name = emp.user_id?.name || emp.name || "Unknown";
                const email = emp.user_id?.email || emp.email || "";
                const dept = emp.department_id?.departmentName || emp.department || "—";
                const designation = emp.designation || emp.role || "—";
                const joinDate = formatDate(emp.date_of_joining || emp.createdAt);
                const empStatus = emp.employment_status || emp.status || "Active";
                const avatarUrl = emp.user_id?.avatar || emp.avatar;
                const empCode = emp.employee_code || "—";

                return (
                  <tr key={emp._id || emp.id}>
                    <td>
                      <span className="emp-code-badge" style={{ fontWeight: 600, color: "var(--emp-primary, #6366f1)", fontSize: "0.85rem" }}>
                        {empCode}
                      </span>
                    </td>
                    <td>
                      <div
                        className="emp-name-cell"
                        style={{ cursor: "pointer" }}
                        onClick={() => onView?.(emp)}
                        title="View employee details"
                      >
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={name} className="emp-avatar-img" />
                        ) : (
                          <div
                            className="emp-avatar"
                            style={{ background: getColor(name) }}
                          >
                            {name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="emp-name-info">
                          <strong>{name}</strong>
                          <span>{email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{dept}</td>
                    <td>{designation}</td>
                    <td>{joinDate}</td>
                    <td>
                      <StatusBadge status={empStatus} />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div className="emp-action-btns" style={{ justifyContent: "center" }}>
                        <button
                          type="button"
                          className="emp-action-icon-btn"
                          title="View Details"
                          aria-label={`View details for ${name}`}
                          onClick={() => onView?.(emp)}
                          id={`view-emp-${emp._id || emp.id}`}
                        >
                          <FiEye size={16} />
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            className="emp-action-icon-btn"
                            title="Edit Employee"
                            aria-label={`Edit ${name}`}
                            onClick={() => onEdit?.(emp)}
                            id={`edit-emp-${emp._id || emp.id}`}
                          >
                            <FiEdit2 size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="emp-action-icon-btn delete"
                            title="Deactivate Employee"
                            aria-label={`Deactivate ${name}`}
                            onClick={() => onDelete?.(emp)}
                            id={`delete-emp-${emp._id || emp.id}`}
                          >
                            <FiTrash2 size={16} />
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
      )}

      {!loading && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalEmployees={totalEmployees}
          pageSize={pageSize}
          onPage={onPage}
        />
      )}
    </div>
  );
}