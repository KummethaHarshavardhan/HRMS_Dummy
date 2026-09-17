import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FiUsers,
  FiPlus,
  FiSearch,
  FiEye,
  FiEdit2,
  FiTrash2,
  FiCheckSquare,
  FiCheckCircle,
  FiClock,
  FiAlertCircle,
} from "react-icons/fi";
import { candidateService } from "../../../services/candidateService.js";
import { taskService } from "../../../services/taskService.js";
import Card from "../../../components/Card/Card.jsx";
import Button from "../../../components/Button/Button.jsx";
import Table from "../../../components/Table/Table.jsx";
import Modal from "../../../components/Modal/Modal.jsx";
import Loader from "../../../components/Loader/Loader.jsx";
import "../TaskMonitoring.css";

export default function CandidateListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [filterMeta, setFilterMeta] = useState({ teams: [], departments: [] });

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Candidate Form state
  const [candidateForm, setCandidateForm] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    designation: "",
    team: "",
    status: "ACTIVE",
  });

  // Task Assign Form state
  const [assignForm, setAssignForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    deadline: "",
    notes: "",
  });

  const fetchFilterMeta = async () => {
    try {
      const res = await candidateService.getFiltersMeta();
      setFilterMeta(res.data || { teams: [], departments: [] });
    } catch (err) {
      console.error("Failed to load filter metadata:", err);
    }
  };

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await candidateService.getCandidates({
        search,
        team: selectedTeam,
        department: selectedDept,
        limit: 100,
      });
      setCandidates(res.data?.candidates || []);
    } catch (err) {
      console.error("Failed to fetch candidates:", err);
      setError(err.message || "Failed to load candidates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilterMeta();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCandidates();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, selectedTeam, selectedDept]);

  // Handle Add Candidate
  const handleOpenAdd = () => {
    setCandidateForm({
      name: "",
      email: "",
      phone: "",
      department: "",
      designation: "",
      team: "",
      status: "ACTIVE",
    });
    setFormError("");
    setIsAddModalOpen(true);
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    if (!candidateForm.name || !candidateForm.email || !candidateForm.department || !candidateForm.designation || !candidateForm.team) {
      setFormError("Please fill in all required fields (Name, Email, Dept, Designation, Team)");
      return;
    }

    try {
      setFormLoading(true);
      setFormError("");
      await candidateService.createCandidate(candidateForm);
      setIsAddModalOpen(false);
      fetchCandidates();
      fetchFilterMeta();
    } catch (err) {
      setFormError(err.message || "Failed to create candidate");
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Edit Candidate
  const handleOpenEdit = (cand) => {
    setSelectedCandidate(cand);
    setCandidateForm({
      name: cand.name || "",
      email: cand.email || "",
      phone: cand.phone || "",
      department: cand.department || "",
      designation: cand.designation || "",
      team: cand.team || "",
      status: cand.status || "ACTIVE",
    });
    setFormError("");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      setFormLoading(true);
      setFormError("");
      await candidateService.updateCandidate(selectedCandidate._id, candidateForm);
      setIsEditModalOpen(false);
      fetchCandidates();
    } catch (err) {
      setFormError(err.message || "Failed to update candidate");
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Delete Candidate
  const handleDelete = async (cand) => {
    if (!window.confirm(`Are you sure you want to delete candidate ${cand.name}? This will remove all their assigned tasks.`)) {
      return;
    }
    try {
      await candidateService.deleteCandidate(cand._id);
      fetchCandidates();
    } catch (err) {
      alert(err.message || "Failed to delete candidate");
    }
  };

  // Handle Quick Assign Task
  const handleOpenAssign = (cand) => {
    setSelectedCandidate(cand);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    const defaultDeadline = tomorrow.toISOString().split("T")[0];

    setAssignForm({
      title: "",
      description: "",
      priority: "MEDIUM",
      deadline: defaultDeadline,
      notes: "",
    });
    setFormError("");
    setIsAssignModalOpen(true);
  };

  const handleSaveAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.title || !assignForm.description || !assignForm.deadline) {
      setFormError("Title, description, and deadline are required");
      return;
    }

    try {
      setFormLoading(true);
      setFormError("");
      await taskService.createTask({
        ...assignForm,
        candidateId: selectedCandidate._id,
      });
      setIsAssignModalOpen(false);
      fetchCandidates();
      alert(`Task successfully assigned to ${selectedCandidate.name}!`);
    } catch (err) {
      setFormError(err.message || "Failed to assign task");
    } finally {
      setFormLoading(false);
    }
  };

  // Compute summary metrics
  const totalCandidates = candidates.length;
  const activeCandidates = candidates.filter((c) => c.status === "ACTIVE").length;
  const totalTasksAssigned = candidates.reduce((sum, c) => sum + (c.taskStats?.totalTasks || 0), 0);
  const totalCompleted = candidates.reduce((sum, c) => sum + (c.taskStats?.completedTasks || 0), 0);
  const overallEfficiency = totalTasksAssigned > 0 ? Math.round((totalCompleted / totalTasksAssigned) * 100) : 0;

  // Table columns
  const columns = [
    {
      key: "name",
      header: "Candidate Name",
      width: "25%",
      render: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #4338ca)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              fontSize: "13px",
              flexShrink: 0,
            }}
          >
            {row.name?.slice(0, 2).toUpperCase() || "CA"}
          </div>
          <div>
            <strong style={{ fontSize: "13px", color: "var(--slate-900, #0f172a)", display: "block" }}>
              {row.name}
            </strong>
            <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)" }}>{row.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: "department",
      header: "Department & Role",
      width: "20%",
      render: (row) => (
        <div>
          <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--slate-800, #1e293b)", display: "block" }}>
            {row.designation || "-"}
          </span>
          <span style={{ fontSize: "11px", color: "var(--slate-500, #64748b)" }}>{row.department}</span>
        </div>
      ),
    },
    {
      key: "team",
      header: "Team",
      width: "12%",
      render: (row) => (
        <span style={{ fontWeight: 600, color: "#4f46e5", fontSize: "12px" }}>
          {row.team || "General"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "10%",
      render: (row) => (
        <span className={`tm-badge ${row.status === "ACTIVE" ? "tm-badge-completed" : "tm-badge-pending"}`}>
          ● {row.status}
        </span>
      ),
    },
    {
      key: "progress",
      header: "Task Velocity",
      width: "18%",
      render: (row) => {
        const stats = row.taskStats || {};
        const rate = stats.completionRate || 0;
        return (
          <div className="tm-progress-wrapper">
            <div className="tm-progress-track">
              <div
                className="tm-progress-fill"
                style={{
                  width: `${rate}%`,
                  backgroundColor: rate >= 80 ? "#10b981" : rate >= 40 ? "#3b82f6" : "#f59e0b",
                }}
              />
            </div>
            <span className="tm-progress-text">{rate}%</span>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      width: "160px",
      render: (row) => (
        <div className="tm-actions-cell">
          <Link
            to={`/hr/candidates/${row._id}`}
            className="tm-action-btn"
            title="View Details"
            aria-label="View Candidate Details"
          >
            <FiEye size={15} />
          </Link>
          <button
            type="button"
            className="tm-action-btn tm-action-btn-primary"
            onClick={() => handleOpenAssign(row)}
            title="Assign Task"
            aria-label="Assign Task"
          >
            <FiCheckSquare size={15} />
          </button>
          <button
            type="button"
            className="tm-action-btn tm-action-btn-edit"
            onClick={() => handleOpenEdit(row)}
            title="Edit Candidate"
            aria-label="Edit Candidate"
          >
            <FiEdit2 size={15} />
          </button>
          <button
            type="button"
            className="tm-action-btn tm-action-btn-danger"
            onClick={() => handleDelete(row)}
            title="Delete Candidate"
            aria-label="Delete Candidate"
          >
            <FiTrash2 size={15} />
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
          <h1>Candidate Directory</h1>
          <p>Manage candidate profiles, department assignments, and ongoing task allocation</p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="tm-stats-grid">
        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-blue">
            <FiUsers />
          </div>
          <div className="tm-stat-content">
            <p>Total Candidates</p>
            <h3>{totalCandidates}</h3>
            <div className="tm-stat-subtext">{activeCandidates} active in system</div>
          </div>
        </div>

        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-purple">
            <FiCheckSquare />
          </div>
          <div className="tm-stat-content">
            <p>Allocated Tasks</p>
            <h3>{totalTasksAssigned}</h3>
            <div className="tm-stat-subtext">{totalCompleted} tasks completed</div>
          </div>
        </div>

        <div className="tm-stat-card">
          <div className="tm-stat-icon tm-icon-green">
            <FiCheckCircle />
          </div>
          <div className="tm-stat-content">
            <p>Completion Efficiency</p>
            <h3>{overallEfficiency}%</h3>
            <div className="tm-stat-subtext">Aggregated task completion rate</div>
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
            placeholder="Search by candidate name, email, role, or team..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="tm-select-filter"
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
        >
          <option value="">All Teams</option>
          {filterMeta.teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          className="tm-select-filter"
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
        >
          <option value="">All Departments</option>
          {filterMeta.departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Candidates Table */}
      <Card title="Candidate Roster" subtitle={`${candidates.length} candidate record(s) loaded`}>
        {error ? (
          <div style={{ padding: "24px", color: "#dc2626", textAlign: "center" }}>
            <FiAlertCircle size={24} style={{ marginBottom: 8 }} />
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={fetchCandidates}>
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={candidates}
            loading={loading}
            emptyText="No candidates matching your search criteria."
          />
        )}
      </Card>

      {/* Add Candidate Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Candidate"
        size="md"
      >
        <form onSubmit={handleSaveAdd} className="tm-form">
          {formError && (
            <div style={{ padding: "10px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: "13px" }}>
              {formError}
            </div>
          )}
          <div className="tm-form-row">
            <div className="tm-form-group">
              <label>Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                value={candidateForm.name}
                onChange={(e) => setCandidateForm({ ...candidateForm, name: e.target.value })}
              />
            </div>
            <div className="tm-form-group">
              <label>Email Address *</label>
              <input
                type="email"
                required
                placeholder="candidate@company.com"
                value={candidateForm.email}
                onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
              />
            </div>
          </div>

          <div className="tm-form-row">
            <div className="tm-form-group">
              <label>Phone Number</label>
              <input
                type="text"
                placeholder="+91 9876543210"
                value={candidateForm.phone}
                onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
              />
            </div>
            <div className="tm-form-group">
              <label>Team *</label>
              <input
                type="text"
                required
                placeholder="e.g. Team Alpha"
                value={candidateForm.team}
                onChange={(e) => setCandidateForm({ ...candidateForm, team: e.target.value })}
              />
            </div>
          </div>

          <div className="tm-form-row">
            <div className="tm-form-group">
              <label>Department *</label>
              <input
                type="text"
                required
                placeholder="e.g. Frontend Engineering"
                value={candidateForm.department}
                onChange={(e) => setCandidateForm({ ...candidateForm, department: e.target.value })}
              />
            </div>
            <div className="tm-form-group">
              <label>Designation *</label>
              <input
                type="text"
                required
                placeholder="e.g. React Developer Trainee"
                value={candidateForm.designation}
                onChange={(e) => setCandidateForm({ ...candidateForm, designation: e.target.value })}
              />
            </div>
          </div>

          <div className="tm-form-footer">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={formLoading}>
              {formLoading ? "Saving..." : "Create Candidate"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Candidate Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Candidate Profile"
        size="md"
      >
        <form onSubmit={handleSaveEdit} className="tm-form">
          {formError && (
            <div style={{ padding: "10px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: "13px" }}>
              {formError}
            </div>
          )}
          <div className="tm-form-row">
            <div className="tm-form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={candidateForm.name}
                onChange={(e) => setCandidateForm({ ...candidateForm, name: e.target.value })}
              />
            </div>
            <div className="tm-form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={candidateForm.email}
                onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
              />
            </div>
          </div>

          <div className="tm-form-row">
            <div className="tm-form-group">
              <label>Phone Number</label>
              <input
                type="text"
                value={candidateForm.phone}
                onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
              />
            </div>
            <div className="tm-form-group">
              <label>Team</label>
              <input
                type="text"
                value={candidateForm.team}
                onChange={(e) => setCandidateForm({ ...candidateForm, team: e.target.value })}
              />
            </div>
          </div>

          <div className="tm-form-row">
            <div className="tm-form-group">
              <label>Department</label>
              <input
                type="text"
                value={candidateForm.department}
                onChange={(e) => setCandidateForm({ ...candidateForm, department: e.target.value })}
              />
            </div>
            <div className="tm-form-group">
              <label>Designation</label>
              <input
                type="text"
                value={candidateForm.designation}
                onChange={(e) => setCandidateForm({ ...candidateForm, designation: e.target.value })}
              />
            </div>
          </div>

          <div className="tm-form-group">
            <label>Status</label>
            <select
              value={candidateForm.status}
              onChange={(e) => setCandidateForm({ ...candidateForm, status: e.target.value })}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="tm-form-footer">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={formLoading}>
              {formLoading ? "Updating..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Task Allocation Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Allocate Task to ${selectedCandidate?.name || "Candidate"}`}
        size="md"
      >
        <form onSubmit={handleSaveAssign} className="tm-form">
          {formError && (
            <div style={{ padding: "10px", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: "13px" }}>
              {formError}
            </div>
          )}

          <div className="tm-form-group">
            <label>Task Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Implement User Profile Module"
              value={assignForm.title}
              onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
            />
          </div>

          <div className="tm-form-group">
            <label>Description & Objectives *</label>
            <textarea
              rows={3}
              required
              placeholder="Provide explicit deliverables, guidelines, and expected results..."
              value={assignForm.description}
              onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })}
            />
          </div>

          <div className="tm-form-row">
            <div className="tm-form-group">
              <label>Priority</label>
              <select
                value={assignForm.priority}
                onChange={(e) => setAssignForm({ ...assignForm, priority: e.target.value })}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
            <div className="tm-form-group">
              <label>Deadline *</label>
              <input
                type="date"
                required
                value={assignForm.deadline}
                onChange={(e) => setAssignForm({ ...assignForm, deadline: e.target.value })}
              />
            </div>
          </div>

          <div className="tm-form-group">
            <label>Initial Instructions / Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Focus on test coverage and reusable patterns"
              value={assignForm.notes}
              onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
            />
          </div>

          <div className="tm-form-footer">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={formLoading}>
              {formLoading ? "Allocating..." : "Allocate Task"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}