import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiCheckSquare,
  FiPlus,
  FiSearch,
  FiEye,
  FiEdit2,
  FiTrash2,
  FiUserCheck,
  FiClock,
  FiAlertTriangle,
} from "react-icons/fi";
import { assignmentService } from "../../../services/assignmentService.js";
import { candidateService } from "../../../services/candidateService.js";
import { taskService } from "../../../services/taskService.js";
import Card from "../../../components/Card/Card.jsx";
import Button from "../../../components/Button/Button.jsx";
import Table from "../../../components/Table/Table.jsx";
import Modal from "../../../components/Modal/Modal.jsx";
import Loader from "../../../components/Loader/Loader.jsx";
import "../TaskMonitoring.css";

export default function TaskListPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [candidatesList, setCandidatesList] = useState([]);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [isOverdueOnly, setIsOverdueOnly] = useState("");

  // Modals state
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Edit/Reassign form states
  const [reassignCandidateId, setReassignCandidateId] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("PENDING");
  const [editProgress, setEditProgress] = useState(0);

  const fetchCandidates = async () => {
    try {
      const res = await candidateService.getCandidates({ limit: 100 });
      setCandidatesList(res.data?.candidates || []);
    } catch (err) {
      console.error("Failed to load candidates list:", err);
    }
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await assignmentService.getAssignments({
        search,
        status: selectedStatus,
        priority: selectedPriority,
        team: selectedTeam,
        isOverdue: isOverdueOnly,
        limit: 100,
      });
      setAssignments(res.data?.assignments || []);
    } catch (err) {
      console.error("Failed to load task assignments:", err);
      setError(err.message || "Failed to load task assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAssignments();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, selectedStatus, selectedPriority, selectedTeam, isOverdueOnly]);

  const handleOpenReassign = (assignment) => {
    setSelectedAssignment(assignment);
    setReassignCandidateId(assignment.candidate?._id || "");
    setEditDeadline(
      assignment.deadline ? new Date(assignment.deadline).toISOString().split("T")[0] : ""
    );
    setEditNotes(assignment.notes || "");
    setFormError("");
    setIsReassignModalOpen(true);
  };

  const handleSaveReassign = async (e) => {
    e.preventDefault();
    if (!reassignCandidateId) {
      setFormError("Please select a candidate for reassignment");
      return;
    }

    try {
      setFormLoading(true);
      setFormError("");
      await assignmentService.reassignAssignment(selectedAssignment._id, {
        newCandidateId: reassignCandidateId,
        deadline: editDeadline,
        notes: editNotes,
      });
      setIsReassignModalOpen(false);
      fetchAssignments();
    } catch (err) {
      setFormError(err.message || "Failed to reassign task");
    } finally {
      setFormLoading(false);
    }
  };

  const handleOpenEdit = (assignment) => {
    setSelectedAssignment(assignment);
    setEditDeadline(
      assignment.deadline ? new Date(assignment.deadline).toISOString().split("T")[0] : ""
    );
    setEditNotes(assignment.notes || "");
    setEditStatus(assignment.status || "PENDING");
    setEditProgress(assignment.progressPercentage || 0);
    setFormError("");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      setFormLoading(true);
      setFormError("");
      await assignmentService.updateAssignment(selectedAssignment._id, {
        deadline: editDeadline,
        notes: editNotes,
        status: editStatus,
        progressPercentage: editProgress,
      });
      setIsEditModalOpen(false);
      fetchAssignments();
    } catch (err) {
      setFormError(err.message || "Failed to update assignment");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteTask = async (row) => {
    const taskId = row.task?._id || row.task;
    const taskTitle = row.task?.title || "this task";
    if (!window.confirm(`Are you sure you want to delete "${taskTitle}"? This will remove the task and all candidate assignments.`)) {
      return;
    }
    try {
      if (taskId) {
        await taskService.deleteTask(taskId);
      }
      fetchAssignments();
    } catch (err) {
      alert(err.message || "Failed to delete task");
    }
  };

  // Compute metrics
  const totalAssignments = assignments.length;
  const inProgressCount = assignments.filter((a) => a.status === "IN_PROGRESS").length;
  const submittedCount = assignments.filter((a) => a.status === "SUBMITTED").length;
  const completedCount = assignments.filter((a) => a.status === "COMPLETED").length;
  const overdueCount = assignments.filter((a) => a.isOverdue).length;

  const columns = [
    {
      key: "task",
      header: "Task & Description",
      width: "25%",
      render: (row) => (
        <div>
          <strong style={{ fontSize: "13px", color: "var(--slate-900, #0f172a)", display: "block" }}>
            {row.task?.title || "N/A"}
          </strong>
          <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)" }}>
            {row.task?.description?.slice(0, 65)}...
          </span>
        </div>
      ),
    },
    {
      key: "candidate",
      header: "Assigned Candidate",
      width: "18%",
      render: (row) => (
        <div>
          <strong style={{ fontSize: "13px", color: "var(--slate-800, #1e293b)", display: "block" }}>
            {row.candidate?.name || "Unassigned"}
          </strong>
          <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)" }}>
            {row.candidate?.team} &bull; {row.candidate?.department}
          </span>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      width: "10%",
      render: (row) => {
        const p = (row.task?.priority || "MEDIUM").toLowerCase();
        return <span className={`tm-badge tm-priority-${p}`}>{row.task?.priority || "MEDIUM"}</span>;
      },
    },
    {
      key: "deadline",
      header: "Deadline",
      width: "13%",
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
      key: "status",
      header: "Status",
      width: "12%",
      render: (row) => {
        const s = (row.status || "PENDING").toLowerCase().replace("_", "-");
        return <span className={`tm-badge tm-badge-${s}`}>{row.status}</span>;
      },
    },
    {
      key: "progress",
      header: "Progress",
      width: "10%",
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
    {
      key: "actions",
      header: "Actions",
      width: "160px",
      render: (row) => (
        <div className="tm-actions-cell">
          <Link
            to={`/hr/tasks/${row.task?._id || row._id}`}
            className="tm-action-btn tm-action-btn-primary"
            title="Review Task"
            aria-label="Review Task"
          >
            <FiEye size={15} />
          </Link>
          <button
            type="button"
            className="tm-action-btn tm-action-btn-edit"
            title="Edit Assignment"
            aria-label="Edit Assignment"
            onClick={() => handleOpenEdit(row)}
          >
            <FiEdit2 size={15} />
          </button>
          <button
            type="button"
            className="tm-action-btn tm-action-btn-danger"
            title="Delete Task"
            aria-label="Delete Task"
            onClick={() => handleDeleteTask(row)}
          >
            <FiTrash2 size={15} />
          </button>
          <button
            type="button"
            className="tm-action-btn tm-action-btn-reassign"
            title="Reassign Task"
            aria-label="Reassign Task"
            onClick={() => handleOpenReassign(row)}
          >
            <FiUserCheck size={15} />
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
          <h1>Task Allocation & Assignment</h1>
          <p>Allocate tasks to candidates, configure deadlines, and monitor operational workload</p>
        </div>
        <div className="tm-header-actions">
          <Link to="/hr/tasks/create">
            <Button variant="primary" size="md">
              <FiPlus style={{ marginRight: 6 }} /> Allocate New Task
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="tm-stats-grid">
        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-blue">
            <FiCheckSquare />
          </div>
          <div className="tm-stat-content">
            <p>Total Allocated</p>
            <h3>{totalAssignments}</h3>
            <div className="tm-stat-subtext">Active assignments</div>
          </div>
        </div>

        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-purple">
            <FiClock />
          </div>
          <div className="tm-stat-content">
            <p>In Progress / Review</p>
            <h3>{inProgressCount + submittedCount}</h3>
            <div className="tm-stat-subtext">{submittedCount} awaiting review</div>
          </div>
        </div>

        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-green">
            <FiCheckSquare />
          </div>
          <div className="tm-stat-content">
            <p>Completed</p>
            <h3>{completedCount}</h3>
            <div className="tm-stat-subtext">Reviewed & approved</div>
          </div>
        </div>

        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-red">
            <FiAlertTriangle />
          </div>
          <div className="tm-stat-content">
            <p>Overdue</p>
            <h3>{overdueCount}</h3>
            <div className="tm-stat-subtext">Exceeded deadline</div>
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
            placeholder="Search tasks, descriptions, or assigned candidate names..."
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
          <option value="PENDING">PENDING</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="SUBMITTED">SUBMITTED</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="REWORK_REQUIRED">REWORK_REQUIRED</option>
        </select>

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

        <select
          className="tm-select-filter"
          value={isOverdueOnly}
          onChange={(e) => setIsOverdueOnly(e.target.value)}
        >
          <option value="">All Deadlines</option>
          <option value="true">Overdue Only</option>
          <option value="false">On Schedule</option>
        </select>
      </div>

      {/* Table */}
      <Card title="Allocated Tasks & Assignments" subtitle={`${assignments.length} record(s) matching filter`}>
        {error ? (
          <div style={{ padding: "24px", color: "#dc2626", textAlign: "center" }}>
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={fetchAssignments}>
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={assignments}
            loading={loading}
            emptyText="No task assignments found."
          />
        )}
      </Card>

      {/* Reassign Modal */}
      <Modal
        isOpen={isReassignModalOpen}
        onClose={() => setIsReassignModalOpen(false)}
        title="Reassign Task"
        size="md"
      >
        <form onSubmit={handleSaveReassign} className="tm-form">
          {formError && (
            <div style={{ padding: "10px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: "13px" }}>
              {formError}
            </div>
          )}
          <div className="tm-form-group">
            <label>Task: {selectedAssignment?.task?.title}</label>
          </div>

          <div className="tm-form-group">
            <label>Select New Candidate *</label>
            <select
              required
              value={reassignCandidateId}
              onChange={(e) => setReassignCandidateId(e.target.value)}
            >
              <option value="">-- Choose Candidate --</option>
              {candidatesList.map((cand) => (
                <option key={cand._id} value={cand._id}>
                  {cand.name} ({cand.team} - {cand.department})
                </option>
              ))}
            </select>
          </div>

          <div className="tm-form-group">
            <label>Updated Deadline</label>
            <input
              type="date"
              value={editDeadline}
              onChange={(e) => setEditDeadline(e.target.value)}
            />
          </div>

          <div className="tm-form-group">
            <label>Notes / Context for New Assignee</label>
            <textarea
              rows={2}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </div>

          <div className="tm-form-footer">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsReassignModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={formLoading}>
              {formLoading ? "Reassigning..." : "Confirm Reassignment"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Assignment"
        size="md"
      >
        <form onSubmit={handleSaveEdit} className="tm-form">
          {formError && (
            <div style={{ padding: "10px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: "13px" }}>
              {formError}
            </div>
          )}
          <div className="tm-form-group">
            <label>Deadline</label>
            <input
              type="date"
              value={editDeadline}
              onChange={(e) => setEditDeadline(e.target.value)}
            />
          </div>

          <div className="tm-form-row">
            <div className="tm-form-group">
              <label>Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              >
                <option value="PENDING">PENDING</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="REWORK_REQUIRED">REWORK_REQUIRED</option>
              </select>
            </div>

            <div className="tm-form-group">
              <label>Progress: {editProgress}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={editProgress}
                onChange={(e) => setEditProgress(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="tm-form-group">
            <label>Notes</label>
            <textarea
              rows={2}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </div>

          <div className="tm-form-footer">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={formLoading}>
              {formLoading ? "Updating..." : "Save Assignment"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}