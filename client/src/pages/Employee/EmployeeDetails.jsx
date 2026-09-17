import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import EmployeeDetailsCard from "../../components/employee/EmployeeDetailsCard.jsx";
import ConfirmModal from "../../components/Modal/ConfirmModal.jsx";
import {
  getEmployeeById,
  updateEmployeeStatus,
  deleteEmployee,
} from "../../services/employeeService.js";
import { createOffboarding } from "../../services/offboardingService.js";
import {
  createOnboarding,
  getEmployeeLifecycleHistory,
} from "../../services/onboardingService.js";
import DocumentManager from "../../components/employee/DocumentManager.jsx";
import EmployeeAssetsTab from "../../components/employee/EmployeeAssetsTab.jsx";
import Modal from "../../components/Modal/Modal.jsx";
import Button from "../../components/Button/Button.jsx";
import "../../components/employee/emp.shared.css";
import "../../components/employee/EmployeeDetailsCard.css";
import "./EmployeeList.css";
import { normalizeRole } from "../../utils/permission.js";
import {
  FiArrowLeft,
  FiXCircle,
  FiCheckCircle,
  FiSearch,
  FiFileText,
  FiBox,
  FiInfo,
  FiUserMinus,
  FiUserPlus,
  FiClock,
} from "react-icons/fi";

