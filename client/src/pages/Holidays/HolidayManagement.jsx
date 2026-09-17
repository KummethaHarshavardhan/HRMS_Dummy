import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FiPlus,
  FiUpload,
  FiEdit2,
  FiTrash2,
  FiCalendar,
  FiBriefcase,
} from "react-icons/fi";
import {
  getAllHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  bulkImportHolidays,
} from "../../services/holidayService";
import { getOrganizations } from "../../services/superAdminService";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/permission";
import Table from "../../components/Table/Table";
import Modal from "../../components/Modal/Modal";
import Button from "../../components/Button/Button";
import "./Holidays.css";

const HOLIDAY_TYPES = ["National", "Regional", "Optional", "Restricted"];

export default function HolidayManagement() {
  const { user } = useAuth();
  const userRole = normalizeRole(user?.role);
  const isSuperAdmin = userRole === "super_admin";

  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgFilter, setSelectedOrgFilter] = useState("all");

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    date: "",
    type: "National",
    description: "",
    organizationId: "",
  });
  const [saving, setSaving] = useState(false);

  // Bulk Import Modal
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkJson, setBulkJson] = useState("");
  const [bulkOrgId, setBulkOrgId] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  // Delete Confirm Modal
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Load organizations for super_admin
  useEffect(() => {
    if (isSuperAdmin) {
      getOrganizations()
        .then((res) => {
          if (res?.success) {
            setOrganizations(res.organizations || []);
          }
        })
        .catch((err) => console.error("Failed to load organizations:", err));
    }
  }, [isSuperAdmin]);

  const fetchHolidays = () => {
    const params = { year: yearFilter };
    if (isSuperAdmin && selectedOrgFilter !== "all") {
      params.organizationId = selectedOrgFilter;
    }
    getAllHolidays(params)
      .then((data) => {
        setHolidays(data?.holidays || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load holidays");
        setLoading(false);
      });
  };

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    const params = { year: yearFilter };
    if (isSuperAdmin && selectedOrgFilter !== "all") {
      params.organizationId = selectedOrgFilter;
    }
    getAllHolidays(params)
      .then((data) => {
        if (!ignore) {
          setHolidays(data?.holidays || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "Failed to load holidays");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [yearFilter, selectedOrgFilter, isSuperAdmin]);

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      name: "",
      date: new Date().toISOString().slice(0, 10),
      type: "National",
      description: "",
      organizationId: selectedOrgFilter !== "all" ? selectedOrgFilter : "",
    });
    setModalOpen(true);
  };

  const openEditModal = (h) => {
    setEditingId(h._id);
    setForm({
      name: h.name,
      date: h.date ? new Date(h.date).toISOString().slice(0, 10) : "",
      type: h.type || "National",
      description: h.description || "",
      organizationId: h.organizationId?._id || h.organizationId || "",
    });
    setModalOpen(true);
  };

  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      if (editingId) {
        await updateHoliday(editingId, form);
        setSuccess("Holiday updated successfully!");
      } else {
        await createHoliday(form);
        setSuccess("Holiday created successfully!");
      }
      setModalOpen(false);
      fetchHolidays();
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to save holiday");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;
    try {
      setDeleting(true);
      await deleteHoliday(deleteItem._id);
      setSuccess("Holiday deleted successfully");
      setDeleteItem(null);
      fetchHolidays();
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to delete holiday");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    try {
      setBulkLoading(true);
      setError("");
      let parsed;
      try {
        parsed = JSON.parse(bulkJson);
      } catch (err) {
        throw new Error("Invalid JSON format. Please check syntax.", { cause: err });
      }

      if (!Array.isArray(parsed)) {
        throw new Error("Expected an array of holiday objects.");
      }

      const res = await bulkImportHolidays(
        parsed,
        isSuperAdmin && bulkOrgId ? bulkOrgId : undefined
      );
      setSuccess(res.message || "Holidays imported successfully!");
      setBulkOpen(false);
      setBulkJson("");
      setBulkOrgId("");
      fetchHolidays();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message || "Bulk import failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const columns = [
    {
      header: "Holiday Name",
      key: "name",
      render: (row) => (
        <div>
          <strong style={{ color: "#1e293b", fontSize: 14 }}>{row.name}</strong>
          {row.description && (
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              {row.description}
            </div>
          )}
        </div>
      ),
    },
    ...(isSuperAdmin
      ? [
          {
            header: "Scope / Organization",
            key: "organization",
            render: (row) => (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: row.organizationId ? "#eef2ff" : "#ecfdf5",
                  color: row.organizationId ? "#4f46e5" : "#059669",
                  border: `1px solid ${row.organizationId ? "#c7d2fe" : "#a7f3d0"}`,
                  display: "inline-block",
                }}
              >
                {row.organizationId?.name
                  ? `${row.organizationId.name} (${row.organizationId.orgCode || "ORG"})`
                  : "Global (All Orgs)"}
              </span>
            ),
          },
        ]
      : []),
    {
      header: "Date",
      key: "date",
      render: (row) =>
        row.date
          ? new Date(row.date).toLocaleDateString("en-IN", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "—",
    },
    {
      header: "Type",
      key: "type",
      render: (row) => {
        const cls =
          row.type === "National"
            ? "badge-national"
            : row.type === "Regional"
            ? "badge-regional"
            : row.type === "Optional"
            ? "badge-optional"
            : "badge-restricted";
        return <span className={`holiday-cell-badge ${cls}`}>{row.type}</span>;
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
            icon={<FiEdit2 size={13} />}
            onClick={() => openEditModal(row)}
            title="Edit holiday"
          >
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<FiTrash2 size={13} />}
            onClick={() => setDeleteItem(row)}
            title="Delete holiday"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const sampleBulkJson = JSON.stringify(
    [
      { name: "New Year's Day", date: "2026-01-01", type: "National" },
      { name: "Republic Day", date: "2026-01-26", type: "National" },
      { name: "Maha Shivratri", date: "2026-02-17", type: "Regional" },
      { name: "Holi", date: "2026-03-04", type: "National" },
      { name: "Good Friday", date: "2026-04-03", type: "National" },
      { name: "Eid-ul-Fitr", date: "2026-03-21", type: "National" },
      { name: "Independence Day", date: "2026-08-15", type: "National" },
      { name: "Gandhi Jayanti", date: "2026-10-02", type: "National" },
      { name: "Diwali", date: "2026-11-08", type: "National" },
      { name: "Christmas Day", date: "2026-12-25", type: "National" }
    ],
    null,
    2
  );

  return (
    <div className="holiday-page">
      <div className="holiday-header">
        <div className="holiday-header-text">
          <h1>Holiday Management</h1>
          <p>Create, edit, and bulk-import official company and national holidays.</p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link to="/holidays" style={{ textDecoration: "none" }}>
            <Button variant="secondary" size="sm" icon={<FiCalendar size={15} />}>
              View Calendar
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            icon={<FiUpload size={15} />}
            onClick={() => {
              setBulkJson(sampleBulkJson);
              setBulkOpen(true);
            }}
          >
            Bulk Import
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<FiPlus size={15} />}
            onClick={openAddModal}
          >
            Add Holiday
          </Button>
        </div>
      </div>

      {error && <div className="emp-alert error">{error}</div>}
      {success && <div className="emp-alert success">{success}</div>}

      {/* Filter by Year & Organization */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>Year:</span>
          <select
            className="doc-filter-select"
            value={yearFilter}
            onChange={(e) => setYearFilter(parseInt(e.target.value, 10))}
          >
            {[yearFilter - 2, yearFilter - 1, yearFilter, yearFilter + 1, yearFilter + 2].map(
              (y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              )
            )}
          </select>
        </div>

        {isSuperAdmin && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <FiBriefcase size={14} color="#4f46e5" />
            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>Organization:</span>
            <select
              className="doc-filter-select"
              value={selectedOrgFilter}
              onChange={(e) => setSelectedOrgFilter(e.target.value)}
              style={{ minWidth: 200, fontWeight: 600 }}
            >
              <option value="all">All Organizations / Global</option>
              {organizations.map((org) => (
                <option key={org._id} value={org._id}>
                  {org.name} ({org.orgCode || "ORG"})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Holidays Table */}
      <Table
        columns={columns}
        data={holidays}
        loading={loading}
        emptyText="No holidays found for this year. Click 'Add Holiday' or 'Bulk Import'."
      />

      {/* Add / Edit Holiday Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingId ? "Edit Holiday" : "Add New Holiday"}
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
              {editingId ? "Save Changes" : "Create Holiday"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Holiday Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                className="doc-filter-select"
                style={{ width: "100%", padding: "9px 12px", fontSize: 14 }}
                placeholder="e.g. Independence Day"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Date <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="date"
                className="doc-filter-select"
                style={{ width: "100%", padding: "9px 12px", fontSize: 14 }}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Holiday Type <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                className="doc-filter-select"
                style={{ width: "100%", padding: "9px 12px", fontSize: 14 }}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {HOLIDAY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {isSuperAdmin && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Target Scope / Organization
                </label>
                <select
                  className="doc-filter-select"
                  style={{ width: "100%", padding: "9px 12px", fontSize: 14 }}
                  value={form.organizationId || ""}
                  onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
                >
                  <option value="">Global / All Organizations</option>
                  {organizations.map((org) => (
                    <option key={org._id} value={org._id}>
                      {org.name} ({org.orgCode || "ORG"})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: "#64748b", marginTop: 4, display: "block" }}>
                  Select an organization for tenant-specific holidays, or keep Global for all organizations.
                </span>
              </div>
            )}

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Description (Optional)
              </label>
              <textarea
                className="doc-filter-select"
                style={{ width: "100%", padding: "9px 12px", fontSize: 13, minHeight: 60 }}
                placeholder="Notes or celebration details..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        isOpen={bulkOpen}
        onClose={() => !bulkLoading && setBulkOpen(false)}
        title="Bulk Import Holidays (JSON)"
        size="lg"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={bulkLoading}
              onClick={() => setBulkOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={bulkLoading}
              onClick={handleBulkSubmit}
            >
              Import Holidays
            </Button>
          </div>
        }
      >
        <form onSubmit={handleBulkSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              Paste a JSON array of holiday objects containing <code>name</code>, <code>date</code> (YYYY-MM-DD), and <code>type</code>. Duplicates will be safely skipped.
            </p>

            {isSuperAdmin && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                  Target Scope / Organization
                </label>
                <select
                  className="doc-filter-select"
                  style={{ width: "100%", padding: "9px 12px", fontSize: 14 }}
                  value={bulkOrgId}
                  onChange={(e) => setBulkOrgId(e.target.value)}
                >
                  <option value="">Global / All Organizations</option>
                  {organizations.map((org) => (
                    <option key={org._id} value={org._id}>
                      {org.name} ({org.orgCode || "ORG"})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <textarea
              className="doc-filter-select"
              style={{
                width: "100%",
                height: 240,
                fontFamily: "monospace",
                fontSize: 12,
                padding: "10px 14px",
              }}
              value={bulkJson}
              onChange={(e) => setBulkJson(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteItem}
        onClose={() => !deleting && setDeleteItem(null)}
        title="Delete Holiday?"
        size="sm"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={deleting}
              onClick={() => setDeleteItem(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleting}
              onClick={handleDeleteConfirm}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: 14, color: "#475569", margin: 0 }}>
          Are you sure you want to delete <strong>{deleteItem?.name}</strong>?
        </p>
      </Modal>
    </div>
  );
}
