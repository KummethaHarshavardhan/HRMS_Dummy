import { useState, useMemo } from "react";
import {
  FiDownload,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiAlertCircle,
  FiUsers,
  FiClock,
} from "react-icons/fi";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtTime = (t) => {
  if (!t) return "—";
  return new Date(t).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const fmtHours = (h) => {
  if (h === undefined || h === null) return "—";
  const num = Number(h);
  if (isNaN(num)) return "—";
  const hrs = Math.floor(num);
  const mins = Math.round((num - hrs) * 60);
  return `${hrs}h ${mins}m`;
};

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  let cls = "att-badge-present";
  if (s === "late") cls = "att-badge-late";
  else if (s === "half day" || s === "half_day") cls = "att-badge-halfday";
  else if (s === "early checkout" || s === "early_checkout") cls = "att-badge-early";
  else if (s === "absent") cls = "att-badge-absent";

  return <span className={`att-status-badge ${cls}`}>{status || "—"}</span>;
}

export default function AdminAttendanceMonitor({
  records = [],
  loading = false,
  error = "",
  onRefresh,
}) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortAsc, setSortAsc] = useState(false);

  // Dynamic Departments from records
  const departments = useMemo(() => {
    const set = new Set();
    records.forEach((r) => {
      if (r.employee?.department) set.add(r.employee.department);
    });
    return Array.from(set);
  }, [records]);

  // Compute summary stats
  const stats = useMemo(() => {
    let present = 0, late = 0, halfDay = 0, early = 0;
    records.forEach((r) => {
      const s = (r.status || "").toLowerCase();
      if (s === "present") present++;
      else if (s === "late") late++;
      else if (s === "half day" || s === "half_day") halfDay++;
      else if (s === "early checkout" || s === "early_checkout") early++;
    });
    return { total: records.length, present, late, halfDay, early };
  }, [records]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Filter & Sort
  const filtered = useMemo(() => {
    let list = records.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterDept && r.employee?.department !== filterDept) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const name = (r.employee?.name || "").toLowerCase();
        const email = (r.employee?.email || "").toLowerCase();
        const code = (r.employee?.employee_code || r.employee?.employeeCode || "").toLowerCase();
        const role = (r.employee?.role || "").toLowerCase();
        const dept = (r.employee?.department || "").toLowerCase();
        if (
          !name.includes(q) &&
          !email.includes(q) &&
          !code.includes(q) &&
          !role.includes(q) &&
          !dept.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });

    list.sort((a, b) => {
      let valA = "";
      let valB = "";

      if (sortField === "date") {
        valA = new Date(a.date || a.createdAt || 0).getTime();
        valB = new Date(b.date || b.createdAt || 0).getTime();
        return sortAsc ? valA - valB : valB - valA;
      } else if (sortField === "employee") {
        valA = (a.employee?.name || "").toLowerCase();
        valB = (b.employee?.name || "").toLowerCase();
      } else if (sortField === "status") {
        valA = (a.status || "").toLowerCase();
        valB = (b.status || "").toLowerCase();
      } else if (sortField === "workingHours") {
        valA = Number(a.workingHours || 0);
        valB = Number(b.workingHours || 0);
        return sortAsc ? valA - valB : valB - valA;
      }

      if (typeof valA === "string") {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [records, search, filterStatus, filterDept, sortField, sortAsc]);

  // PDF Export
  const handleExportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Employee Attendance Report", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(
      `Total: ${filtered.length} | Present: ${stats.present} | Late: ${stats.late} | Half Day: ${stats.halfDay}`,
      14,
      38
    );

    const rows = filtered.map((r) => [
      `${r.employee?.name || "—"} (${r.employee?.employee_code || ""})`,
      r.employee?.role || "—",
      r.employee?.department || "—",
      fmtDate(r.date),
      r.status || "—",
      fmtTime(r.checkIn),
      fmtTime(r.checkOut),
      fmtHours(r.workingHours),
    ]);

    autoTable(doc, {
      head: [["Employee", "Role", "Department", "Date", "Status", "Check In", "Check Out", "Working Hrs"]],
      body: rows,
      startY: 50,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [25, 118, 210] },
    });

    doc.save("Attendance_Report.pdf");
  };

  return (
    <div className="admin-attendance-monitor">
      {/* Stats Row */}
      <div className="admin-att-stats-row">
        {[
          { label: "Total Records", value: stats.total, color: "var(--primary-600)" },
          { label: "Present", value: stats.present, color: "var(--success)" },
          { label: "Late", value: stats.late, color: "#f59e0b" },
          { label: "Half Day", value: stats.halfDay, color: "#8b5cf6" },
          { label: "Early Checkout", value: stats.early, color: "#ef4444" },
        ].map((s) => (
          <div key={s.label} className="admin-att-stat-card">
            <span className="admin-att-stat-value" style={{ color: s.color }}>{s.value}</span>
            <span className="admin-att-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="admin-att-toolbar">
        <div className="admin-att-search-wrap">
          <input
            id="admin-att-search"
            type="text"
            className="admin-att-search"
            placeholder="Search employee, ID, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="admin-att-filter-wrap">
          <select
            id="admin-att-status-filter"
            className="admin-att-filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by Status"
          >
            <option value="">Status</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Half Day">Half Day</option>
            <option value="Early Checkout">Early Checkout</option>
          </select>

          {departments.length > 0 && (
            <select
              className="admin-att-filter-select"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              aria-label="Filter by Department"
            >
              <option value="">Department</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="admin-att-actions-wrap">
          <button
            id="admin-att-refresh-btn"
            type="button"
            className="btn-secondary admin-att-action-btn"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh attendance records"
            aria-label="Refresh attendance"
          >
            <FiRefreshCw size={15} className={loading ? "spinning" : ""} />
            {loading ? "Loading…" : "Refresh"}
          </button>

          <button
            id="admin-att-export-btn"
            type="button"
            className="btn-primary admin-att-action-btn"
            onClick={handleExportPDF}
            disabled={filtered.length === 0 || loading}
            title="Download PDF Report"
            aria-label="Export PDF Report"
          >
            <FiDownload size={15} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="att-status-msg att-error">
          <FiAlertCircle size={15} /> {error}
        </div>
      )}

      {/* Table */}
      <div className="admin-att-table-container">
        {loading ? (
          <div className="att-loading-state" style={{ padding: "48px 24px", textAlign: "center" }}>
            <div className="emp-spinner" style={{ margin: "0 auto 12px" }} />
            <p>Loading attendance records…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="att-empty-state" style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8" }}>
            <FiUsers size={40} style={{ margin: "0 auto 8px", color: "#cbd5e1" }} />
            <h3>No attendance records found</h3>
            <p>
              {search || filterStatus || filterDept
                ? "Try adjusting your search or filter criteria."
                : "No attendance data is available yet."}
            </p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: "auto" }}>
            <table className="admin-att-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th onClick={() => handleSort("employee")} style={{ cursor: "pointer" }}>
                    Employee {sortField === "employee" ? (sortAsc ? "↑" : "↓") : "↕"}
                  </th>
                  <th>Role</th>
                  <th>Department</th>
                  <th onClick={() => handleSort("date")} style={{ cursor: "pointer" }}>
                    Date {sortField === "date" ? (sortAsc ? "↑" : "↓") : "↕"}
                  </th>
                  <th onClick={() => handleSort("status")} style={{ cursor: "pointer" }}>
                    Status {sortField === "status" ? (sortAsc ? "↑" : "↓") : "↕"}
                  </th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th onClick={() => handleSort("workingHours")} style={{ cursor: "pointer" }}>
                    Working Hrs {sortField === "workingHours" ? (sortAsc ? "↑" : "↓") : "↕"}
                  </th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <div className="att-emp-cell">
                        <span className="att-emp-name">
                          {r.employee?.name || "—"}
                          {(r.employee?.employee_code || r.employee?.employeeCode) && (
                            <span style={{ marginLeft: 6, fontSize: "0.75rem", color: "var(--emp-primary, #6366f1)", fontWeight: 600 }}>
                              ({r.employee?.employee_code || r.employee?.employeeCode})
                            </span>
                          )}
                        </span>
                        <span className="att-emp-email">{r.employee?.email || "—"}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`att-role-badge att-role-${(r.employee?.role || "").toLowerCase()}`}>
                        {r.employee?.role || "—"}
                      </span>
                    </td>
                    <td>{r.employee?.department || "—"}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{fmtTime(r.checkIn)}</td>
                    <td>{fmtTime(r.checkOut)}</td>
                    <td>{fmtHours(r.workingHours)}</td>
                    <td className="att-remarks">{r.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="admin-att-count">
        Showing <strong>{filtered.length}</strong> of <strong>{records.length}</strong> records
      </p>
    </div>
  );
}