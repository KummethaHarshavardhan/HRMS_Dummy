import { Link, useNavigate } from "react-router-dom";
import "../employee/emp.shared.css";
import "../employee/EmployeeDetailsCard.css";
import { FiArrowLeft, FiEdit2, FiTrash2 } from "react-icons/fi";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function StatusBadge({ status }) {
  const cls =
    status === "Active" ? "active" : status === "Inactive" ? "inactive" : "on-leave";
  const label = status === "Inactive" ? "Relieved / Inactive" : status || "—";
  return <span className={`emp-badge ${cls}`}>{label}</span>;
}

export default function EmployeeDetailsCard({ employee, onEdit, onDelete, onBack, canEdit = true }) {
  const navigate = useNavigate();
  if (!employee) return null;

  const name =
    (typeof employee.user_id === "object" && employee.user_id?.name) ||
    employee.name ||
    employee.employeeName ||
    "Unknown";

  const email =
    (typeof employee.user_id === "object" && employee.user_id?.email) ||
    employee.email ||
    "—";

  const role =
    (typeof employee.user_id === "object" && employee.user_id?.role) ||
    employee.role ||
    "Employee";

  const dept =
    (typeof employee.department_id === "object" && employee.department_id?.departmentName) ||
    employee.department ||
    employee.departmentName ||
    "—";

  const deptId =
    (typeof employee.department_id === "object" && employee.department_id?.departmentId) ||
    employee.departmentId ||
    "—";

  const deptLocation =
    (typeof employee.department_id === "object" && employee.department_id?.location) ||
    employee.location ||
    "—";

  const designation = employee.designation || employee.role || "Employee";
  
  const rawCode = employee.employee_code || employee.employeeCode;
  const code =
    rawCode && !/^[0-9a-fA-F]{24}$/.test(rawCode)
      ? rawCode
      : (employee._id || employee.id)
      ? `EMP-${String(employee._id || employee.id).slice(-6).toUpperCase()}`
      : "EMP001";

  const joinDate = formatDate(employee.date_of_joining || employee.createdAt);
  const status = employee.employment_status || employee.status || "Active";
  const isInactive = status === "Inactive";
  const createdAt = formatDate(employee.createdAt);

  return (
    <div className="emp-detail-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <Link
          to="/employee"
          className="emp-btn-secondary"
          id="emp-detail-back-btn"
          style={{ cursor: "pointer" }}
        >
          <FiArrowLeft size={16} /> Back to Directory
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {canEdit && (
            <>
              <button
                type="button"
                className="emp-btn-primary"
                onClick={() => onEdit?.(employee)}
                id="emp-detail-edit-btn"
                aria-label={`Edit ${name}`}
              >
                <FiEdit2 size={15} /> Edit Employee
              </button>
              <button
                type="button"
                className="emp-btn-danger"
                onClick={() => onDelete?.(employee)}
                id="emp-detail-delete-btn"
                aria-label={`Deactivate ${name}`}
              >
                <FiTrash2 size={15} /> Deactivate Employee
              </button>
            </>
          )}
        </div>
      </div>

      {isInactive && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "10px",
            padding: "12px 16px",
            color: "#991b1b",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: "18px" }}>⚠️</span>
          <span>
            <strong>Account Deactivated / Relieved:</strong> This employee has completed offboarding and is inactive. Login, active task assignment, payroll generation, and asset allocation are disabled. Historical records remain fully preserved.
          </span>
        </div>
      )}

      <div className="emp-detail-hero" style={isInactive ? { background: "linear-gradient(135deg, #64748b 0%, #475569 100%)" } : undefined}>
        <div className="emp-detail-avatar">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="emp-detail-hero-info">
          <h2>{name}</h2>
          <p>{designation} &nbsp;·&nbsp; {dept}</p>
          <p style={{ marginTop: 4, opacity: 0.75, fontSize: 13 }}>{email}</p>
        </div>
        <div className="emp-detail-hero-badge">
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="emp-details-grid">
        <div className="emp-details-section">
          <h3>Employment Info</h3>
          <div className="emp-detail-item">
            <label>Employee Code</label>
            <strong>{code}</strong>
          </div>
          <div className="emp-detail-item">
            <label>Designation</label>
            <strong>{designation}</strong>
          </div>
          <div className="emp-detail-item">
            <label>Date of Joining</label>
            <strong>{joinDate}</strong>
          </div>
          <div className="emp-detail-item">
            <label>Status</label>
            <strong><StatusBadge status={status} /></strong>
          </div>
          <div className="emp-detail-item">
            <label>Record Created</label>
            <strong>{createdAt}</strong>
          </div>
        </div>

        <div className="emp-details-section">
          <h3>Personal Info</h3>
          <div className="emp-detail-item">
            <label>Full Name</label>
            <strong>{name}</strong>
          </div>
          <div className="emp-detail-item">
            <label>Email</label>
            <strong>{email}</strong>
          </div>
          <div className="emp-detail-item">
            <label>System Role</label>
            <strong>{role}</strong>
          </div>
        </div>

        <div className="emp-details-section">
          <h3>Department Info</h3>
          <div className="emp-detail-item">
            <label>Department</label>
            <strong>{dept}</strong>
          </div>
          {deptId && deptId !== "—" && (
            <div className="emp-detail-item">
              <label>Department ID</label>
              <strong>{deptId}</strong>
            </div>
          )}
          {deptLocation && deptLocation !== "—" && (
            <div className="emp-detail-item">
              <label>Location</label>
              <strong>{deptLocation}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}