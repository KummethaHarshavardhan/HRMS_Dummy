import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getProfile, updateProfile } from "../../services/api";
import { getMyEmployeeProfile } from "../../services/profileService";
import { useAuth } from "../../context/AuthContext";
import {
  FiEdit2,
  FiArrowLeft,
  FiUser,
  FiMail,
  FiPhone,
  FiBriefcase,
  FiShield,
  FiCheckCircle,
  FiFileText,
  FiBox,
  FiClock,
} from "react-icons/fi";
import DocumentManager from "../../components/employee/DocumentManager";
import EmployeeAssetsTab from "../../components/employee/EmployeeAssetsTab";
import "../../components/employee/emp.shared.css";
import "../../pages/Assets/Assets.css";
import "./Profile.css";

import { useToast } from "../../context/ToastContext";

function Profile() {
  const { user: authUser, updateUser } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [employeeId, setEmployeeId] = useState(null);
  const [employeeRecord, setEmployeeRecord] = useState(null);
  const [employeeLoading, setEmployeeLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Also load linked employee record ID for documents and assets
    setEmployeeLoading(true);
    getMyEmployeeProfile()
      .then((data) => {
        if (data?.employee?._id) {
          setEmployeeId(data.employee._id);
          setEmployeeRecord(data.employee);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch linked employee profile:", err.message);
      })
      .finally(() => {
        setEmployeeLoading(false);
      });
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getProfile();
        const u = data.user || {};
        setProfile(u);
        setForm({
          name: u.name || "",
          email: u.email || "",
          phone: u.phone || "",
          department: u.department || "",
        });
        if (updateUser && u.name) {
          updateUser(u);
        }
      } catch (err) {
        setError(err.message || "Unable to load profile.");
        if (err.message === "Authentication required") {
          navigate("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  const canEditDepartment = profile?.role === "Admin" || profile?.role === "HR" || authUser?.role === "Admin" || authUser?.role === "HR";

  const handleEdit = () => {
    setError("");
    setSuccess("");
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (profile) {
      setForm({
        name: profile.name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        department: profile.department || "",
      });
    }
    setIsEditing(false);
    setError("");
    setSuccess("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await updateProfile({
        name: form.name,
        phone: form.phone,
        department: form.department,
        role: form.role
      });
      setProfile(data.user);
      setForm({
        name: data.user.name,
        phone: data.user.phone || '',
        department: data.user.department || '',
        role: data.user.role || 'Employee'
      });
      updateUser(data.user);
      const msg = 'Profile updated successfully.';
      setSuccess(msg);
      showToast('success', msg);
      setIsEditing(false);
    } catch (err) {
      const errMsg = err.message || 'Unable to save profile.';
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="emp-page">
        <div className="emp-loading">
          <span className="emp-spinner" />
          Loading your profile...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="emp-page">
        <div className="emp-alert error">Unable to load profile data.</div>
      </div>
    );
  }

  const name = profile.name || "User";
  const email = profile.email || "—";
  const role = profile.role || "Employee";
  const dept = profile.department || "Engineering";
  const phone = profile.phone || "-";

  return (
    <div className="emp-page profile-redesign-wrapper">
      <div className="emp-page-header">
        <div className="emp-page-header-text">
          <h1>My Profile</h1>
          <p>Review and manage your account credentials & personal information.</p>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link to="/dashboard" className="emp-btn-secondary">
            <FiArrowLeft size={16} /> Back to Dashboard
          </Link>
          {!isEditing && activeTab === "details" && (
            <button type="button" className="emp-btn-primary" onClick={handleEdit} id="edit-profile-btn">
              <FiEdit2 size={16} /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Profile Navigation Tabs */}
      <div className="profile-nav-tabs asset-nav-tabs">
        <button
          type="button"
          id="profile-tab-details"
          className={`profile-nav-tab asset-nav-tab ${activeTab === "details" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("details");
            setIsEditing(false);
          }}
        >
          <FiUser size={16} /> Personal Details
        </button>
        <button
          type="button"
          id="profile-tab-documents"
          className={`profile-nav-tab asset-nav-tab ${activeTab === "documents" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("documents");
            setIsEditing(false);
          }}
        >
          <FiFileText size={16} /> Documents
        </button>
        <button
          type="button"
          id="profile-tab-assets"
          className={`profile-nav-tab asset-nav-tab ${activeTab === "assets" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("assets");
            setIsEditing(false);
          }}
        >
          <FiBox size={16} /> Assets
        </button>
      </div>

      {activeTab === "details" && (
        <div className="profile-layout-grid">
          <div className="profile-hero-card">
            <div className="profile-hero-avatar-wrapper">
              <div className="profile-hero-avatar">
                {name.charAt(0).toUpperCase()}
              </div>
              <span className="profile-status-indicator" title="Active Account">
                <FiCheckCircle size={14} />
              </span>
            </div>

            <h2 className="profile-user-name">{name}</h2>
            <span className="profile-user-role-badge">{role}</span>
            <p className="profile-user-email">{email}</p>

            <div className="profile-quick-stats">
              <div className="profile-stat-box">
                <span className="profile-stat-label">Department</span>
                <span className="profile-stat-value">{dept}</span>
              </div>
              <div className="profile-stat-box">
                <span className="profile-stat-label">Status</span>
                <span className="profile-stat-value active">Active</span>
              </div>
            </div>
          </div>

          <div className="profile-details-card">
            <div className="profile-card-header">
              <h2>{isEditing ? "Edit Personal Details" : "Personal Details"}</h2>
              <span className="profile-card-subtitle">
                {isEditing ? "Update your contact and department details below." : "View your details registered on Infinetra HRMS."}
              </span>
            </div>

            {isEditing ? (
              <form className="profile-edit-form" onSubmit={(e) => e.preventDefault()}>
                <div className="profile-form-grid">
                  <div className="profile-form-group">
                    <label className="profile-form-label">
                      <FiUser size={14} /> Full Name <span>*</span>
                    </label>
                    <input
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={handleChange}
                      className="profile-form-input"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="profile-form-group">
                    <label className="profile-form-label">
                      <FiMail size={14} /> Email Address (Read-Only)
                    </label>
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      disabled
                      className="profile-form-input disabled"
                    />
                  </div>

                  <div className="profile-form-group">
                    <label className="profile-form-label">
                      <FiPhone size={14} /> Phone Number
                    </label>
                    <input
                      name="phone"
                      type="text"
                      value={form.phone}
                      onChange={handleChange}
                      className="profile-form-input"
                      placeholder="e.g. +91 9876543210"
                    />
                  </div>

                  <div className="profile-form-group">
                    <label className="profile-form-label">
                      <FiBriefcase size={14} /> Department {!canEditDepartment && "(Read-Only)"}
                    </label>
                    <input
                      name="department"
                      type="text"
                      value={form.department}
                      onChange={handleChange}
                      disabled={!canEditDepartment}
                      className={`profile-form-input ${!canEditDepartment ? "disabled" : ""}`}
                      placeholder="e.g. Engineering"
                    />
                    {!canEditDepartment && (
                      <span className="profile-field-hint" style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4, display: "block" }}>
                        Department can only be modified by Admin or HR.
                      </span>
                    )}
                  </div>
                </div>

                <div className="profile-form-actions">
                  <button
                    type="button"
                    className="emp-btn-secondary"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="emp-btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <span className="emp-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-info-grid">
                <div className="profile-info-item">
                  <div className="profile-info-icon"><FiUser size={18} /></div>
                  <div className="profile-info-content">
                    <span className="profile-info-label">Full Name</span>
                    <strong className="profile-info-value">{name}</strong>
                  </div>
                </div>

                <div className="profile-info-item">
                  <div className="profile-info-icon"><FiMail size={18} /></div>
                  <div className="profile-info-content">
                    <span className="profile-info-label">Email Address</span>
                    <strong className="profile-info-value">{email}</strong>
                  </div>
                </div>

                <div className="profile-info-item">
                  <div className="profile-info-icon"><FiPhone size={18} /></div>
                  <div className="profile-info-content">
                    <span className="profile-info-label">Phone Number</span>
                    <strong className="profile-info-value">{phone}</strong>
                  </div>
                </div>

                <div className="profile-info-item">
                  <div className="profile-info-icon"><FiBriefcase size={18} /></div>
                  <div className="profile-info-content">
                    <span className="profile-info-label">Department</span>
                    <strong className="profile-info-value">{dept}</strong>
                  </div>
                </div>

                <div className="profile-info-item">
                  <div className="profile-info-icon"><FiShield size={18} /></div>
                  <div className="profile-info-content">
                    <span className="profile-info-label">System Role</span>
                    <strong className="profile-info-value">{role}</strong>
                  </div>
                </div>

                <div className="profile-info-item">
                  <div className="profile-info-icon"><FiClock size={18} /></div>
                  <div className="profile-info-content">
                    <span className="profile-info-label">Work Shift</span>
                    <strong className="profile-info-value">
                      {employeeRecord?.current_shift_id ? (
                        <>
                          <span style={{ color: employeeRecord.current_shift_id.color || "#4f46e5" }}>
                            {employeeRecord.current_shift_id.name}
                          </span>
                          <span style={{ fontWeight: 400, color: "#64748b", marginLeft: 6, fontSize: "0.9em" }}>
                            ({employeeRecord.current_shift_id.start_time} – {employeeRecord.current_shift_id.end_time})
                          </span>
                          {employeeRecord.current_shift_group_id && (
                            <span style={{ display: "block", fontSize: "0.85em", color: "#64748b", fontWeight: 400, marginTop: 2 }}>
                              Group: {employeeRecord.current_shift_group_id.name || employeeRecord.current_shift_group_id}
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: "#64748b", fontWeight: 500 }}>Standard Hours (09:00 – 18:00)</span>
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div style={{ marginTop: 8 }}>
          {employeeLoading ? (
            <div className="emp-loading" style={{ padding: 40, textAlign: "center" }}>
              <span className="emp-spinner" />
              Loading documents...
            </div>
          ) : employeeId ? (
            <DocumentManager employeeId={employeeId} />
          ) : (
            <div
              className="emp-empty-state"
              style={{
                background: "#ffffff",
                borderRadius: 16,
                padding: "48px 24px",
                textAlign: "center",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 12px rgba(15, 23, 42, 0.04)",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  marginBottom: 16,
                }}
              >
                <FiFileText size={28} />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "#0f172a" }}>
                No Employee Record Linked
              </h3>
              <p style={{ margin: 0, color: "#64748b", fontSize: 14, maxWidth: 440, marginInline: "auto" }}>
                Documents are tied to employee records. If you are an admin or manager without an employee profile, you can view and manage documents through the Employee Directory.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "assets" && (
        <div style={{ marginTop: 8 }}>
          {employeeLoading ? (
            <div className="emp-loading" style={{ padding: 40, textAlign: "center" }}>
              <span className="emp-spinner" />
              Loading assigned assets...
            </div>
          ) : employeeId ? (
            <EmployeeAssetsTab employeeId={employeeId} />
          ) : (
            <div
              className="emp-empty-state"
              style={{
                background: "#ffffff",
                borderRadius: 16,
                padding: "48px 24px",
                textAlign: "center",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 12px rgba(15, 23, 42, 0.04)",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  marginBottom: 16,
                }}
              >
                <FiBox size={28} />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "#0f172a" }}>
                No Employee Record Linked
              </h3>
              <p style={{ margin: 0, color: "#64748b", fontSize: 14, maxWidth: 440, marginInline: "auto" }}>
                Assigned assets are tied to employee records. If you are an admin or manager without an employee profile, you can view and manage assets through the Asset Inventory.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Profile;