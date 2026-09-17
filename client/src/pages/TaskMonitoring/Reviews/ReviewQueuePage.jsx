import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiExternalLink,
  FiSearch,
  FiMessageSquare,
  FiXCircle,
} from "react-icons/fi";
import { reviewService } from "../../../services/reviewService.js";
import Card from "../../../components/Card/Card.jsx";
import Table from "../../../components/Table/Table.jsx";
import Button from "../../../components/Button/Button.jsx";
import Modal from "../../../components/Modal/Modal.jsx";
import Loader from "../../../components/Loader/Loader.jsx";
import "../TaskMonitoring.css";

export default function ReviewQueuePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [queue, setQueue] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");

  // Modals state
  const [selectedItem, setSelectedItem] = useState(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isReworkModalOpen, setIsReworkModalOpen] = useState(false);
  const [reviewComments, setReviewComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const fetchQueue = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reviewService.getReviewQueue({
        team: selectedTeam,
        priority: selectedPriority,
        search,
      });
      setQueue(res.data?.queue || []);
    } catch (err) {
      console.error("Failed to load review queue:", err);
      setError(err.message || "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQueue();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, selectedTeam, selectedPriority]);

  const handleOpenApprove = (item) => {
    setSelectedItem(item);
    setReviewComments("Approved. Requirements fulfilled effectively.");
    setModalError("");
    setIsApproveModalOpen(true);
  };

  const handleConfirmApprove = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setModalError("");
      await reviewService.approveSubmission(selectedItem._id, reviewComments);
      setIsApproveModalOpen(false);
      fetchQueue();
      alert(`Submission for "${selectedItem.taskAssignment?.task?.title}" approved! Task marked as COMPLETED.`);
    } catch (err) {
      setModalError(err.message || "Failed to approve submission");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRework = (item) => {
    setSelectedItem(item);
    setReviewComments("");
    setModalError("");
    setIsReworkModalOpen(true);
  };

  const handleConfirmRework = async (e) => {
    e.preventDefault();
    if (!reviewComments.trim()) {
      setModalError("Feedback comments explaining required improvements are required.");
      return;
    }

    try {
      setSubmitting(true);
      setModalError("");
      await reviewService.reworkSubmission(selectedItem._id, reviewComments);
      setIsReworkModalOpen(false);
      fetchQueue();
      alert(`Rework requested for "${selectedItem.taskAssignment?.task?.title}". Feedback returned to candidate.`);
    } catch (err) {
      setModalError(err.message || "Failed to request rework");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: "task",
      header: "Task & Priority",
      width: "30%",
      render: (row) => {
        const p = (row.taskAssignment?.task?.priority || "MEDIUM").toLowerCase();
        return (
          <div>
            <strong style={{ fontSize: "13px", color: "var(--slate-900, #0f172a)", display: "block" }}>
              {row.taskAssignment?.task?.title || "Task"}
            </strong>
            <div style={{ marginTop: 4 }}>
              <span className={`tm-badge tm-priority-${p}`} style={{ fontSize: "10px" }}>
                {row.taskAssignment?.task?.priority || "MEDIUM"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: "candidate",
      header: "Candidate",
      width: "20%",
      render: (row) => (
        <div>
          <strong style={{ fontSize: "13px", color: "var(--slate-800, #1e293b)", display: "block" }}>
            {row.candidate?.name}
          </strong>
          <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)" }}>
            {row.candidate?.team} &bull; {row.candidate?.department}
          </span>
        </div>
      ),
    },
    {
      key: "notes",
      header: "Submission Notes & Artifact",
      width: "25%",
      render: (row) => (
        <div>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--slate-700, #334155)" }}>
            {row.submissionText?.slice(0, 70)}...
          </p>
          {row.attachmentUrl && (
            <a
              href={row.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "11px", color: "#2563eb", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4 }}
            >
              <FiExternalLink size={11} /> View URL / Repo
            </a>
          )}
        </div>
      ),
    },
    {
      key: "submittedAt",
      header: "Submitted",
      width: "10%",
      render: (row) => (
        <span style={{ fontSize: "12px" }}>
          {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : "-"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Review Actions",
      width: "15%",
      render: (row) => (
        <div className="tm-actions-cell">
          <button
            type="button"
            className="tm-action-btn tm-action-btn-success"
            onClick={() => handleOpenApprove(row)}
            title="Approve Submission"
            aria-label="Approve Submission"
          >
            <FiCheckCircle size={15} />
          </button>
          <button
            type="button"
            className="tm-action-btn tm-action-btn-warning"
            onClick={() => handleOpenRework(row)}
            title="Request Rework"
            aria-label="Request Rework"
          >
            <FiXCircle size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="tm-container">
      {/* Header */}
      <div className="tm-header">
        <div className="tm-header-title">
          <h1>Evaluation & Review Queue</h1>
          <p>Examine candidate deliverables, grant formal approval, or specify rework recommendations</p>
        </div>
        <div className="tm-header-actions">
          <Button variant="outline" size="sm" onClick={fetchQueue}>
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="tm-stats-grid">
        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-purple">
            <FiClock />
          </div>
          <div className="tm-stat-content">
            <p>Pending Reviews</p>
            <h3>{queue.length}</h3>
            <div className="tm-stat-subtext">Awaiting evaluation</div>
          </div>
        </div>

        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-blue">
            <FiCheckCircle />
          </div>
          <div className="tm-stat-content">
            <p>Review Mode</p>
            <h3>Action Ready</h3>
            <div className="tm-stat-subtext">Instant approval & feedback</div>
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
            placeholder="Search candidate name or task title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="tm-select-filter"
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="URGENT">URGENT</option>
        </select>
      </div>

      {/* Queue Table */}
      <Card title="Pending Submissions Queue" subtitle={`${queue.length} submission(s) awaiting review`}>
        {error ? (
          <div style={{ padding: 24, textAlign: "center", color: "#dc2626" }}>
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={fetchQueue}>
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={queue}
            loading={loading}
            emptyText="Review queue is clear! All submissions have been evaluated."
          />
        )}
      </Card>

      {/* Approve Modal */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="Approve Deliverable & Complete Task"
        size="md"
      >
        <form onSubmit={handleConfirmApprove} className="tm-form">
          {modalError && (
            <div style={{ padding: 10, background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: "13px" }}>
              {modalError}
            </div>
          )}

          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: 12, borderRadius: 8 }}>
            <strong style={{ color: "#047857", fontSize: "14px", display: "block" }}>
              {selectedItem?.taskAssignment?.task?.title}
            </strong>
            <span style={{ fontSize: "12px", color: "#065f46" }}>
              Submitted by: <strong>{selectedItem?.candidate?.name}</strong>
            </span>
          </div>

          <div className="tm-form-group">
            <label>Approval Feedback / Commendation (Optional)</label>
            <textarea
              rows={3}
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
            />
          </div>

          <div className="tm-form-footer">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsApproveModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting}>
              {submitting ? "Approving..." : "Confirm Approval"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rework Modal */}
      <Modal
        isOpen={isReworkModalOpen}
        onClose={() => setIsReworkModalOpen(false)}
        title="Request Task Rework & Revisions"
        size="md"
      >
        <form onSubmit={handleConfirmRework} className="tm-form">
          {modalError && (
            <div style={{ padding: 10, background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: "13px" }}>
              {modalError}
            </div>
          )}

          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: 12, borderRadius: 8 }}>
            <strong style={{ color: "#b45309", fontSize: "14px", display: "block" }}>
              {selectedItem?.taskAssignment?.task?.title}
            </strong>
            <span style={{ fontSize: "12px", color: "#92400e" }}>
              Assignee: <strong>{selectedItem?.candidate?.name}</strong>
            </span>
          </div>

          <div className="tm-form-group">
            <label>Specific Feedback & Actionable Requirements *</label>
            <textarea
              rows={4}
              required
              placeholder="State what requirements were not met and provide precise steps for revision..."
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
            />
          </div>

          <div className="tm-form-footer">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsReworkModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="warning"
              size="sm"
              type="submit"
              loading={submitting}
            >
              Send Rework Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}