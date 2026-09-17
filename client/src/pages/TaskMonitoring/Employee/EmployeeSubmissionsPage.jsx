import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FiSend,
  FiFileText,
  FiExternalLink,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiPlus,
  FiEye,
  FiRefreshCw,
  FiMessageSquare,
} from "react-icons/fi";
import { submissionService } from "../../../services/submissionService.js";
import { assignmentService } from "../../../services/assignmentService.js";
import Table from "../../../components/Table/Table.jsx";
import Modal from "../../../components/Modal/Modal.jsx";
import Loader from "../../../components/Loader/Loader.jsx";
import "./EmployeeTaskMonitoring.css";

export default function EmployeeSubmissionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // New Submission Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [submissionText, setSubmissionText] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [subRes, assignRes] = await Promise.all([
        submissionService.getSubmissions({ limit: 100 }),
        assignmentService.getAssignments({ limit: 100 }),
      ]);

      setSubmissions(subRes.data?.submissions || []);
      const activeAssigns = (assignRes.data?.assignments || []).filter(
        (a) => a.status !== "COMPLETED"
      );
      setAssignments(activeAssigns);
      if (activeAssigns.length > 0 && !selectedAssignmentId) {
        setSelectedAssignmentId(activeAssigns[0]._id);
      }
    } catch (err) {
      console.error("Failed to load submissions:", err);
      setError(err.message || "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = () => {
    setSubmissionText("");
    setAttachmentUrl("");
    setModalError("");
    setModalSuccess("");
    if (assignments.length > 0) {
      setSelectedAssignmentId(assignments[0]._id);
    }
    setIsModalOpen(true);
  };

  const handleCreateSubmission = async (e) => {
    e.preventDefault();
    if (!selectedAssignmentId) {
      setModalError("Please select an assigned task");
      return;
    }
    if (!submissionText.trim()) {
      setModalError("Please describe your submission notes or implementation details");
      return;
    }

    try {
      setSubmitting(true);
      setModalError("");
      await submissionService.createSubmission({
        taskAssignmentId: selectedAssignmentId,
        submissionText,
        attachmentUrl,
      });

      setModalSuccess("Deliverable submitted successfully for review!");
      setTimeout(() => {
        setIsModalOpen(false);
        fetchData();
      }, 1200);
    } catch (err) {
      setModalError(err.message || "Failed to submit work");
    } finally {
      setSubmitting(false);
    }
  };

  const totalSubmissions = submissions.length;
  const approvedCount = submissions.filter((s) => s.status === "APPROVED").length;
  const pendingCount = submissions.filter((s) => s.status === "SUBMITTED").length;
  const reworkCount = submissions.filter((s) => s.status === "REWORK_REQUIRED").length;

  const columns = [
    {
      key: "task",
      header: "Task & Version",
      width: "30%",
      minWidth: "160px",
      render: (row) => (
        <div>
          <Link
            to={`/employee/tasks/${row.taskAssignment?._id}`}
            style={{ fontWeight: 700, fontSize: "13.5px", color: "#0f172a", textDecoration: "none" }}
          >
            {row.taskAssignment?.task?.title || "Task Deliverable"}
          </Link>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#4f46e5", background: "#eef2ff", padding: "2px 6px", borderRadius: 4 }}>
              Version {row.version}
            </span>
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              Submitted {new Date(row.submittedAt || row.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "notes",
      header: "Submission Description",
      width: "30%",
      minWidth: "170px",
      render: (row) => (
        <div>
          <p style={{ margin: "0 0 4px 0", fontSize: "12.5px", color: "#334155", lineHeight: 1.4 }}>
            {row.submissionText}
          </p>
          {row.attachmentUrl && (
            <a
              href={row.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "11.5px", color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
            >
              <FiExternalLink size={11} /> View Deliverable Link
            </a>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Review Status",
      width: "15%",
      minWidth: "110px",
      render: (row) => {
        const s = (row.status || "SUBMITTED").toLowerCase().replace("_", "-");
        return <span className={`etm-badge etm-badge-${s}`}>{row.status}</span>;
      },
    },
    {
      key: "feedback",
      header: "Reviewer Feedback",
      width: "25%",
      minWidth: "160px",
      render: (row) => {
        const latestReview = row.reviews && row.reviews.length > 0 ? row.reviews[0] : null;
        if (!latestReview) {
          return <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>Awaiting review...</span>;
        }

        return (
          <div style={{ fontSize: "12px" }}>
            <strong style={{ color: latestReview.decision === "APPROVED" ? "#059669" : "#d97706", display: "block" }}>
              {latestReview.decision}
            </strong>
            {latestReview.comments && (
              <span style={{ color: "#475569", fontSize: "11px", display: "block", marginTop: 2 }}>
                "{latestReview.comments}"
              </span>
            )}
            <span style={{ color: "#94a3b8", fontSize: "10px", marginTop: 2, display: "block" }}>
              By {latestReview.reviewer?.name || "Manager"}
            </span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="etm-container">
      {/* Header */}
      <div className="etm-header">
        <div className="etm-header-left">
          <div className="etm-breadcrumb">
            Task Monitoring <span>/</span> Submissions
          </div>
          <h1 className="etm-title">My Work Submissions</h1>
          <p className="etm-subtitle">
            Submit deliverables and view manager reviews, versions, and feedback
          </p>
        </div>

        <div className="etm-header-actions">
          <button type="button" className="etm-btn-outline" onClick={fetchData}>
            <FiRefreshCw size={14} /> Refresh
          </button>
          <button type="button" className="etm-btn-primary" onClick={handleOpenModal}>
            <FiPlus size={14} /> Submit New Deliverable
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="etm-kpi-grid">
        <div className="etm-kpi-card">
          <div className="etm-kpi-icon etm-icon-indigo">
            <FiSend />
          </div>
          <div className="etm-kpi-info">
            <span className="etm-kpi-label">TOTAL SUBMISSIONS</span>
            <span className="etm-kpi-value">{totalSubmissions}</span>
            <span className="etm-kpi-subtext">All submitted versions</span>
          </div>
        </div>

        <div className="etm-kpi-card">
          <div className="etm-kpi-icon etm-icon-emerald">
            <FiCheckCircle />
          </div>
          <div className="etm-kpi-info">
            <span className="etm-kpi-label">APPROVED</span>
            <span className="etm-kpi-value">{approvedCount}</span>
            <span className="etm-kpi-subtext">Accepted deliverables</span>
          </div>
        </div>

        <div className="etm-kpi-card">
          <div className="etm-kpi-icon etm-icon-amber">
            <FiClock />
          </div>
          <div className="etm-kpi-info">
            <span className="etm-kpi-label">PENDING REVIEW</span>
            <span className="etm-kpi-value">{pendingCount}</span>
            <span className="etm-kpi-subtext">Under manager evaluation</span>
          </div>
        </div>

        <div className="etm-kpi-card">
          <div className="etm-kpi-icon etm-icon-coral">
            <FiAlertCircle />
          </div>
          <div className="etm-kpi-info">
            <span className="etm-kpi-label">NEEDS REWORK</span>
            <span className="etm-kpi-value">{reworkCount}</span>
            <span className="etm-kpi-subtext">Requires revisions</span>
          </div>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="etm-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Loader.Spinner size="lg" />
            <p style={{ marginTop: 12, color: "#64748b" }}>Loading submission history...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#b91c1c" }}>
            <p>{error}</p>
            <button type="button" className="etm-btn-outline" onClick={fetchData}>
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
              data={submissions}
              loading={false}
              emptyText="No deliverables submitted yet. Click 'Submit New Deliverable' above to submit work."
            />
          </>
        )}
      </div>

      {/* New Submission Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Submit Work Deliverable"
        >
          <form onSubmit={handleCreateSubmission} className="etm-form">
            {modalError && (
              <div style={{ padding: "10px", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, fontSize: "0.82rem" }}>
                {modalError}
              </div>
            )}
            {modalSuccess && (
              <div style={{ padding: "10px", background: "#ecfdf5", color: "#065f46", borderRadius: 8, fontSize: "0.82rem" }}>
                {modalSuccess}
              </div>
            )}

            <div className="etm-form-group">
              <label>Select Assigned Task *</label>
              {assignments.length === 0 ? (
                <p style={{ fontSize: "0.84rem", color: "#b91c1c" }}>
                  You currently have no active assigned tasks available for submission.
                </p>
              ) : (
                <select
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                  required
                >
                  {assignments.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.task?.title || "Task"} (Priority: {a.task?.priority || "MEDIUM"})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="etm-form-group">
              <label>Submission Notes & Implementation Details *</label>
              <textarea
                rows="4"
                placeholder="Explain what was accomplished, milestones reached, or specific notes for the reviewer..."
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                required
              />
            </div>

            <div className="etm-form-group">
              <label>Repository / Live Demo / Documentation URL (Optional)</label>
              <input
                type="url"
                placeholder="https://github.com/... or https://demo-link.com"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
              />
            </div>

            <div className="etm-form-footer">
              <button
                type="button"
                className="etm-btn-outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="etm-btn-primary"
                disabled={submitting || assignments.length === 0}
              >
                {submitting ? "Submitting..." : "Submit Deliverable"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
