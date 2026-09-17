import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiCheckSquare,
  FiClock,
  FiUser,
  FiCalendar,
  FiAlertCircle,
  FiEye,
} from "react-icons/fi";
import { taskService } from "../../../services/taskService.js";
import Card from "../../../components/Card/Card.jsx";
import Button from "../../../components/Button/Button.jsx";
import Table from "../../../components/Table/Table.jsx";
import Loader from "../../../components/Loader/Loader.jsx";
import "../TaskMonitoring.css";

export default function TaskDetailsPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [task, setTask] = useState(null);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    const fetchTask = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await taskService.getTaskById(id);
        setTask(res.data?.task);
        setAssignments(res.data?.assignments || []);
      } catch (err) {
        console.error("Failed to load task details:", err);
        setError(err.message || "Failed to load task");
      } finally {
        setLoading(false);
      }
    };
    fetchTask();
  }, [id]);

  if (loading) {
    return (
      <div className="tm-container" style={{ textAlign: "center", padding: "60px 0" }}>
        <Loader.Spinner size="lg" />
        <p style={{ marginTop: 12, color: "var(--slate-500, #64748b)" }}>Loading task details...</p>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="tm-container">
        <div style={{ padding: "30px", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, textAlign: "center" }}>
          <FiAlertCircle size={32} style={{ marginBottom: 8 }} />
          <h3>Error Loading Task</h3>
          <p>{error || "Task not found"}</p>
          <Link to="/hr/tasks">
            <Button variant="primary" size="sm">
              <FiArrowLeft style={{ marginRight: 6 }} /> Back to Tasks
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const priorityClass = `tm-priority-${(task.priority || "MEDIUM").toLowerCase()}`;

  const columns = [
    {
      key: "candidate",
      header: "Candidate",
      width: "25%",
      render: (row) => (
        <div>
          <strong style={{ fontSize: "13px", color: "var(--slate-900, #0f172a)", display: "block" }}>
            {row.candidate?.name || "Unassigned"}
          </strong>
          <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)" }}>{row.candidate?.email}</span>
        </div>
      ),
    },
    {
      key: "team",
      header: "Team / Department",
      width: "20%",
      render: (row) => (
        <div>
          <span style={{ fontWeight: 600, fontSize: "12px" }}>{row.candidate?.team || "General"}</span>
          <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)", display: "block" }}>
            {row.candidate?.department}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "15%",
      render: (row) => {
        const s = (row.status || "PENDING").toLowerCase().replace("_", "-");
        return <span className={`tm-badge tm-badge-${s}`}>{row.status}</span>;
      },
    },
    {
      key: "deadline",
      header: "Deadline",
      width: "18%",
      render: (row) => (
        <div>
          <span style={{ fontSize: "12px", fontWeight: 600 }}>
            {row.deadline ? new Date(row.deadline).toLocaleDateString() : "-"}
          </span>
          {row.isOverdue && (
            <span className="tm-badge tm-badge-overdue" style={{ marginLeft: 6 }}>
              OVERDUE
            </span>
          )}
        </div>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      width: "22%",
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
      <div className="tm-header">
        <div>
          <Link
            to="/hr/tasks"
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
            <FiArrowLeft /> Back to Tasks
          </Link>
          <h1>{task.title}</h1>
          <p>Created by {task.createdBy?.name || "HR Admin"} &bull; {new Date(task.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="tm-header-actions">
          <span className={`tm-badge ${priorityClass}`}>
            Priority: {task.priority}
          </span>
        </div>
      </div>

      <Card title="Task Description">
        <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.6, color: "var(--slate-800, #1e293b)" }}>
          {task.description}
        </p>
      </Card>

      <Card title="Allocated Candidate Assignments" subtitle={`${assignments.length} total assignee(s)`}>
        <Table
          columns={columns}
          data={assignments}
          loading={false}
          emptyText="No candidates assigned to this task."
        />
      </Card>
    </div>
  );
}