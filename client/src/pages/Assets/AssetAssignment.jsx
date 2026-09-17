import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiUserCheck,
  FiCornerDownLeft,
  FiBox,
  FiCheckCircle,
  FiClock,
  FiPlus,
} from "react-icons/fi";
import {
  getAllAssignments,
  getAllAssets,
  assignAsset,
  returnAsset,
} from "../../services/assetService";
import { getAllEmployees } from "../../services/employeeService";
import Table from "../../components/Table/Table";
import Button from "../../components/Button/Button";
import Modal from "../../components/Modal/Modal";
import Loader from "../../components/Loader/Loader";
import "./Assets.css";

const ASSET_CONDITIONS = ["New", "Good", "Fair", "Damaged"];

export default function AssetAssignment() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");

  // Assign Modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [availableAssets, setAvailableAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Return Modal
  const [returnItem, setReturnItem] = useState(null);
  const [returnCondition, setReturnCondition] = useState("Good");
  const [returnNotes, setReturnNotes] = useState("");
  const [returning, setReturning] = useState(false);

  const fetchAssignments = () => {
    getAllAssignments({ status: statusFilter })
      .then((data) => {
        setAssignments(data?.assignments || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load assignments");
        setLoading(false);
      });
  };

  useEffect(() => {
    let ignore = false;
    getAllAssignments({ status: statusFilter })
      .then((data) => {
        if (!ignore) {
          setAssignments(data?.assignments || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "Failed to load assignments");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [statusFilter]);

  const openAssignModal = async () => {
    setAssignOpen(true);
    setLoadingOptions(true);
    setError("");
    try {
      const [assetsData, empData] = await Promise.all([
        getAllAssets({ status: "Available" }),
        getAllEmployees({ page: 1, limit: 200, status: "Active" }),
      ]);

      const avail = assetsData?.assets || [];
      const emps = (empData?.employees || empData?.data || []).filter(
        (emp) => (emp.employment_status || emp.status) !== "Inactive"
      );
      setAvailableAssets(avail);
      setEmployees(emps);

      if (avail.length > 0) setSelectedAssetId(avail[0]._id);
      if (emps.length > 0) setSelectedEmpId(emps[0]._id || emps[0].id);
    } catch {
      setError("Failed to load available assets or employees");
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAssetId || !selectedEmpId) {
      setError("Please select both an asset and an employee.");
      return;
    }

    try {
      setAssigning(true);
      setError("");
      await assignAsset({
        asset_id: selectedAssetId,
        employee_id: selectedEmpId,
        notes: assignNotes,
      });
      setSuccess("Asset assigned successfully!");
      setAssignOpen(false);
      setAssignNotes("");
      fetchAssignments();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to assign asset");
    } finally {
      setAssigning(false);
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returnItem) return;

    try {
      setReturning(true);
      setError("");
      await returnAsset({
        assignment_id: returnItem._id,
        return_condition: returnCondition,
        notes: returnNotes,
      });
      setSuccess("Asset returned successfully and marked Available!");
      setReturnItem(null);
      setReturnNotes("");
      fetchAssignments();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to return asset");
    } finally {
      setReturning(false);
    }
  };

  const columns = [
    {
      header: "Asset Tag & Device",
      key: "asset",
      render: (row) => {
        const a = row.asset_id;
        if (!a) return <span style={{ color: "#94a3b8" }}>Unknown</span>;
        return (
          <div>
            <div style={{ fontWeight: 700, color: "#1e293b" }}>{a.asset_tag}</div>
            <div style={{ fontSize: 13, color: "#475569" }}>
              {a.brand} {a.model} ({a.type})
            </div>
            {a.serial_number && (
              <div style={{ fontSize: 11, color: "#94a3b8" }}>S/N: {a.serial_number}</div>
            )}
          </div>
        );
      },
    },
    {
      header: "Assigned Employee",
      key: "employee",
      render: (row) => {
        const emp = row.employee_id;
        if (!emp) return <span style={{ color: "#94a3b8" }}>—</span>;
        const name = emp.user_id?.name || "Employee";
        const email = emp.user_id?.email || "";
        const code = emp.employee_code || "EMP";
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
      header: "Dates",
      key: "dates",
      render: (row) => (
        <div>
          <div style={{ fontSize: 12, color: "#334155" }}>
            <strong>Assigned:</strong>{" "}
            {new Date(row.assigned_date).toLocaleDateString("en-IN")}
          </div>
          {row.returned_date && (
            <div style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>
              <strong>Returned:</strong>{" "}
              {new Date(row.returned_date).toLocaleDateString("en-IN")}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Status",
      key: "status",
      render: (row) => (
        <span
          className={`asset-status-pill ${
            row.status === "Active" ? "asset-status-assigned" : "asset-status-available"
          }`}
        >
          {row.status === "Active" ? <FiCheckCircle size={12} /> : <FiClock size={12} />}
          {row.status}
        </span>
      ),
    },
    {
      header: "Notes / Condition",
      key: "notes",
      render: (row) => (
        <div style={{ fontSize: 12, color: "#64748b", maxWidth: 200 }}>
          {row.return_condition && (
            <div>
              <strong>Condition:</strong> {row.return_condition}
            </div>
          )}
          {row.notes && <div>{row.notes}</div>}
        </div>
      ),
    },
    {
      header: "Action",
      key: "action",
      align: "right",
      render: (row) => {
        if (row.status !== "Active") {
          return <span style={{ color: "#94a3b8", fontSize: 12 }}>Completed</span>;
        }
        return (
          <Button
            variant="warning"
            size="sm"
            icon={<FiCornerDownLeft size={13} />}
            onClick={() => {
              setReturnItem(row);
              setReturnCondition("Good");
              setReturnNotes("");
            }}
          >
            Process Return
          </Button>
        );
      },
    },
  ];

  return (
    <div className="assets-page">
      <div className="assets-header">
        <div className="assets-header-text">
          <h1>Asset Assignment Desk</h1>
          <p>Allocate available equipment to staff and log asset returns with condition checks.</p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Button
            variant="primary"
            size="sm"
            icon={<FiPlus size={15} />}
            onClick={openAssignModal}
            id="assign-asset-btn"
          >
            Assign Asset to Staff
          </Button>
        </div>
      </div>

      {error && <div className="emp-alert error">{error}</div>}
      {success && <div className="emp-alert success">{success}</div>}

      {/* Tabs */}
      <div className="asset-nav-tabs">
        <button
          className="asset-nav-tab"
          onClick={() => navigate("/assets")}
        >
          <FiBox size={16} /> Asset Inventory
        </button>
        <button className="asset-nav-tab active">
          <FiUserCheck size={16} /> Assignment & Return Desk
        </button>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>Filter:</span>
        <select
          className="doc-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="Active">Active Held Assets</option>
          <option value="Returned">Returned History</option>
          <option value="ALL">All Assignments</option>
        </select>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={assignments}
        loading={loading}
        emptyText="No assignments found for this filter."
      />

      {/* Assign Asset Modal */}
      <Modal
        isOpen={assignOpen}
        onClose={() => !assigning && setAssignOpen(false)}
        title="Assign Asset to Employee"
        size="md"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={assigning}
              onClick={() => setAssignOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={assigning}
              disabled={availableAssets.length === 0}
              onClick={handleAssignSubmit}
            >
              Confirm Assignment
            </Button>
          </div>
        }
      >
        <form onSubmit={handleAssignSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {loadingOptions ? (
              <Loader text="Loading assets and employees..." />
            ) : availableAssets.length === 0 ? (
              <div style={{ background: "#fef3c7", padding: "14px 18px", borderRadius: 8, color: "#92400e" }}>
                <strong>No Available Assets:</strong> All devices are currently assigned or under repair.
                Please add new assets or return an existing asset first.
              </div>
            ) : (
              <>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                    Select Available Asset <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    className="doc-filter-select"
                    style={{ width: "100%", padding: "10px 14px", fontSize: 14 }}
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                    required
                  >
                    {availableAssets.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.asset_tag} — {a.brand} {a.model} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                    Assign To Employee <span style={{ color: "#ef4444" }}>*</span>
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

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                    Assignment Notes
                  </label>
                  <textarea
                    className="doc-filter-select"
                    style={{ width: "100%", padding: "8px 12px", minHeight: 60, fontSize: 13 }}
                    placeholder="e.g. Issued with laptop charger and wireless mouse"
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </form>
      </Modal>

      {/* Return Asset Modal */}
      <Modal
        isOpen={!!returnItem}
        onClose={() => !returning && setReturnItem(null)}
        title="Process Asset Return"
        size="md"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={returning}
              onClick={() => setReturnItem(null)}
            >
              Cancel
            </Button>
            <Button
              variant="warning"
              size="sm"
              loading={returning}
              onClick={handleReturnSubmit}
            >
              Confirm Return & Mark Available
            </Button>
          </div>
        }
      >
        <form onSubmit={handleReturnSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                {returnItem?.asset_id?.asset_tag} — {returnItem?.asset_id?.brand} {returnItem?.asset_id?.model}
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                Returning from: <strong>{returnItem?.employee_id?.user_id?.name || "Employee"}</strong>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Return Condition <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                className="doc-filter-select"
                style={{ width: "100%", padding: "10px 14px", fontSize: 14 }}
                value={returnCondition}
                onChange={(e) => setReturnCondition(e.target.value)}
              >
                {ASSET_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c} Condition
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Return Inspection Notes
              </label>
              <textarea
                className="doc-filter-select"
                style={{ width: "100%", padding: "8px 12px", minHeight: 60, fontSize: 13 }}
                placeholder="Inspected hardware condition, peripherals returned..."
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
