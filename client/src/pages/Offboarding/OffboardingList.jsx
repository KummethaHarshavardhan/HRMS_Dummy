import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus,
  FiClock,
  FiCheckCircle,
  FiArrowRight,
} from "react-icons/fi";
import { getAllOffboarding, createOffboarding } from "../../services/offboardingService";
import { getAllEmployees } from "../../services/employeeService";
import Table from "../../components/Table/Table";
import Button from "../../components/Button/Button";
import Modal from "../../components/Modal/Modal";
import Loader from "../../components/Loader/Loader";
import "../Onboarding/Onboarding.css";

export default function OffboardingList() {
  const navigate = useNavigate();
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // New Offboarding Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [resignationDate, setResignationDate] = useState("");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [exitReason, setExitReason] = useState("");
  const [loadingEmps, setLoadingEmps] = useState(false);

  const fetchOffboarding = () => {
    getAllOffboarding({
      status: statusFilter,
      search,
    })
      .then((data) => {
        setProcesses(data?.offboardingProcesses || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load offboarding processes");
        setLoading(false);
      });
  };

  useEffect(() => {
    let ignore = false;
    getAllOffboarding({
      status: statusFilter,
      search,
    })
      .then((data) => {
        if (!ignore) {
          setProcesses(data?.offboardingProcesses || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "Failed to load offboarding processes");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [statusFilter, search]);

  const openCreateModal = async () => {
    setCreateOpen(true);
    setLoadingEmps(true);
    try {
      const data = await getAllEmployees({ page: 1, limit: 100, status: "Active" });
      const empList = data?.employees || data?.data || [];
      setEmployees(empList);
      if (empList.length > 0) {
        setSelectedEmpId(empList[0]._id || empList[0].id);
      }
    } catch {
      setError("Failed to load employees for offboarding");
    } finally {
      setLoadingEmps(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmpId || !resignationDate || !lastWorkingDay) {
      setError("Please fill in all required fields.");
      return;
    }
    try {
      setCreating(true);
      setError("");
      await createOffboarding({
        employee_id: selectedEmpId,
        resignation_date: resignationDate,
        last_working_day: lastWorkingDay,
        exit_reason: exitReason,
      });
      setCreateOpen(false);
      setResignationDate("");
      setLastWorkingDay("");
      setExitReason("");
      fetchOffboarding();
    } catch (err) {
      setError(err.message || "Failed to initiate offboarding");
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    {
      header: "Employee",
      key: "employee",
      render: (row) => {
        const emp = row.employee_id;
        const name = emp?.user_id?.name || "Unknown";
        const email = emp?.user_id?.email || "";
        const code = emp?.employee_code || "EMP";
        return (
          <div>
            <div style={{ fontWeight: 600, color: "#1e293b" }}>{name}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {code} &bull; {email}
            </div>
          </div>
        );
      },
    },
    {
      header: "Timeline",
      key: "timeline",
      render: (row) => {
        const resign = row.resignation_date
          ? new Date(row.resignation_date).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
            })
          : "—";
        const lastDay = row.last_working_day
          ? new Date(row.last_working_day).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "—";
        return (
          <div>
            <div style={{ fontSize: 13, color: "#334155" }}>
              <strong>LWD:</strong> {lastDay}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Resigned: {resign}</div>
          </div>
        );
      },
    },
    {
      header: "Clearances",
      key: "clearance",
      render: (row) => {
        const c = row.clearance_status || {};
        const signedCount = [c.hr?.signed, c.it?.signed, c.finance?.signed, c.manager?.signed].filter(
          Boolean
        ).length;
        const isComplete = signedCount === 4;

        return (
          <span
            className={`doc-badge ${
              isComplete ? "doc-badge-active" : "doc-badge-expiring"
            }`}
          >
            {signedCount}/4 Signed
          </span>
        );
      },
    },
    {
      header: "Task Progress",
      key: "progress",
      render: (row) => {
        const total = row.checklist?.length || 0;
        const done = row.checklist?.filter((t) => t.status === "Done").length || 0;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <div style={{ width: 130 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
                marginBottom: 4,
              }}
            >
              <span>{pct}%</span>
              <span>{done}/{total} Done</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      header: "Status",
      key: "status",
      render: (row) => {
        const isDone = row.status === "Completed";
        return (
          <span
            className={`doc-badge ${
              isDone ? "doc-badge-active" : "doc-badge-expiring"
            }`}
          >
            {isDone ? <FiCheckCircle size={12} /> : <FiClock size={12} />}
            {row.status}
          </span>
        );
      },
    },
    {
      header: "Action",
      key: "action",
      align: "right",
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          icon={<FiArrowRight size={14} />}
          onClick={() => navigate(`/offboarding/${row._id}`)}
        >
          Manage Clearance
        </Button>
      ),
    },
  ];

  return (
    <div className="onboarding-page">
      <div className="onboarding-header">
        <div className="onboarding-header-text">
          <h1>Employee Offboarding & Clearance</h1>
          <p>
            Oversee employee exits, department clearance sign-offs, asset recovery, and relieving letters.
          </p>
        </div>
        <Button
          variant="danger"
          icon={<FiPlus size={16} />}
          onClick={openCreateModal}
          id="initiate-offboarding-btn"
        >
          Initiate Offboarding
        </Button>
      </div>

      {error && <div className="emp-alert error">{error}</div>}

      {/* Filter / Search Bar */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <input
            type="search"
            className="doc-filter-select"
            style={{ width: "100%", padding: "9px 14px" }}
            placeholder="Search by employee name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="doc-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {/* Process Table */}
      <Table
        columns={columns}
        data={processes}
        loading={loading}
        emptyText="No offboarding processes found."
      />

      {/* Initiate Offboarding Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title="Initiate Employee Offboarding"
        size="md"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={creating}
              onClick={handleCreateSubmit}
            >
              Initiate Process
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {loadingEmps ? (
              <Loader text="Loading employees..." />
            ) : (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Select Employee <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  className="doc-filter-select"
                  style={{ width: "100%", padding: "10px 14px", fontSize: 14 }}
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  required
                >
                  {employees.map((emp) => {
                    const name = emp.user_id?.name || emp.name || "Employee";
                    const code = emp.employee_code || "EMP";
                    return (
                      <option key={emp._id || emp.id} value={emp._id || emp.id}>
                        {name} ({code})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Resignation Date <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="date"
                className="doc-filter-select"
                style={{ width: "100%", padding: "10px 14px", fontSize: 14 }}
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
                style={{ width: "100%", padding: "10px 14px", fontSize: 14 }}
                value={lastWorkingDay}
                onChange={(e) => setLastWorkingDay(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Exit Reason / Notes
              </label>
              <textarea
                className="doc-filter-select"
                style={{ width: "100%", padding: "10px 14px", fontSize: 14, minHeight: 70 }}
                placeholder="Reason for resignation or departure..."
                value={exitReason}
                onChange={(e) => setExitReason(e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
