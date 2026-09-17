import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FiTrendingUp,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiSend,
  FiRefreshCw,
  FiEye,
  FiSave,
} from "react-icons/fi";
import { progressService } from "../../../services/progressService.js";
import { assignmentService } from "../../../services/assignmentService.js";
import Loader from "../../../components/Loader/Loader.jsx";
import "./EmployeeTaskMonitoring.css";

export default function EmployeeProgressPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progressOverview, setProgressOverview] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const [inlineValues, setInlineValues] = useState({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [resOverview, resAssignments] = await Promise.all([
        progressService.getProgressOverview(),
        assignmentService.getAssignments({ limit: 100 }),
      ]);

      setProgressOverview(resOverview.data || {});
      const list = resAssignments.data?.assignments || [];
      setAssignments(list);

      const initialVals = {};
      list.forEach((a) => {
        initialVals[a._id] = a.progressPercentage || 0;
      });
      setInlineValues(initialVals);
    } catch (err) {
      console.error("Failed to load progress tracking:", err);
      setError(err.message || "Failed to load progress data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSliderChange = (assignmentId, val) => {
    setInlineValues((prev) => ({
      ...prev,
      [assignmentId]: Number(val),
    }));
  };

  const handleSaveInlineProgress = async (assignmentId) => {
    const val = inlineValues[assignmentId];
    try {
      setUpdatingId(assignmentId);
      await progressService.updateTaskProgress(assignmentId, {
        progressPercentage: val,
      });
      setSaveSuccessMsg(`Progress saved: ${val}%`);
      setTimeout(() => setSaveSuccessMsg(""), 3000);
      fetchData();
    } catch (err) {
      console.error("Failed to save progress:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const summary = progressOverview?.summary || {};

  return (
    <div className="etm-container">
      {/* Header */}
      <div className="etm-header">
        <div className="etm-header-left">
          <div className="etm-breadcrumb">
            Task Monitoring <span>/</span> Progress Tracking
          </div>
          <h1 className="etm-title">Task Progress Tracking</h1>
          <p className="etm-subtitle">
            Real-time tracking of milestones, deliverables, and completion rates
          </p>
        </div>

        <div className="etm-header-actions">
          <button type="button" className="etm-btn-outline" onClick={fetchData}>
            <FiRefreshCw size={14} /> Refresh
          </button>
          <Link to="/employee/tasks" style={{ textDecoration: "none" }}>
            <button type="button" className="etm-btn-primary">
              View All Tasks
            </button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <Loader.Spinner size="lg" />
          <p style={{ marginTop: 12, color: "#64748b" }}>Calculating live task progress...</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="etm-kpi-grid">
            <div className="etm-kpi-card">
              <div className="etm-kpi-icon etm-icon-indigo">
                <FiTrendingUp />
              </div>
              <div className="etm-kpi-info">
                <span className="etm-kpi-label">OVERALL PROGRESS</span>
                <span className="etm-kpi-value">{summary.overallProgressPercentage || 0}%</span>
                <span className="etm-kpi-subtext">Average milestone completion</span>
              </div>
            </div>

            <div className="etm-kpi-card">
              <div className="etm-kpi-icon etm-icon-emerald">
                <FiCheckCircle />
              </div>
              <div className="etm-kpi-info">
                <span className="etm-kpi-label">COMPLETED</span>
                <span className="etm-kpi-value">{summary.completedTasks || 0}</span>
                <span className="etm-kpi-subtext">Finished tasks</span>
              </div>
            </div>

            <div className="etm-kpi-card">
              <div className="etm-kpi-icon etm-icon-blue">
                <FiClock />
              </div>
              <div className="etm-kpi-info">
                <span className="etm-kpi-label">IN PROGRESS</span>
                <span className="etm-kpi-value">{summary.inProgressTasks || 0}</span>
                <span className="etm-kpi-subtext">Actively in development</span>
              </div>
            </div>

            <div className="etm-kpi-card">
              <div className="etm-kpi-icon etm-icon-amber">
                <FiSend />
              </div>
              <div className="etm-kpi-info">
                <span className="etm-kpi-label">AWAITING REVIEW</span>
                <span className="etm-kpi-value">{summary.submittedTasks || 0}</span>
                <span className="etm-kpi-subtext">Submitted deliverables</span>
              </div>
            </div>

            {(summary.overdueTasks || 0) > 0 && (
              <div className="etm-kpi-card" style={{ borderColor: "#fecaca" }}>
                <div className="etm-kpi-icon etm-icon-coral">
                  <FiAlertTriangle />
                </div>
                <div className="etm-kpi-info">
                  <span className="etm-kpi-label">OVERDUE</span>
                  <span className="etm-kpi-value" style={{ color: "#dc2626" }}>{summary.overdueTasks}</span>
                  <span className="etm-kpi-subtext">Past scheduled deadline</span>
                </div>
              </div>
            )}
          </div>

          {saveSuccessMsg && (
            <div style={{ padding: "10px 16px", background: "#ecfdf5", color: "#065f46", borderRadius: 8, fontSize: "0.85rem", marginBottom: 16, border: "1px solid #a7f3d0" }}>
              {saveSuccessMsg}
            </div>
          )}

          {/* Active Tasks Progress Roster */}
          <div className="etm-card">
            <h3 style={{ margin: "0 0 16px 0", fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
              Active Task Milestone Progress
            </h3>

            {assignments.length === 0 ? (
              <p style={{ color: "#64748b", fontStyle: "italic", textAlign: "center", padding: 30 }}>
                No active tasks found.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {assignments.map((assignment) => {
                  const val = inlineValues[assignment._id] !== undefined ? inlineValues[assignment._id] : (assignment.progressPercentage || 0);
                  const isDirty = val !== (assignment.progressPercentage || 0);

                  return (
                    <div
                      key={assignment._id}
                      style={{
                        padding: "18px 20px",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        background: "#f8fafc",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                        <div>
                          <Link
                            to={`/employee/tasks/${assignment._id}`}
                            style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a", textDecoration: "none" }}
                          >
                            {assignment.task?.title || "Task"}
                          </Link>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                            <span className={`etm-badge etm-priority-${(assignment.task?.priority || "MEDIUM").toLowerCase()}`}>
                              {assignment.task?.priority || "MEDIUM"}
                            </span>
                            <span className={`etm-badge etm-badge-${(assignment.status || "PENDING").toLowerCase().replace("_", "-")}`}>
                              {assignment.status}
                            </span>
                            {assignment.deadline && (
                              <span style={{ fontSize: "11.5px", color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                                <FiClock size={12} /> Deadline: {new Date(assignment.deadline).toLocaleDateString()}
                              </span>
                            )}
                            {assignment.isOverdue && (
                              <span className="etm-badge etm-badge-overdue">OVERDUE</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Link to={`/employee/tasks/${assignment._id}`}>
                            <button type="button" className="etm-btn-outline" style={{ padding: "5px 12px", fontSize: "0.78rem" }}>
                              <FiEye size={12} /> View Details
                            </button>
                          </Link>

                          {isDirty && (
                            <button
                              type="button"
                              className="etm-btn-primary"
                              style={{ padding: "5px 12px", fontSize: "0.78rem" }}
                              onClick={() => handleSaveInlineProgress(assignment._id)}
                              disabled={updatingId === assignment._id}
                            >
                              <FiSave size={12} /> {updatingId === assignment._id ? "Saving..." : "Save"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Slider and Track */}
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={val}
                          onChange={(e) => handleSliderChange(assignment._id, e.target.value)}
                          className="etm-progress-slider"
                        />
                        <span style={{ fontSize: "1rem", fontWeight: 800, color: "#4f46e5", minWidth: 42, textAlign: "right" }}>
                          {val}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
