import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  FiUser, FiLock, FiBell, FiSliders, FiShield,
  FiSave, FiCheckCircle, FiAlertCircle, FiLoader,
  FiMail, FiPhone, FiBriefcase, FiEdit2,
  FiHome, FiClock, FiXCircle, FiPlus, FiDownload,
  FiPaperclip, FiTrash2, FiCalendar, FiX, FiRotateCcw
} from 'react-icons/fi';
import { getProfile, updateProfile } from '../../services/api';
import { submitWFHRequest, getMyWFHRequests, downloadAttachment, withdrawWFHRequest } from '../../services/wfhService';
import Modal, { ModalHeader, ModalBody, ModalFooter } from '../../components/Modal/Modal';
import ConfirmModal from '../../components/Modal/ConfirmModal';
import Button from '../../components/Button/Button';
import './Settings.css';

/* -----------------------------------------------------------------------
   localStorage helpers for UI-only preferences
----------------------------------------------------------------------- */
const UI_PREFS_KEY = 'hrms_ui_prefs';

const loadUIPrefs = () => {
  try {
    const saved = localStorage.getItem(UI_PREFS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const saveUIPrefs = (prefs) => {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
  } catch {}
};

const formatWfhDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const calcDays = (start, end) => {
  if (!start || !end) return 1;
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const diffTime = e.getTime() - s.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 1;
};

export default function Settings() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');
  const canEditDepartment = user?.role === 'Admin' || user?.role === 'HR';

  // ── Profile State ──────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    department: user?.department || '',
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  // ── Notification Preferences (UI-only, localStorage) ───────────────
  const savedPrefs = loadUIPrefs();
  const [notifPrefs, setNotifPrefs] = useState({
    emailNotifications: savedPrefs.emailNotifications ?? true,
    payrollUpdates: savedPrefs.payrollUpdates ?? true,
    smsAlerts: savedPrefs.smsAlerts ?? false,
  });
  const [notifSaving, setNotifSaving] = useState(false);

  // ── WFH Requests State ─────────────────────────────────────────────
  const [wfhRequests, setWfhRequests] = useState([]);
  const [wfhLoading, setWfhLoading] = useState(false);
  const [isWfhModalOpen, setIsWfhModalOpen] = useState(false);
  const [wfhSubmitting, setWfhSubmitting] = useState(false);
  const [downloadingFileKey, setDownloadingFileKey] = useState(null);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [requestToWithdraw, setRequestToWithdraw] = useState(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const [wfhForm, setWfhForm] = useState({
    start_date: '',
    end_date: '',
    reason: '',
    files: [],
  });

  const fetchMyWfhRequests = useCallback(async () => {
    setWfhLoading(true);
    try {
      const res = await getMyWFHRequests();
      setWfhRequests(res?.data || []);
    } catch (err) {
      console.error('Error loading personal WFH requests:', err);
      showToast('error', err.message || 'Failed to load your WFH requests.');
    } finally {
      setWfhLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeTab === 'wfh') {
      fetchMyWfhRequests();
    }
  }, [activeTab, fetchMyWfhRequests]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    if (wfhForm.files.length + selectedFiles.length > 5) {
      showToast('error', 'You can upload at most 5 files in total.');
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];

    for (const f of selectedFiles) {
      if (f.size > 10 * 1024 * 1024) {
        showToast('error', `File "${f.name}" exceeds the 10MB size limit.`);
        return;
      }
      if (!allowedTypes.includes(f.type)) {
        showToast('error', `File "${f.name}" has an unsupported format. Allowed: PDF, JPG, PNG, DOCX.`);
        return;
      }
    }

    setWfhForm((prev) => ({
      ...prev,
      files: [...prev.files, ...selectedFiles],
    }));
    e.target.value = '';
  };

  const handleRemoveFile = (indexToRemove) => {
    setWfhForm((prev) => ({
      ...prev,
      files: prev.files.filter((_, idx) => idx !== indexToRemove),
    }));
  };

  const handleSubmitWFH = async (e) => {
    if (e) e.preventDefault();
    if (!wfhForm.start_date) {
      showToast('error', 'Start Date is required.');
      return;
    }
    if (!wfhForm.end_date) {
      showToast('error', 'End Date is required.');
      return;
    }
    const s = new Date(wfhForm.start_date);
    const end = new Date(wfhForm.end_date);
    s.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (end.getTime() < s.getTime()) {
      showToast('error', 'End Date cannot be earlier than Start Date.');
      return;
    }
    if (!wfhForm.reason.trim()) {
      showToast('error', 'Reason is required.');
      return;
    }

    setWfhSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('start_date', wfhForm.start_date);
      formData.append('end_date', wfhForm.end_date);
      formData.append('reason', wfhForm.reason.trim());
      wfhForm.files.forEach((file) => {
        formData.append('files', file);
      });

      await submitWFHRequest(formData);
      showToast('success', 'Work From Home request submitted successfully.');
      setIsWfhModalOpen(false);
      setWfhForm({ start_date: '', end_date: '', reason: '', files: [] });
      fetchMyWfhRequests();
    } catch (err) {
      console.error('Submit WFH error:', err);
      showToast('error', err.message || 'Failed to submit WFH request.');
    } finally {
      setWfhSubmitting(false);
    }
  };

  const handleConfirmWithdraw = async () => {
    if (!requestToWithdraw) return;
    setWithdrawLoading(true);
    try {
      const res = await withdrawWFHRequest(requestToWithdraw._id);
      showToast('success', 'Work From Home request withdrawn successfully.');
      const updatedWithdrawnAt = res?.data?.withdrawn_at || new Date().toISOString();
      setWfhRequests((prev) =>
        prev.map((r) =>
          r._id === requestToWithdraw._id
            ? { ...r, status: 'Withdrawn', withdrawn_at: updatedWithdrawnAt }
            : r
        )
      );
      setIsWithdrawModalOpen(false);
      setRequestToWithdraw(null);
    } catch (err) {
      console.error('Withdraw error:', err);
      showToast('error', err?.response?.data?.message || err.message || 'Failed to withdraw WFH request.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleDownloadAttachment = async (reqId, fileIndex, fileName) => {
    try {
      setDownloadingFileKey(`${reqId}-${fileIndex}`);
      await downloadAttachment(reqId, fileIndex, fileName);
      showToast('success', `Downloaded ${fileName}`);
    } catch (err) {
      console.error('Download error:', err);
      showToast('error', err.message || 'Failed to download attachment.');
    } finally {
      setDownloadingFileKey(null);
    }
  };

  // ── Load profile on mount ──────────────────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const data = await getProfile();
        const u = data.user || {};
        setProfileForm({
          name: u.name || user?.name || '',
          email: u.email || user?.email || '',
          phone: u.phone || '',
          department: u.department || '',
        });
        if (updateUser && u.name) {
          updateUser(u);
        }
      } catch (err) {
        showToast('error', err.message || 'Failed to load profile.');
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // ── Profile save ───────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!profileForm.name.trim()) {
      showToast('error', 'Name cannot be empty.');
      return;
    }
    setProfileSaving(true);
    try {
      const payload = {
        name: profileForm.name,
        phone: profileForm.phone,
      };
      if (canEditDepartment) {
        payload.department = profileForm.department;
      }
      const data = await updateProfile(payload);
      const updated = data.user || {};
      setProfileForm((prev) => ({
        ...prev,
        name: updated.name || prev.name,
        phone: updated.phone !== undefined ? updated.phone : prev.phone,
        department: updated.department || prev.department,
      }));
      
      if (updateUser) {
        updateUser(updated);
      }

      showToast('success', 'Profile updated successfully.');
    } catch (err) {
      showToast('error', err.message || 'Failed to save profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Notification prefs save (localStorage) ─────────────────────────
  const handleSaveNotifications = () => {
    setNotifSaving(true);
    setTimeout(() => {
      saveUIPrefs({ ...loadUIPrefs(), ...notifPrefs });
      setNotifSaving(false);
      showToast('success', 'Notification preferences saved locally.');
    }, 400);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: FiUser },
    { id: 'notifications', label: 'Notifications', icon: FiBell },
    { id: 'security', label: 'Security', icon: FiShield },
    { id: 'wfh', label: 'Work From Home', icon: FiHome },
  ];

  return (
    <div className="settings-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-box">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your profile, preferences, and security options.</p>
        </div>
      </div>

      {/* Tab Pills */}
      <div className="settings-nav-pills">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`settings-pill ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── PROFILE TAB ─────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="settings-section-card">
          <div className="card-header">
            <h3 className="card-title"><FiUser size={18} /> Personal Information</h3>
            <span className="settings-backend-badge">Saved to Server</span>
          </div>


          {profileLoading ? (
            <div className="settings-loading-state">
              <div className="settings-spinner" />
              Loading your profile...
            </div>
          ) : (
            <div className="settings-profile-grid">
              <div className="settings-form-group">
                <label className="settings-form-label">
                  <FiUser size={13} /> Full Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="settings-form-input"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="settings-form-group">
                <label className="settings-form-label">
                  <FiMail size={13} /> Email Address
                </label>
                <input
                  type="email"
                  className="settings-form-input disabled"
                  value={profileForm.email}
                  disabled
                  title="Email cannot be changed"
                />
                <span className="settings-field-hint">Email address cannot be changed.</span>
              </div>

              <div className="settings-form-group">
                <label className="settings-form-label">
                  <FiPhone size={13} /> Phone Number
                </label>
                <input
                  type="text"
                  className="settings-form-input"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="e.g. +91 9876543210"
                />
              </div>

              <div className="settings-form-group">
                <label className="settings-form-label">
                  <FiBriefcase size={13} /> Department {!canEditDepartment && '(Read-Only)'}
                </label>
                <input
                  type="text"
                  className={`settings-form-input ${!canEditDepartment ? 'disabled' : ''}`}
                  value={profileForm.department}
                  onChange={(e) => setProfileForm((p) => ({ ...p, department: e.target.value }))}
                  disabled={!canEditDepartment}
                  placeholder="e.g. Engineering"
                />
                {!canEditDepartment && (
                  <span className="settings-field-hint">Department can only be modified by Admin or HR.</span>
                )}
              </div>
            </div>
          )}

          <div className="settings-form-actions">
            <button
              className="btn-primary"
              onClick={handleSaveProfile}
              disabled={profileSaving || profileLoading}
            >
              {profileSaving ? (
                <><div className="settings-spinner-sm" /> Saving...</>
              ) : (
                <><FiSave size={15} /> Save Profile</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS TAB ───────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="settings-section-card">
          <div className="card-header">
            <h3 className="card-title"><FiBell size={18} /> Notification Preferences</h3>
            <span className="settings-local-badge">Saved Locally</span>
          </div>

          <div className="settings-info-banner">
            <FiAlertCircle size={15} />
            These preferences are saved in your browser. They control UI notifications only — server-side email delivery is managed by your administrator.
          </div>

          <div className="settings-item-row">
            <div className="settings-item-info">
              <h4>Email Notifications</h4>
              <p>Show in-app alerts for leave approvals, rejections, and system updates.</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={notifPrefs.emailNotifications}
                onChange={() => setNotifPrefs((p) => ({ ...p, emailNotifications: !p.emailNotifications }))}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="settings-item-row">
            <div className="settings-item-info">
              <h4>Payroll & Salary Alerts</h4>
              <p>Display a banner when a new payslip is available in the Payroll section.</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={notifPrefs.payrollUpdates}
                onChange={() => setNotifPrefs((p) => ({ ...p, payrollUpdates: !p.payrollUpdates }))}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="settings-item-row">
            <div className="settings-item-info">
              <h4>SMS Notifications</h4>
              <p>SMS delivery is configured server-side. This toggle is for future integration.</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={notifPrefs.smsAlerts}
                onChange={() => setNotifPrefs((p) => ({ ...p, smsAlerts: !p.smsAlerts }))}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="settings-form-actions">
            <button className="btn-primary" onClick={handleSaveNotifications} disabled={notifSaving}>
              {notifSaving ? <><div className="settings-spinner-sm" /> Saving...</> : <><FiSave size={15} /> Save Preferences</>}
            </button>
          </div>
        </div>
      )}

      {/* ── SECURITY TAB ─────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="settings-section-card">
          <div className="card-header">
            <h3 className="card-title"><FiShield size={18} /> Security & Access</h3>
          </div>

          <div className="settings-item-row">
            <div className="settings-item-info">
              <h4>Account Password</h4>
              <p>Update your password regularly to protect your HRMS account.</p>
            </div>
            <button className="btn-secondary" onClick={() => navigate('/change-password')}>
              <FiLock size={14} /> Change Password
            </button>
          </div>

          <div className="settings-item-row">
            <div className="settings-item-info">
              <h4>Active Session</h4>
              <p>
                Signed in as <strong>{user?.name || 'User'}</strong> ({user?.email || '—'}).
                Role: <strong>{user?.role || 'Employee'}</strong>.
              </p>
            </div>
            <button className="btn-outline" onClick={() => navigate('/profile')}>
              <FiUser size={14} /> View Profile
            </button>
          </div>
        </div>
      )}

      {/* ── WORK FROM HOME TAB ───────────────────────────────────────── */}
      {activeTab === 'wfh' && (
        <div className="settings-section-card settings-wfh-card">
          <div className="card-header wfh-settings-card-header">
            <div>
              <h3 className="card-title">
                <FiHome size={18} /> Work From Home (WFH) Requests
              </h3>
              <p className="wfh-settings-subtitle">
                Apply for remote working days and track the approval status of your submitted requests.
              </p>
            </div>
            <button
              className="btn-primary wfh-new-request-btn"
              onClick={() => setIsWfhModalOpen(true)}
            >
              <FiPlus size={16} /> Request WFH
            </button>
          </div>

          <div className="settings-info-banner">
            <FiAlertCircle size={16} />
            <div>
              <strong>Super Admin Approval:</strong> Work From Home requests are reviewed and decided solely by the Super Admin. You will receive an automated notification once your request has been approved or rejected.
            </div>
          </div>

          {/* WFH Stats Counters */}
          <div className="settings-wfh-stats">
            <div className="settings-wfh-stat total">
              <span className="count">{wfhRequests.length}</span>
              <span className="label">Total Applied</span>
            </div>
            <div className="settings-wfh-stat pending">
              <span className="count">
                {wfhRequests.filter((r) => r.status === 'Pending').length}
              </span>
              <span className="label">Pending</span>
            </div>
            <div className="settings-wfh-stat approved">
              <span className="count">
                {wfhRequests.filter((r) => r.status === 'Approved').length}
              </span>
              <span className="label">Approved</span>
            </div>
            <div className="settings-wfh-stat rejected">
              <span className="count">
                {wfhRequests.filter((r) => r.status === 'Rejected').length}
              </span>
              <span className="label">Rejected</span>
            </div>
            <div className="settings-wfh-stat withdrawn">
              <span className="count">
                {wfhRequests.filter((r) => r.status === 'Withdrawn').length}
              </span>
              <span className="label">Withdrawn</span>
            </div>
          </div>

          {/* Requests History Table */}
          <div className="settings-wfh-history">
            <div className="settings-wfh-history-header">
              <h4>My Request History</h4>
              <button
                className="btn-link"
                onClick={fetchMyWfhRequests}
                disabled={wfhLoading}
              >
                Refresh
              </button>
            </div>

            {wfhLoading ? (
              <div className="settings-loading-state">
                <div className="settings-spinner" />
                Loading your WFH requests...
              </div>
            ) : wfhRequests.length === 0 ? (
              <div className="settings-wfh-empty">
                <FiHome size={36} className="empty-icon" />
                <p>You have not submitted any Work From Home requests yet.</p>
                <button
                  className="btn-primary"
                  onClick={() => setIsWfhModalOpen(true)}
                >
                  <FiPlus size={15} /> Submit Your First Request
                </button>
              </div>
            ) : (
              <div className="settings-wfh-table-wrapper">
                <table className="settings-wfh-table">
                  <thead>
                    <tr>
                      <th>Requested Dates</th>
                      <th>Duration</th>
                      <th>Reason</th>
                      <th>Attachments</th>
                      <th>Status</th>
                      <th>Decision Details</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wfhRequests.map((req) => {
                      const days = calcDays(req.start_date, req.end_date);
                      const isPending = req.status === 'Pending';
                      const isApproved = req.status === 'Approved';
                      const isRejected = req.status === 'Rejected';
                      const isWithdrawn = req.status === 'Withdrawn';

                      return (
                        <tr key={req._id}>
                          <td>
                            <div className="wfh-table-dates">
                              <strong>
                                {formatWfhDate(req.start_date)} &ndash; {formatWfhDate(req.end_date)}
                              </strong>
                              <span className="wfh-requested-on">
                                Applied on {formatWfhDate(req.requested_at || req.createdAt)}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="wfh-table-days">
                              {days} {days === 1 ? 'day' : 'days'}
                            </span>
                          </td>
                          <td>
                            <div className="wfh-table-reason" title={req.reason}>
                              {req.reason}
                            </div>
                          </td>
                          <td>
                            {req.attached_files && req.attached_files.length > 0 ? (
                              <div className="wfh-table-files">
                                {req.attached_files.map((file, idx) => (
                                  <button
                                    key={idx}
                                    className="wfh-table-file-btn"
                                    onClick={() =>
                                      handleDownloadAttachment(req._id, idx, file.file_name)
                                    }
                                    title={`Download ${file.file_name}`}
                                    disabled={downloadingFileKey === `${req._id}-${idx}`}
                                  >
                                    <FiDownload size={11} />
                                    <span>{file.file_name}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="wfh-no-files-text">No files</span>
                            )}
                          </td>
                          <td>
                            <span className={`wfh-status-badge ${req.status?.toLowerCase()}`}>
                              {isPending && <FiClock size={12} />}
                              {isApproved && <FiCheckCircle size={12} />}
                              {isRejected && <FiXCircle size={12} />}
                              {isWithdrawn && <FiRotateCcw size={12} />}
                              {req.status}
                            </span>
                          </td>
                          <td>
                            {isPending ? (
                              <span className="wfh-pending-note">Pending Super Admin review</span>
                            ) : isWithdrawn ? (
                              <div className="wfh-outcome-details">
                                <span className="wfh-outcome-date">
                                  Withdrawn on {formatWfhDate(req.withdrawn_at || req.updatedAt)}
                                </span>
                                <span className="wfh-outcome-reason">Cancelled by you</span>
                              </div>
                            ) : (
                              <div className="wfh-outcome-details">
                                <span className="wfh-outcome-date">
                                  {formatWfhDate(req.decided_at)}
                                </span>
                                {isRejected && req.rejection_reason && (
                                  <span className="wfh-outcome-reason" title={req.rejection_reason}>
                                    Reason: {req.rejection_reason}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            {isPending ? (
                              <button
                                type="button"
                                className="wfh-withdraw-btn"
                                onClick={() => {
                                  setRequestToWithdraw(req);
                                  setIsWithdrawModalOpen(true);
                                }}
                                title="Withdraw this pending request"
                              >
                                <FiRotateCcw size={12} /> Withdraw
                              </button>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SUBMIT WFH REQUEST MODAL ─────────────────────────────────── */}
      <Modal
        isOpen={isWfhModalOpen}
        onClose={() => {
          if (!wfhSubmitting) {
            setIsWfhModalOpen(false);
          }
        }}
        maxWidth="580px"
      >
        <ModalHeader
          onClose={() => {
            if (!wfhSubmitting) {
              setIsWfhModalOpen(false);
            }
          }}
        >
          <div className="wfh-modal-header-title">
            <FiHome size={20} />
            <span>Request Work From Home</span>
          </div>
        </ModalHeader>

        <form onSubmit={handleSubmitWFH}>
          <ModalBody>
            <div className="wfh-form-container">
              {/* Date Inputs */}
              <div className="wfh-dates-row">
                <div className="settings-form-group">
                  <label className="settings-form-label">
                    <FiCalendar size={13} /> Start Date <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    className="settings-form-input"
                    value={wfhForm.start_date}
                    onChange={(e) =>
                      setWfhForm((prev) => ({
                        ...prev,
                        start_date: e.target.value,
                        end_date: prev.end_date && prev.end_date < e.target.value ? e.target.value : prev.end_date,
                      }))
                    }
                    required
                  />
                </div>

                <div className="settings-form-group">
                  <label className="settings-form-label">
                    <FiCalendar size={13} /> End Date <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    className="settings-form-input"
                    value={wfhForm.end_date}
                    min={wfhForm.start_date || undefined}
                    onChange={(e) =>
                      setWfhForm((prev) => ({
                        ...prev,
                        end_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              {/* Live Duration Calculation */}
              {wfhForm.start_date && wfhForm.end_date && (
                <div className="wfh-calc-preview">
                  <span>Calculated Remote Days:</span>
                  <strong>
                    {calcDays(wfhForm.start_date, wfhForm.end_date)}{' '}
                    {calcDays(wfhForm.start_date, wfhForm.end_date) === 1 ? 'Working Day' : 'Working Days'}
                  </strong>
                </div>
              )}

              {/* Reason Textarea */}
              <div className="settings-form-group">
                <label className="settings-form-label">
                  Reason for Remote Work <span className="required">*</span>
                </label>
                <textarea
                  className="settings-form-input wfh-textarea-field"
                  rows={4}
                  placeholder="Explain why you need to work from home (e.g. personal emergency, health, focus work)..."
                  value={wfhForm.reason}
                  onChange={(e) =>
                    setWfhForm((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  required
                />
              </div>

              {/* Attachments Upload */}
              <div className="settings-form-group">
                <label className="settings-form-label">
                  <FiPaperclip size={13} /> Attach Documents (Optional, Max 5 files)
                </label>
                <div className="wfh-upload-zone">
                  <input
                    type="file"
                    id="wfh-file-input"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    disabled={wfhForm.files.length >= 5}
                  />
                  <label
                    htmlFor="wfh-file-input"
                    className={`wfh-upload-btn-label ${wfhForm.files.length >= 5 ? 'disabled' : ''}`}
                  >
                    <FiPlus size={16} /> Choose Files (PDF, JPG, PNG, DOCX up to 10MB)
                  </label>
                  <span className="wfh-upload-hint">
                    {wfhForm.files.length} / 5 files selected
                  </span>
                </div>

                {/* Attached File Previews */}
                {wfhForm.files.length > 0 && (
                  <div className="wfh-selected-files-list">
                    {wfhForm.files.map((file, idx) => (
                      <div key={idx} className="wfh-selected-file-row">
                        <div className="file-meta">
                          <FiPaperclip size={13} />
                          <span className="name">{file.name}</span>
                          <span className="size">
                            ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                          </span>
                        </div>
                        <button
                          type="button"
                          className="wfh-file-remove-btn"
                          onClick={() => handleRemoveFile(idx)}
                          title="Remove file"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsWfhModalOpen(false)}
              disabled={wfhSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={wfhSubmitting || !wfhForm.reason.trim() || !wfhForm.start_date || !wfhForm.end_date}
            >
              {wfhSubmitting ? 'Submitting...' : 'Submit WFH Request'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ── WITHDRAW WFH REQUEST CONFIRM MODAL ───────────────────────── */}
      <ConfirmModal
        isOpen={isWithdrawModalOpen}
        onClose={() => {
          if (!withdrawLoading) {
            setIsWithdrawModalOpen(false);
            setRequestToWithdraw(null);
          }
        }}
        onConfirm={handleConfirmWithdraw}
        title="Withdraw Work From Home Request?"
        message={
          requestToWithdraw ? (
            <div>
              <p>
                Are you sure you want to withdraw your Work From Home request for{' '}
                <strong>
                  {formatWfhDate(requestToWithdraw.start_date)} &ndash; {formatWfhDate(requestToWithdraw.end_date)}
                </strong>
                ?
              </p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                Once withdrawn, this request will be marked as Withdrawn and removed from the Pending review queue.
              </p>
            </div>
          ) : (
            'Are you sure you want to withdraw this request?'
          )
        }
        confirmText={withdrawLoading ? 'Withdrawing...' : 'Yes, Withdraw Request'}
        cancelText="Cancel"
        variant="warning"
        loading={withdrawLoading}
      />
    </div>
  );
}