import React, { useState } from "react";
import { formatCurrency } from "../../../utils/formatCurrency";
import "./PayrollTrendChart.css";

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function PayrollTrendChart({ data = [], loading = false, error = null }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    placement: "top",
    monthName: "",
    gross: 0,
    net: 0,
    empCount: 0,
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

  const handleMouseMove = (e, d, monthName) => {
    const coords = getEventCoords(e);
    if (coords.clientX === undefined || coords.clientY === undefined) return;

    const winWidth = typeof window !== "undefined" ? window.innerWidth : 400;
    const clampedX = Math.max(120, Math.min(winWidth - 120, coords.clientX));
    const showBelow = coords.clientY < 140;

    setTooltip({
      visible: true,
      x: clampedX,
      y: coords.clientY,
      placement: showBelow ? "bottom" : "top",
      monthName,
      gross: d.totalGrossPay || 0,
      net: d.totalNetPay || 0,
      empCount: d.employeeCount || 0,
    });
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  if (loading) {
    return <div className="chart-loading-state">Loading payroll trend...</div>;
  }

  if (error) {
    return (
      <div className="chart-error-state">
        <p>{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="chart-empty-state">No payroll analytics available for this period.</div>;
  }

  // Sort by year and month
  const sortedData = [...data].sort((a, b) => {
    if (a._id.year !== b._id.year) return a._id.year - b._id.year;
    return a._id.month - b._id.month;
  });

  const maxVal = Math.max(
    ...sortedData.map((d) => Math.max(d.totalGrossPay || 0, d.totalNetPay || 0)),
    1000
  );

  const svgWidth = 650;
  const svgHeight = 280;
  const paddingX = 60;
  const paddingY = 40;
  const graphWidth = svgWidth - paddingX * 2;
  const graphHeight = svgHeight - paddingY * 2;

  const pointsCount = sortedData.length;
  const stepX = pointsCount > 1 ? graphWidth / (pointsCount - 1) : 0;

  const grossPoints = sortedData.map((d, i) => {
    const x = pointsCount === 1 ? svgWidth / 2 : paddingX + i * stepX;
    const y = paddingY + graphHeight - ((d.totalGrossPay || 0) / maxVal) * graphHeight;
    return { x, y, val: d.totalGrossPay, item: d };
  });

  const netPoints = sortedData.map((d, i) => {
    const x = pointsCount === 1 ? svgWidth / 2 : paddingX + i * stepX;
    const y = paddingY + graphHeight - ((d.totalNetPay || 0) / maxVal) * graphHeight;
    return { x, y, val: d.totalNetPay, item: d };
  });

  const grossPath = grossPoints.reduce(
    (acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`,
    ""
  );

  const netPath = netPoints.reduce(
    (acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`,
    ""
  );

  return (
    <div className="payroll-trend-container" onMouseLeave={handleMouseLeave}>
      <div className="chart-legend">
        <div className="legend-item">
          <span className="legend-dot gross-dot"></span>
          <span>Gross Pay</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot net-dot"></span>
          <span>Net Pay</span>
        </div>
      </div>

      <div className="svg-wrapper">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="trend-svg" style={{ overflow: "visible" }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = paddingY + graphHeight * (1 - ratio);
            const labelVal = maxVal * ratio;
            return (
              <g key={i}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={svgWidth - paddingX}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingX - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="11"
                >
                  {labelVal >= 1000 ? `${Math.round(labelVal / 1000)}k` : Math.round(labelVal)}
                </text>
              </g>
            );
          })}

          {/* Active Vertical Crosshair Guide */}
          {hoveredIdx !== null && grossPoints[hoveredIdx] && (
            <line
              x1={grossPoints[hoveredIdx].x}
              y1={paddingY}
              x2={grossPoints[hoveredIdx].x}
              y2={paddingY + graphHeight}
              stroke="#64748b"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              style={{ pointerEvents: "none", opacity: 0.75 }}
            />
          )}

          {/* Paths */}
          {sortedData.length > 1 && (
            <>
              <path d={grossPath} fill="none" stroke="#2563eb" strokeWidth="3" />
              <path d={netPath} fill="none" stroke="#059669" strokeWidth="3" />
            </>
          )}

          {/* Data Points */}
          {grossPoints.map((p, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g key={`gross-${idx}`} className="chart-point-group">
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 8 : 5}
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth={isHovered ? 3 : 2}
                  style={{
                    filter: isHovered ? "drop-shadow(0 0 6px rgba(37, 99, 235, 0.75))" : "none",
                    transition: "all 0.2s ease",
                  }}
                />
              </g>
            );
          })}

          {netPoints.map((p, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g key={`net-${idx}`} className="chart-point-group">
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 8 : 5}
                  fill="#059669"
                  stroke="#ffffff"
                  strokeWidth={isHovered ? 3 : 2}
                  style={{
                    filter: isHovered ? "drop-shadow(0 0 6px rgba(5, 150, 105, 0.75))" : "none",
                    transition: "all 0.2s ease",
                  }}
                />
              </g>
            );
          })}

          {/* Full Column Hitboxes for Effortless Hover */}
          {sortedData.map((d, idx) => {
            const x = grossPoints[idx].x;
            const colWidth = pointsCount > 1 ? stepX : 60;
            const isHovered = hoveredIdx === idx;
            const monthName = `${MONTH_NAMES[d._id.month] || d._id.month} ${d._id.year || ""}`;

            return (
              <g key={`hitbox-${idx}`}>
                {isHovered && (
                  <rect
                    x={x - colWidth / 2}
                    y={paddingY}
                    width={colWidth}
                    height={graphHeight}
                    fill="rgba(241, 245, 249, 0.45)"
                    rx="6"
                    style={{ pointerEvents: "none", transition: "all 0.15s ease" }}
                  />
                )}
                <rect
                  x={x - colWidth / 2}
                  y={paddingY}
                  width={colWidth}
                  height={graphHeight}
                  fill="transparent"
                  style={{ cursor: "pointer", touchAction: "manipulation" }}
                  onMouseEnter={(e) => {
                    setHoveredIdx(idx);
                    handleMouseMove(e, d, monthName);
                  }}
                  onMouseMove={(e) => {
                    handleMouseMove(e, d, monthName);
                  }}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={(e) => {
                    setHoveredIdx(idx);
                    handleMouseMove(e, d, monthName);
                  }}
                  onTouchMove={(e) => {
                    handleMouseMove(e, d, monthName);
                  }}
                />
              </g>
            );
          })}

          {/* X Axis Labels */}
          {sortedData.map((d, i) => {
            const x = pointsCount === 1 ? svgWidth / 2 : paddingX + i * stepX;
            const isHovered = hoveredIdx === i;
            return (
              <text
                key={i}
                x={x}
                y={svgHeight - 10}
                textAnchor="middle"
                fill={isHovered ? "#0f172a" : "#64748b"}
                fontSize={isHovered ? "13" : "12"}
                fontWeight={isHovered ? "700" : "500"}
                style={{ transition: "all 0.2s ease" }}
              >
                {`${MONTH_NAMES[d._id.month] || d._id.month}`}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Floating Obsidian Glassmorphism Tooltip */}
      {tooltip.visible && (
        <div
          className="payroll-chart-tooltip"
          style={{
            position: "fixed",
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: tooltip.placement === "bottom" ? "translate(-50%, 20px)" : "translate(-50%, -100%)",
            marginTop: tooltip.placement === "bottom" ? "0px" : "-14px",
            pointerEvents: "none",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            background: "rgba(15, 23, 42, 0.96)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            borderRadius: "10px",
            padding: "9px 15px",
            boxShadow: "0 10px 28px -4px rgba(0, 0, 0, 0.45)",
            color: "#ffffff",
            whiteSpace: "nowrap",
            maxWidth: "calc(100vw - 24px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", borderBottom: "1px solid rgba(255,255,255,0.12)", paddingBottom: "4px" }}>
            <strong style={{ fontSize: "12.5px", color: "#f8fafc" }}>
              {tooltip.monthName}
            </strong>
            <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>
              {tooltip.empCount} employees
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontSize: "11.5px", marginTop: "2px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#cbd5e1" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#38bdf8", display: "inline-block" }}></span>
                Gross Pay:
              </span>
              <strong style={{ color: "#38bdf8" }}>{formatCurrency(tooltip.gross)}</strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#cbd5e1" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#34d399", display: "inline-block" }}></span>
                Net Pay:
              </span>
              <strong style={{ color: "#34d399" }}>{formatCurrency(tooltip.net)}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
