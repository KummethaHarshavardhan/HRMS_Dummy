import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import {
  getSuperAdminDashboard,
  createOrganization,
  updateOrganization,
  getOrganizations,
  getOrganizationEmployees,
  toggleOrganizationStatus,
} from "../../services/superAdminService.js";
import Card from "../../components/Card/Card.jsx";
import Button from "../../components/Button/Button.jsx";
import Table from "../../components/Table/Table.jsx";
import Modal from "../../components/Modal/Modal.jsx";
import Loader from "../../components/Loader/Loader.jsx";
import {
  FiLayers,
  FiUsers,
  FiUserCheck,
  FiPieChart,
  FiPlus,
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiEdit2,
  FiBriefcase,
  FiMail,
  FiPhone,
} from "react-icons/fi";
import "./SuperAdminDashboard.css";
import "./Organizations.css";

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [organizations, setOrganizations] = useState([]);

  // =====================================================
  // 1. CREATE ORGANIZATION MODAL (Unified with HR)
  // =====================================================
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    orgCode: "",
    memberLimit: 50,
    status: "Active",
    address: "",
    hrName: "",
    hrEmail: "",
    hrPhone: "",
    hrPassword: "",
  });
  const [showCreateHRPassword, setShowCreateHRPassword] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // =====================================================
  // 2. VIEW EMPLOYEES MODAL
  // =====================================================
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewOrg, setViewOrg] = useState(null);
  const [viewEmployees, setViewEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // =====================================================
  // 3. EDIT ALL FIELDS MODAL
  // =====================================================
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    orgCode: "",
    memberLimit: 50,
    status: "Active",
    hrName: "",
    hrEmail: "",
    hrPhone: "",
    address: "",
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashRes, orgsRes] = await Promise.all([
        getSuperAdminDashboard(),
        getOrganizations(),
      ]);

      if (dashRes?.success) {
        setStats(dashRes.stats);
      }
      if (orgsRes?.success) {
        setOrganizations(orgsRes.organizations || []);
      }
    } catch (err) {
      showToast("error", err.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // =====================================================
  // HANDLER: Unified Create Organization & HR
  // =====================================================
  const openCreateModal = () => {
    setCreateForm({
      name: "",
      orgCode: "",
      memberLimit: 50,
      status: "Active",
      address: "",
      hrName: "",
      hrEmail: "",
      hrPhone: "",
      hrPassword: "",
    });
    setShowCreateHRPassword(false);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      showToast("error", "Organization name is required");
      return;
    }
    if (createForm.hrEmail && !createForm.hrName.trim()) {
      showToast("error", "Please provide HR Name along with HR Email");
      return;
    }

    try {
      setSubmittingCreate(true);
      const res = await createOrganization(createForm);
      showToast(
        "success",
        res.message || "Organization and HR saved successfully in database"
      );
      setIsCreateModalOpen(false);
      fetchDashboardData();
    } catch (err) {
      showToast("error", err.message || "Failed to create organization");
    } finally {
      setSubmittingCreate(false);
    }
  };

  // =====================================================
  // HANDLER: View All Employees in Organization
  // =====================================================
  const handleOpenView = async (org) => {
    setViewOrg(org);
    setIsViewModalOpen(true);
    setLoadingEmployees(true);
    try {
      const res = await getOrganizationEmployees(org._id);
      if (res?.success) {
        setViewEmployees(res.employees || []);
      }
    } catch (err) {
      showToast("error", err.message || "Failed to load employees for this organization");
    } finally {
      setLoadingEmployees(false);
    }
  };

  // =====================================================
  // HANDLER: Edit All Fields (Org + HR + Limit + Status)
  // =====================================================
  const handleOpenEdit = (org) => {
    setEditingOrg(org);
    setEditForm({
      name: org.name || "",
      orgCode: org.orgCode || "",
      memberLimit: org.memberLimit || 50,
      status: org.status || "Active",
      hrName: org.hrName && org.hrName !== "Unassigned HR" && org.hrName !== "Not Assigned" ? org.hrName : "",
      hrEmail: org.hrEmail && org.hrEmail !== "-" ? org.hrEmail : "",
      hrPhone: org.hrPhone && org.hrPhone !== "-" ? org.hrPhone : "",
      address: org.address || "",
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingOrg) return;
    if (!editForm.name.trim()) {
      showToast("error", "Organization name is required");
      return;
    }
    if (!editForm.orgCode.trim()) {
      showToast("error", "Organization ID is required");
      return;
    }

    try {
      setSubmittingEdit(true);
      const res = await updateOrganization(editingOrg._id, editForm);
      showToast(
        "success",
        res.message || "Organization and HR details updated successfully in database"
      );
      setIsEditModalOpen(false);
      fetchDashboardData();
    } catch (err) {
      showToast("error", err.message || "Failed to update organization");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // =====================================================
  // HANDLER: Toggle Active / Inactive Status
  // =====================================================
  const handleToggleStatus = async (org) => {
    const nextStatus = org.status === "Active" ? "Inactive" : "Active";
    try {
      const res = await toggleOrganizationStatus(org._id, nextStatus);
      showToast("success", res.message || `Status updated to ${nextStatus}`);
      fetchDashboardData();
    } catch (err) {
      showToast("error", err.message || "Failed to update status");
    }
  };

  // =====================================================
  // TABLE COLUMNS (EXACT USER REQUIREMENTS)
  // 1. Organization Name
  // 2. ID
  // 3. HR Name
  // 4. Total Employees with HR
  // 5. HR Contact
  // 6. Status (Active/Inactive)
  // 7. Actions (View, Edit, Toggle)
  // =====================================================
  const columns = [
    {
      key: "name",
      header: "Organization Name",
      width: "20%",
      render: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="org-icon-avatar">
            <FiBriefcase size={16} />
          </div>
          <div>
            <strong style={{ display: "block", color: "#0f172a", fontSize: "14px" }}>
              {row.name}
            </strong>
          </div>
        </div>
      ),
    },
    {
      key: "id",
      header: "ID",
      width: "10%",
      render: (row) => (
        <span className="org-code-badge">
          {row.orgCode}
        </span>
      ),
    },
    {
      key: "hrName",
      header: "HR Name",
      width: "16%",
      render: (row) => {
        const isAssigned = row.hrName && row.hrName !== "Unassigned HR" && row.hrName !== "Not Assigned" && row.hrName !== "-";
        return (
          <div>
            <strong style={{ color: isAssigned ? "#0f172a" : "#94a3b8", fontSize: "13px", display: "block" }}>
              {isAssigned ? row.hrName : "Not Assigned"}
            </strong>
            {isAssigned && (
              <span style={{ fontSize: "11px", color: "#4f46e5", fontWeight: 600 }}>
                HR Manager
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "totalEmployees",
      header: "Total Employees with HR",
      width: "18%",
      render: (row) => {
        const used = row.currentMemberCount || 0;
        const limit = row.memberLimit || 50;
        const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <span style={{ fontWeight: 700, color: "#1e293b" }}>
                {used} / {limit} Members
              </span>
              <span style={{ color: "#64748b", fontSize: "11px" }}>
                {row.remainingSlots} free
              </span>
            </div>
            <div className="capacity-bar-track">
              <div
                className={`capacity-bar-fill ${
                  pct >= 100 ? "fill-danger" : pct >= 80 ? "fill-warning" : "fill-normal"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "hrContact",
      header: "HR Contact",
      width: "16%",
      render: (row) => (
        <div style={{ fontSize: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#334155" }}>
            <FiMail size={12} color="#64748b" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "140px" }} title={row.hrEmail}>
              {row.hrEmail && row.hrEmail !== "-" ? row.hrEmail : "No email"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b", marginTop: "2px" }}>
            <FiPhone size={12} />
            <span>{row.hrPhone && row.hrPhone !== "-" ? row.hrPhone : "No phone"}</span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "10%",
      render: (row) => (
        <button
          type="button"
          onClick={() => handleToggleStatus(row)}
          className={`sa-status-toggle-btn ${
            row.status === "Active" ? "toggle-active" : "toggle-inactive"
          }`}
          title={`Click to set as ${row.status === "Active" ? "Inactive" : "Active"}`}
        >
          ● {row.status}
        </button>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: "16%",
      render: (row) => (
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenView(row)}
            title="View all employees under this organization"
            aria-label="View organization"
          >
            <FiEye size={15} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenEdit(row)}
            title="Edit all organization and HR details"
            aria-label="Edit organization"
          >
            <FiEdit2 size={15} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="sa-dashboard-container">
      {/* Header with ONLY "Create Organization" button */}
      <div className="sa-header">
        <div className="sa-header-intro">
          <h1>Super Admin Portal</h1>
          <p>Multi-Tenant Organization Management & System Administration</p>
        </div>
        <div className="sa-header-actions">
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            <FiPlus style={{ marginRight: 6 }} /> Create Organization
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="sa-stats-grid">
        <div className="sa-stat-card">
          <div className="sa-stat-icon-wrapper sa-icon-blue">
            <FiLayers size={24} />
          </div>
          <div className="sa-stat-details">
            <p>Total Organizations</p>
            {loading ? <Loader.Spinner size="sm" /> : <h2>{stats?.totalOrganizations ?? 0}</h2>}
            <span className="sa-trend-text">
              ✓ {stats?.activeOrganizations ?? 0} Active Units
            </span>
          </div>
        </div>

        <div className="sa-stat-card">
          <div className="sa-stat-icon-wrapper sa-icon-purple">
            <FiUserCheck size={24} />
          </div>
          <div className="sa-stat-details">
            <p>Total HR Managers</p>
            {loading ? <Loader.Spinner size="sm" /> : <h2>{stats?.totalHR ?? 0}</h2>}
            <span className="sa-trend-text">Associated across Organizations</span>
          </div>
        </div>

        <div className="sa-stat-card">
          <div className="sa-stat-icon-wrapper sa-icon-green">
            <FiUsers size={24} />
          </div>
          <div className="sa-stat-details">
            <p>Total Org Members</p>
            {loading ? <Loader.Spinner size="sm" /> : <h2>{stats?.totalMembers ?? 0}</h2>}
            <span className="sa-trend-text">HR + Employees enrolled</span>
          </div>
        </div>

        <div className="sa-stat-card">
          <div className="sa-stat-icon-wrapper sa-icon-amber">
            <FiPieChart size={24} />
          </div>
          <div className="sa-stat-details">
            <p>Overall Limit Usage</p>
            {loading ? (
              <Loader.Spinner size="sm" />
            ) : (
              <h2>{stats?.capacityUtilization ?? 0}%</h2>
            )}
            <span className="sa-trend-text">
              {stats?.totalMembers ?? 0} / {stats?.totalCapacity ?? 0} Total Slots
            </span>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="sa-nav-grid">
        <div className="sa-nav-card" onClick={() => navigate("/super-admin/organizations")}>
          <div className="sa-nav-card-body">
            <div className="sa-nav-icon">
              <FiLayers size={20} />
            </div>
            <div>
              <h3>Organizations Hub</h3>
              <p>Create, manage, and configure enterprise organizations & limits.</p>
            </div>
          </div>
          <FiArrowRight className="sa-nav-arrow" size={18} />
        </div>

        <div className="sa-nav-card" onClick={() => navigate("/super-admin/hr-management")}>
          <div className="sa-nav-card-body">
            <div className="sa-nav-icon">
              <FiUserCheck size={20} />
            </div>
            <div>
              <h3>HR Account Management</h3>
              <p>Supervise and inspect provisioned HR Managers across organizations.</p>
            </div>
          </div>
          <FiArrowRight className="sa-nav-arrow" size={18} />
        </div>

        <div className="sa-nav-card" onClick={() => navigate("/super-admin/usage-limits")}>
          <div className="sa-nav-card-body">
            <div className="sa-nav-icon">
              <FiPieChart size={20} />
            </div>
            <div>
              <h3>Member Usage & Limits</h3>
              <p>Monitor member limit quotas, slot remaining, and capacity alerts.</p>
            </div>
          </div>
          <FiArrowRight className="sa-nav-arrow" size={18} />
        </div>
      </div>

      {/* Main Organizations & Workforce Hub Table */}
      <Card
        title="Organizations & Workforce Hub"
        subtitle="Manage organizations, view enrolled employees, edit all fields, and toggle active/inactive status"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/super-admin/organizations")}
          >
            Open Full Hub
          </Button>
        }
      >
        <Table
          columns={columns}
          data={organizations}
          loading={loading}
          emptyText="No organizations onboarded yet. Click '+ Create Organization' above to add your first tenant."
        />
      </Card>

      {/* =====================================================
          MODAL 1: CREATE ORGANIZATION (Unified with HR)
         ===================================================== */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Organization & Assign HR"
        size="lg"
        footer={
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={submittingCreate}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateSubmit}
              disabled={submittingCreate}
            >
              {submittingCreate ? "Saving Organization & HR..." : "Save Organization & HR"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit} className="sa-modal-form">
          <div className="sa-section-divider">
            <FiBriefcase size={16} />
            <span>Organization Details</span>
          </div>

          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">
                Organization Name <span>*</span>
              </label>
              <input
                type="text"
                className="sa-form-input"
                placeholder="e.g. Apex Global Solutions"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
              />
            </div>

            <div className="sa-form-group">
              <label className="sa-form-label">Organization ID / Code</label>
              <input
                type="text"
                className="sa-form-input"
                placeholder="e.g. APEX01 (auto-generated if empty)"
                value={createForm.orgCode}
                onChange={(e) =>
                  setCreateForm({ ...createForm, orgCode: e.target.value.toUpperCase() })
                }
              />
            </div>
          </div>

          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">
                Total Allowed Employees with HR <span>*</span>
              </label>
              <input
                type="number"
                min="1"
                className="sa-form-input"
                placeholder="e.g. 50"
                value={createForm.memberLimit}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    memberLimit: parseInt(e.target.value, 10) || 1,
                  })
                }
                required
              />
            </div>

            <div className="sa-form-group">
              <label className="sa-form-label">Status</label>
              <select
                className="sa-form-select"
                value={createForm.status}
                onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="sa-form-group">
            <label className="sa-form-label">Office Address</label>
            <input
              type="text"
              className="sa-form-input"
              placeholder="e.g. Suite 400, Financial District"
              value={createForm.address}
              onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
            />
          </div>

          <div className="sa-section-divider" style={{ marginTop: "16px" }}>
            <FiUsers size={16} />
            <span>HR Manager Details (Saved directly to this organization)</span>
          </div>

          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">
                HR Full Name <span>*</span>
              </label>
              <input
                type="text"
                className="sa-form-input"
                placeholder="e.g. Sarah Jenkins"
                value={createForm.hrName}
                onChange={(e) => setCreateForm({ ...createForm, hrName: e.target.value })}
                required
              />
            </div>

            <div className="sa-form-group">
              <label className="sa-form-label">
                HR Email Address <span>*</span>
              </label>
              <input
                type="email"
                className="sa-form-input"
                placeholder="hr@apex.com"
                value={createForm.hrEmail}
                onChange={(e) => setCreateForm({ ...createForm, hrEmail: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">HR Contact (Phone)</label>
              <input
                type="text"
                maxLength={10}
                className="sa-form-input"
                placeholder="10-digit phone number"
                value={createForm.hrPhone}
                onChange={(e) => setCreateForm({ ...createForm, hrPhone: e.target.value })}
              />
            </div>

            <div className="sa-form-group">
              <label className="sa-form-label">
                HR Password <span>*</span>
              </label>
              <div className="sa-password-box">
                <input
                  type={showCreateHRPassword ? "text" : "password"}
                  className="sa-form-input"
                  placeholder="e.g. Hr@12345 (8+ chars, 1 uppercase, 1 digit, 1 symbol)"
                  value={createForm.hrPassword}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, hrPassword: e.target.value })
                  }
                  required
                />
                <button
                  type="button"
                  className="sa-password-toggle"
                  onClick={() => setShowCreateHRPassword(!showCreateHRPassword)}
                >
                  {showCreateHRPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* =====================================================
          MODAL 2: VIEW ALL EMPLOYEES UNDER THIS ORGANIZATION
         ===================================================== */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Employee Directory: ${viewOrg?.name || ""} (${viewOrg?.orgCode || ""})`}
        size="lg"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
            <Button variant="primary" size="sm" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div style={{ padding: "8px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", padding: "12px", background: "#f8fafc", borderRadius: "8px" }}>
            <div>
              <span style={{ fontSize: "13px", color: "#64748b" }}>Organization ID:</span>{" "}
              <strong style={{ color: "#4f46e5" }}>{viewOrg?.orgCode}</strong>
            </div>
            <div>
              <span style={{ fontSize: "13px", color: "#64748b" }}>Total Enrolled:</span>{" "}
              <strong>{viewEmployees.length} Members</strong>
            </div>
            <div>
              <span style={{ fontSize: "13px", color: "#64748b" }}>Capacity Limit:</span>{" "}
              <strong>{viewOrg?.memberLimit} Slots</strong>
            </div>
          </div>

          {loadingEmployees ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
              <Loader.Spinner size="md" />
            </div>
          ) : viewEmployees.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
              <FiUsers size={36} color="#94a3b8" style={{ marginBottom: "8px" }} />
              <p style={{ fontWeight: 600 }}>No employees currently enrolled under this organization.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto", maxHeight: "400px" }}>
              <table className="view-emp-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Contact (Phone)</th>
                    <th>Designation / Role</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {viewEmployees.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <strong>{emp.name}</strong>
                        {emp.role === "HR" && (
                          <span className="sa-status-badge sa-status-role" style={{ marginLeft: "6px", fontSize: "10px" }}>
                            HR
                          </span>
                        )}
                      </td>
                      <td>{emp.email}</td>
                      <td>{emp.phone}</td>
                      <td>{emp.designation}</td>
                      <td>{emp.department}</td>
                      <td>
                        <span className={`sa-status-badge ${emp.status === "Active" ? "sa-status-active" : "sa-status-inactive"}`}>
                          ● {emp.status}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", color: "#64748b" }}>
                        {emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* =====================================================
          MODAL 3: EDIT ALL FIELDS (Org, ID, HR, Total Employees, Status)
         ===================================================== */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Organization: ${editingOrg?.name || ""}`}
        size="lg"
        footer={
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
              disabled={submittingEdit}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleEditSubmit}
              disabled={submittingEdit}
            >
              {submittingEdit ? "Updating in Database..." : "Save All Changes in Database"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleEditSubmit} className="sa-modal-form">
          <div className="sa-section-divider">
            <FiBriefcase size={16} />
            <span>Organization Details</span>
          </div>

          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">
                Organization Name <span>*</span>
              </label>
              <input
                type="text"
                className="sa-form-input"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>

            <div className="sa-form-group">
              <label className="sa-form-label">
                Organization ID / Code <span>*</span>
              </label>
              <input
                type="text"
                className="sa-form-input"
                value={editForm.orgCode}
                onChange={(e) =>
                  setEditForm({ ...editForm, orgCode: e.target.value.toUpperCase() })
                }
                required
              />
            </div>
          </div>

          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">
                Total Allowed Employees with HR <span>*</span>
              </label>
              <input
                type="number"
                min="1"
                className="sa-form-input"
                value={editForm.memberLimit}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    memberLimit: parseInt(e.target.value, 10) || 1,
                  })
                }
                required
              />
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Current members: {editingOrg?.currentMemberCount || 0}
              </span>
            </div>

            <div className="sa-form-group">
              <label className="sa-form-label">Status</label>
              <select
                className="sa-form-select"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="sa-form-group">
            <label className="sa-form-label">Office Address</label>
            <input
              type="text"
              className="sa-form-input"
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            />
          </div>

          <div className="sa-section-divider" style={{ marginTop: "16px" }}>
            <FiUsers size={16} />
            <span>HR Manager Information (Updates directly in database)</span>
          </div>

          <div className="sa-form-row">
            <div className="sa-form-group">
              <label className="sa-form-label">HR Full Name</label>
              <input
                type="text"
                className="sa-form-input"
                placeholder="e.g. Sarah Jenkins"
                value={editForm.hrName}
                onChange={(e) => setEditForm({ ...editForm, hrName: e.target.value })}
              />
            </div>

            <div className="sa-form-group">
              <label className="sa-form-label">HR Email Address</label>
              <input
                type="email"
                className="sa-form-input"
                placeholder="hr@apex.com"
                value={editForm.hrEmail}
                onChange={(e) => setEditForm({ ...editForm, hrEmail: e.target.value })}
              />
            </div>
          </div>

          <div className="sa-form-group">
            <label className="sa-form-label">HR Contact (Phone)</label>
            <input
              type="text"
              maxLength={10}
              className="sa-form-input"
              placeholder="10-digit phone number"
              value={editForm.hrPhone}
              onChange={(e) => setEditForm({ ...editForm, hrPhone: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}