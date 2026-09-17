import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
} from "react-icons/fi";
import {
  getOnboardingById,
  getEmployeeOnboarding,
  updateOnboardingTask,
  updateOnboardingStatus,
} from "../../services/onboardingService";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/permission";
import Button from "../../components/Button/Button";
import Loader from "../../components/Loader/Loader";
import "./Onboarding.css";

export default function OnboardingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = normalizeRole(user?.role);
  const isStaff = userRole === "admin" || userRole === "super_admin" || userRole === "hr_manager";

  const [onboarding, setOnboarding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  useEffect(() => {
    let ignore = false;
    const promise = id ? getOnboardingById(id) : getEmployeeOnboarding("me");
    promise
      .then((data) => {
        if (!ignore) {
          setOnboarding(data?.onboarding || null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "Failed to load onboarding checklist");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [id]);

  const handleStatusChange = async (taskId, newStatus) => {
    if (!isStaff) return;
    try {
      setUpdatingTaskId(taskId);
      setError("");
      const res = await updateOnboardingTask(onboarding._id, taskId, {
        status: newStatus,
      });
      setOnboarding(res?.onboarding || onboarding);
      setSuccess("Task updated");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to update task");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleCompleteProcess = async () => {
    if (!isStaff) return;
    try {
      setLoading(true);
      setError("");
      const res = await updateOnboardingStatus(onboarding._id, "Completed");
      setOnboarding(res?.onboarding || onboarding);
      setSuccess("Onboarding marked as Completed!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !onboarding) {
    return (
      <div className="onboarding-page" style={{ textAlign: "center", padding: 60 }}>
        <Loader text="Loading onboarding details..." />
      </div>
    );
  }

  if (error && !onboarding) {
    return (
      <div className="onboarding-page">
        <div className="emp-alert error">{error}</div>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          <FiArrowLeft size={15} /> Go Back
        </Button>
      </div>
    );
  }

  if (!onboarding) {
    return (
      <div className="onboarding-page">
        <div className="emp-empty-state">
          <p>No active onboarding process found.</p>
        </div>
      </div>
    );
  }

  const emp = onboarding.employee_id;
  const name = emp?.user_id?.name || "Employee";
  const email = emp?.user_id?.email || "";
  const code = emp?.employee_code || "EMP";
  const dept = emp?.department_id?.departmentName || "—";
  const designation = emp?.designation || "—";

  const checklist = onboarding.checklist || [];
  const totalTasks = checklist.length;
  const doneTasks = checklist.filter((t) => t.status === "Done").length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const filteredTasks =
    activeCategory === "ALL"
      ? checklist
      : checklist.filter((t) => t.category === activeCategory);

  const categories = ["ALL", "HR", "IT", "Admin", "Finance"];

  const getTagClass = (cat) => {
    switch (cat) {
      case "HR":
        return "tag-hr";
      case "IT":
        return "tag-it";
      case "Admin":
        return "tag-admin";
      case "Finance":
        return "tag-finance";
      default:
        return "";
    }
  };

  return (
    <div className="onboarding-page">
      {/* Navigation Top */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Button
          variant="secondary"
          size="sm"
          icon={<FiArrowLeft size={15} />}
          onClick={() => (isStaff ? navigate("/onboarding") : navigate("/profile"))}
        >
          {isStaff ? "Back to Onboarding List" : "Back to Profile"}
        </Button>

        {isStaff && onboarding.status !== "Completed" && (
          <Button
            variant="success"
            size="sm"
            icon={<FiCheckCircle size={15} />}
            onClick={handleCompleteProcess}
          >
            Mark All Onboarding Complete
          </Button>
        )}
      </div>

      {error && <div className="emp-alert error">{error}</div>}
      {success && <div className="emp-alert success">{success}</div>}

      {/* Employee & Progress Hero Card */}
      <div className="emp-detail-hero" style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}>
        <div className="emp-detail-avatar" style={{ background: "#ffffff", color: "#4f46e5" }}>
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="emp-detail-hero-info">
          <h2 style={{ color: "#ffffff" }}>{name} — Onboarding</h2>
          <p style={{ color: "#e0e7ff" }}>
            {designation} &bull; {dept} &bull; {code}
          </p>
          <p style={{ color: "#c7d2fe", fontSize: 13, marginTop: 4 }}>
            {email} &bull; Started {new Date(onboarding.start_date).toLocaleDateString("en-IN")}
          </p>
        </div>
        <div className="emp-detail-hero-badge">
          <span
            className={`doc-badge ${
              onboarding.status === "Completed" ? "doc-badge-active" : "doc-badge-expiring"
            }`}
            style={{ fontSize: 13, padding: "6px 14px" }}
          >
            {onboarding.status === "Completed" ? <FiCheckCircle size={14} /> : <FiClock size={14} />}
            {onboarding.status}
          </span>
        </div>
      </div>

      {/* Progress Track Card */}
      <div
        style={{
          background: "#ffffff",
          padding: 20,
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
            Overall Completion Progress
          </span>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#4f46e5" }}>
            {progressPct}% ({doneTasks}/{totalTasks} Completed)
          </span>
        </div>
        <div className="progress-track" style={{ height: 12 }}>
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className="doc-filter-select"
            style={{
              fontWeight: 600,
              background: activeCategory === cat ? "#4f46e5" : "#ffffff",
              color: activeCategory === cat ? "#ffffff" : "#475569",
              borderColor: activeCategory === cat ? "#4f46e5" : "#cbd5e1",
            }}
            onClick={() => setActiveCategory(cat)}
          >
            {cat} Tasks (
            {cat === "ALL"
              ? checklist.length
              : checklist.filter((t) => t.category === cat).length}
            )
          </button>
        ))}
      </div>

      {/* Checklist Tasks List */}
      <div className="checklist-container">
        {filteredTasks.length === 0 ? (
          <div className="emp-empty-state">
            <p>No tasks in this category.</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isDone = task.status === "Done";
            const isInProgress = task.status === "In Progress";
            const isUpdating = updatingTaskId === task._id;

            return (
              <div
                key={task._id}
                className={`checklist-card ${isDone ? "done" : ""}`}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1 }}>
                  <div style={{ marginTop: 2 }}>
                    {isDone ? (
                      <FiCheckCircle size={22} style={{ color: "#15803d" }} />
                    ) : (
                      <FiClock size={22} style={{ color: "#f59e0b" }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className={`category-tag ${getTagClass(task.category)}`}>
                        {task.category}
                      </span>
                      <span className="task-title" style={{ fontSize: 15, fontWeight: 600, color: "#1e293b" }}>
                        {task.task_name}
                      </span>
                    </div>

                    {task.notes && (
                      <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#64748b" }}>
                        {task.notes}
                      </p>
                    )}

                    {task.completed_at && (
                      <div style={{ fontSize: 12, color: "#15803d", marginTop: 4 }}>
                        Completed on: {new Date(task.completed_at).toLocaleString("en-IN")}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Toggle buttons for HR/Admin */}
                {isStaff ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      type="button"
                      disabled={isUpdating}
                      className="doc-filter-select"
                      style={{
                        fontSize: 12,
                        padding: "6px 12px",
                        background: task.status === "Pending" ? "#f1f5f9" : "#ffffff",
                        borderColor: task.status === "Pending" ? "#64748b" : "#e2e8f0",
                        fontWeight: task.status === "Pending" ? 700 : 400,
                      }}
                      onClick={() => handleStatusChange(task._id, "Pending")}
                    >
                      Pending
                    </button>
                    <button
                      type="button"
                      disabled={isUpdating}
                      className="doc-filter-select"
                      style={{
                        fontSize: 12,
                        padding: "6px 12px",
                        background: isInProgress ? "#fef3c7" : "#ffffff",
                        borderColor: isInProgress ? "#f59e0b" : "#e2e8f0",
                        color: isInProgress ? "#b45309" : "#475569",
                        fontWeight: isInProgress ? 700 : 400,
                      }}
                      onClick={() => handleStatusChange(task._id, "In Progress")}
                    >
                      In Progress
                    </button>
                    <button
                      type="button"
                      disabled={isUpdating}
                      className="doc-filter-select"
                      style={{
                        fontSize: 12,
                        padding: "6px 12px",
                        background: isDone ? "#dcfce7" : "#ffffff",
                        borderColor: isDone ? "#22c55e" : "#e2e8f0",
                        color: isDone ? "#15803d" : "#475569",
                        fontWeight: isDone ? 700 : 400,
                      }}
                      onClick={() => handleStatusChange(task._id, "Done")}
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <span
                    className={`doc-badge ${
                      isDone
                        ? "doc-badge-active"
                        : isInProgress
                        ? "doc-badge-expiring"
                        : "doc-badge-expired"
                    }`}
                  >
                    {task.status}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
