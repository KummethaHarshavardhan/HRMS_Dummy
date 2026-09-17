import React, { useState } from "react";
import { formatCurrency } from "../../../utils/formatCurrency";
import "./DeductionBreakdownChart.css";

export default function DeductionBreakdownChart({ data = {}, loading = false, error = null }) {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    placement: "top",
    title: "",
    value: "",
    percentage: "",
    color: "",
  });

  const getEventCoords = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  const handleMouseMove = (e, item, pct) => {
    const coords = getEventCoords(e);
    if (coords.clientX === undefined || coords.clientY === undefined) return;

    const winWidth = typeof window !== "undefined" ? window.innerWidth : 400;
    const clampedX = Math.max(110, Math.min(winWidth - 110, coords.clientX));
    const showBelow = coords.clientY < 130;

    setTooltip({
      visible: true,
      x: clampedX,
      y: coords.clientY,
      placement: showBelow ? "bottom" : "top",
      title: item.label,
      value: formatCurrency(item.value),
      percentage: `${pct}%`,
      color: item.color,
    });
  };

  const handleMouseLeave = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
    setHoveredItem(null);
  };

  if (loading) {
    return <div className="chart-loading-state">Loading deduction breakdown...</div>;
  }

  if (error) {
    return <div className="chart-error-state">{error}</div>;
  }

  // New backend sends: { totalDeductions, totalBasicSalary, totalHRA, totalAllowances, totalBonus }
  // Old Payslip backend sent: { totalTax, totalProvidentFund, totalInsurance, totalOther }
  // Support both shapes for backward compatibility.
  const hasNewShape = data?.totalBasicSalary !== undefined || data?.totalHRA !== undefined;

  let items = [];
  let totalAmount = 0;

  if (hasNewShape) {
    // Show earnings breakdown (what makes up gross salary)
    const basic = data?.totalBasicSalary || 0;
    const hra = data?.totalHRA || 0;
    const allowances = data?.totalAllowances || 0;
    const bonus = data?.totalBonus || 0;
    const deductions = data?.totalDeductions || 0;

    totalAmount = basic + hra + allowances + bonus;

    if (totalAmount === 0 && deductions === 0) {
      return <div className="chart-empty-state">No deduction data recorded for this period.</div>;
    }

    if (totalAmount === 0) {
      // Only deductions available – show as single bar
      items = [{ label: "Total Deductions", value: deductions, color: "#dc2626" }];
      totalAmount = deductions;
    } else {
      items = [
        { label: "Basic Salary", value: basic, color: "#2563eb" },
        { label: "HRA", value: hra, color: "#059669" },
        { label: "Allowances", value: allowances, color: "#7c3aed" },
        { label: "Bonus", value: bonus, color: "#d97706" },
        { label: "Total Deductions", value: deductions, color: "#dc2626" },
      ].filter((i) => i.value > 0);
    }
  } else {
    // Legacy Payslip shape
    const tax = data?.totalTax || 0;
    const pf = data?.totalProvidentFund || 0;
    const insurance = data?.totalInsurance || 0;
    const other = data?.totalOther || 0;

    totalAmount = tax + pf + insurance + other;

    if (totalAmount === 0) {
      return <div className="chart-empty-state">No deduction data recorded for this period.</div>;
    }

    items = [
      { label: "Tax (TDS)", value: tax, color: "#dc2626" },
      { label: "Provident Fund (PF)", value: pf, color: "#2563eb" },
      { label: "Health Insurance", value: insurance, color: "#059669" },
      { label: "Other Deductions", value: other, color: "#d97706" },
    ];
  }

  // SVG Donut calculation
  const size = 170;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentAngle = 0;

  return (
    <div className="deduction-chart-wrapper" onMouseLeave={handleMouseLeave}>
      <div className="donut-visual">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
          {items.map((item, idx) => {
            if (item.value <= 0) return null;
            const strokeDasharray = `${(item.value / totalAmount) * circumference} ${circumference}`;
            const strokeDashoffset = -currentAngle;
            currentAngle += (item.value / totalAmount) * circumference;
            const pct = Math.round((item.value / totalAmount) * 100);
            const isHovered = hoveredItem?.label === item.label;

            return (
              <circle
                key={idx}
                className="deduction-donut-segment"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{
                  opacity: hoveredItem && !isHovered ? 0.35 : 1,
                  filter: isHovered ? "drop-shadow(0 4px 12px rgba(0,0,0,0.28))" : "none",
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  setHoveredItem({ ...item, pct });
                  handleMouseMove(e, item, pct);
                }}
                onMouseMove={(e) => {
                  handleMouseMove(e, item, pct);
                }}
                onMouseLeave={handleMouseLeave}
                onTouchStart={(e) => {
                  setHoveredItem({ ...item, pct });
                  handleMouseMove(e, item, pct);
                }}
                onTouchMove={(e) => {
                  handleMouseMove(e, item, pct);
                }}
              />
            );
          })}
        </svg>
        <div className="donut-center-text" style={{ pointerEvents: "none", transition: "all 0.25s ease" }}>
          <span
            className="donut-total-title"
            style={{
              color: hoveredItem ? "#0f172a" : "#64748b",
              fontWeight: 700,
              fontSize: "11px",
              transition: "color 0.2s ease",
            }}
          >
            {hoveredItem ? hoveredItem.label : "Total"}
          </span>
          <span
            className="donut-total-value"
            style={{
              color: hoveredItem ? hoveredItem.color : "#0f172a",
              transform: hoveredItem ? "scale(1.06)" : "scale(1)",
              transition: "all 0.2s ease",
            }}
          >
            {formatCurrency(hoveredItem ? hoveredItem.value : totalAmount)}
          </span>
          {hoveredItem && (
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                color: hoveredItem.color,
                marginTop: 2,
              }}
            >
              {hoveredItem.pct}% of total
            </span>
          )}
        </div>
      </div>

      <div className="deduction-legend-list">
        {items.map((item, idx) => {
          const pct = Math.round((item.value / totalAmount) * 100);
          const isHovered = hoveredItem?.label === item.label;
          return (
            <div
              key={idx}
              className={`deduction-legend-row ${isHovered ? "active" : ""}`}
              style={{
                cursor: "pointer",
                backgroundColor: isHovered ? "rgba(241, 245, 249, 0.95)" : "#f8fafc",
                borderColor: isHovered ? item.color : "transparent",
                transform: isHovered ? "translateX(4px)" : "none",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                setHoveredItem({ ...item, pct });
                handleMouseMove(e, item, pct);
              }}
              onMouseMove={(e) => {
                handleMouseMove(e, item, pct);
              }}
              onMouseLeave={handleMouseLeave}
              onTouchStart={(e) => {
                setHoveredItem({ ...item, pct });
                handleMouseMove(e, item, pct);
              }}
            >
              <div className="legend-label-group">
                <span
                  className="legend-badge"
                  style={{
                    backgroundColor: item.color,
                    transform: isHovered ? "scale(1.3)" : "scale(1)",
                    boxShadow: isHovered ? `0 0 8px ${item.color}` : "none",
                    transition: "all 0.2s ease",
                  }}
                />
                <span className="legend-text" style={{ color: isHovered ? "#0f172a" : "#334155", fontWeight: isHovered ? 700 : 500 }}>
                  {item.label}
                </span>
              </div>
              <div className="legend-val-group">
                <span className="legend-amount">{formatCurrency(item.value)}</span>
                <span className="legend-pct">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Cursor Tooltip */}
      {tooltip.visible && (
        <div
          className="deduction-chart-tooltip"
          style={{
            position: "fixed",
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: tooltip.placement === "bottom" ? "translate(-50%, 20px)" : "translate(-50%, -100%)",
            marginTop: tooltip.placement === "bottom" ? "0px" : "-14px",
            pointerEvents: "none",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "rgba(15, 23, 42, 0.96)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            borderRadius: "10px",
            padding: "8px 14px",
            boxShadow: "0 10px 28px -4px rgba(0, 0, 0, 0.45)",
            color: "#ffffff",
            whiteSpace: "nowrap",
            maxWidth: "calc(100vw - 24px)",
          }}
        >
          {tooltip.color && (
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: tooltip.color,
                boxShadow: `0 0 8px ${tooltip.color}`,
                flexShrink: 0,
              }}
            />
          )}
          <div>
            <strong style={{ fontSize: "12px", display: "block", color: "#f8fafc", lineHeight: 1.2 }}>
              {tooltip.title}
            </strong>
            <span style={{ fontSize: "11px", color: "#cbd5e1" }}>
              {tooltip.value} ({tooltip.percentage})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
