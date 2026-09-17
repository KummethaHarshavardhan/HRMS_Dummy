import React from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../../context/ToastContext";
import { formatCurrency } from "../../../utils/formatCurrency";
import { exportReport } from "../../../services/reportService";
import { FiEye, FiDownload, FiFolder } from "react-icons/fi";
import "./ReportTable.css";

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function ReportTable({
  reports = [],
  loading = false,
  error = null,
  onRefresh,
}) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleExport = async (id, e) => {
    e.stopPropagation();
    try {
      await exportReport(id);
      showToast('success', 'Report exported to CSV successfully');
    } catch (err) {
      showToast('error', err.message || "Failed to export report");
    }
  };

  if (loading) {
    return (
      <div className="report-table-loading" style={{ padding: "48px 24px", textAlign: "center" }}>
        <div className="emp-spinner" style={{ margin: "0 auto 12px" }} />
        Loading reports...
      </div>
    );
  }

  if (error) {
    return (
      <div className="report-table-error">
        <p>{error}</p>
        {onRefresh && (
          <button className="retry-btn" onClick={onRefresh}>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <div className="report-table-empty" style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8" }}>
        <FiFolder size={36} style={{ margin: "0 auto 8px", color: "#cbd5e1" }} />
        <p style={{ margin: 0, fontWeight: 600, color: "#64748b" }}>No reports have been generated yet.</p>
      </div>
    );
  }

  return (
    <div className="report-table-container">
      <table className="report-table">
        <thead>
          <tr>
            <th>Report Type</th>
            <th>Period</th>
            <th>Department</th>
            <th>Employee Code</th>
            <th>Employee Name</th>
            <th>Employees</th>
            <th>Gross Pay</th>
            <th>Deductions</th>
            <th>Net Pay</th>
            <th>Generated Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => {
            const id = report._id;
            const type = report.reportType || "N/A";
            const monthText = report.month ? MONTH_NAMES[report.month] : "";
            const period = [monthText, report.year].filter(Boolean).join(" ") || "All Periods";
            const summary = report.summary || {};
            const generatedAtStr = report.generatedAt || report.createdAt
              ? new Date(report.generatedAt || report.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "N/A";

            const empObj = report.employee || (typeof report.employeeId === "object" ? report.employeeId : null);
            const empCode = empObj?.employeeCode || empObj?.employee_code || (report.reportType === "employee" ? "EMP" : "All Employees");
            const empName = empObj?.fullName || empObj?.user_id?.name || (report.reportType === "employee" ? "Employee" : "All Employees");
            const dept = report.department || empObj?.department || empObj?.department_id?.departmentName || "All Departments";

            return (
              <tr key={id} onClick={() => navigate(`/reports/${id}`)} style={{ cursor: "pointer" }}>
                <td>
                  <span className={`type-badge type-${type}`}>
                    {type.toUpperCase()}
                  </span>
                </td>
                <td>{period}</td>
                <td>{dept}</td>
                <td className="emp-id-text">{empCode}</td>
                <td>{empName}</td>
                <td>{summary.totalEmployees ?? 0}</td>
                <td>{formatCurrency(summary.totalGrossPay || 0)}</td>
                <td>{formatCurrency(summary.totalDeductions || 0)}</td>
                <td className="net-pay-text">{formatCurrency(summary.totalNetPay || 0)}</td>
                <td className="date-text">{generatedAtStr}</td>
                <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="action-btn view-btn"
                    onClick={() => navigate(`/reports/${id}`)}
                    title="View Details"
                    aria-label="View Report Details"
                  >
                    <FiEye size={13} style={{ marginRight: 4 }} /> View
                  </button>
                  <button
                    type="button"
                    className="action-btn export-btn"
                    onClick={(e) => handleExport(id, e)}
                    title="Export CSV"
                    aria-label="Export Report CSV"
                  >
                    <FiDownload size={13} style={{ marginRight: 4 }} /> Export
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
