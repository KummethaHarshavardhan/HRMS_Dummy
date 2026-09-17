import React, { useState } from "react";
import { formatCurrency } from "../../../utils/formatCurrency";
import "./DepartmentBreakdownChart.css";

const DEPT_COLORS = ["#2563eb", "#059669", "#7c3aed", "#d97706", "#dc2626", "#0891b2", "#475569"];

export default function DepartmentBreakdownChart({ data = [], loading = false, error = null }) {
  const [hoveredDept, setHoveredDept] = useState(null);

  if (loading) {
    return <div className="chart-loading-state">Loading department breakdown...</div>;
  }

  if (error) {
    return <div className="chart-error-state">{error}</div>;
  }

  if (!data || data.length === 0) {
    return <div className="chart-empty-state">No department breakdown data available.</div>;
  }

  const maxNetPay = Math.max(...data.map((d) => d.totalNetPay || 0), 1000);
  const totalCompanyNet = data.reduce((acc, d) => acc + (d.totalNetPay || 0), 0);

  return (
    <div className="dept-breakdown-container">
      <div className="dept-bars-list">
        {data.map((item, idx) => {
          // New backend shape: { department, totalNetPay, totalGrossPay, employeeCount }
          // Old shape: { _id, totalNetPay, employeeCount }
          const deptName = item.department || item._id || "Unassigned";
          const percentage = Math.round(((item.totalNetPay || 0) / maxNetPay) * 100);
          const sharePct = totalCompanyNet > 0 ? Math.round(((item.totalNetPay || 0) / totalCompanyNet) * 100) : 0;
          const color = DEPT_COLORS[idx % DEPT_COLORS.length];
          const isHovered = hoveredDept === idx;
          const avgPerEmp = (item.employeeCount || 0) > 0 ? Math.round((item.totalNetPay || 0) / item.employeeCount) : 0;

          return (
            <div
              key={deptName + idx}
              className={`dept-bar-item ${isHovered ? "active" : ""}`}
              onClick={() => setHoveredDept(hoveredDept === idx ? null : idx)}
              onMouseEnter={() => setHoveredDept(idx)}
              onMouseLeave={() => setHoveredDept(null)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: isHovered ? "rgba(241, 245, 249, 0.85)" : "transparent",
                border: isHovered ? "1px solid #cbd5e1" : "1px solid transparent",
                transform: isHovered ? "translateX(4px)" : "none",
                transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
                cursor: "pointer",
              }}
            >
              <div className="dept-bar-header">
                <div className="dept-name-wrapper">
                  <span
                    className="dept-color-badge"
                    style={{
                      backgroundColor: color,
                      transform: isHovered ? "scale(1.3)" : "scale(1)",
                      boxShadow: isHovered ? `0 0 8px ${color}` : "none",
                      transition: "all 0.2s ease",
                    }}
                  ></span>
                  <span className="dept-name" style={{ color: isHovered ? "#0f172a" : "#1e293b", fontWeight: isHovered ? 700 : 600 }}>
                    {deptName}
                  </span>
                  <span className="dept-emp-count">
                    ({item.employeeCount || 0} emp)
                  </span>
                  {isHovered && avgPerEmp > 0 && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: color,
                        background: "rgba(255, 255, 255, 0.9)",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        border: `1px solid ${color}44`,
                      }}
                    >
                      avg {formatCurrency(avgPerEmp)}/emp
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="dept-amount">{formatCurrency(item.totalNetPay || 0)}</span>
                  <span style={{ fontSize: "11.5px", fontWeight: 600, color: isHovered ? color : "#94a3b8" }}>
                    ({sharePct}%)
                  </span>
                </div>
              </div>
              <div className="dept-progress-track">
                <div
                  className="dept-progress-fill"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: color,
                    boxShadow: isHovered ? `0 0 10px ${color}88` : "none",
                    filter: isHovered ? "brightness(1.08)" : "none",
                    transition: "width 0.4s ease-out, box-shadow 0.2s ease, filter 0.2s ease",
                  }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
