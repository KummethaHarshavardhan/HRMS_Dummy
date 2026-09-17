import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiClock,
  FiCalendar,
  FiUser,
  FiCheckCircle,
  FiAlertTriangle,
  FiSend,
  FiExternalLink,
  FiFileText,
  FiMessageSquare,
  FiSave,
} from "react-icons/fi";
import { assignmentService } from "../../../services/assignmentService.js";
import { progressService } from "../../../services/progressService.js";
import { submissionService } from "../../../services/submissionService.js";
import Loader from "../../../components/Loader/Loader.jsx";
import "./EmployeeTaskMonitoring.css";

export default function EmployeeTaskDetailsPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignment, setAssignment] = useState(null);

  // Progress update state
  const [progressVal, setProgressVal] = useState(0);
  const [savingProgress, setSavingProgress] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressError, setProgressError] = useState("");

  // Submission state
  const [subText, setSubText] = useState("");
  const [subUrl, setSubUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subError, setSubError] = useState("");
  const [subSuccess, setSubSuccess] = useState("");

  const fetchAssignment = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await assignmentService.getAssignmentById(id);
      const data = res.data?.assignment;
      setAssignment(data);
      setProgressVal(data?.progressPercentage || 0);
    } catch (err) {
      console.error("Failed to load task details:", err);
      setError(err.message || "Failed to load task details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignment();
  }, [id]);

  const handleSaveProgress = async () => {
    if (!assignment?._id) return;
    try {
      setSavingProgress(true);
      setProgressMsg("");
      setProgressError("");
      const res = await progressService.updateTaskProgress(assignment._id, {
        progressPercentage: progressVal,
      });
      setProgressMsg(`Progress updated to ${progressVal}% successfully!`);
      if (res?.data?.assignment) {
        setAssignment(res.data.assignment);
        setProgressVal(res.data.assignment.progressPercentage ?? progressVal);
      } else {
        fetchAssignment();
      }
      setTimeout(() => setProgressMsg(""), 3500);
    } catch (err) {
      console.error("Failed to update progress:", err);
      setProgressError(err.message || "Failed to update progress.");
      setTimeout(() => setProgressError(""), 4000);
    } finally {
      setSavingProgress(false);
    }
  };

  const handleSubmitWork = async (e) => {
    e.preventDefault();
    if (!subText.trim()) {
      setSubError("Please provide submission notes or description");
      return;
    }

    try {
      setSubmitting(true);
      setSubError("");
      await submissionService.createSubmission({
        taskAssignmentId: assignment._id,
        submissionText: subText,
        attachmentUrl: subUrl,
      });

      setSubSuccess("Deliverable submitted successfully for manager review!");
      setSubText("");
      setSubUrl("");
      setTimeout(() => {
        setSubSuccess("");
        fetchAssignment();
      }, 1500);
    } catch (err) {
      setSubError(err.message || "Failed to submit deliverable");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="etm-container" style={{ textAlign: "center", padding: "80px 0" }}>
        <Loader.Spinner size="lg" />
        <p style={{ marginTop: 12, color: "#64748b" }}>Loading task details...</p>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="etm-container">
        <div style={{ padding: 30, background: "#fef2f2", color: "#b91c1c", borderRadius: 10, textAlign: "center" }}>
          <FiAlertTriangle size={32} style={{ marginBottom: 8 }} />
          <h3>Error Loading Task</h3>
          <p>{error || "Task not found"}</p>
          <Link to="/employee/tasks">
            <button type="button" className="etm-btn-primary" style={{ marginTop: 12 }}>
              <FiArrowLeft size={14} /> Back to My Tasks
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const priority = assignment.task?.priority || "MEDIUM";
  const status = assignment.status || "PENDING";
  const submissions = assignment.submissions || [];

  return (
    <div className="etm-container">
      {/* Header */}
      <div className="etm-header">
        <div className="etm-header-left">
          <Link to="/employee/tasks" style={{ textDecoration: "none", width: "fit-content" }}>
            <button type="button" className="etm-btn-outline" style={{ marginBottom: 8 }}>
              <FiArrowLeft size={14} /> Back to My Tasks
            </button>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 className="etm-title">{assignment.task?.title || "Task Details"}</h1>
            <span className={`etm-badge etm-priority-${priority.toLowerCase()}`}>
              {priority} Priority
            </span>
            <span className={`etm-badge etm-badge-${status.toLowerCase().replace("_", "-")}`}>
              {status}
            </span>
          </div>
          <p className="etm-subtitle">
            Assigned on {new Date(assignment.createdAt || Date.now()).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="etm-details-grid">
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Task Instructions */}
          <div className="etm-panel">
            <h3 className="etm-panel-title">
              <FiFileText /> Task Overview & Description
            </h3>
            <p style={{ fontSize: "0.92rem", lineHeight: 1.6, color: "#334155", whiteSpace: "pre-wrap" }}>
              {assignment.task?.description || "No specific description provided."}
            </p>

            {assignment.notes && (
              <div style={{ marginTop: 16, padding: "12px 16px", background: "#f8fafc", borderLeft: "4px solid #4f46e5", borderRadius: "0 8px 8px 0" }}>
                <strong style={{ fontSize: "0.82rem", color: "#4f46e5", display: "block", marginBottom: 2 }}>
                  Manager Instructions:
                </strong>
                <span style={{ fontSize: "0.86rem", color: "#334155" }}>{assignment.notes}</span>
              </div>
            )}
          </div>

          {/* Interactive Progress Slider */}
          <div className="etm-panel">
            <h3 className="etm-panel-title">
              <FiClock /> Update Task Progress ({progressVal}%)
            </h3>
            <p style={{ fontSize: "0.84rem", color: "#64748b", margin: "0 0 16px 0" }}>
              Adjust the slider to reflect your real-time milestone progress.
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <input
                type="range"
                min="0"
                max="100"
                value={progressVal}
                onChange={(e) => setProgressVal(Number(e.target.value))}
                className="etm-progress-slider"
              />
              <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "#4f46e5", minWidth: 46, textAlign: "right" }}>
                {progressVal}%
              </span>
            </div>

            {/* Quick Presets */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {[0, 25, 50, 75, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="etm-btn-outline"
                  style={{
                    padding: "4px 12px",
                    fontSize: "0.78rem",
                    borderColor: progressVal === preset ? "#4f46e5" : "#cbd5e1",
                    color: progressVal === preset ? "#4f46e5" : "#475569",
                    fontWeight: progressVal === preset ? 700 : 500,
                  }}
                  onClick={() => setProgressVal(preset)}
                >
                  {preset}%
                </button>
              ))}
            </div>

            {progressMsg && (
              <div style={{ padding: "8px 12px", background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", borderRadius: 6, fontSize: "0.82rem", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <FiCheckCircle size={14} /> {progressMsg}
              </div>
            )}

            {progressError && (
              <div style={{ padding: "8px 12px", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 6, fontSize: "0.82rem", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <FiAlertTriangle size={14} /> {progressError}
              </div>
            )}

            <button
              type="button"
              className="etm-btn-primary"
              onClick={handleSaveProgress}
              disabled={savingProgress}
            >
              <FiSave size={14} /> {savingProgress ? "Saving..." : "Save Progress"}
            </button>
          </div>

          {/* Submit Work Form */}
          {status !== "COMPLETED" && (
            <div className="etm-panel">
              <h3 className="etm-panel-title">
                <FiSend /> Submit Deliverable for Review
              </h3>
              <p style={{ fontSize: "0.84rem", color: "#64748b", margin: "0 0 16px 0" }}>
                Ready to submit? Provide your implementation summary and repository or preview link.
              </p>

              <form onSubmit={handleSubmitWork} className="etm-form">
                {subError && (
                  <div style={{ padding: "10px", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, fontSize: "0.82rem" }}>
                    {subError}
                  </div>
                )}
                {subSuccess && (
                  <div style={{ padding: "10px", background: "#ecfdf5", color: "#065f46", borderRadius: 8, fontSize: "0.82rem" }}>
                    {subSuccess}
                  </div>
                )}

                <div className="etm-form-group">
                  <label>Deliverable Notes & Implementation Details *</label>
                  <textarea
                    rows="4"
                    placeholder="Describe the completed work, changes implemented, or notes for the reviewer..."
                    value={subText}
                    onChange={(e) => setSubText(e.target.value)}
                    required
                  />
                </div>

                <div className="etm-form-group">
                  <label>Repository / Pull Request / Live Demo URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://github.com/... or https://preview-url.com"
                    value={subUrl}
                    onChange={(e) => setSubUrl(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="etm-btn-primary"
                  style={{ width: "fit-content" }}
                  disabled={submitting}
                >
                  <FiSend size={14} /> {submitting ? "Submitting..." : "Submit Deliverable"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Schedule & Submissions History */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Metadata Panel */}
          <div className="etm-panel">
            <h3 className="etm-panel-title">Schedule & Manager Info</h3>

            <div className="etm-info-row">
              <span className="etm-info-label">Deadline</span>
              <span className="etm-info-value" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <FiCalendar size={13} />
                {assignment.deadline ? new Date(assignment.deadline).toLocaleDateString() : "No Deadline"}
              </span>
            </div>

            <div className="etm-info-row">
              <span className="etm-info-label">Deadline Status</span>
              <span className="etm-info-value">
                {assignment.isOverdue ? (
                  <span className="etm-badge etm-badge-overdue">OVERDUE</span>
                ) : (
                  <span style={{ color: "#059669", fontWeight: 700 }}>On Track</span>
                )}
              </span>
            </div>

            <div className="etm-info-row">
              <span className="etm-info-label">Assigned By</span>
              <span className="etm-info-value">
                {assignment.assignedBy?.name || "Management"}
              </span>
            </div>

            <div className="etm-info-row">
              <span className="etm-info-label">Current Progress</span>
              <span className="etm-info-value" style={{ color: "#4f46e5" }}>
                {assignment.progressPercentage || 0}%
              </span>
            </div>
          </div>

          {/* Submissions & Reviews History */}
          <div className="etm-panel">
            <h3 className="etm-panel-title">
              <FiMessageSquare /> Submission History ({submissions.length})
            </h3>

            {submissions.length === 0 ? (
              <p style={{ fontSize: "0.84rem", color: "#64748b", fontStyle: "italic" }}>
                No deliverables submitted yet. Use the form on the left to submit work.
              </p>
            ) : (
              submissions.map((sub) => (
                <div key={sub._id} className="etm-submission-item">
                  <div className="etm-sub-header">
                    <span className="etm-sub-title">Version {sub.version}</span>
                    <span className={`etm-badge etm-badge-${(sub.status || "SUBMITTED").toLowerCase().replace("_", "-")}`}>
                      {sub.status}
                    </span>
                  </div>

                  <p className="etm-sub-text">{sub.submissionText}</p>

                  {sub.attachmentUrl && (
                    <a
                      href={sub.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: "0.78rem",
                        color: "#2563eb",
                        fontWeight: 600,
                        textDecoration: "none",
                        margin: "4px 0 8px 0",
                      }}
                    >
                      <FiExternalLink size={12} /> View Deliverable Link
                    </a>
                  )}

                  <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                    Submitted {new Date(sub.submittedAt || sub.createdAt).toLocaleString()}
                  </div>

                  {/* Reviews for this submission */}
                  {sub.reviews && sub.reviews.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      {sub.reviews.map((rev) => (
                        <div
                          key={rev._id}
                          className={`etm-review-box ${
                            rev.decision === "APPROVED" ? "etm-review-approved" : "etm-review-rework"
                          }`}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginBottom: 4 }}>
                            <span>Review Decision: {rev.decision}</span>
                            <span style={{ fontSize: "0.72rem" }}>
                              {rev.reviewer?.name || "Reviewer"}
                            </span>
                          </div>
                          {rev.comments && <p style={{ margin: 0 }}>"{rev.comments}"</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
