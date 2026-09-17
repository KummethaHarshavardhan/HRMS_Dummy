import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiClock,
  FiBox,
  FiUserCheck,
} from "react-icons/fi";
import {
  getAllAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssetHistory,
} from "../../services/assetService";
import Table from "../../components/Table/Table";
import Button from "../../components/Button/Button";
import Modal from "../../components/Modal/Modal";
import Loader from "../../components/Loader/Loader";
import "./Assets.css";

const ASSET_TYPES = [
  "Laptop",
  "Desktop",
  "Monitor",
  "ID Card",
  "Mobile",
  "SIM",
  "Access Card",
  "Other",
];

const ASSET_STATUSES = ["Available", "Assigned", "Under Repair", "Retired"];
const ASSET_CONDITIONS = ["New", "Good", "Fair", "Damaged"];

export default function AssetInventory() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    asset_tag: "",
    type: "Laptop",
    brand: "",
    model: "",
    serial_number: "",
    purchase_date: "",
    status: "Available",
    condition: "Good",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  // History Modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedAssetHistory, setSelectedAssetHistory] = useState([]);
  const [historyAssetTag, setHistoryAssetTag] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Delete Modal
  const [deleteAssetItem, setDeleteAssetItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAssets = () => {
    getAllAssets({
      type: typeFilter,
      status: statusFilter,
      search,
    })
      .then((data) => {
        setAssets(data?.assets || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load assets");
        setLoading(false);
      });
  };

  useEffect(() => {
    let ignore = false;
    getAllAssets({
      type: typeFilter,
      status: statusFilter,
      search,
    })
      .then((data) => {
        if (!ignore) {
          setAssets(data?.assets || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "Failed to load assets");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [typeFilter, statusFilter, search]);

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      asset_tag: `AST${Math.floor(1000 + Math.random() * 9000)}`,
      type: "Laptop",
      brand: "",
      model: "",
      serial_number: "",
      purchase_date: new Date().toISOString().slice(0, 10),
      status: "Available",
      condition: "Good",
      notes: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (asset) => {
    setEditingId(asset._id);
    setForm({
      asset_tag: asset.asset_tag,
      type: asset.type,
      brand: asset.brand,
      model: asset.model,
      serial_number: asset.serial_number || "",
      purchase_date: asset.purchase_date
        ? new Date(asset.purchase_date).toISOString().slice(0, 10)
        : "",
      status: asset.status,
      condition: asset.condition || "Good",
      notes: asset.notes || "",
    });
    setModalOpen(true);
  };

  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      if (editingId) {
        await updateAsset(editingId, form);
        setSuccess("Asset updated successfully!");
      } else {
        await createAsset(form);
        setSuccess("Asset created successfully!");
      }
      setModalOpen(false);
      fetchAssets();
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to save asset");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenHistory = async (asset) => {
    setHistoryAssetTag(asset.asset_tag);
    setHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const data = await getAssetHistory(asset._id);
      setSelectedAssetHistory(data?.history || []);
    } catch {
      setError("Failed to load asset history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteAssetItem) return;
    try {
      setDeleting(true);
      await deleteAsset(deleteAssetItem._id);
      setSuccess("Asset deleted successfully");
      setDeleteAssetItem(null);
      fetchAssets();
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to delete asset");
    } finally {
      setDeleting(false);
    }
  };

  const getStatusPill = (status) => {
    switch (status) {
      case "Available":
        return <span className="asset-status-pill asset-status-available">Available</span>;
      case "Assigned":
        return <span className="asset-status-pill asset-status-assigned">Assigned</span>;
      case "Under Repair":
        return <span className="asset-status-pill asset-status-repair">Under Repair</span>;
      case "Retired":
        return <span className="asset-status-pill asset-status-retired">Retired</span>;
      default:
        return <span className="asset-status-pill">{status}</span>;
    }
  };

  const getConditionPill = (cond) => {
    const cls =
      cond === "New"
        ? "condition-new"
        : cond === "Good"
        ? "condition-good"
        : cond === "Fair"
        ? "condition-fair"
        : "condition-damaged";
    return <span className={`condition-pill ${cls}`}>{cond}</span>;
  };

  const columns = [
    {
      header: "Asset Tag",
      key: "asset_tag",
      render: (row) => (
        <div>
          <strong style={{ color: "#1e293b" }}>{row.asset_tag}</strong>
          <div style={{ fontSize: 12, color: "#64748b" }}>{row.type}</div>
        </div>
      ),
    },
    {
      header: "Device / Model",
      key: "brand_model",
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: "#334155" }}>
            {row.brand} {row.model}
          </div>
          {row.serial_number && (
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              S/N: {row.serial_number}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Status",
      key: "status",
      render: (row) => getStatusPill(row.status),
    },
    {
      header: "Condition",
      key: "condition",
      render: (row) => getConditionPill(row.condition),
    },
    {
      header: "Current Custodian",
      key: "assigned_to",
      render: (row) => {
        const ca = row.current_assignment;
        if (!ca || row.status !== "Assigned") {
          return <span style={{ color: "#94a3b8", fontSize: 13 }}>—</span>;
        }
        const emp = ca.employee_id;
        const name = emp?.user_id?.name || "Employee";
        const code = emp?.employee_code || "EMP";
        return (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#4f46e5" }}>
              {name}
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{code}</div>
          </div>
        );
      },
    },
    {
      header: "Actions",
      key: "actions",
      align: "right",
      render: (row) => (
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <Button
            variant="outline"
            size="sm"
            icon={<FiClock size={13} />}
            onClick={() => handleOpenHistory(row)}
            title="View Assignment History"
          >
            History
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<FiEdit2 size={13} />}
            onClick={() => openEditModal(row)}
            title="Edit Asset"
          >
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<FiTrash2 size={13} />}
            disabled={row.status === "Assigned"}
            onClick={() => setDeleteAssetItem(row)}
            title={row.status === "Assigned" ? "Cannot delete assigned asset" : "Delete Asset"}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="assets-page">
      {/* Top Header */}
      <div className="assets-header">
        <div className="assets-header-text">
          <h1>Asset Management</h1>
          <p>Track hardware devices, IT equipment, assignments, and returns.</p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link to="/assets/assignments" style={{ textDecoration: "none" }}>
            <Button variant="secondary" size="sm" icon={<FiUserCheck size={15} />}>
              Assign / Return Flow
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            icon={<FiPlus size={15} />}
            onClick={openAddModal}
            id="add-asset-btn"
          >
            Add New Asset
          </Button>
        </div>
      </div>

      {error && <div className="emp-alert error">{error}</div>}
      {success && <div className="emp-alert success">{success}</div>}

      {/* Tabs */}
      <div className="asset-nav-tabs">
        <button className="asset-nav-tab active">
          <FiBox size={16} /> Asset Inventory ({assets.length})
        </button>
        <button
          className="asset-nav-tab"
          onClick={() => navigate("/assets/assignments")}
        >
          <FiUserCheck size={16} /> Assignment & Return Desk
        </button>
      </div>

      {/* Filters and Search */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <input
            type="search"
            className="doc-filter-select"
            style={{ width: "100%", padding: "9px 14px" }}
            placeholder="Search by tag, brand, model, serial number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="doc-filter-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ALL">All Types</option>
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          className="doc-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          {ASSET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={assets}
        loading={loading}
        emptyText="No assets found. Click 'Add New Asset' to populate your inventory."
      />

      {/* Add / Edit Asset Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingId ? "Edit Asset" : "Add New Asset"}
        size="md"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              onClick={handleSaveSubmit}
            >
              {editingId ? "Save Changes" : "Create Asset"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Asset Tag <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  className="doc-filter-select"
                  style={{ width: "100%", padding: "8px 12px", textTransform: "uppercase" }}
                  placeholder="AST0001"
                  value={form.asset_tag}
                  onChange={(e) => setForm({ ...form, asset_tag: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Asset Type <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  className="doc-filter-select"
                  style={{ width: "100%", padding: "8px 12px" }}
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Brand <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  className="doc-filter-select"
                  style={{ width: "100%", padding: "8px 12px" }}
                  placeholder="e.g. Apple, Dell, Lenovo"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Model <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  className="doc-filter-select"
                  style={{ width: "100%", padding: "8px 12px" }}
                  placeholder="e.g. MacBook Pro 16, XPS 15"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Serial Number
                </label>
                <input
                  type="text"
                  className="doc-filter-select"
                  style={{ width: "100%", padding: "8px 12px" }}
                  placeholder="Hardware serial number"
                  value={form.serial_number}
                  onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Purchase Date
                </label>
                <input
                  type="date"
                  className="doc-filter-select"
                  style={{ width: "100%", padding: "8px 12px" }}
                  value={form.purchase_date}
                  onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Status <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  className="doc-filter-select"
                  style={{ width: "100%", padding: "8px 12px" }}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  disabled={editingId && form.status === "Assigned"}
                >
                  {ASSET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Condition <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  className="doc-filter-select"
                  style={{ width: "100%", padding: "8px 12px" }}
                  value={form.condition}
                  onChange={(e) => setForm({ ...form, condition: e.target.value })}
                >
                  {ASSET_CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Notes / Specs
              </label>
              <textarea
                className="doc-filter-select"
                style={{ width: "100%", padding: "8px 12px", minHeight: 60 }}
                placeholder="Processor, RAM, accessories included..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Assignment History Modal */}
      <Modal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`Assignment History: ${historyAssetTag}`}
        size="lg"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setHistoryOpen(false)}>
            Close
          </Button>
        }
      >
        {loadingHistory ? (
          <Loader text="Loading assignment history..." />
        ) : selectedAssetHistory.length === 0 ? (
          <p style={{ color: "#64748b", margin: 20, textAlign: "center" }}>
            No past assignment records for this asset.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {selectedAssetHistory.map((item) => {
              const emp = item.employee_id;
              const name = emp?.user_id?.name || "Employee";
              const code = emp?.employee_code || "EMP";
              const isCurr = item.status === "Active";

              return (
                <div
                  key={item._id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: 12,
                    background: isCurr ? "#f0fdf4" : "#f8fafc",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>{name} ({code})</strong>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      Assigned: {new Date(item.assigned_date).toLocaleDateString("en-IN")}
                      {item.returned_date && (
                        <span> &bull; Returned: {new Date(item.returned_date).toLocaleDateString("en-IN")}</span>
                      )}
                    </div>
                    {item.notes && (
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        Note: {item.notes}
                      </div>
                    )}
                  </div>
                  <span
                    className={`asset-status-pill ${
                      isCurr ? "asset-status-assigned" : "asset-status-available"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteAssetItem}
        onClose={() => !deleting && setDeleteAssetItem(null)}
        title="Delete Asset?"
        size="sm"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={deleting}
              onClick={() => setDeleteAssetItem(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleting}
              onClick={handleDeleteConfirm}
            >
              Delete Asset
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: 14, color: "#475569", margin: 0 }}>
          Are you sure you want to delete asset{" "}
          <strong>{deleteAssetItem?.asset_tag}</strong> ({deleteAssetItem?.brand}{" "}
          {deleteAssetItem?.model})?
        </p>
      </Modal>
    </div>
  );
}
