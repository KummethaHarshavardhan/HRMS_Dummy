import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiCheckSquare,
  FiUser,
  FiUsers,
  FiCalendar,
  FiAlertCircle,
} from "react-icons/fi";
import { taskService } from "../../../services/taskService.js";
import { candidateService } from "../../../services/candidateService.js";
import Card from "../../../components/Card/Card.jsx";
import Button from "../../../components/Button/Button.jsx";
import "../TaskMonitoring.css";

export default function CreateTaskPage() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [allocationMode, setAllocationMode] = useState("SINGLE"); // "SINGLE" or "BULK"
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    // Default deadline: 7 days in future
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDeadline(d.toISOString().split("T")[0]);

    const loadCandidates = async () => {
      try {
        setLoadingCandidates(true);
        const res = await candidateService.getCandidates({ status: "ACTIVE", limit: 100 });
        setCandidates(res.data?.candidates || []);
      } catch (err) {
        console.error("Failed to load candidates for task allocation:", err);
      } finally {
        setLoadingCandidates(false);
      }
    };
    loadCandidates();
  }, []);

  const handleToggleBulkCandidate = (id) => {
    if (selectedCandidateIds.includes(id)) {
      setSelectedCandidateIds(selectedCandidateIds.filter((item) => item !== id));
    } else {
      setSelectedCandidateIds([...selectedCandidateIds, id]);
    }
  };

  const handleSelectTeam = (teamName) => {
    const teamCandIds = candidates.filter((c) => c.team === teamName).map((c) => c._id);
    const combined = [...new Set([...selectedCandidateIds, ...teamCandIds])];
    setSelectedCandidateIds(combined);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !description || !deadline) {
      setError("Please fill in Title, Description, and Deadline.");
      return;
    }

    if (allocationMode === "SINGLE" && !selectedCandidateId) {
      setError("Please select a candidate to allocate this task to.");
      return;
    }

    if (allocationMode === "BULK" && selectedCandidateIds.length === 0) {
      setError("Please select at least one candidate for bulk allocation.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const payload = {
        title,
        description,
        priority,
        deadline,
        notes,
      };

      if (allocationMode === "SINGLE") {
        payload.candidateId = selectedCandidateId;
      } else {
        payload.candidateIds = selectedCandidateIds;
      }

      await taskService.createTask(payload);
      navigate("/hr/tasks");
    } catch (err) {
      console.error("Failed to create and allocate task:", err);
      setError(err.message || "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  const teamsList = [...new Set(candidates.map((c) => c.team).filter(Boolean))];

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
            <FiArrowLeft /> Back to Task Allocation
          </Link>
          <h1>Allocate New Task</h1>
          <p>Define task requirements and allocate to individual candidates or entire teams</p>
        </div>
      </div>

      <Card title="Task Definition & Assignee Form">
        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "#fef2f2",
              color: "#b91c1c",
              borderRadius: 8,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "14px",
            }}
          >
            <FiAlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="tm-form">
          <div className="tm-form-group">
            <label>Task Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Implement Redux Toolkit State Management"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="tm-form-group">
            <label>Task Description & Instructions *</label>
            <textarea
              rows={4}
              required
              placeholder="Detail the exact deliverables, acceptance criteria, documentation expectations, and technical stack..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="tm-form-row">
            <div className="tm-form-group">
              <label>Task Priority *</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="LOW">LOW (Standard non-blocking task)</option>
                <option value="MEDIUM">MEDIUM (Regular milestone delivery)</option>
                <option value="HIGH">HIGH (Urgent release dependency)</option>
                <option value="URGENT">URGENT (Immediate critical priority)</option>
              </select>
            </div>

            <div className="tm-form-group">
              <label>Submission Deadline *</label>
              <input
                type="date"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          {/* Allocation Mode Selector */}
          <div className="tm-form-group" style={{ marginTop: 4 }}>
            <label>Allocation Mode</label>
            <div className="tm-mode-selector">
              <button
                type="button"
                className={`tm-mode-btn ${allocationMode === "SINGLE" ? "active" : ""}`}
                onClick={() => setAllocationMode("SINGLE")}
              >
                <FiUser size={15} />
                <span>Single Candidate</span>
              </button>
              <button
                type="button"
                className={`tm-mode-btn ${allocationMode === "BULK" ? "active" : ""}`}
                onClick={() => setAllocationMode("BULK")}
              >
                <FiUsers size={15} />
                <span>Bulk / Team Allocation</span>
              </button>
            </div>
          </div>

          {allocationMode === "SINGLE" ? (
            <div className="tm-form-group" style={{ marginTop: 10 }}>
              <label>Select Assignee *</label>
              <select
                required
                value={selectedCandidateId}
                onChange={(e) => setSelectedCandidateId(e.target.value)}
              >
                <option value="">-- Choose Candidate --</option>
                {candidates.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.team} &bull; {c.designation})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>
                  Select Candidates for Bulk Assignment ({selectedCandidateIds.length} selected)
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {teamsList.map((tm) => (
                    <button
                      key={tm}
                      type="button"
                      className="tm-team-tag-btn"
                      onClick={() => handleSelectTeam(tm)}
                    >
                      + {tm}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  maxHeight: 200,
                  overflowY: "auto",
                  border: "1px solid var(--slate-200, #e2e8f0)",
                  borderRadius: 8,
                  padding: 10,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
                  gap: 8,
                  background: "#f8fafc",
                }}
              >
                {candidates.map((c) => {
                  const isChecked = selectedCandidateIds.includes(c._id);
                  return (
                    <label
                      key={c._id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: isChecked ? "#eff6ff" : "#fff",
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid",
                        borderColor: isChecked ? "#93c5fd" : "#e2e8f0",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleBulkCandidate(c._id)}
                      />
                      <span>
                        <strong>{c.name}</strong> ({c.team})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="tm-form-group" style={{ marginTop: 10 }}>
            <label>Specific Instructions / Notes</label>
            <input
              type="text"
              placeholder="e.g. Include unit tests and verify against API contract before submission"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="tm-form-footer" style={{ marginTop: 20 }}>
            <Link to="/hr/tasks">
              <Button variant="outline" size="md" type="button">
                Cancel
              </Button>
            </Link>
            <Button variant="primary" size="md" type="submit" disabled={submitting}>
              {submitting ? "Allocating Tasks..." : "Confirm & Allocate Task"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
