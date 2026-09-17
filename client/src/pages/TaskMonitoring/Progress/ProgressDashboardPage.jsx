import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FiTrendingUp,
  FiClock,
  FiActivity,
  FiSend,
  FiCheckCircle,
  FiAlertTriangle,
  FiUsers,
  FiRefreshCw,
  FiUser,
  FiX,
  FiSun,
  FiMoon,
} from "react-icons/fi";
import { progressService } from "../../../services/progressService.js";
import Loader from "../../../components/Loader/Loader.jsx";
import "./ProgressDashboardPage.css";

export default function ProgressDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [overview, setOverview] = useState({ summary: {}, deadlines: {} });
  const [candidatesProgress, setCandidatesProgress] = useState([]);
  const [teamsProgress, setTeamsProgress] = useState([]);
  const [showTeamModal, setShowTeamModal] = useState(false);

  // Theme mode: "portal" honors the usual background; "dark" matches the laptop reference photo
  const [themeMode, setThemeMode] = useState("portal");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [resOverview, resCandidates, resTeams] = await Promise.all([
        progressService.getOverview(),
        progressService.getCandidatesProgress(),
        progressService.getTeamsProgress(),
      ]);

      setOverview(resOverview?.data || { summary: {}, deadlines: {} });
      setCandidatesProgress(resCandidates?.data?.candidates || []);
      setTeamsProgress(resTeams?.data?.teams || []);
    } catch (err) {
      console.error("Failed to load progress metrics:", err);
      setError(err.message || "Failed to load progress metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const { summary = {}, deadlines = {} } = overview;

  return (
    <div className={`pm-dashboard-container pm-theme-${themeMode}`}>
      {/* --------------------------------------------------------------------
          PAGE HEADER
          -------------------------------------------------------------------- */}
      <div className="pm-header">
        <div className="pm-header-info">
          <h1 className="pm-header-title">Progress Monitoring Dashboard</h1>
          <p className="pm-header-subtitle">
            Real-time tracking of candidate workflow states, velocity, and deadline compliance
          </p>
        </div>

        <div className="pm-header-actions">
          {/* Quick Theme Switcher Pill */}
          <div className="pm-theme-toggle" title="Switch between Portal Theme and Dark Reference Theme">
            <button
              type="button"
              className={`pm-theme-btn ${themeMode === "portal" ? "active" : ""}`}
              onClick={() => setThemeMode("portal")}
            >
              <FiSun size={13} />
              <span>Portal</span>
            </button>
            <button
              type="button"
              className={`pm-theme-btn ${themeMode === "dark" ? "active" : ""}`}
              onClick={() => setThemeMode("dark")}
            >
              <FiMoon size={13} />
              <span>Dark Deck</span>
            </button>
          </div>

          <button
            type="button"
            className="pm-btn pm-btn-secondary"
            onClick={() => setShowTeamModal(true)}
            title="View Team Progress Breakdown"
          >
            <FiUsers size={15} />
            <span>Team Progress Breakdown</span>
          </button>

          <button
            type="button"
            className="pm-btn pm-btn-primary"
            onClick={fetchData}
            disabled={loading}
            title="Refresh current metrics"
          >
            <FiRefreshCw size={15} className={loading ? "pm-spin" : ""} />
            <span>Refresh Metrics</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "12px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FiAlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* --------------------------------------------------------------------
          SECTION 1: TOP 6 METRIC CARDS (Matching Reference Photo 2)
          -------------------------------------------------------------------- */}
      <div className="pm-metrics-grid">
        {/* 1. TOTAL ALLOCATED */}
        <div className="pm-metric-card">
          <div className="pm-metric-icon-box pm-icon-blue">
            <FiTrendingUp />
          </div>
          <div className="pm-metric-details">
            <span className="pm-metric-label">Total Allocated</span>
            <span className="pm-metric-value">{summary.totalTasks || 0}</span>
            <span className="pm-metric-subtext">Tasks assigned</span>
          </div>
        </div>

        {/* 2. PENDING START */}
        <div className="pm-metric-card">
          <div className="pm-metric-icon-box pm-icon-cyan">
            <FiClock />
          </div>
          <div className="pm-metric-details">
            <span className="pm-metric-label">Pending Start</span>
            <span className="pm-metric-value">{summary.pending || 0}</span>
            <span className="pm-metric-subtext">Not yet started</span>
          </div>
        </div>

        {/* 3. IN PROGRESS */}
        <div className="pm-metric-card">
          <div className="pm-metric-icon-box pm-icon-activity">
            <FiActivity />
          </div>
          <div className="pm-metric-details">
            <span className="pm-metric-label">In Progress</span>
            <span className="pm-metric-value">{summary.inProgress || 0}</span>
            <span className="pm-metric-subtext">Active development</span>
          </div>
        </div>

        {/* 4. SUBMITTED */}
        <div className="pm-metric-card">
          <div className="pm-metric-icon-box pm-icon-indigo">
            <FiSend />
          </div>
          <div className="pm-metric-details">
            <span className="pm-metric-label">Submitted</span>
            <span className="pm-metric-value">{summary.submitted || 0}</span>
            <span className="pm-metric-subtext">Awaiting review</span>
          </div>
        </div>

        {/* 5. COMPLETED */}
        <div className="pm-metric-card">
          <div className="pm-metric-icon-box pm-icon-green">
            <FiCheckCircle />
          </div>
          <div className="pm-metric-details">
            <span className="pm-metric-label">Completed</span>
            <span className="pm-metric-value">{summary.completed || 0}</span>
            <span className="pm-metric-subtext">{summary.completionRate || 0}% rate</span>
          </div>
        </div>

        {/* 6. OVERDUE TASKS */}
        <div className="pm-metric-card">
          <div className="pm-metric-icon-box pm-icon-red">
            <FiAlertTriangle />
          </div>
          <div className="pm-metric-details">
            <span className="pm-metric-label">Overdue Tasks</span>
            <span className="pm-metric-value">{summary.overdue || 0}</span>
            <span className="pm-metric-subtext pm-metric-subtext-danger">Requires attention</span>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------
          SECTION 2: DEADLINE & TIMELINESS CLASSIFICATION (Matching Photo 2)
          -------------------------------------------------------------------- */}
      <div className="pm-section-wrapper">
        <div className="pm-section-header">
          <h2 className="pm-section-title">Deadline & Timeliness Classification</h2>
          <p className="pm-section-subtitle">
            Automatic calculation based on current time versus task deadline
          </p>
        </div>

        <div className="pm-deadlines-grid">
          {/* 1. Completed On Time */}
          <div className="pm-deadline-card pm-border-teal">
            <span className="pm-deadline-label">Completed On Time</span>
            <span className="pm-deadline-value">{deadlines.completedOnTime || 0}</span>
          </div>

          {/* 2. Completed Late */}
          <div className="pm-deadline-card pm-border-amber">
            <span className="pm-deadline-label">Completed Late</span>
            <span className="pm-deadline-value">{deadlines.completedLate || 0}</span>
          </div>

          {/* 3. Currently Overdue */}
          <div className="pm-deadline-card pm-border-red">
            <span className="pm-deadline-label">Currently Overdue</span>
            <span className="pm-deadline-value">{deadlines.overdue || 0}</span>
          </div>

          {/* 4. Due Today */}
          <div className="pm-deadline-card pm-border-sky">
            <span className="pm-deadline-label">Due Today</span>
            <span className="pm-deadline-value">{deadlines.dueToday || 0}</span>
          </div>

          {/* 5. Upcoming Future */}
          <div className="pm-deadline-card pm-border-slate">
            <span className="pm-deadline-label">Upcoming Future</span>
            <span className="pm-deadline-value">{deadlines.upcoming || 0}</span>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------
          SECTION 3: CANDIDATE PROGRESS & WORKLOAD VELOCITY TABLE (Matching Photos 2 & 3)
          -------------------------------------------------------------------- */}
      <div className="pm-section-wrapper">
        <div className="pm-section-header">
          <h2 className="pm-section-title">Candidate Progress & Workload Velocity</h2>
          <p className="pm-section-subtitle">
            Individual task load, completion rate, and progress percentages
          </p>
        </div>

        <div className="pm-table-container">
          <div className="pm-table-responsive">
            <table className="pm-table">
              <thead>
                <tr>
                  <th style={{ width: "24%" }}>Candidate Name</th>
                  <th style={{ width: "16%" }}>Team</th>
                  <th style={{ width: "26%" }}>Task Breakdown</th>
                  <th style={{ width: "12%" }}>Overdue Alert</th>
                  <th style={{ width: "14%" }}>Overall Progress</th>
                  <th style={{ width: "8%", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px 0" }}>
                      <Loader.Spinner size="lg" />
                    </td>
                  </tr>
                ) : candidatesProgress.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="pm-empty-state">
                      No active candidates found.
                    </td>
                  </tr>
                ) : (
                  candidatesProgress.map((cand) => (
                    <tr key={cand._id}>
                      {/* 1. Candidate Name + Email */}
                      <td>
                        <div className="pm-cand-name-box">
                          <span className="pm-cand-name">{cand.name}</span>
                          <span className="pm-cand-email">{cand.email}</span>
                        </div>
                      </td>

                      {/* 2. Team */}
                      <td>
                        <span className="pm-cand-team">
                          {cand.team || cand.department || "General Team"}
                        </span>
                      </td>

                      {/* 3. Task Breakdown */}
                      <td>
                        <div className="pm-breakdown-tokens">
                          <span className="pm-token-comp">{cand.completed || 0}Comp</span>
                          <span className="pm-token-sep">•</span>
                          <span className="pm-token-prog">{cand.inProgress || 0}In-Prog</span>
                          <span className="pm-token-sep">•</span>
                          <span className="pm-token-sub">{cand.submitted || 0}Sub</span>
                          <span className="pm-token-sep">•</span>
                          <span className="pm-token-pend">{cand.pending || 0}Pend</span>
                        </div>
                      </td>

                      {/* 4. Overdue Alert */}
                      <td>
                        {cand.overdue > 0 ? (
                          <span className="pm-badge-overdue">{cand.overdue} OVERDUE</span>
                        ) : (
                          <span className="pm-text-zero-overdue">0 overdue</span>
                        )}
                      </td>

                      {/* 5. Overall Progress */}
                      <td>
                        <div className="pm-progress-cell">
                          <div className="pm-progress-header">
                            <span>Progress</span>
                            <span className="pm-progress-pct">
                              {cand.progressPercentage || 0}%
                            </span>
                          </div>
                          <div className="pm-progress-bar-track">
                            <div
                              className={`pm-progress-bar-fill ${
                                cand.progressPercentage >= 80
                                  ? "pm-fill-green"
                                  : "pm-fill-blue"
                              }`}
                              style={{ width: `${cand.progressPercentage || 0}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 6. Action: Profile */}
                      <td style={{ textAlign: "right" }}>
                        <Link
                          to={`/hr/candidates/${cand._id}`}
                          className="pm-action-profile-btn"
                          title={`View ${cand.name}'s Profile`}
                        >
                          <FiUser size={13} />
                          <span>Profile</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------
          TEAM PROGRESS BREAKDOWN MODAL (Triggered by Header Button)
          -------------------------------------------------------------------- */}
      {showTeamModal && (
        <div className="pm-modal-overlay" onClick={() => setShowTeamModal(false)}>
          <div className="pm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pm-modal-header">
              <div>
                <h3 className="pm-modal-title">Team Progress & Velocity Breakdown</h3>
                <p className="pm-modal-subtitle">
                  Aggregated candidate workload, completion velocity, and delivery metrics across teams
                </p>
              </div>
              <button
                type="button"
                className="pm-modal-close-btn"
                onClick={() => setShowTeamModal(false)}
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="pm-modal-body">
              <div className="pm-table-responsive">
                <table className="pm-table">
                  <thead>
                    <tr>
                      <th>Team Name</th>
                      <th>Members</th>
                      <th>Tasks Assigned</th>
                      <th>Overdue</th>
                      <th>Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamsProgress.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="pm-empty-state">
                          No teams found.
                        </td>
                      </tr>
                    ) : (
                      teamsProgress.map((team, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong style={{ color: "var(--pm-text-title)" }}>
                              {team.team}
                            </strong>
                          </td>
                          <td>
                            <span>{team.candidateCount || 0} candidates</span>
                          </td>
                          <td>
                            <span>
                              {team.completed || 0} / {team.totalTasks || 0} tasks
                            </span>
                          </td>
                          <td>
                            {team.overdue > 0 ? (
                              <span className="pm-badge-overdue">
                                {team.overdue} Tasks
                              </span>
                            ) : (
                              <span style={{ color: "#10b981", fontWeight: 600 }}>
                                On Track
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="pm-progress-cell">
                              <div className="pm-progress-header">
                                <span>Rate</span>
                                <span className="pm-progress-pct">
                                  {team.completionRate || 0}%
                                </span>
                              </div>
                              <div className="pm-progress-bar-track">
                                <div
                                  className="pm-progress-bar-fill pm-fill-green"
                                  style={{ width: `${team.completionRate || 0}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pm-modal-footer">
              <button
                type="button"
                className="pm-btn pm-btn-secondary"
                onClick={() => setShowTeamModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}