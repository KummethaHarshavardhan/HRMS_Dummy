import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus,
  FiClock,
  FiCheckCircle,
  FiArrowRight,
} from "react-icons/fi";
import { getAllOnboarding, createOnboarding } from "../../services/onboardingService";
import { getAllEmployees } from "../../services/employeeService";
import Table from "../../components/Table/Table";
import Button from "../../components/Button/Button";
import Modal from "../../components/Modal/Modal";
import Loader from "../../components/Loader/Loader";
import "./Onboarding.css";

export default function OnboardingList() {
  const navigate = useNavigate();
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // New Onboarding Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [loadingEmps, setLoadingEmps] = useState(false);

  const fetchOnboarding = () => {
    getAllOnboarding({
      status: statusFilter,
      search,
    })
      .then((data) => {
        setProcesses(data?.onboardingProcesses || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load onboarding processes");
        setLoading(false);
      });
  };

  useEffect(() => {
    let ignore = false;
    getAllOnboarding({
      status: statusFilter,
      search,
    })
      .then((data) => {
        if (!ignore) {
          setProcesses(data?.onboardingProcesses || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "Failed to load onboarding processes");
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
      setError("Failed to load employees for onboarding");
    } finally {
      setLoadingEmps(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmpId) return;
    try {
      setCreating(true);
      setError("");
      await createOnboarding({ employee_id: selectedEmpId });
      setCreateOpen(false);
      fetchOnboarding();
    } catch (err) {
      setError(err.message || "Failed to start onboarding");
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
      header: "Department / Role",
      key: "department",
      render: (row) => {
        const dept = row.employee_id?.department_id?.departmentName || "—";
        const designation = row.employee_id?.designation || "—";
        return (
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>
              {designation}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{dept}</div>
          </div>
        );
      },
    },
    {
      header: "Checklist Progress",
      key: "progress",
      render: (row) => {
        const total = row.checklist?.length || 0;
        const done = row.checklist?.filter((t) => t.status === "Done").length || 0;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <div style={{ width: 140 }}>
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
              <span>
                {done}/{total} Done
              </span>
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
            className={`doc-badge ${isDone ? "doc-badge-active" : "doc-badge-expiring"}`}
          >
            {isDone ? <FiCheckCircle size={12} /> : <FiClock size={12} />}
            {row.status}
          </span>
        );
      },
    },
    {
      header: "Started Date",
      key: "start_date",
      render: (row) =>
        row.start_date
          ? new Date(row.start_date).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "—",
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
          onClick={() => navigate(`/onboarding/${row._id}`)}
        >
          View Checklist
        </Button>
      ),
    },
  ];

  return (
    <div className="onboarding-page">
      <div className="onboarding-header">
        <div className="onboarding-header-text">
          <h1>Employee Onboarding</h1>
          <p>
            Track new joiner provisioning, documentation, IT assets, and department checklists.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<FiPlus size={16} />}
          onClick={openCreateModal}
          id="initiate-onboarding-btn"
        >
          Start Onboarding
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
        emptyText="No onboarding processes found. Click 'Start Onboarding' to begin a workflow."
      />

      {/* Start Onboarding Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title="Start Employee Onboarding"
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
              variant="primary"
              size="sm"
              loading={creating}
              onClick={handleCreateSubmit}
            >
              Initialize Checklist
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              Select an employee to initiate their formal onboarding workflow with pre-configured
              checklists across HR, IT, Admin, and Finance.
            </p>

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
          </div>
        </form>
      </Modal>
    </div>
  );
}
