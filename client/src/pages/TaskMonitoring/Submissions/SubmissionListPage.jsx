import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FiFileText,
  FiSearch,
  FiEye,
  FiExternalLink,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiMessageSquare,
} from "react-icons/fi";
import { submissionService } from "../../../services/submissionService.js";
import Card from "../../../components/Card/Card.jsx";
import Table from "../../../components/Table/Table.jsx";
import Button from "../../../components/Button/Button.jsx";
import Modal from "../../../components/Modal/Modal.jsx";
import Loader from "../../../components/Loader/Loader.jsx";
import "../TaskMonitoring.css";

export default function SubmissionListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // View modal state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await submissionService.getSubmissions({
        status: selectedStatus,
        limit: 100,
      });
      setSubmissions(res.data?.submissions || []);
    } catch (err) {
      console.error("Failed to load submissions:", err);
      setError(err.message || "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSubmissions();
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedStatus]);

  const handleOpenView = (sub) => {
    setSelectedSubmission(sub);
    setIsViewModalOpen(true);
  };

  const filteredSubmissions = submissions.filter((s) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const candidateName = s.candidate?.name?.toLowerCase() || "";
    const taskTitle = s.taskAssignment?.task?.title?.toLowerCase() || "";
    const notes = s.submissionText?.toLowerCase() || "";
    return candidateName.includes(term) || taskTitle.includes(term) || notes.includes(term);
  });

  const submittedCount = submissions.filter((s) => s.status === "SUBMITTED").length;
  const approvedCount = submissions.filter((s) => s.status === "APPROVED").length;
  const reworkCount = submissions.filter((s) => s.status === "REWORK_REQUIRED").length;

  const columns = [
    {
      key: "task",
      header: "Task & Candidate",
      width: "35%",
      render: (row) => (
        <div>
          <strong style={{ fontSize: "13px", color: "var(--slate-900, #0f172a)", display: "block" }}>
            {row.taskAssignment?.task?.title || "Task"}
          </strong>
          <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)" }}>
            By: <strong style={{ color: "#4f46e5" }}>{row.candidate?.name || "Candidate"}</strong> ({row.candidate?.team})
          </span>
        </div>
      ),
    },
    {
      key: "version",
      header: "Version",
      width: "10%",
      render: (row) => (
        <span style={{ fontWeight: 700, fontSize: "12px", color: "#6366f1" }}>
          v{row.version || 1}
        </span>
      ),
    },
    {
      key: "submittedAt",
      header: "Submission Date",
      width: "15%",
      render: (row) => (
        <span style={{ fontSize: "12px" }}>
          {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : "-"}
        </span>
      ),
    },
    {
      key: "attachment",
      header: "Artifact / Link",
      width: "15%",
      render: (row) =>
        row.attachmentUrl ? (
          <a
            href={row.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tm-link-btn"
          >
            <FiExternalLink size={12} /> Repository / URL
          </a>
        ) : (
          <span style={{ fontSize: "11px", color: "var(--slate-400, #94a3b8)" }}>None</span>
        ),
    },
    {
      key: "status",
      header: "Review Status",
      width: "15%",
      render: (row) => {
        const s = row.status?.toLowerCase().replace("_", "-");
        return <span className={`tm-badge tm-badge-${s}`}>{row.status}</span>;
      },
    },
    {
      key: "actions",
      header: "Inspect",
      width: "10%",
      render: (row) => (
        <button
          type="button"
          className="tm-action-btn tm-action-btn-primary"
          onClick={() => handleOpenView(row)}
          title="Review Submission"
          aria-label="Review Submission"
        >
          <FiEye size={15} />
        </button>
      ),
    },
  ];

  return (
    <div className="tm-container">
      {/* Header */}
      <div className="tm-header">
        <div className="tm-header-title">
          <h1>Candidate Submissions</h1>
          <p>Review work artifacts, delivery notes, and submission revision history</p>
        </div>
        <div className="tm-header-actions">
          <Link to="/hr/reviews">
            <Button variant="primary" size="md">
              Go to Review Queue ({submittedCount})
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="tm-stats-grid">
        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-purple">
            <FiFileText />
          </div>
          <div className="tm-stat-content">
            <p>Total Submissions</p>
            <h3>{submissions.length}</h3>
            <div className="tm-stat-subtext">Received records</div>
          </div>
        </div>

        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-amber">
            <FiClock />
          </div>
          <div className="tm-stat-content">
            <p>Awaiting Review</p>
            <h3>{submittedCount}</h3>
            <div className="tm-stat-subtext">Needs HR evaluation</div>
          </div>
        </div>

        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-green">
            <FiCheckCircle />
          </div>
          <div className="tm-stat-content">
            <p>Approved Submissions</p>
            <h3>{approvedCount}</h3>
            <div className="tm-stat-subtext">Passed review</div>
          </div>
        </div>

        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-red">
            <FiAlertCircle />
          </div>
          <div className="tm-stat-content">
            <p>Rework Requested</p>
            <h3>{reworkCount}</h3>
            <div className="tm-stat-subtext">Feedback returned</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="tm-filter-toolbar">
        <div className="tm-search-box">
          <FiSearch className="tm-search-icon" size={16} />
          <input
            type="text"
            className="tm-search-input"
            placeholder="Search submissions by candidate or task title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="tm-select-filter"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="SUBMITTED">SUBMITTED (Pending Review)</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REWORK_REQUIRED">REWORK_REQUIRED</option>
        </select>
      </div>

      {/* Table */}
      <Card title="Candidate Work Submissions" subtitle={`${filteredSubmissions.length} submission(s)`}>
        {error ? (
          <div style={{ padding: 24, textAlign: "center", color: "#dc2626" }}>
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={fetchSubmissions}>
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={filteredSubmissions}
            loading={loading}
            emptyText="No submissions matching criteria."
          />
        )}
      </Card>

      {/* Submission Detail Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Submission Details - v${selectedSubmission?.version || 1}`}
        size="md"
      >
        {selectedSubmission && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)", display: "block" }}>Task</span>
              <strong style={{ fontSize: "15px", color: "var(--slate-900, #0f172a)" }}>
                {selectedSubmission.taskAssignment?.task?.title}
              </strong>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)", display: "block" }}>Submitted By</span>
                <strong style={{ fontSize: "13px" }}>{selectedSubmission.candidate?.name}</strong>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)", display: "block" }}>Submission Date</span>
                <strong style={{ fontSize: "13px" }}>
                  {new Date(selectedSubmission.submittedAt).toLocaleString()}
                </strong>
              </div>
            </div>

            <div>
              <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)", display: "block", marginBottom: 4 }}>
                Candidate Submission Notes
              </span>
              <div
                style={{
                  background: "var(--slate-50, #f8fafc)",
                  padding: "12px",
                  borderRadius: 8,
                  border: "1px solid var(--slate-200, #e2e8f0)",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                {selectedSubmission.submissionText}
              </div>
            </div>

            {selectedSubmission.attachmentUrl && (
              <div>
                <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)", display: "block", marginBottom: 4 }}>
                  Provided Artifact Link
                </span>
                <a
                  href={selectedSubmission.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#2563eb", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <FiExternalLink /> {selectedSubmission.attachmentUrl}
                </a>
              </div>
            )}

            {/* Review feedback history */}
            {selectedSubmission.reviews?.length > 0 && (
              <div>
                <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)", display: "block", marginBottom: 6 }}>
                  Review History
                </span>
                {selectedSubmission.reviews.map((rev) => (
                  <div
                    key={rev._id}
                    style={{
                      background: rev.decision === "APPROVED" ? "#ecfdf5" : "#fffbeb",
                      border: "1px solid",
                      borderColor: rev.decision === "APPROVED" ? "#a7f3d0" : "#fde68a",
                      padding: "10px",
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <strong style={{ fontSize: "12px", color: rev.decision === "APPROVED" ? "#047857" : "#b45309" }}>
                        {rev.decision} by {rev.reviewer?.name || "Reviewer"}
                      </strong>
                      <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)" }}>
                        {new Date(rev.reviewedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--slate-800, #1e293b)" }}>
                      {rev.comments}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="tm-form-footer">
              <Button variant="outline" size="sm" onClick={() => setIsViewModalOpen(false)}>
                Close
              </Button>
              {selectedSubmission.status === "SUBMITTED" && (
                <Link to="/hr/reviews">
                  <Button variant="primary" size="sm">
                    Open in Review Queue
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}