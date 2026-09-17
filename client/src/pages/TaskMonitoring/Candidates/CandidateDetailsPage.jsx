import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiUser,
  FiMail,
  FiPhone,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
  FiEye,
} from "react-icons/fi";
import { candidateService } from "../../../services/candidateService.js";
import Card from "../../../components/Card/Card.jsx";
import Button from "../../../components/Button/Button.jsx";
import Table from "../../../components/Table/Table.jsx";
import Loader from "../../../components/Loader/Loader.jsx";
import "../TaskMonitoring.css";

export default function CandidateDetailsPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [summary, setSummary] = useState({});

  const fetchCandidateDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await candidateService.getCandidateById(id);
      setCandidate(res.data?.candidate);
      setAssignments(res.data?.assignments || []);
      setSummary(res.data?.summary || {});
    } catch (err) {
      console.error("Failed to load candidate details:", err);
      setError(err.message || "Failed to load candidate profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidateDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="tm-container" style={{ textAlign: "center", padding: "60px 0" }}>
        <Loader.Spinner size="lg" />
        <p style={{ marginTop: 12, color: "var(--slate-500, #64748b)" }}>Loading candidate profile...</p>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="tm-container">
        <div style={{ padding: "30px", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, textAlign: "center" }}>
          <FiAlertCircle size={32} style={{ marginBottom: 8 }} />
          <h3>Error Loading Candidate</h3>
          <p>{error || "Candidate not found"}</p>
          <Link to="/hr/candidates">
            <Button variant="primary" size="sm">
              <FiArrowLeft style={{ marginRight: 6 }} /> Back to Candidates
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const columns = [
    {
      key: "task",
      header: "Task Title",
      width: "35%",
      render: (row) => (
        <div>
          <strong style={{ fontSize: "13px", color: "var(--slate-900, #0f172a)", display: "block" }}>
            {row.task?.title || "N/A"}
          </strong>
          <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)" }}>
            {row.task?.description?.slice(0, 70)}...
          </span>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      width: "12%",
      render: (row) => {
        const p = (row.task?.priority || "MEDIUM").toLowerCase();
        return <span className={`tm-badge tm-priority-${p}`}>{row.task?.priority || "MEDIUM"}</span>;
      },
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
      width: "18%",
      render: (row) => {
        const d = row.deadline ? new Date(row.deadline).toLocaleDateString() : "-";
        return (
          <div>
            <span style={{ fontSize: "12px", fontWeight: 600 }}>{d}</span>
            {row.isOverdue && (
              <span className="tm-badge tm-badge-overdue" style={{ marginLeft: 6 }}>
                OVERDUE
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "progress",
      header: "Progress",
      width: "20%",
      render: (row) => (
        <div className="tm-progress-wrapper">
          <div className="tm-progress-track">
            <div
              className="tm-progress-fill"
              style={{
                width: `${row.progressPercentage || 0}%`,
                backgroundColor: row.status === "COMPLETED" ? "#10b981" : "#4f46e5",
              }}
            />
          </div>
          <span className="tm-progress-text">{row.progressPercentage || 0}%</span>
        </div>
      ),
    },
  ];

  return (
    <div className="tm-container">
      {/* Back button & Title */}
      <div className="tm-header">
        <div>
          <Link
            to="/hr/candidates"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--primary-600, #4f46e5)",
              fontSize: "0.85rem",
              fontWeight: 700,
              textDecoration: "none",
              marginBottom: 8,
            }}
          >
            <FiArrowLeft /> Back to Candidate Directory
          </Link>
          <h1>{candidate.name}</h1>
          <p>
            {candidate.designation} &bull; {candidate.department} &bull; Team: <strong>{candidate.team}</strong>
          </p>
        </div>
        <div className="tm-header-actions">
          <span className={`tm-badge ${candidate.status === "ACTIVE" ? "tm-badge-completed" : "tm-badge-pending"}`}>
            ● {candidate.status}
          </span>
        </div>
      </div>

      {/* Candidate Profile Details Card */}
      <Card title="Candidate Overview">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FiMail size={18} color="#6366f1" />
            <div>
              <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)", display: "block" }}>Email</span>
              <strong style={{ fontSize: "13px" }}>{candidate.email}</strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FiPhone size={18} color="#6366f1" />
            <div>
              <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)", display: "block" }}>Phone</span>
              <strong style={{ fontSize: "13px" }}>{candidate.phone || "Not provided"}</strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FiBriefcase size={18} color="#6366f1" />
            <div>
              <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)", display: "block" }}>Team / Dept</span>
              <strong style={{ fontSize: "13px" }}>{candidate.team} / {candidate.department}</strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FiCalendar size={18} color="#6366f1" />
            <div>
              <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)", display: "block" }}>Joined</span>
              <strong style={{ fontSize: "13px" }}>
                {candidate.joiningDate ? new Date(candidate.joiningDate).toLocaleDateString() : "-"}
              </strong>
            </div>
          </div>
        </div>
      </Card>

      {/* Summary KPI Grid */}
      <div className="tm-stats-grid">
        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-blue">
            <FiClock />
          </div>
          <div className="tm-stat-content">
            <p>Total Tasks</p>
            <h3>{summary.totalTasks || 0}</h3>
            <div className="tm-stat-subtext">Assigned across lifecycle</div>
          </div>
        </div>

        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-green">
            <FiCheckCircle />
          </div>
          <div className="tm-stat-content">
            <p>Completed</p>
            <h3>{summary.completedTasks || 0}</h3>
            <div className="tm-stat-subtext">{summary.completionRate || 0}% completion rate</div>
          </div>
        </div>

        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-amber">
            <FiClock />
          </div>
          <div className="tm-stat-content">
            <p>In Progress / Submitted</p>
            <h3>{(summary.inProgressTasks || 0) + (summary.submittedTasks || 0)}</h3>
            <div className="tm-stat-subtext">{summary.submittedTasks || 0} waiting for review</div>
          </div>
        </div>

        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-red">
            <FiAlertCircle />
          </div>
          <div className="tm-stat-content">
            <p>Overdue Tasks</p>
            <h3>{summary.overdueTasks || 0}</h3>
            <div className="tm-stat-subtext">Past deadline</div>
          </div>
        </div>
      </div>

      {/* Task History Table */}
      <Card title="Assigned Tasks & Progress" subtitle={`${assignments.length} total assignment(s)`}>
        <Table
          columns={columns}
          data={assignments}
          loading={false}
          emptyText="No tasks currently assigned to this candidate."
        />
      </Card>
    </div>
  );
}