import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiCheckSquare,
  FiSearch,
  FiEye,
  FiSend,
  FiClock,
  FiCheckCircle,
  FiAlertTriangle,
  FiTrendingUp,
  FiFileText,
  FiRefreshCw,
} from "react-icons/fi";
import { assignmentService } from "../../../services/assignmentService.js";
import { submissionService } from "../../../services/submissionService.js";
import Table from "../../../components/Table/Table.jsx";
import Modal from "../../../components/Modal/Modal.jsx";
import Loader from "../../../components/Loader/Loader.jsx";
import "./EmployeeTaskMonitoring.css";

export default function EmployeeTasksPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignments, setAssignments] = useState([]);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [isOverdueOnly, setIsOverdueOnly] = useState("");

  // Submit Work Modal state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissionText, setSubmissionText] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await assignmentService.getAssignments({
        search,
        status: selectedStatus,
        priority: selectedPriority,
        isOverdue: isOverdueOnly,
        limit: 100,
      });
      setAssignments(res.data?.assignments || []);
    } catch (err) {
      console.error("Failed to load employee tasks:", err);
      setError(err.message || "Failed to load assigned tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAssignments();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, selectedStatus, selectedPriority, isOverdueOnly]);

  const handleOpenSubmit = (assignment) => {
    setSelectedAssignment(assignment);
    setSubmissionText("");
    setAttachmentUrl("");
    setSubmitError("");
    setSubmitSuccess("");
    setIsSubmitModalOpen(true);
  };

  const handleSubmitDeliverable = async (e) => {
    e.preventDefault();
    if (!submissionText.trim()) {
      setSubmitError("Please enter submission description or notes");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError("");
      await submissionService.createSubmission({
        taskAssignmentId: selectedAssignment._id,
        submissionText,
        attachmentUrl,
      });

      setSubmitSuccess("Deliverable submitted successfully for review!");
      setTimeout(() => {
        setIsSubmitModalOpen(false);
        fetchAssignments();
      }, 1000);
    } catch (err) {
      setSubmitError(err.message || "Failed to submit deliverable");
    } finally {
      setSubmitting(false);
    }
  };

  // KPI Calculations
  const totalCount = assignments.length;
  const completedCount = assignments.filter((a) => a.status === "COMPLETED").length;
  const inProgressCount = assignments.filter((a) => a.status === "IN_PROGRESS").length;
  const submittedCount = assignments.filter((a) => a.status === "SUBMITTED").length;
  const overdueCount = assignments.filter((a) => a.isOverdue).length;

  const columns = [
    {
      key: "task",
      header: "Task Information",
      width: "35%",
      minWidth: "170px",
      render: (row) => (
        <div>
          <Link
            to={`/employee/tasks/${row._id}`}
            style={{ fontWeight: 700, fontSize: "13.5px", color: "#0f172a", textDecoration: "none" }}
          >
            {row.task?.title || "Task Title"}
          </Link>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
            <span className={`etm-badge etm-priority-${(row.task?.priority || "MEDIUM").toLowerCase()}`}>
              {row.task?.priority || "MEDIUM"}
            </span>
            {row.notes && (
              <span style={{ fontSize: "11px", color: "#64748b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                &bull; {row.notes}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "deadline",
      header: "Deadline & Schedule",
      width: "20%",
      minWidth: "130px",
      render: (row) => (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "12.5px", fontWeight: 600 }}>
            <FiClock size={13} color="#64748b" />
            <span>{row.deadline ? new Date(row.deadline).toLocaleDateString() : "-"}</span>
          </div>
          {row.isOverdue ? (
            <span className="etm-badge etm-badge-overdue" style={{ marginTop: 4 }}>
              OVERDUE
            </span>
          ) : (
            <span style={{ fontSize: "11px", color: "#64748b", marginTop: 2, display: "block" }}>
              Assigned {new Date(row.createdAt || Date.now()).toLocaleDateString()}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Task Status",
      width: "15%",
      minWidth: "110px",
      render: (row) => {
        const s = (row.status || "PENDING").toLowerCase().replace("_", "-");
        return <span className={`etm-badge etm-badge-${s}`}>{row.status}</span>;
      },
    },
    {
      key: "progress",
      header: "Completion",
      width: "15%",
      minWidth: "120px",
      render: (row) => (
        <div className="etm-progress-container">
          <div className="etm-progress-track">
            <div
              className="etm-progress-fill"
              style={{
                width: `${row.progressPercentage || 0}%`,
                backgroundColor:
                  row.status === "COMPLETED"
                    ? "#10b981"
                    : row.status === "SUBMITTED"
                    ? "#818cf8"
                    : "#4f46e5",
              }}
            />
          </div>
          <span style={{ fontSize: "12px", fontWeight: 700, minWidth: 32 }}>
            {row.progressPercentage || 0}%
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: "15%",
      minWidth: "85px",
      render: (row) => (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="etm-action-btn"
            onClick={() => navigate(`/employee/tasks/${row._id}`)}
            title="View Task Details"
            aria-label="View Task Details"
          >
            <FiEye size={15} />
          </button>
          {row.status !== "COMPLETED" && (
            <button
              type="button"
              className="etm-action-btn etm-action-btn-primary"
              onClick={() => handleOpenSubmit(row)}
              title="Submit Deliverable"
              aria-label="Submit Deliverable"
            >
              <FiSend size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="etm-container">
      {/* Header */}
      <div className="etm-header">
        <div className="etm-header-left">
          <div className="etm-breadcrumb">
            Task Monitoring <span>/</span> My Tasks
          </div>
          <h1 className="etm-title">My Assigned Tasks</h1>
          <p className="etm-subtitle">
            View, track progress, and submit deliverables for tasks assigned to you
          </p>
        </div>

        <div className="etm-header-actions">
          <button type="button" className="etm-btn-outline" onClick={fetchAssignments}>
            <FiRefreshCw size={14} /> Refresh
          </button>
          <Link to="/employee/submissions" style={{ textDecoration: "none" }}>
            <button type="button" className="etm-btn-primary">
              <FiFileText size={14} /> View Submissions
            </button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="etm-kpi-grid">
        <div className="etm-kpi-card">
          <div className="etm-kpi-icon etm-icon-indigo">
            <FiCheckSquare />
          </div>
          <div className="etm-kpi-info">
            <span className="etm-kpi-label">ASSIGNED TASKS</span>
            <span className="etm-kpi-value">{totalCount}</span>
            <span className="etm-kpi-subtext">Total active assignments</span>
          </div>
        </div>

        <div className="etm-kpi-card">
          <div className="etm-kpi-icon etm-icon-blue">
            <FiTrendingUp />
          </div>
          <div className="etm-kpi-info">
            <span className="etm-kpi-label">IN PROGRESS</span>
            <span className="etm-kpi-value">{inProgressCount}</span>
            <span className="etm-kpi-subtext">Currently working</span>
          </div>
        </div>

        <div className="etm-kpi-card">
          <div className="etm-kpi-icon etm-icon-amber">
            <FiSend />
          </div>
          <div className="etm-kpi-info">
            <span className="etm-kpi-label">SUBMITTED</span>
            <span className="etm-kpi-value">{submittedCount}</span>
            <span className="etm-kpi-subtext">Awaiting manager review</span>
          </div>
        </div>

        <div className="etm-kpi-card">
          <div className="etm-kpi-icon etm-icon-emerald">
            <FiCheckCircle />
          </div>
          <div className="etm-kpi-info">
            <span className="etm-kpi-label">COMPLETED</span>
            <span className="etm-kpi-value">{completedCount}</span>
            <span className="etm-kpi-subtext">Finalized & approved</span>
          </div>
        </div>

        {overdueCount > 0 && (
          <div className="etm-kpi-card" style={{ borderColor: "#fecaca" }}>
            <div className="etm-kpi-icon etm-icon-coral">
              <FiAlertTriangle />
            </div>
            <div className="etm-kpi-info">
              <span className="etm-kpi-label">OVERDUE</span>
              <span className="etm-kpi-value" style={{ color: "#dc2626" }}>{overdueCount}</span>
              <span className="etm-kpi-subtext">Requires immediate delivery</span>
            </div>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="etm-filter-bar">
        <div className="etm-search-wrapper">
          <FiSearch className="etm-search-icon" />
          <input
            type="text"
            className="etm-search-input"
            placeholder="Search by task title, description, or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            className="etm-select-filter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="COMPLETED">Completed</option>
            <option value="REWORK_REQUIRED">Rework Required</option>
          </select>

          <select
            className="etm-select-filter"
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="HIGH">High Priority</option>
            <option value="URGENT">Urgent Priority</option>
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "#475569", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isOverdueOnly === "true"}
              onChange={(e) => setIsOverdueOnly(e.target.checked ? "true" : "")}
            />
            <span>Overdue Only</span>
          </label>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="etm-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Loader.Spinner size="lg" />
            <p style={{ marginTop: 12, color: "#64748b", fontSize: "0.88rem" }}>Loading your assigned tasks...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#b91c1c" }}>
            <p>{error}</p>
            <button type="button" className="etm-btn-outline" onClick={fetchAssignments}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="etm-table-scroll-hint">
              <span>⇄ Swipe horizontally to view all columns</span>
            </div>
            <Table
              columns={columns}
              data={assignments}
              loading={false}
              emptyText="No tasks currently assigned to you."
            />
          </>
        )}
      </div>

      {/* Submit Deliverable Modal */}
      {isSubmitModalOpen && selectedAssignment && (
        <Modal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          title={`Submit Work: ${selectedAssignment.task?.title || "Task"}`}
        >
          <form onSubmit={handleSubmitDeliverable} className="etm-form">
            {submitError && (
              <div style={{ padding: "10px", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, fontSize: "0.82rem" }}>
                {submitError}
              </div>
            )}
            {submitSuccess && (
              <div style={{ padding: "10px", background: "#ecfdf5", color: "#065f46", borderRadius: 8, fontSize: "0.82rem" }}>
                {submitSuccess}
              </div>
            )}

            <div className="etm-form-group">
              <label>Submission Notes & Description *</label>
              <textarea
                rows="4"
                placeholder="Describe the completed work, changes implemented, or testing notes..."
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                required
              />
            </div>

            <div className="etm-form-group">
              <label>Repository / Live Preview URL (Optional)</label>
              <input
                type="url"
                placeholder="https://github.com/... or https://preview-link.com"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
              />
            </div>

            <div className="etm-form-footer">
              <button
                type="button"
                className="etm-btn-outline"
                onClick={() => setIsSubmitModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="etm-btn-primary"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Confirm & Submit Work"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