export default function EmployeeDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const normRole = normalizeRole(user?.role);
  const canEdit = normRole === "admin" || normRole === "hr_manager";

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  // Offboarding modal state
  const [offboardingOpen, setOffboardingOpen] = useState(false);
  const [resignationDate, setResignationDate] = useState("");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [exitReason, setExitReason] = useState("");
  const [initiatingOffboarding, setInitiatingOffboarding] = useState(false);

  // Rejoin modal state
  const [rejoinOpen, setRejoinOpen] = useState(false);
  const [rejoinDate, setRejoinDate] = useState("");
  const [initiatingRejoin, setInitiatingRejoin] = useState(false);

  // Lifecycle history state
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState({ onboardings: [], offboardings: [], timeline: [] });

  const loadLifecycleHistory = async () => {
    if (!id) return;
    setHistoryLoading(true);
    try {
      const data = await getEmployeeLifecycleHistory(id);
      setHistoryData(data || { onboardings: [], offboardings: [], timeline: [] });
    } catch (err) {
      console.warn("Could not load lifecycle history:", err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError("");
    getEmployeeById(id)
      .then((data) => setEmployee(data?.employee || null))
      .catch((err) => setError(err.message || "Failed to load employee"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (activeTab === "history") {
      loadLifecycleHistory();
    }
  }, [activeTab, id]);

  const handleToggleStatus = async () => {
    if (!employee) return;
    if (employee.employment_status === "Inactive") {
      showToast('error', "Relieved employees can only be reactivated via rejoin/onboarding.");
      return;
    }
    const newStatus = "Inactive";
    setStatusLoading(true);
    try {
      const data = await updateEmployeeStatus(id, newStatus);
      setEmployee(data?.employee || employee);
      showToast('success', `Status updated to ${newStatus}`);
    } catch (err) {
      showToast('error', err.message || "Failed to update status");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleRejoinSubmit = async (e) => {
    e.preventDefault();
    try {
      setInitiatingRejoin(true);
      const res = await createOnboarding({
        employee_id: employee._id || employee.id,
        start_date: rejoinDate || new Date().toISOString().slice(0, 10),
      });
      showToast("success", "Rejoin onboarding process initiated successfully!");
      setRejoinOpen(false);
      loadLifecycleHistory();
      if (res?.onboarding?._id) {
        navigate(`/onboarding/${res.onboarding._id}`);
      }
    } catch (err) {
      showToast("error", err.message || "Failed to initiate rejoin process");
    } finally {
      setInitiatingRejoin(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await deleteEmployee(id);
      showToast('success', "Employee deactivated successfully.");
      navigate("/employee");
    } catch (err) {
      showToast('error', err.message || "Failed to deactivate employee");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditClick = (emp) => {
    if (!canEdit) {
      showToast('error', "You do not have permission to edit employee details.");
      return;
    }
    navigate(`/employee/${emp._id || emp.id}/edit`);
  };

  const handleDeleteClick = () => {
    if (!canEdit) {
      showToast('error', "You do not have permission to deactivate employees.");
      return;
    }
    setConfirmDelete(true);
  };

  if (loading) {
    return (
      <div className="emp-page">
        <div className="emp-loading">
          <span className="emp-spinner" />
          Loading employee details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="emp-page">
        <div className="emp-alert error">{error}</div>
        <button className="emp-btn-secondary" onClick={() => navigate("/employee")}>
          <FiArrowLeft size={16} /> Back to Directory
        </button>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="emp-page">
        <div className="emp-empty-state">
          <div className="emp-empty-icon"><FiSearch size={48} /></div>
          <p>Employee not found</p>
        </div>
        <button
          className="emp-btn-secondary"
          style={{ marginTop: 12 }}
          onClick={() => navigate("/employee")}
        >
          <FiArrowLeft size={16} /> Back to Directory
        </button>
      </div>
    );
  }

  const name =
    (typeof employee?.user_id === "object" && employee?.user_id?.name) ||
    employee?.name ||
    "this employee";

  const handleOffboardingSubmit = async (e) => {
    e.preventDefault();
    if (!resignationDate || !lastWorkingDay) {
      showToast("error", "Please provide resignation date and last working day.");
      return;
    }
    try {
      setInitiatingOffboarding(true);
      const res = await createOffboarding({
        employee_id: employee._id || employee.id,
        resignation_date: resignationDate,
        last_working_day: lastWorkingDay,
        exit_reason: exitReason,
      });
      showToast("success", "Offboarding process initiated!");
      setOffboardingOpen(false);
      navigate(`/offboarding/${res?.offboarding?._id || ""}`);
    } catch (err) {
      showToast("error", err.message || "Failed to initiate offboarding");
    } finally {
      setInitiatingOffboarding(false);
    }
  };

  return (
    <div className="emp-page">
      {employee.employment_status === "Inactive" && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 13, color: "#92400e", fontWeight: 500 }}>
              This employee is currently <strong>Inactive (Relieved)</strong>. Direct reactivation is blocked. To restore active status, initiate a rejoin onboarding.
            </span>
          </div>
          {canEdit && (
            <Button
              variant="primary"
              size="sm"
              icon={<FiUserPlus size={14} />}
              onClick={() => {
                setRejoinDate(new Date().toISOString().slice(0, 10));
                setRejoinOpen(true);
              }}
              id="rejoin-company-banner-btn"
            >
              Rejoin company
            </Button>
          )}
        </div>
      )}

      {canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 12 }}>
          {employee.employment_status === "Active" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                icon={<FiUserMinus size={15} />}
                onClick={() => {
                  setResignationDate(new Date().toISOString().slice(0, 10));
                  setLastWorkingDay("");
                  setExitReason("");
                  setOffboardingOpen(true);
                }}
                id="initiate-offboarding-detail-btn"
              >
                Initiate Offboarding
              </Button>
              <button
                type="button"
                className="emp-btn-secondary"
                onClick={handleToggleStatus}
                disabled={statusLoading}
                id="toggle-status-btn"
                aria-label="Mark Inactive"
              >
                {statusLoading ? "Updating..." : <><FiXCircle size={15} /> Mark Inactive</>}
              </button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={<FiUserPlus size={15} />}
              onClick={() => {
                setRejoinDate(new Date().toISOString().slice(0, 10));
                setRejoinOpen(true);
              }}
              id="rejoin-company-btn"
            >
              Rejoin company
            </Button>
          )}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="asset-nav-tabs" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`asset-nav-tab ${activeTab === "details" ? "active" : ""}`}
          onClick={() => setActiveTab("details")}
        >
          <FiInfo size={16} /> Overview Details
        </button>
        <button
          type="button"
          className={`asset-nav-tab ${activeTab === "documents" ? "active" : ""}`}
          onClick={() => setActiveTab("documents")}
        >
          <FiFileText size={16} /> Documents
        </button>
        <button
          type="button"
          className={`asset-nav-tab ${activeTab === "assets" ? "active" : ""}`}
          onClick={() => setActiveTab("assets")}
        >
          <FiBox size={16} /> Assigned Assets
        </button>
        <button
          type="button"
          className={`asset-nav-tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
          id="lifecycle-history-tab-btn"
        >
          <FiClock size={16} /> Lifecycle History
        </button>
      </div>

      {activeTab === "details" && (
        <EmployeeDetailsCard
          employee={employee}
          canEdit={true}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          onBack={() => navigate("/employee")}
        />
      )}

      {activeTab === "documents" && (
        <div style={{ marginTop: 8 }}>
          <DocumentManager employeeId={employee._id || employee.id} canManage={canEdit} />
        </div>
      )}

      {activeTab === "assets" && (
        <div style={{ marginTop: 8 }}>
          <EmployeeAssetsTab employeeId={employee._id || employee.id} />
        </div>
      )}

      {activeTab === "history" && (
        <div style={{ marginTop: 8, background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                Employment Lifecycle History
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
                Chronological timeline of all onboarding cycles, offboarding exits, and rejoin milestones.
              </p>
            </div>
            {canEdit && employee.employment_status === "Inactive" && (
              <Button
                variant="primary"
                size="sm"
                icon={<FiUserPlus size={14} />}
                onClick={() => {
                  setRejoinDate(new Date().toISOString().slice(0, 10));
                  setRejoinOpen(true);
                }}
              >
                Rejoin company
              </Button>
            )}
          </div>

          {historyLoading ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#64748b" }}>
              <span className="emp-spinner" /> Loading lifecycle timeline...
            </div>
          ) : historyData.timeline.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: "#64748b" }}>
              <FiClock size={36} style={{ color: "#94a3b8", marginBottom: 8 }} />
              <p style={{ margin: 0, fontWeight: 500 }}>No lifecycle events recorded yet.</p>
            </div>
          ) : (
            <div style={{ position: "relative", paddingLeft: 24, borderLeft: "2px solid #e2e8f0", marginLeft: 12 }}>
              {historyData.timeline.map((event, idx) => {
                const isOnboarding = event.type === "ONBOARDING";
                const isCompleted = event.status === "Completed";
                return (
                  <div
                    key={event._id || idx}
                    style={{
                      position: "relative",
                      marginBottom: idx === historyData.timeline.length - 1 ? 0 : 24,
                    }}
                  >
                    {/* Timeline Node Dot */}
                    <div
                      style={{
                        position: "absolute",
                        left: -33,
                        top: 2,
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: isOnboarding ? "#2563eb" : "#d97706",
                        border: "3px solid #ffffff",
                        boxShadow: "0 0 0 2px #cbd5e1",
                      }}
                    />

                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        padding: "16px 20px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                background: isOnboarding ? "#eff6ff" : "#fffbeb",
                                color: isOnboarding ? "#1d4ed8" : "#b45309",
                                border: `1px solid ${isOnboarding ? "#bfdbfe" : "#fde68a"}`,
                              }}
                            >
                              {isOnboarding ? "Onboarding / Rejoin" : "Offboarding Exit"}
                            </span>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                background: isCompleted ? "#ecfdf5" : "#f1f5f9",
                                color: isCompleted ? "#047857" : "#475569",
                              }}
                            >
                              {event.status}
                            </span>
                          </div>

                          <h4 style={{ margin: "8px 0 4px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>
                            {isOnboarding ? "Employee Onboarding Workflow" : "Employee Offboarding & Clearance"}
                          </h4>
                          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                            {isOnboarding ? (
                              <>Started: <strong>{new Date(event.date).toLocaleDateString()}</strong> • Tasks: {event.tasksDone} / {event.tasksTotal} completed</>
                            ) : (
                              <>Exit / Last Day: <strong>{new Date(event.date).toLocaleDateString()}</strong> {event.exit_reason ? `• Reason: "${event.exit_reason}"` : ""}</>
                            )}
                          </p>
                          {event.completed_at && (
                            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#10b981" }}>
                              ✓ Completed on {new Date(event.completed_at).toLocaleString()}
                            </p>
                          )}
                          {!isOnboarding && event.experience_letter_generated_at && (
                            <span
                              style={{
                                display: "inline-block",
                                marginTop: 6,
                                padding: "2px 6px",
                                background: "#f0fdf4",
                                color: "#15803d",
                                border: "1px solid #bbf7d0",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            >
                              📄 Experience Letter Issued ({new Date(event.experience_letter_generated_at).toLocaleDateString()})
                            </span>
                          )}
                        </div>

                        <div>
                          {isOnboarding ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/onboarding/${event._id}`)}
                            >
                              View Checklist
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/offboarding/${event._id}`)}
                            >
                              View Clearance
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDeleteConfirm}
        title="Deactivate Employee?"
        message={`Are you sure you want to deactivate ${name} (${employee.employee_code || "EMP"})? Historical records across payroll, leave, and attendance will be preserved.`}
        confirmText="Deactivate"
        variant="danger"
        loading={deleting}
      />

      {/* Initiate Offboarding Modal */}
      <Modal
        isOpen={offboardingOpen}
        onClose={() => !initiatingOffboarding && setOffboardingOpen(false)}
        title={`Initiate Offboarding: ${name}`}
        size="md"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={initiatingOffboarding}
              onClick={() => setOffboardingOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={initiatingOffboarding}
              onClick={handleOffboardingSubmit}
            >
              Start Exit Process
            </Button>
          </div>
        }
      >
        <form onSubmit={handleOffboardingSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Resignation Date <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="date"
                className="doc-filter-select"
                style={{ width: "100%", padding: "8px 12px" }}
                value={resignationDate}
                onChange={(e) => setResignationDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Last Working Day <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="date"
                className="doc-filter-select"
                style={{ width: "100%", padding: "8px 12px" }}
                value={lastWorkingDay}
                onChange={(e) => setLastWorkingDay(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Exit Reason / Handover Notes
              </label>
              <textarea
                className="doc-filter-select"
                style={{ width: "100%", padding: "8px 12px", minHeight: 60 }}
                placeholder="Reason for departure..."
                value={exitReason}
                onChange={(e) => setExitReason(e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Rejoin Company Modal */}
      <Modal
        isOpen={rejoinOpen}
        onClose={() => !initiatingRejoin && setRejoinOpen(false)}
        title={`Rejoin Company: ${name}`}
        size="md"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={initiatingRejoin}
              onClick={() => setRejoinOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={initiatingRejoin}
              onClick={handleRejoinSubmit}
              id="confirm-rejoin-btn"
            >
              Start Rejoin Onboarding
            </Button>
          </div>
        }
      >
        <form onSubmit={handleRejoinSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                padding: "12px 14px",
                fontSize: 13,
                color: "#166534",
                lineHeight: 1.5,
              }}
            >
              <strong>Rejoining Policy:</strong> Initiating this process creates a new Onboarding workflow for <strong>{name}</strong> while preserving all historical records. The employee remains <em>Inactive</em> with login/access disabled until the onboarding checklist is marked <strong>Completed</strong>.
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Rejoin Start Date <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="date"
                className="doc-filter-select"
                style={{ width: "100%", padding: "8px 12px" }}
                value={rejoinDate}
                onChange={(e) => setRejoinDate(e.target.value)}
                required
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
