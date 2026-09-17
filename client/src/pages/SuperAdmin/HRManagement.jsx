import React, { useState, useEffect } from "react";
import { useToast } from "../../context/ToastContext.jsx";
import {
  getAllHR,
  createHR,
  updateHR,
  getOrganizations,
} from "../../services/superAdminService.js";
import Card from "../../components/Card/Card.jsx";
import Button from "../../components/Button/Button.jsx";
import Table from "../../components/Table/Table.jsx";
import Modal from "../../components/Modal/Modal.jsx";
import {
  FiPlus,
  FiSearch,
  FiEdit2,
  FiUserCheck,
  FiEye,
  FiEyeOff,
  FiBriefcase,
  FiPhone,
  FiMail,
} from "react-icons/fi";
import "./HRManagement.css";

export default function HRManagement() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [hrList, setHRList] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedOrgFilter, setSelectedOrgFilter] = useState("all");

  // Create HR Modal
  const [isCreateHRModalOpen, setIsCreateHRModalOpen] = useState(false);
  const [createHRForm, setCreateHRForm] = useState({
    organizationId: "",
    name: "",
    email: "",
    phone: "",
    department: "Human Resources",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submittingCreateHR, setSubmittingCreateHR] = useState(false);

  // Edit HR Modal
  const [isEditHRModalOpen, setIsEditHRModalOpen] = useState(false);
  const [editingHR, setEditingHR] = useState(null);
  const [editHRForm, setEditHRForm] = useState({
    name: "",
    phone: "",
    department: "",
    organizationId: "",
  });
  const [submittingEditHR, setSubmittingEditHR] = useState(false);

  const fetchHRAndOrgs = async () => {
    try {
      setLoading(true);
      const [hrRes, orgRes] = await Promise.all([
        getAllHR(),
        getOrganizations(),
      ]);

      if (hrRes?.success) {
        setHRList(hrRes.hrUsers || []);
      }
      if (orgRes?.success) {
        setOrganizations(orgRes.organizations || []);
      }
    } catch (err) {
      showToast("error", err.message || "Failed to load HR management data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHRAndOrgs();
  }, []);

  const openCreateHR = () => {
    const activeOrgs = organizations.filter((o) => o.status === "Active");
    setCreateHRForm({
      organizationId: activeOrgs.length > 0 ? activeOrgs[0]._id : "",
      name: "",
      email: "",
      phone: "",
      department: "Human Resources",
      password: "",
    });
    setShowPassword(false);
    setIsCreateHRModalOpen(true);
  };

  const handleCreateHRSubmit = async (e) => {
    e.preventDefault();
    if (!createHRForm.organizationId) {
      showToast("error", "Please select an organization");
      return;
    }
    if (
      !createHRForm.name.trim() ||
      !createHRForm.email.trim() ||
      !createHRForm.password
    ) {
      showToast("error", "Name, email, and password are required");
      return;
    }

    try {
      setSubmittingCreateHR(true);
      const res = await createHR(createHRForm);
      showToast(
        "success",
        res.message || "HR created and associated with organization successfully"
      );
      setIsCreateHRModalOpen(false);
      fetchHRAndOrgs();
    } catch (err) {
      showToast("error", err.message || "Failed to create HR account");
    } finally {
      setSubmittingCreateHR(false);
    }
  };

  const openEditHR = (hr) => {
    setEditingHR(hr);
    setEditHRForm({
      name: hr.name || "",
      phone: hr.phone || "",
      department: hr.department || "Human Resources",
      organizationId: hr.organizationId?._id || hr.organizationId || "",
    });
    setIsEditHRModalOpen(true);
  };

  const handleEditHRSubmit = async (e) => {
    e.preventDefault();
    if (!editingHR) return;
    try {
      setSubmittingEditHR(true);
      await updateHR(editingHR._id, editHRForm);
      showToast("success", "HR information updated successfully");
      setIsEditHRModalOpen(false);
      fetchHRAndOrgs();
    } catch (err) {
      showToast("error", err.message || "Failed to update HR account");
    } finally {
      setSubmittingEditHR(false);
    }
  };

  const filteredHRList = hrList.filter((hr) => {
    const matchesSearch =
      (hr.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (hr.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (hr.organizationId?.name || "").toLowerCase().includes(search.toLowerCase());

    const orgId = hr.organizationId?._id || hr.organizationId;
    const matchesOrg =
      selectedOrgFilter === "all" || String(orgId) === String(selectedOrgFilter);

    return matchesSearch && matchesOrg;
  });

  const columns = [
    {
      key: "name",
      header: "HR Manager",
      width: "28%",
      render: (row) => {
        const initials = (row.name || "HR").slice(0, 2).toUpperCase();
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="hr-avatar-initials">{initials}</div>
            <div>
              <strong style={{ display: "block", color: "#0f172a" }}>{row.name}</strong>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#64748b" }}>
                <FiMail size={12} /> {row.email}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: "organization",
      header: "Associated Organization",
      width: "25%",
      render: (row) => (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <FiBriefcase size={14} color="#4f46e5" />
            <strong style={{ color: "#1e293b", fontSize: "13px" }}>
              {row.organizationId?.name || "Unassigned"}
            </strong>
          </div>
          {row.organizationId?.orgCode && (
            <span style={{ fontSize: "11px", color: "#4f46e5", fontWeight: 700, marginLeft: "20px" }}>
              {row.organizationId.orgCode}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "contact",
      header: "Phone & Dept",
      width: "20%",
      render: (row) => (
        <div style={{ fontSize: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#334155" }}>
            <FiPhone size={12} /> {row.phone || "-"}
          </div>
          <span style={{ color: "#64748b", marginTop: "2px", display: "block" }}>
            {row.department || "Human Resources"}
          </span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      width: "12%",
      render: (row) => (
        <span className="sa-status-badge sa-status-role">
          {row.role || "HR"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Action",
      width: "15%",
      render: (row) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => openEditHR(row)}
          title="Edit HR Information"
          aria-label="Edit HR Information"
        >
          <FiEdit2 size={15} />
        </Button>
      ),
    },
  ];

  return (
    <div className="hr-page-container">
      {/* Page Header */}
      <div className="hr-page-header">
        <div>
          <h1>HR Management</h1>
          <p>Supervise provisioned HR Managers and their associated tenant Organizations.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreateHR}>
          <FiPlus style={{ marginRight: 6 }} /> Create HR
        </Button>
      </div>

      {/* Filter and Search */}
      <Card>
        <div className="hr-filter-bar">
          <div className="hr-search-box">
            <FiSearch className="hr-search-icon" size={16} />
            <input
              type="text"
              placeholder="Search HR by name, email, or organization..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="hr-filter-group">
            <label>Filter by Organization:</label>
            <select
              value={selectedOrgFilter}
              onChange={(e) => setSelectedOrgFilter(e.target.value)}
              className="hr-filter-select"
            >
              <option value="all">All Organizations</option>
              {organizations.map((org) => (
                <option key={org._id} value={org._id}>
                  {org.name} ({org.orgCode})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* HR Table */}
        <Table
          columns={columns}
          data={filteredHRList}
          loading={loading}
          emptyText="No HR Manager records found."
        />
      </Card>

      {/* =====================================================
          MODAL: Create HR (Strictly Preserving Existing HR Fields)
         ===================================================== */}
      <Modal
        isOpen={isCreateHRModalOpen}
        onClose={() => setIsCreateHRModalOpen(false)}
        title="Create HR Under Organization"
        size="md"
        footer={
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateHRModalOpen(false)}
              disabled={submittingCreateHR}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateHRSubmit}
              disabled={submittingCreateHR}
            >
              {submittingCreateHR ? "Saving HR..." : "Save HR Account"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateHRSubmit} className="sa-modal-form">
          <div className="sa-form-group">
            <label className="sa-form-label">
              Select Organization <span>*</span>
            </label>
            <select
              className="sa-form-select"
              value={createHRForm.organizationId}
              onChange={(e) =>
                setCreateHRForm({ ...createHRForm, organizationId: e.target.value })
              }
              required
            >
              <option value="">— Select Target Organization —</option>
              {organizations
                .filter((o) => o.status === "Active")
                .map((org) => (
                  <option key={org._id} value={org._id}>
                    {org.name} ({org.orgCode}) — Capacity: {org.currentMemberCount || 0}/{org.memberLimit}
                  </option>
                ))}
            </select>
          </div>

          <div className="sa-form-group">
            <label className="sa-form-label">
              Full Name <span>*</span>
            </label>
            <input
              type="text"
              className="sa-form-input"
              placeholder="e.g. Rachel Adams"
              value={createHRForm.name}
              onChange={(e) =>
                setCreateHRForm({ ...createHRForm, name: e.target.value })
              }
              required
            />
          </div>

          <div className="sa-form-group">
            <label className="sa-form-label">
              Email Address <span>*</span>
            </label>
            <input
              type="email"
              className="sa-form-input"
              placeholder="rachel@company.com"
              value={createHRForm.email}
              onChange={(e) =>
                setCreateHRForm({ ...createHRForm, email: e.target.value })
              }
              required
            />
          </div>

          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">Phone Number</label>
              <input
                type="text"
                maxLength={10}
                className="sa-form-input"
                placeholder="10-digit number"
                value={createHRForm.phone}
                onChange={(e) =>
                  setCreateHRForm({ ...createHRForm, phone: e.target.value })
                }
              />
            </div>

            <div className="sa-form-group">
              <label className="sa-form-label">Department</label>
              <input
                type="text"
                className="sa-form-input"
                placeholder="e.g. Human Resources"
                value={createHRForm.department}
                onChange={(e) =>
                  setCreateHRForm({ ...createHRForm, department: e.target.value })
                }
              />
            </div>
          </div>

          <div className="sa-form-group">
            <label className="sa-form-label">
              Password <span>*</span>
            </label>
            <div className="sa-password-box">
              <input
                type={showPassword ? "text" : "password"}
                className="sa-form-input"
                placeholder="At least 8 chars, 1 uppercase, 1 digit, 1 special char"
                value={createHRForm.password}
                onChange={(e) =>
                  setCreateHRForm({ ...createHRForm, password: e.target.value })
                }
                required
              />
              <button
                type="button"
                className="sa-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
            <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
              Requirement: Minimum 8 characters with at least 1 uppercase, 1 digit, and 1 special symbol.
            </span>
          </div>

          <div className="sa-form-group">
            <label className="sa-form-label">Assigned Role</label>
            <input
              type="text"
              className="sa-form-input"
              value="HR"
              disabled
              style={{ background: "#f8fafc", color: "#475569", cursor: "not-allowed", fontWeight: 600 }}
            />
          </div>
        </form>
      </Modal>

      {/* =====================================================
          MODAL: Edit HR Details
         ===================================================== */}
      <Modal
        isOpen={isEditHRModalOpen}
        onClose={() => setIsEditHRModalOpen(false)}
        title={`Edit HR Details: ${editingHR?.name || ""}`}
        size="md"
        footer={
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditHRModalOpen(false)}
              disabled={submittingEditHR}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleEditHRSubmit}
              disabled={submittingEditHR}
            >
              {submittingEditHR ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleEditHRSubmit} className="sa-modal-form">
          <div className="sa-form-group">
            <label className="sa-form-label">
              Full Name <span>*</span>
            </label>
            <input
              type="text"
              className="sa-form-input"
              value={editHRForm.name}
              onChange={(e) =>
                setEditHRForm({ ...editHRForm, name: e.target.value })
              }
              required
            />
          </div>

          <div className="sa-form-group">
            <label className="sa-form-label">Email Address (Read-only)</label>
            <input
              type="email"
              className="sa-form-input"
              value={editingHR?.email || ""}
              disabled
              style={{ background: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
            />
          </div>

          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">Phone Number</label>
              <input
                type="text"
                maxLength={10}
                className="sa-form-input"
                value={editHRForm.phone}
                onChange={(e) =>
                  setEditHRForm({ ...editHRForm, phone: e.target.value })
                }
              />
            </div>

            <div className="sa-form-group">
              <label className="sa-form-label">Department</label>
              <input
                type="text"
                className="sa-form-input"
                value={editHRForm.department}
                onChange={(e) =>
                  setEditHRForm({ ...editHRForm, department: e.target.value })
                }
              />
            </div>
          </div>

          <div className="sa-form-group">
            <label className="sa-form-label">Associated Organization</label>
            <select
              className="sa-form-select"
              value={editHRForm.organizationId}
              onChange={(e) =>
                setEditHRForm({ ...editHRForm, organizationId: e.target.value })
              }
            >
              <option value="">— Unassigned —</option>
              {organizations.map((org) => (
                <option key={org._id} value={org._id}>
                  {org.name} ({org.orgCode})
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}