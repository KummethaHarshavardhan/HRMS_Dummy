import React, { useState, useEffect, useMemo } from "react";
import {
  FiBarChart2,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiUsers,
  FiDownload,
  FiLayers,
  FiFileText,
  FiTrendingUp,
  FiCalendar,
  FiRefreshCw,
  FiArrowRight,
  FiArrowLeft,
  FiSearch,
} from "react-icons/fi";
import { taskReportService } from "../../../services/taskReportService.js";
import Card from "../../../components/Card/Card.jsx";
import Table from "../../../components/Table/Table.jsx";
import Button from "../../../components/Button/Button.jsx";
import Loader from "../../../components/Loader/Loader.jsx";
import "../TaskMonitoring.css";
import "./ReportsOverviewPage.css";

export default function ReportsOverviewPage() {
  const [activeTab, setActiveTab] = useState("overview"); // "overview", "candidates", "teams", "tasks"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [overview, setOverview] = useState({
    kpi: {},
    statusDistribution: [],
    priorityDistribution: [],
    deadlineStats: {},
  });
  const [candidateReport, setCandidateReport] = useState([]);
  const [teamReport, setTeamReport] = useState([]);
  const [taskReport, setTaskReport] = useState([]);

  // Search filter for detailed views
  const [searchQuery, setSearchQuery] = useState("");

  // Hover states & cursor tracking for charts
  const [hoveredDonut, setHoveredDonut] = useState(null);
  const [hoveredVelocity, setHoveredVelocity] = useState(null);
  const [activeVelocityFilter, setActiveVelocityFilter] = useState(null);
  const [hoveredDeadlineBar, setHoveredDeadlineBar] = useState(null);
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

  const handleMouseMove = (e, title, value, percentage, color) => {
    const coords = getEventCoords(e);
    if (coords.clientX === undefined || coords.clientY === undefined) return;

    const winWidth = typeof window !== "undefined" ? window.innerWidth : 400;
    const clampedX = Math.max(100, Math.min(winWidth - 100, coords.clientX));
    const showBelow = coords.clientY < 130;

    setTooltip({
      visible: true,
      x: clampedX,
      y: coords.clientY,
      placement: showBelow ? "bottom" : "top",
      title,
      value,
      percentage,
      color,
    });
  };

  const handleMouseLeave = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
    setHoveredDonut(null);
    setHoveredVelocity(null);
    setHoveredDeadlineBar(null);
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const [resOverview, resCandidates, resTeams, resTasks] = await Promise.all([
        taskReportService.getOverview(),
        taskReportService.getCandidateReports(),
        taskReportService.getTeamReports(),
        taskReportService.getTaskReports(),
      ]);

      setOverview(resOverview.data || {});
      setCandidateReport(resCandidates.data?.report || []);
      setTeamReport(resTeams.data?.report || []);
      setTaskReport(resTasks.data?.report || []);
    } catch (err) {
      console.error("Failed to load task monitoring reports:", err);
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const { kpi = {}, statusDistribution = [], deadlineStats = {} } = overview;

  // Filtered lists for detail tables
  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidateReport;
    const q = searchQuery.toLowerCase();
    return candidateReport.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.team?.toLowerCase().includes(q) ||
        c.department?.toLowerCase().includes(q)
    );
  }, [candidateReport, searchQuery]);

  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return teamReport;
    const q = searchQuery.toLowerCase();
    return teamReport.filter((t) => t.team?.toLowerCase().includes(q));
  }, [teamReport, searchQuery]);

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return taskReport;
    const q = searchQuery.toLowerCase();
    return taskReport.filter(
      (t) =>
        t.taskTitle?.toLowerCase().includes(q) ||
        t.candidateName?.toLowerCase().includes(q) ||
        t.candidateTeam?.toLowerCase().includes(q) ||
        t.status?.toLowerCase().includes(q)
    );
  }, [taskReport, searchQuery]);

  // Candidate Report Columns
  const candidateColumns = [
    {
      key: "name",
      header: "Candidate",
      width: "25%",
      render: (row) => (
        <div>
          <strong style={{ fontSize: "13px", color: "var(--slate-900, #0f172a)", display: "block" }}>
            {row.name}
          </strong>
          <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)" }}>{row.email}</span>
        </div>
      ),
    },
    {
      key: "team",
      header: "Team / Department",
      width: "20%",
      render: (row) => (
        <div>
          <span style={{ fontWeight: 600, fontSize: "12px", color: "#4f46e5" }}>{row.team}</span>
          <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)", display: "block" }}>
            {row.department}
          </span>
        </div>
      ),
    },
    {
      key: "assigned",
      header: "Assigned / Completed",
      width: "15%",
      render: (row) => (
        <span style={{ fontSize: "12px", fontWeight: 700 }}>
          {row.completed} / {row.totalAssigned}
        </span>
      ),
    },
    {
      key: "rework",
      header: "Rework Count",
      width: "12%",
      render: (row) => (
        <span style={{ fontSize: "12px", fontWeight: 600, color: row.reworkCount > 0 ? "#d97706" : "#64748b" }}>
          {row.reworkCount}
        </span>
      ),
    },
    {
      key: "completion",
      header: "Completion Rate",
      width: "14%",
      render: (row) => (
        <span style={{ fontWeight: 800, fontSize: "13px", color: row.completionPercentage >= 70 ? "#059669" : "#2563eb" }}>
          {row.completionPercentage}%
        </span>
      ),
    },
    {
      key: "onTime",
      header: "On-Time Rate",
      width: "14%",
      render: (row) => (
        <span style={{ fontWeight: 800, fontSize: "13px", color: row.onTimePercentage >= 80 ? "#059669" : "#d97706" }}>
          {row.onTimePercentage}%
        </span>
      ),
    },
  ];

  // Team Report Columns
  const teamColumns = [
    {
      key: "team",
      header: "Team",
      width: "25%",
      render: (row) => <strong style={{ fontSize: "13px", color: "#4f46e5" }}>{row.team}</strong>,
    },
    {
      key: "candidates",
      header: "Headcount",
      width: "15%",
      render: (row) => <span>{row.totalCandidates} candidates</span>,
    },
    {
      key: "tasks",
      header: "Total Tasks",
      width: "20%",
      render: (row) => (
        <div>
          <strong style={{ fontSize: "13px" }}>{row.totalTasks}</strong>
          <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)", display: "block" }}>
            {row.completed} completed &bull; {row.overdue} overdue
          </span>
        </div>
      ),
    },
    {
      key: "completion",
      header: "Completion Rate",
      width: "20%",
      render: (row) => (
        <div className="tm-progress-wrapper">
          <div className="tm-progress-track">
            <div
              className="tm-progress-fill"
              style={{
                width: `${row.averageCompletionPercentage}%`,
                backgroundColor: row.averageCompletionPercentage >= 75 ? "#10b981" : "#4f46e5",
              }}
            />
          </div>
          <span className="tm-progress-text">{row.averageCompletionPercentage}%</span>
        </div>
      ),
    },
    {
      key: "onTime",
      header: "On-Time Delivery",
      width: "20%",
      render: (row) => (
        <span style={{ fontWeight: 800, color: "#059669", fontSize: "13px" }}>
          {row.onTimePercentage}%
        </span>
      ),
    },
  ];

  // Task Report Columns
  const taskColumns = [
    {
      key: "task",
      header: "Task",
      width: "30%",
      render: (row) => (
        <div>
          <strong style={{ fontSize: "13px", color: "var(--slate-900, #0f172a)", display: "block" }}>
            {row.taskTitle}
          </strong>
          <span className={`tm-badge tm-priority-${row.priority?.toLowerCase()}`} style={{ fontSize: "10px", marginTop: 4 }}>
            {row.priority}
          </span>
        </div>
      ),
    },
    {
      key: "candidate",
      header: "Candidate & Team",
      width: "20%",
      render: (row) => (
        <div>
          <strong style={{ fontSize: "13px" }}>{row.candidateName}</strong>
          <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)", display: "block" }}>
            {row.candidateTeam}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "15%",
      render: (row) => {
        const s = row.status?.toLowerCase().replace("_", "-");
        return <span className={`tm-badge tm-badge-${s}`}>{row.status}</span>;
      },
    },
    {
      key: "deadline",
      header: "Deadline",
      width: "15%",
      render: (row) => (
        <div>
          <span style={{ fontSize: "12px" }}>{row.deadline ? new Date(row.deadline).toLocaleDateString() : "-"}</span>
          {row.isOverdue && (
            <span className="tm-badge tm-badge-overdue" style={{ marginLeft: 6 }}>
              OVERDUE
            </span>
          )}
        </div>
      ),
    },
    {
      key: "review",
      header: "Latest Review",
      width: "20%",
      render: (row) => (
        <div>
          <strong
            style={{
              fontSize: "12px",
              color:
                row.latestReviewDecision === "APPROVED"
                  ? "#059669"
                  : row.latestReviewDecision === "REWORK_REQUIRED"
                  ? "#d97706"
                  : "#64748b",
            }}
          >
            {row.latestReviewDecision || "PENDING"}
          </strong>
          {row.latestReviewComments && (
            <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)", display: "block" }}>
              {row.latestReviewComments.slice(0, 50)}...
            </span>
          )}
        </div>
      ),
    },
  ];

  const handleExportCSV = () => {
    let headers = [];
    let rows = [];

    if (activeTab === "candidates") {
      headers = ["Candidate Name", "Email", "Team", "Department", "Total Assigned", "Completed", "Completion %", "On-Time %", "Rework Count"];
      rows = candidateReport.map((c) => [
        `"${c.name}"`,
        `"${c.email}"`,
        `"${c.team}"`,
        `"${c.department}"`,
        c.totalAssigned,
        c.completed,
        `${c.completionPercentage}%`,
        `${c.onTimePercentage}%`,
        c.reworkCount,
      ]);
    } else if (activeTab === "teams") {
      headers = ["Team Name", "Candidates", "Total Tasks", "Completed", "Overdue", "Completion %", "On-Time %"];
      rows = teamReport.map((t) => [
        `"${t.team}"`,
        t.totalCandidates,
        t.totalTasks,
        t.completed,
        t.overdue,
        `${t.averageCompletionPercentage}%`,
        `${t.onTimePercentage}%`,
      ]);
    } else {
      headers = ["Task Title", "Priority", "Candidate", "Team", "Status", "Deadline", "Is Overdue", "Review Decision"];
      rows = taskReport.map((t) => [
        `"${t.taskTitle}"`,
        t.priority,
        `"${t.candidateName}"`,
        `"${t.candidateTeam}"`,
        t.status,
        t.deadline ? new Date(t.deadline).toLocaleDateString() : "",
        t.isOverdue ? "YES" : "NO",
        t.latestReviewDecision || "PENDING",
      ]);
    }

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `evaluation_report_${activeTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── CHARTS CALCULATION HELPERS ──

  // 1. Donut Chart Calculations
  const donutItems = useMemo(() => {
    const defaultColorMap = {
      Completed: "#10b981",
      "In Progress": "#0ea5e9",
      Submitted: "#818cf8",
      Pending: "#94a3b8",
      "Rework Required": "#f59e0b",
    };

    if (statusDistribution && statusDistribution.length > 0) {
      return statusDistribution.map((s) => ({
        name: s.name,
        value: s.value || 0,
        color: s.color || defaultColorMap[s.name] || "#64748b",
      }));
    }

    return [
      { name: "Completed", value: kpi.completedTasks || 0, color: "#10b981" },
      { name: "In Progress", value: kpi.inProgressTasks || 0, color: "#0ea5e9" },
      { name: "Submitted", value: kpi.submittedTasks || 0, color: "#818cf8" },
      { name: "Pending", value: kpi.pendingTasks || 0, color: "#94a3b8" },
      { name: "Rework Required", value: kpi.reworkTasks || 0, color: "#f59e0b" },
    ];
  }, [statusDistribution, kpi]);

  const totalDonutTasks = useMemo(() => {
    return donutItems.reduce((acc, item) => acc + item.value, 0);
  }, [donutItems]);

  const donutSize = 180;
  const strokeWidth = 24;
  const donutRadius = (donutSize - strokeWidth) / 2;
  const donutCircumference = 2 * Math.PI * donutRadius;

  // 2. Team Comparative Velocity Chart Calculations
  const teamVelocityData = useMemo(() => {
    if (teamReport && teamReport.length > 0) {
      return teamReport.slice(0, 5).map((t) => ({
        name: t.team || "Team",
        total: t.totalTasks || 0,
        completed: t.completed || 0,
        overdue: t.overdue || 0,
      }));
    }
    // Fallback default teams
    return [
      { name: "Team Alpha", total: 0, completed: 0, overdue: 0 },
      { name: "Team Beta", total: 0, completed: 0, overdue: 0 },
      { name: "Team Gamma", total: 0, completed: 0, overdue: 0 },
      { name: "Team Delta", total: 0, completed: 0, overdue: 0 },
    ];
  }, [teamReport]);

  const maxVelocity = useMemo(() => {
    let max = 4;
    teamVelocityData.forEach((t) => {
      if (t.total > max) max = t.total;
    });
    return Math.ceil(max * 1.2);
  }, [teamVelocityData]);

  // 3. Deadline Timeliness Chart Calculations
  const deadlineBars = useMemo(() => {
    return [
      { label: "On Time", count: deadlineStats.completedOnTime || 0, color: "#10b981" },
      { label: "Due Today", count: deadlineStats.dueToday || 0, color: "#f59e0b" },
      { label: "Overdue", count: deadlineStats.overdue || 0, color: "#ef4444" },
      { label: "Upcoming", count: deadlineStats.upcoming || 0, color: "#0ea5e9" },
    ];
  }, [deadlineStats]);

  const totalDeadlineTasks = useMemo(() => {
    return deadlineBars.reduce((acc, bar) => acc + (bar.count || 0), 0);
  }, [deadlineBars]);

  const maxDeadline = useMemo(() => {
    let max = 4;
    deadlineBars.forEach((b) => {
      if (b.count > max) max = b.count;
    });
    return Math.ceil(max * 1.25);
  }, [deadlineBars]);

  return (
    <div className="epr-page-container">
      {/* ── Page Header ── */}
      <div className="epr-header">
        <div className="epr-header-left">
          <div className="epr-breadcrumb">
            Reports & Analytics <span>/</span> Evaluation
          </div>
          <h1 className="epr-title">Evaluation & Performance Reports</h1>
          <p className="epr-subtitle">
            Holistic reporting across candidate velocity, team health, and task completion metrics
          </p>
        </div>

        <div className="epr-header-actions">
          {/* Action Pills */}
          <button
            type="button"
            className={`epr-pill-btn ${activeTab === "candidates" ? "active" : ""}`}
            onClick={() => setActiveTab("candidates")}
          >
            <FiUsers size={15} /> Candidate Report
          </button>
          <button
            type="button"
            className={`epr-pill-btn ${activeTab === "teams" ? "active" : ""}`}
            onClick={() => setActiveTab("teams")}
          >
            <FiLayers size={15} /> Team Report
          </button>
          <button
            type="button"
            className={`epr-pill-btn ${activeTab === "tasks" ? "active" : ""}`}
            onClick={() => setActiveTab("tasks")}
          >
            <FiFileText size={15} /> Task-Wise Audit Report
          </button>

          {/* Utility Buttons */}
          <button type="button" className="epr-action-btn-outline" onClick={handleExportCSV}>
            <FiDownload size={14} /> Export (.CSV)
          </button>
          <button type="button" className="epr-action-btn-primary" onClick={fetchReports}>
            <FiRefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <Loader.Spinner size="lg" />
          <p style={{ marginTop: 12, color: "#64748b", fontSize: "0.9rem" }}>Loading performance intelligence...</p>
        </div>
      ) : activeTab === "overview" ? (
        <>
          {/* ── 4 KPI Stats Row ── */}
          <div className="epr-kpi-grid">
            {/* Card 1: Completion Efficiency */}
            <div className="epr-kpi-card">
              <div className="epr-kpi-icon-box epr-icon-emerald">
                <FiTrendingUp />
              </div>
              <div className="epr-kpi-info">
                <span className="epr-kpi-label">COMPLETION EFFICIENCY</span>
                <span className="epr-kpi-value">{kpi.completionRate || 0}%</span>
                <span className="epr-kpi-subtext">
                  {kpi.completedTasks || 0} of {kpi.totalAssignments || 0} tasks
                </span>
              </div>
            </div>

            {/* Card 2: On-Time Completion */}
            <div className="epr-kpi-card">
              <div className="epr-kpi-icon-box epr-icon-blue">
                <FiClock />
              </div>
              <div className="epr-kpi-info">
                <span className="epr-kpi-label">ON-TIME COMPLETION</span>
                <span className="epr-kpi-value">{kpi.onTimeRate || 0}%</span>
                <span className="epr-kpi-subtext">Met target deadline</span>
              </div>
            </div>

            {/* Card 3: Overdue Ratio */}
            <div className="epr-kpi-card">
              <div className="epr-kpi-icon-box epr-icon-coral">
                <FiBarChart2 />
              </div>
              <div className="epr-kpi-info">
                <span className="epr-kpi-label">OVERDUE RATIO</span>
                <span className="epr-kpi-value">{kpi.overdueTasks || 0}</span>
                <span className="epr-kpi-subtext">Active delayed tasks</span>
              </div>
            </div>

            {/* Card 4: Active Reworks */}
            <div className="epr-kpi-card">
              <div className="epr-kpi-icon-box epr-icon-amber">
                <FiRefreshCw />
              </div>
              <div className="epr-kpi-info">
                <span className="epr-kpi-label">ACTIVE REWORKS</span>
                <span className="epr-kpi-value">{kpi.reworkTasks || 0}</span>
                <span className="epr-kpi-subtext">Revision cycle</span>
              </div>
            </div>
          </div>

          {/* ── Middle Row: 3 Chart Cards ── */}
          <div className="epr-charts-grid">
            {/* Chart 1: Task Status Breakdown (Donut) */}
            <div className="epr-chart-card">
              <div className="epr-chart-header">
                <div>
                  <h3 className="epr-chart-title">Task Status Breakdown</h3>
                  <p className="epr-chart-subtitle">Distribution of all lifecycle stages</p>
                </div>
              </div>

              <div className="epr-donut-wrapper">
                <div className="epr-donut-svg-container">
                  <svg
                    width={donutSize}
                    height={donutSize}
                    viewBox={`0 0 ${donutSize} ${donutSize}`}
                    style={{ overflow: "visible" }}
                  >
                    {totalDonutTasks === 0 ? (
                      <circle
                        cx={donutSize / 2}
                        cy={donutSize / 2}
                        r={donutRadius}
                        fill="transparent"
                        stroke="#e2e8f0"
                        strokeWidth={strokeWidth}
                      />
                    ) : (
                      (() => {
                        let accumulatedOffset = 0;
                        return donutItems.map((item, idx) => {
                          if (item.value <= 0) return null;
                          const dash = (item.value / totalDonutTasks) * donutCircumference;
                          const strokeDasharray = `${dash} ${donutCircumference}`;
                          const strokeDashoffset = -accumulatedOffset;
                          accumulatedOffset += dash;

                          const isHovered = hoveredDonut?.name === item.name;
                          const percent = totalDonutTasks > 0 ? Math.round((item.value / totalDonutTasks) * 100) : 0;

                          return (
                            <circle
                              key={idx}
                              className="epr-donut-segment"
                              cx={donutSize / 2}
                              cy={donutSize / 2}
                              r={donutRadius}
                              fill="transparent"
                              stroke={item.color}
                              strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              transform={`rotate(-90 ${donutSize / 2} ${donutSize / 2})`}
                              style={{
                                opacity: hoveredDonut && !isHovered ? 0.35 : 1,
                                filter: isHovered ? "drop-shadow(0 4px 10px rgba(0,0,0,0.22))" : "none",
                                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                                cursor: "pointer",
                              }}
                              onMouseEnter={(e) => {
                                setHoveredDonut({ ...item, percentage: percent });
                                handleMouseMove(e, item.name, `${item.value} Tasks`, `${percent}%`, item.color);
                              }}
                              onMouseMove={(e) => {
                                handleMouseMove(e, item.name, `${item.value} Tasks`, `${percent}%`, item.color);
                              }}
                              onMouseLeave={handleMouseLeave}
                              onTouchStart={(e) => {
                                setHoveredDonut({ ...item, percentage: percent });
                                handleMouseMove(e, item.name, `${item.value} Tasks`, `${percent}%`, item.color);
                              }}
                              onTouchMove={(e) => {
                                handleMouseMove(e, item.name, `${item.value} Tasks`, `${percent}%`, item.color);
                              }}
                            />
                          );
                        });
                      })()
                    )}
                  </svg>

                  <div className="epr-donut-center-label" style={{ transition: "all 0.25s ease" }}>
                    <div
                      className="epr-donut-center-count"
                      style={{
                        color: hoveredDonut ? hoveredDonut.color : "#0f172a",
                        transform: hoveredDonut ? "scale(1.08)" : "scale(1)",
                        transition: "all 0.25s ease",
                      }}
                    >
                      {hoveredDonut ? hoveredDonut.value : totalDonutTasks}
                    </div>
                    <div
                      className="epr-donut-center-text"
                      style={{
                        fontWeight: 700,
                        color: hoveredDonut ? "#0f172a" : "#64748b",
                        transition: "color 0.2s ease",
                      }}
                    >
                      {hoveredDonut ? hoveredDonut.name : "Total Tasks"}
                    </div>
                    {hoveredDonut && (
                      <div
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 700,
                          color: hoveredDonut.color,
                          marginTop: 2,
                          animation: "eprFadeIn 0.15s ease",
                        }}
                      >
                        {hoveredDonut.percentage}% of tasks
                      </div>
                    )}
                  </div>
                </div>

                {/* Donut Legend */}
                <div className="epr-chart-legend">
                  {donutItems.map((item) => {
                    const isHovered = hoveredDonut?.name === item.name;
                    const percent = totalDonutTasks > 0 ? Math.round((item.value / totalDonutTasks) * 100) : 0;
                    return (
                      <div
                        key={item.name}
                        className={`epr-legend-item ${isHovered ? "active" : ""}`}
                        style={{
                          cursor: "pointer",
                          padding: "4px 8px",
                          borderRadius: 6,
                          background: isHovered ? "#f1f5f9" : "transparent",
                          transition: "all 0.2s ease",
                          transform: isHovered ? "translateY(-1px)" : "none",
                        }}
                        onMouseEnter={(e) => {
                          setHoveredDonut({ ...item, percentage: percent });
                          handleMouseMove(e, item.name, `${item.value} Tasks`, `${percent}%`, item.color);
                        }}
                        onMouseMove={(e) => {
                          handleMouseMove(e, item.name, `${item.value} Tasks`, `${percent}%`, item.color);
                        }}
                        onMouseLeave={handleMouseLeave}
                        onTouchStart={(e) => {
                          setHoveredDonut({ ...item, percentage: percent });
                          handleMouseMove(e, item.name, `${item.value} Tasks`, `${percent}%`, item.color);
                        }}
                      >
                        <span
                          className="epr-legend-dot"
                          style={{
                            backgroundColor: item.color,
                            transform: isHovered ? "scale(1.3)" : "scale(1)",
                            transition: "transform 0.2s ease",
                          }}
                        />
                        <span style={{ fontWeight: isHovered ? 700 : 500 }}>{item.name}</span>
                        <strong style={{ color: item.color, marginLeft: 2 }}>{item.value}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Chart 2: Team Comparative Velocity (Grouped Bars) */}
            <div className="epr-chart-card">
              <div className="epr-chart-header">
                <div>
                  <h3 className="epr-chart-title">Team Comparative Velocity</h3>
                  <p className="epr-chart-subtitle">Task workload and completions</p>
                </div>
                <div className="epr-top-legend">
                  <div
                    className="epr-top-legend-item"
                    style={{
                      cursor: "pointer",
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: activeVelocityFilter === "total" ? "#e0f2fe" : "transparent",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={() => setActiveVelocityFilter("total")}
                    onMouseLeave={() => setActiveVelocityFilter(null)}
                  >
                    <span className="epr-legend-dot" style={{ backgroundColor: "#38bdf8" }} />
                    <span style={{ fontWeight: activeVelocityFilter === "total" ? 700 : 500 }}>Total Tasks</span>
                  </div>
                  <div
                    className="epr-top-legend-item"
                    style={{
                      cursor: "pointer",
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: activeVelocityFilter === "completed" ? "#d1fae5" : "transparent",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={() => setActiveVelocityFilter("completed")}
                    onMouseLeave={() => setActiveVelocityFilter(null)}
                  >
                    <span className="epr-legend-dot" style={{ backgroundColor: "#10b981" }} />
                    <span style={{ fontWeight: activeVelocityFilter === "completed" ? 700 : 500 }}>Completed</span>
                  </div>
                  <div
                    className="epr-top-legend-item"
                    style={{
                      cursor: "pointer",
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: activeVelocityFilter === "overdue" ? "#fee2e2" : "transparent",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={() => setActiveVelocityFilter("overdue")}
                    onMouseLeave={() => setActiveVelocityFilter(null)}
                  >
                    <span className="epr-legend-dot" style={{ backgroundColor: "#ef4444" }} />
                    <span style={{ fontWeight: activeVelocityFilter === "overdue" ? 700 : 500 }}>Overdue</span>
                  </div>
                </div>
              </div>

              <div className="epr-svg-bar-container">
                <svg
                  width="100%"
                  height="220"
                  viewBox={`0 0 ${Math.max(380, 50 + teamVelocityData.length * 80)} 220`}
                  preserveAspectRatio="xMidYMid meet"
                  style={{ overflow: "visible" }}
                >
                  {/* Grid Lines & Y-axis values */}
                  {[0, 1, 2, 3, 4].map((step) => {
                    const yVal = Math.round((maxVelocity / 4) * step);
                    const yPos = 180 - (step / 4) * 140;
                    return (
                      <g key={step}>
                        <line x1="36" y1={yPos} x2={Math.max(370, 40 + teamVelocityData.length * 80)} y2={yPos} stroke="#f1f5f9" strokeDasharray="3 3" />
                        <text x="24" y={yPos + 4} fontSize="10" fill="#94a3b8" textAnchor="end">
                          {yVal}
                        </text>
                      </g>
                    );
                  })}

                  {/* Grouped Bars per Team */}
                  {teamVelocityData.map((team, idx) => {
                    const groupX = 46 + idx * 80;
                    const chartH = 140;

                    const hTotal = maxVelocity > 0 ? (team.total / maxVelocity) * chartH : 0;
                    const hCompleted = maxVelocity > 0 ? (team.completed / maxVelocity) * chartH : 0;
                    const hOverdue = maxVelocity > 0 ? (team.overdue / maxVelocity) * chartH : 0;

                    const isTeamHovered = hoveredVelocity?.teamName === team.name;

                    return (
                      <g key={team.name}>
                        {/* Column Group Background Highlight */}
                        {isTeamHovered && (
                          <rect
                            x={groupX - 6}
                            y={30}
                            width="64"
                            height="154"
                            rx="8"
                            fill="rgba(241, 245, 249, 0.85)"
                            style={{ transition: "all 0.2s ease" }}
                          />
                        )}

                        {/* Bar 1: Total Tasks */}
                        {(() => {
                          const isBarHovered = isTeamHovered && hoveredVelocity?.barType === "total";
                          const isFiltered = activeVelocityFilter && activeVelocityFilter !== "total";
                          const percent = team.total > 0 ? 100 : 0;
                          return (
                            <g>
                              <rect
                                className="epr-bar-column"
                                x={groupX}
                                y={180 - Math.max(hTotal, 3)}
                                width="14"
                                height={Math.max(hTotal, 3)}
                                rx="3"
                                fill="#38bdf8"
                                style={{
                                  opacity: isFiltered ? 0.25 : hoveredVelocity && !isBarHovered ? 0.4 : 1,
                                  filter: isBarHovered ? "drop-shadow(0 3px 8px rgba(56, 189, 248, 0.8))" : "none",
                                  transformOrigin: `${groupX + 7}px 180px`,
                                  transform: isBarHovered ? "scaleY(1.04)" : "scaleY(1)",
                                  transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
                                  cursor: "pointer",
                                }}
                              />
                              {isBarHovered && (
                                <text
                                  x={groupX + 7}
                                  y={180 - Math.max(hTotal, 3) - 5}
                                  fontSize="10"
                                  fontWeight="800"
                                  fill="#0284c7"
                                  textAnchor="middle"
                                >
                                  {team.total}
                                </text>
                              )}
                              <rect
                                x={groupX - 2}
                                y={20}
                                width="18"
                                height="180"
                                fill="transparent"
                                cursor="pointer"
                                onMouseEnter={(e) => {
                                  setHoveredVelocity({ teamName: team.name, barType: "total" });
                                  handleMouseMove(e, `${team.name} • Total Tasks`, `${team.total} Tasks`, `${percent}%`, "#38bdf8");
                                }}
                                onMouseMove={(e) => {
                                  handleMouseMove(e, `${team.name} • Total Tasks`, `${team.total} Tasks`, `${percent}%`, "#38bdf8");
                                }}
                                onMouseLeave={handleMouseLeave}
                                onTouchStart={(e) => {
                                  setHoveredVelocity({ teamName: team.name, barType: "total" });
                                  handleMouseMove(e, `${team.name} • Total Tasks`, `${team.total} Tasks`, `${percent}%`, "#38bdf8");
                                }}
                                onTouchMove={(e) => {
                                  handleMouseMove(e, `${team.name} • Total Tasks`, `${team.total} Tasks`, `${percent}%`, "#38bdf8");
                                }}
                              />
                            </g>
                          );
                        })()}

                        {/* Bar 2: Completed */}
                        {(() => {
                          const isBarHovered = isTeamHovered && hoveredVelocity?.barType === "completed";
                          const isFiltered = activeVelocityFilter && activeVelocityFilter !== "completed";
                          const percent = team.total > 0 ? Math.round((team.completed / team.total) * 100) : 0;
                          return (
                            <g>
                              <rect
                                className="epr-bar-column"
                                x={groupX + 17}
                                y={180 - Math.max(hCompleted, 3)}
                                width="14"
                                height={Math.max(hCompleted, 3)}
                                rx="3"
                                fill="#10b981"
                                style={{
                                  opacity: isFiltered ? 0.25 : hoveredVelocity && !isBarHovered ? 0.4 : 1,
                                  filter: isBarHovered ? "drop-shadow(0 3px 8px rgba(16, 185, 129, 0.8))" : "none",
                                  transformOrigin: `${groupX + 24}px 180px`,
                                  transform: isBarHovered ? "scaleY(1.04)" : "scaleY(1)",
                                  transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
                                  cursor: "pointer",
                                }}
                              />
                              {isBarHovered && (
                                <text
                                  x={groupX + 24}
                                  y={180 - Math.max(hCompleted, 3) - 5}
                                  fontSize="10"
                                  fontWeight="800"
                                  fill="#059669"
                                  textAnchor="middle"
                                >
                                  {team.completed}
                                </text>
                              )}
                              <rect
                                x={groupX + 15}
                                y={20}
                                width="18"
                                height="180"
                                fill="transparent"
                                cursor="pointer"
                                onMouseEnter={(e) => {
                                  setHoveredVelocity({ teamName: team.name, barType: "completed" });
                                  handleMouseMove(e, `${team.name} • Completed Tasks`, `${team.completed} Tasks`, `${percent}% of total`, "#10b981");
                                }}
                                onMouseMove={(e) => {
                                  handleMouseMove(e, `${team.name} • Completed Tasks`, `${team.completed} Tasks`, `${percent}% of total`, "#10b981");
                                }}
                                onMouseLeave={handleMouseLeave}
                                onTouchStart={(e) => {
                                  setHoveredVelocity({ teamName: team.name, barType: "completed" });
                                  handleMouseMove(e, `${team.name} • Completed Tasks`, `${team.completed} Tasks`, `${percent}% of total`, "#10b981");
                                }}
                                onTouchMove={(e) => {
                                  handleMouseMove(e, `${team.name} • Completed Tasks`, `${team.completed} Tasks`, `${percent}% of total`, "#10b981");
                                }}
                              />
                            </g>
                          );
                        })()}

                        {/* Bar 3: Overdue */}
                        {(() => {
                          const isBarHovered = isTeamHovered && hoveredVelocity?.barType === "overdue";
                          const isFiltered = activeVelocityFilter && activeVelocityFilter !== "overdue";
                          const percent = team.total > 0 ? Math.round((team.overdue / team.total) * 100) : 0;
                          return (
                            <g>
                              <rect
                                className="epr-bar-column"
                                x={groupX + 34}
                                y={180 - Math.max(hOverdue, 3)}
                                width="14"
                                height={Math.max(hOverdue, 3)}
                                rx="3"
                                fill="#ef4444"
                                style={{
                                  opacity: isFiltered ? 0.25 : hoveredVelocity && !isBarHovered ? 0.4 : 1,
                                  filter: isBarHovered ? "drop-shadow(0 3px 8px rgba(239, 68, 68, 0.8))" : "none",
                                  transformOrigin: `${groupX + 41}px 180px`,
                                  transform: isBarHovered ? "scaleY(1.04)" : "scaleY(1)",
                                  transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
                                  cursor: "pointer",
                                }}
                              />
                              {isBarHovered && (
                                <text
                                  x={groupX + 41}
                                  y={180 - Math.max(hOverdue, 3) - 5}
                                  fontSize="10"
                                  fontWeight="800"
                                  fill="#dc2626"
                                  textAnchor="middle"
                                >
                                  {team.overdue}
                                </text>
                              )}
                              <rect
                                x={groupX + 32}
                                y={20}
                                width="18"
                                height="180"
                                fill="transparent"
                                cursor="pointer"
                                onMouseEnter={(e) => {
                                  setHoveredVelocity({ teamName: team.name, barType: "overdue" });
                                  handleMouseMove(e, `${team.name} • Overdue Tasks`, `${team.overdue} Tasks`, `${percent}% of total`, "#ef4444");
                                }}
                                onMouseMove={(e) => {
                                  handleMouseMove(e, `${team.name} • Overdue Tasks`, `${team.overdue} Tasks`, `${percent}% of total`, "#ef4444");
                                }}
                                onMouseLeave={handleMouseLeave}
                                onTouchStart={(e) => {
                                  setHoveredVelocity({ teamName: team.name, barType: "overdue" });
                                  handleMouseMove(e, `${team.name} • Overdue Tasks`, `${team.overdue} Tasks`, `${percent}% of total`, "#ef4444");
                                }}
                                onTouchMove={(e) => {
                                  handleMouseMove(e, `${team.name} • Overdue Tasks`, `${team.overdue} Tasks`, `${percent}% of total`, "#ef4444");
                                }}
                              />
                            </g>
                          );
                        })()}

                        {/* X-axis Team Label */}
                        <text
                          x={groupX + 24}
                          y="202"
                          fontSize="10"
                          fontWeight={isTeamHovered ? "800" : "600"}
                          fill={isTeamHovered ? "#0f172a" : "#64748b"}
                          textAnchor="middle"
                          style={{ transition: "all 0.2s ease" }}
                        >
                          {team.name.length > 11 ? `${team.name.slice(0, 9)}..` : team.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Chart 3: Deadline Timeliness (Category Bars) */}
            <div className="epr-chart-card">
              <div className="epr-chart-header">
                <div>
                  <h3 className="epr-chart-title">Deadline Timeliness</h3>
                  <p className="epr-chart-subtitle">On-time vs delayed tasks</p>
                </div>
              </div>

              <div className="epr-svg-bar-container">
                <svg
                  width="100%"
                  height="220"
                  viewBox="0 0 340 220"
                  preserveAspectRatio="xMidYMid meet"
                  style={{ overflow: "visible" }}
                >
                  {/* Grid Lines */}
                  {[0, 1, 2, 3, 4].map((step) => {
                    const yVal = Math.round((maxDeadline / 4) * step);
                    const yPos = 180 - (step / 4) * 140;
                    return (
                      <g key={step}>
                        <line x1="36" y1={yPos} x2="330" y2={yPos} stroke="#f1f5f9" strokeDasharray="3 3" />
                        <text x="24" y={yPos + 4} fontSize="10" fill="#94a3b8" textAnchor="end">
                          {yVal}
                        </text>
                      </g>
                    );
                  })}

                  {/* Deadline Category Bars */}
                  {deadlineBars.map((bar, idx) => {
                    const barX = 52 + idx * 70;
                    const chartH = 140;
                    const h = maxDeadline > 0 ? (bar.count / maxDeadline) * chartH : 0;
                    const isHovered = hoveredDeadlineBar?.label === bar.label;
                    const percent = totalDeadlineTasks > 0 ? Math.round((bar.count / totalDeadlineTasks) * 100) : 0;

                    return (
                      <g key={bar.label}>
                        {/* Background Column Highlight on Hover */}
                        {isHovered && (
                          <rect
                            x={barX - 12}
                            y={30}
                            width="60"
                            height="154"
                            rx="8"
                            fill="rgba(241, 245, 249, 0.85)"
                            style={{ transition: "all 0.2s ease" }}
                          />
                        )}

                        {/* Data Bar */}
                        <rect
                          className="epr-bar-column"
                          x={barX}
                          y={180 - Math.max(h, 4)}
                          width="36"
                          height={Math.max(h, 4)}
                          rx="5"
                          fill={bar.color}
                          style={{
                            opacity: hoveredDeadlineBar && !isHovered ? 0.35 : 1,
                            filter: isHovered ? `drop-shadow(0 4px 10px ${bar.color}99)` : "none",
                            transformOrigin: `${barX + 18}px 180px`,
                            transform: isHovered ? "scaleY(1.03)" : "scaleY(1)",
                            transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
                            cursor: "pointer",
                          }}
                        />

                        {/* Value Display above bar */}
                        <text
                          x={barX + 18}
                          y={180 - Math.max(h, 4) - 6}
                          fontSize="11"
                          fontWeight="800"
                          fill={isHovered ? bar.color : "#64748b"}
                          textAnchor="middle"
                          style={{
                            opacity: isHovered || bar.count > 0 ? 1 : 0.75,
                            transition: "all 0.2s ease",
                          }}
                        >
                          {bar.count}
                        </text>

                        {/* Category Label */}
                        <text
                          x={barX + 18}
                          y="202"
                          fontSize="10.5"
                          fontWeight={isHovered ? "800" : "600"}
                          fill={isHovered ? bar.color : "#64748b"}
                          textAnchor="middle"
                          style={{ transition: "all 0.2s ease" }}
                        >
                          {bar.label}
                        </text>

                        {/* Full Column Hit Target Area for Easy Hovering */}
                        <rect
                          x={barX - 12}
                          y={20}
                          width="60"
                          height="190"
                          fill="transparent"
                          cursor="pointer"
                          onMouseEnter={(e) => {
                            setHoveredDeadlineBar({ ...bar, percentage: percent });
                            handleMouseMove(e, bar.label, `${bar.count} Tasks`, `${percent}%`, bar.color);
                          }}
                          onMouseMove={(e) => {
                            handleMouseMove(e, bar.label, `${bar.count} Tasks`, `${percent}%`, bar.color);
                          }}
                          onMouseLeave={handleMouseLeave}
                          onTouchStart={(e) => {
                            setHoveredDeadlineBar({ ...bar, percentage: percent });
                            handleMouseMove(e, bar.label, `${bar.count} Tasks`, `${percent}%`, bar.color);
                          }}
                          onTouchMove={(e) => {
                            handleMouseMove(e, bar.label, `${bar.count} Tasks`, `${percent}%`, bar.color);
                          }}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>

          {/* ── Bottom Row: 3 Navigation Action Cards ── */}
          <div className="epr-bottom-cards-grid">
            {/* Card 1: Candidate Performance */}
            <div className="epr-nav-card">
              <div>
                <div className="epr-nav-card-top">
                  <div className="epr-nav-card-icon" style={{ color: "#4f46e5", backgroundColor: "#eef2ff" }}>
                    <FiUsers />
                  </div>
                  <div>
                    <h4 className="epr-nav-card-title">Candidate Performance</h4>
                    <p className="epr-nav-card-desc">
                      Individual candidate task load, completion rate, rework occurrences, and on-time percentages.
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="epr-nav-card-btn"
                onClick={() => setActiveTab("candidates")}
              >
                <span>View Candidate Metrics</span>
                <FiArrowRight size={14} />
              </button>
            </div>

            {/* Card 2: Team Performance */}
            <div className="epr-nav-card">
              <div>
                <div className="epr-nav-card-top">
                  <div className="epr-nav-card-icon" style={{ color: "#059669", backgroundColor: "#ecfdf5" }}>
                    <FiLayers />
                  </div>
                  <div>
                    <h4 className="epr-nav-card-title">Team Performance</h4>
                    <p className="epr-nav-card-desc">
                      Cross-team velocity comparison, average completion percentage, and overdue task count.
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="epr-nav-card-btn"
                onClick={() => setActiveTab("teams")}
              >
                <span>View Team Analytics</span>
                <FiArrowRight size={14} />
              </button>
            </div>

            {/* Card 3: Task-Wise Detailed Log */}
            <div className="epr-nav-card">
              <div>
                <div className="epr-nav-card-top">
                  <div className="epr-nav-card-icon" style={{ color: "#0284c7", backgroundColor: "#f0f9ff" }}>
                    <FiFileText />
                  </div>
                  <div>
                    <h4 className="epr-nav-card-title">Task-Wise Detailed Log</h4>
                    <p className="epr-nav-card-desc">
                      Comprehensive auditable log with candidates, priorities, deadlines, submission timestamps, and reviews.
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="epr-nav-card-btn"
                onClick={() => setActiveTab("tasks")}
              >
                <span>View Task Log</span>
                <FiArrowRight size={14} />
              </button>
            </div>
          </div>
        </>
      ) : (
        /* ── Detailed Tab View (Candidates, Teams, Tasks) ── */
        <div className="epr-table-card">
          <div className="epr-drilldown-header">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                className="epr-back-btn"
                onClick={() => {
                  setActiveTab("overview");
                  setSearchQuery("");
                }}
              >
                <FiArrowLeft size={14} /> Back to Overview
              </button>

              <div className="epr-drilldown-tabs">
                <button
                  type="button"
                  className={`epr-pill-btn ${activeTab === "candidates" ? "active" : ""}`}
                  onClick={() => setActiveTab("candidates")}
                >
                  Candidate Breakdown ({candidateReport.length})
                </button>
                <button
                  type="button"
                  className={`epr-pill-btn ${activeTab === "teams" ? "active" : ""}`}
                  onClick={() => setActiveTab("teams")}
                >
                  Team Performance ({teamReport.length})
                </button>
                <button
                  type="button"
                  className={`epr-pill-btn ${activeTab === "tasks" ? "active" : ""}`}
                  onClick={() => setActiveTab("tasks")}
                >
                  Task Audit Roster ({taskReport.length})
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="epr-search-wrapper">
                <FiSearch className="epr-search-icon" />
                <input
                  type="text"
                  className="epr-search-input"
                  placeholder="Search records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <button type="button" className="epr-action-btn-outline" onClick={handleExportCSV}>
                <FiDownload size={14} /> Export CSV
              </button>
            </div>
          </div>

          {activeTab === "candidates" ? (
            <Card title="Candidate Performance Benchmarks">
              <Table
                columns={candidateColumns}
                data={filteredCandidates}
                loading={false}
                emptyText="No candidate performance records match your criteria."
              />
            </Card>
          ) : activeTab === "teams" ? (
            <Card title="Team Velocity Comparison">
              <Table
                columns={teamColumns}
                data={filteredTeams}
                loading={false}
                emptyText="No team performance records match your criteria."
              />
            </Card>
          ) : (
            <Card title="Complete Task Audit Roster">
              <Table
                columns={taskColumns}
                data={filteredTasks}
                loading={false}
                emptyText="No tasks match your criteria."
              />
            </Card>
          )}
        </div>
      )}

      {/* Dynamic Cursor-Tracking Floating Tooltip */}
      {tooltip.visible && (
        <div
          className="epr-floating-tooltip"
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
              {tooltip.value} {tooltip.percentage ? `(${tooltip.percentage})` : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}