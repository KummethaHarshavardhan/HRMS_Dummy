import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { normalizeRole } from "../../utils/permission";
import {
  getAllWFHRequests,
  getMyWFHRequests,
  decideWFHRequest,
  downloadAttachment,
  withdrawWFHRequest,
} from "../../services/wfhService";
import { getOrganizations } from "../../services/superAdminService";
import Modal, { ModalHeader, ModalBody, ModalFooter } from "../../components/Modal/Modal";
import ConfirmModal from "../../components/Modal/ConfirmModal";
import Button from "../../components/Button/Button";
import Loader from "../../components/Loader/Loader";
import {
  FiHome,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiSearch,
  FiFilter,
  FiDownload,
  FiEye,
  FiAlertCircle,
  FiFileText,
  FiCalendar,
  FiUser,
  FiCheck,
  FiX,
  FiRefreshCw,
  FiShield,
  FiPaperclip,
  FiRotateCcw,
} from "react-icons/fi";
import "./WFHRequests.css";

const formatDate = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const calculateDays = (start, end) => {
  if (!start || !end) return 1;
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const diffTime = e.getTime() - s.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 1;
};

export default function WFHRequests() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const userRole = normalizeRole(user?.role);
  const isSuperAdmin = userRole === "super_admin";
  const isEmployee = userRole === "employee";

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [orgFilter, setOrgFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [organizations, setOrganizations] = useState([]);

  // Modals state
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  // Withdraw Modal state
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [requestToWithdraw, setRequestToWithdraw] = useState(null);

  // Fetch organizations for Super Admin filter
  useEffect(() => {
    if (isSuperAdmin) {
      getOrganizations()
        .then((res) => {
          if (res?.data) {
            setOrganizations(res.data);
          } else if (Array.isArray(res)) {
            setOrganizations(res);
          }
        })
        .catch((err) => {
          console.warn("Failed to load organizations for filter:", err.message);
        });
    }
  }, [isSuperAdmin]);

  // Fetch WFH Requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      if (isEmployee) {
        const res = await getMyWFHRequests();
        let list = res?.data || [];
        if (statusFilter !== "ALL") {
          list = list.filter((r) => r.status === statusFilter);
        }
        setRequests(list);
      } else {
        const params = {};
        if (statusFilter !== "ALL") params.status = statusFilter;
        if (isSuperAdmin && orgFilter !== "ALL") params.organizationId = orgFilter;

        const res = await getAllWFHRequests(params);
        setRequests(res?.data || []);
      }
    } catch (err) {
      console.error("fetchRequests error:", err);
      showToast("error", err?.response?.data?.message || err.message || "Failed to load WFH requests.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, orgFilter, isSuperAdmin, isEmployee, showToast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Filter requests by search query (employee name, code, reason)
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const empName = req.employee_id?.user_id?.name || "";
      const empEmail = req.employee_id?.user_id?.email || "";
      const empCode = req.employee_id?.employee_code || "";
      const reason = req.reason || "";
      const orgName = req.organizationId?.name || "";
      return (
        empName.toLowerCase().includes(q) ||
        empEmail.toLowerCase().includes(q) ||
        empCode.toLowerCase().includes(q) ||
        reason.toLowerCase().includes(q) ||
        orgName.toLowerCase().includes(q)
      );
    });
  }, [requests, searchQuery]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === "Pending").length;
    const approved = requests.filter((r) => r.status === "Approved").length;
    const rejected = requests.filter((r) => r.status === "Rejected").length;
    const withdrawn = requests.filter((r) => r.status === "Withdrawn").length;
    return { total, pending, approved, rejected, withdrawn };
  }, [requests]);

  // Handle Download Attachment
  const handleDownloadFile = async (reqId, fileIndex, fileName) => {
    try {
      setDownloadingId(`${reqId}-${fileIndex}`);
      await downloadAttachment(reqId, fileIndex, fileName);
      showToast("success", `Downloaded ${fileName}`);
    } catch (err) {
      console.error("Download error:", err);
      showToast("error", err.message || "Could not download file.");
    } finally {
      setDownloadingId(null);
    }
  };

  // Open Approve Confirmation (Super Admin Only)
  const openApproveModal = (req) => {
    setSelectedRequest(req);
    setIsApproveModalOpen(true);
  };

  // Open Reject Modal (Super Admin Only)
  const openRejectModal = (req) => {
    setSelectedRequest(req);
    setRejectionReason("");
    setIsRejectModalOpen(true);
  };

  // Open Details Modal
  const openDetailModal = (req) => {
    setSelectedRequest(req);
    setIsDetailModalOpen(true);
  };

  // Submit Approval
  const handleConfirmApprove = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      await decideWFHRequest(selectedRequest._id, {
        decision: "Approved",
      });
      showToast("success", `WFH request approved successfully.`);
      setIsApproveModalOpen(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (err) {
      console.error("Approval error:", err);
      showToast("error", err.message || "Failed to approve WFH request.");
    } finally {
      setActionLoading(false);
    }
  };

  // Open Withdraw Confirmation Modal
  const openWithdrawModal = (req) => {
    setRequestToWithdraw(req);
    setIsWithdrawModalOpen(true);
  };

  // Submit Withdrawal (Self-Service)
  const handleConfirmWithdraw = async () => {
    if (!requestToWithdraw) return;
    setActionLoading(true);
    try {
      const res = await withdrawWFHRequest(requestToWithdraw._id);
      showToast("success", "Work From Home request withdrawn successfully.");

      // Update the row in place to show Withdrawn badge without removing the row
      const updatedWithdrawnAt = res?.data?.withdrawn_at || new Date().toISOString();
      setRequests((prev) =>
        prev.map((r) =>
          r._id === requestToWithdraw._id
            ? { ...r, status: "Withdrawn", withdrawn_at: updatedWithdrawnAt }
            : r
        )
      );
      setIsWithdrawModalOpen(false);
      setRequestToWithdraw(null);
    } catch (err) {
      console.error("Withdraw error:", err);
      showToast("error", err?.response?.data?.message || err.message || "Failed to withdraw WFH request.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="wfh-page-container">
      {/* Page Header */}
      <div className="wfh-page-header">
        <div className="wfh-header-title-box">
          <div className="wfh-header-icon-badge">
            <FiHome size={24} />
          </div>
          <div>
            <h1 className="wfh-page-title">
              {isSuperAdmin
                ? "Work From Home Requests (Global Approval Queue)"
                : isEmployee
                ? "My Work From Home Requests"
                : "Work From Home Requests"}
            </h1>
            <p className="wfh-page-subtitle">
              {isSuperAdmin
                ? "Review and approve or reject remote work requests submitted across all organizations."
                : isEmployee
                ? "Submit and track your remote work requests. You can withdraw any pending request before a decision is made."
                : "View Work From Home requests submitted by employees in your organization."}
            </p>
          </div>
        </div>

        <button
          className="wfh-refresh-btn"
          onClick={fetchRequests}
          disabled={loading}
          title="Refresh table"
        >
          <FiRefreshCw className={loading ? "wfh-spin" : ""} size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Role Notice Banner */}
      {isEmployee ? (
        <div className="wfh-notice-banner employee-banner">
          <FiAlertCircle size={18} className="wfh-banner-icon" />
          <div className="wfh-banner-text">
            <strong>Employee Self-Service:</strong> You can track the status of your remote work requests below. Any request that is currently <strong>Pending</strong> can be withdrawn at any time before a decision is made.
          </div>
        </div>
      ) : !isSuperAdmin ? (
        <div className="wfh-notice-banner hr-banner">
          <FiAlertCircle size={18} className="wfh-banner-icon" />
          <div className="wfh-banner-text">
            <strong>Read-Only Access:</strong> Work From Home requests can only be
            approved or rejected by the Super Admin. As HR/Admin, you can monitor
            submitted requests and status updates.
          </div>
        </div>
      ) : (
        <div className="wfh-notice-banner superadmin-banner">
          <FiShield size={18} className="wfh-banner-icon" />
          <div className="wfh-banner-text">
            <strong>Sole Decision-Maker:</strong> You hold the exclusive authority to
            approve or reject Work From Home requests across all organizations.
          </div>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="wfh-stats-grid">
        <div className="wfh-stat-card total">
          <div className="wfh-stat-icon">
            <FiCalendar size={22} />
          </div>
          <div className="wfh-stat-data">
            <span className="wfh-stat-value">{stats.total}</span>
            <span className="wfh-stat-label">Total Requests</span>
          </div>
        </div>

        <div className="wfh-stat-card pending">
          <div className="wfh-stat-icon">
            <FiClock size={22} />
          </div>
          <div className="wfh-stat-data">
            <span className="wfh-stat-value">{stats.pending}</span>
            <span className="wfh-stat-label">Pending Approval</span>
          </div>
        </div>

        <div className="wfh-stat-card approved">
          <div className="wfh-stat-icon">
            <FiCheckCircle size={22} />
          </div>
          <div className="wfh-stat-data">
            <span className="wfh-stat-value">{stats.approved}</span>
            <span className="wfh-stat-label">Approved</span>
          </div>
        </div>

        <div className="wfh-stat-card rejected">
          <div className="wfh-stat-icon">
            <FiXCircle size={22} />
          </div>
          <div className="wfh-stat-data">
            <span className="wfh-stat-value">{stats.rejected}</span>
            <span className="wfh-stat-label">Rejected</span>
          </div>
        </div>

        <div className="wfh-stat-card withdrawn">
          <div className="wfh-stat-icon">
            <FiRotateCcw size={22} />
          </div>
          <div className="wfh-stat-data">
            <span className="wfh-stat-value">{stats.withdrawn}</span>
            <span className="wfh-stat-label">Withdrawn</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="wfh-controls-card">
        <div className="wfh-search-box">
          <FiSearch size={16} className="wfh-search-icon" />
          <input
            type="text"
            placeholder={
              isSuperAdmin
                ? "Search employee, code, org, or reason..."
                : "Search employee, code, or reason..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="wfh-search-input"
          />
          {searchQuery && (
            <button
              className="wfh-clear-search"
              onClick={() => setSearchQuery("")}
            >
              <FiX size={14} />
            </button>
          )}
        </div>

        <div className="wfh-filters-group">
          {/* Organization filter (Super Admin Only) */}
          {isSuperAdmin && (
            <div className="wfh-filter-item">
              <label className="wfh-filter-label">Organization:</label>
              <select
                className="wfh-select"
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
              >
                <option value="ALL">All Organizations</option>
                {organizations.map((org) => (
                  <option key={org._id} value={org._id}>
                    {org.name || org.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status filter */}
          <div className="wfh-filter-item">
            <label className="wfh-filter-label">Status:</label>
            <select
              className="wfh-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Withdrawn">Withdrawn</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="wfh-table-card">
        {loading ? (
          <div className="wfh-table-loading">
            <Loader text="Loading Work From Home requests..." />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="wfh-empty-state">
            <FiHome size={42} className="wfh-empty-icon" />
            <h3 className="wfh-empty-title">No WFH Requests Found</h3>
            <p className="wfh-empty-desc">
              {searchQuery || statusFilter !== "ALL" || orgFilter !== "ALL"
                ? "No requests match your selected filters. Try changing or clearing them."
                : "There are no Work From Home requests to display at this time."}
            </p>
          </div>
        ) : (
          <div className="wfh-table-responsive">
            <table className="wfh-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  {isSuperAdmin && <th>Organization</th>}
                  <th>Period & Duration</th>
                  <th>Reason</th>
                  <th>Attachments</th>
                  <th>Status</th>
                  <th>Decision Info</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((item) => {
                  const emp = item.employee_id;
                  const userName = emp?.user_id?.name || "Unknown Employee";
                  const userEmail = emp?.user_id?.email || "";
                  const empCode = emp?.employee_code || "—";
                  const dept = emp?.department_id?.departmentName || "—";
                  const orgName = item.organizationId?.name || "—";
                  const days = calculateDays(item.start_date, item.end_date);
                  const isPending = item.status === "Pending";
                  const isApproved = item.status === "Approved";
                  const isRejected = item.status === "Rejected";
                  const isWithdrawn = item.status === "Withdrawn";
                  const fileCount = item.attached_files?.length || 0;

                  const empUserId = emp?.user_id?._id || emp?.user_id || emp?._id;
                  const isOwner =
                    isEmployee ||
                    (empUserId &&
                      String(empUserId) === String(user?.id || user?._id));
                  const canWithdraw = isPending && isOwner;

                  return (
                    <tr key={item._id} className="wfh-table-row">
                      {/* Employee Column */}
                      <td>
                        <div className="wfh-emp-cell">
                          <div className="wfh-emp-avatar">
                            {userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="wfh-emp-name">{userName}</div>
                            <div className="wfh-emp-meta">
                              <span>{empCode}</span>
                              {dept !== "—" && (
                                <>
                                  <span className="wfh-meta-dot">•</span>
                                  <span>{dept}</span>
                                </>
                              )}
                            </div>
                            <div className="wfh-emp-email">{userEmail}</div>
                          </div>
                        </div>
                      </td>

                      {/* Organization Column (Super Admin only) */}
                      {isSuperAdmin && (
                        <td>
                          <div className="wfh-org-badge">{orgName}</div>
                        </td>
                      )}

                      {/* Period & Duration */}
                      <td>
                        <div className="wfh-dates-cell">
                          <div className="wfh-date-range">
                            {formatDate(item.start_date)} &ndash; {formatDate(item.end_date)}
                          </div>
                          <span className="wfh-duration-pill">
                            {days} {days === 1 ? "day" : "days"}
                          </span>
                        </div>
                      </td>

                      {/* Reason */}
                      <td>
                        <div className="wfh-reason-cell" title={item.reason}>
                          {item.reason}
                        </div>
                      </td>

                      {/* Attachments */}
                      <td>
                        {fileCount > 0 ? (
                          <div className="wfh-attachments-cell">
                            <span className="wfh-attach-count-badge">
                              <FiPaperclip size={12} /> {fileCount}
                            </span>
                            <div className="wfh-file-pills">
                              {item.attached_files.map((file, idx) => (
                                <button
                                  key={idx}
                                  className="wfh-file-pill-btn"
                                  onClick={() =>
                                    handleDownloadFile(item._id, idx, file.file_name)
                                  }
                                  title={`Download ${file.file_name}`}
                                  disabled={downloadingId === `${item._id}-${idx}`}
                                >
                                  <FiDownload size={11} />
                                  <span className="wfh-file-name-text">
                                    {file.file_name}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="wfh-no-files">No files</span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          className={`wfh-status-badge ${item.status?.toLowerCase()}`}
                        >
                          {isPending && <FiClock size={12} />}
                          {isApproved && <FiCheckCircle size={12} />}
                          {isRejected && <FiXCircle size={12} />}
                          {isWithdrawn && <FiRotateCcw size={12} />}
                          {item.status}
                        </span>
                      </td>

                      {/* Decision Details */}
                      <td>
                        {isPending ? (
                          <span className="wfh-pending-hint">Awaiting review</span>
                        ) : isWithdrawn ? (
                          <div className="wfh-decision-cell">
                            <div className="wfh-decided-at">
                              Withdrawn {formatDate(item.withdrawn_at || item.updatedAt)}
                            </div>
                            <span className="wfh-pending-hint">Cancelled by employee</span>
                          </div>
                        ) : (
                          <div className="wfh-decision-cell">
                            <div className="wfh-decided-at">
                              {formatDate(item.decided_at)}
                            </div>
                            {item.decided_by?.name && (
                              <div className="wfh-decided-by">
                                by {item.decided_by.name}
                              </div>
                            )}
                            {isRejected && item.rejection_reason && (
                              <div
                                className="wfh-rejection-tag"
                                title={item.rejection_reason}
                              >
                                Reason: {item.rejection_reason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="text-right">
                        <div className="wfh-actions-group">
                          {/* View details (accessible to everyone) */}
                          <button
                            className="wfh-action-btn view-btn"
                            onClick={() => openDetailModal(item)}
                            title="View request details"
                          >
                            <FiEye size={15} />
                          </button>

                          {/* Withdraw button (Pending and Owner only) */}
                          {canWithdraw && (
                            <button
                              className="wfh-action-btn withdraw-btn"
                              onClick={() => openWithdrawModal(item)}
                              title="Withdraw this WFH request"
                            >
                              <FiRotateCcw size={14} />
                              <span>Withdraw</span>
                            </button>
                          )}

                          {/* Approve & Reject (STRICTLY Super Admin Only and Pending Only) */}
                          {isSuperAdmin && isPending && (
                            <>
                              <button
                                className="wfh-action-btn approve-btn"
                                onClick={() => openApproveModal(item)}
                                title="Approve WFH Request"
                              >
                                <FiCheck size={15} />
                                <span>Approve</span>
                              </button>

                              <button
                                className="wfh-action-btn reject-btn"
                                onClick={() => openRejectModal(item)}
                                title="Reject WFH Request"
                              >
                                <FiX size={15} />
                                <span>Reject</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 1. Request Details Modal */}
      {/* ============================================================== */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedRequest(null);
        }}
        maxWidth="680px"
      >
        <ModalHeader
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedRequest(null);
          }}
        >
          <div className="wfh-modal-title">
            <FiHome size={20} />
            <span>Work From Home Request Details</span>
          </div>
        </ModalHeader>

        <ModalBody>
          {selectedRequest && (
            <div className="wfh-detail-container">
              {/* Status Header */}
              <div className="wfh-modal-status-bar">
                <span
                  className={`wfh-status-badge ${selectedRequest.status?.toLowerCase()}`}
                >
                  {selectedRequest.status === "Pending" && <FiClock size={13} />}
                  {selectedRequest.status === "Approved" && <FiCheckCircle size={13} />}
                  {selectedRequest.status === "Rejected" && <FiXCircle size={13} />}
                  {selectedRequest.status === "Withdrawn" && <FiRotateCcw size={13} />}
                  {selectedRequest.status}
                </span>
                <span className="wfh-modal-req-date">
                  Requested on {formatDate(selectedRequest.requested_at || selectedRequest.createdAt)}
                </span>
              </div>

              {/* Employee & Org Info */}
              <div className="wfh-modal-info-grid">
                <div className="wfh-info-item">
                  <span className="wfh-info-label">Employee Name</span>
                  <span className="wfh-info-value">
                    {selectedRequest.employee_id?.user_id?.name || "—"}
                  </span>
                </div>

                <div className="wfh-info-item">
                  <span className="wfh-info-label">Employee Code</span>
                  <span className="wfh-info-value">
                    {selectedRequest.employee_id?.employee_code || "—"}
                  </span>
                </div>

                <div className="wfh-info-item">
                  <span className="wfh-info-label">Email Address</span>
                  <span className="wfh-info-value">
                    {selectedRequest.employee_id?.user_id?.email || "—"}
                  </span>
                </div>

                <div className="wfh-info-item">
                  <span className="wfh-info-label">Organization</span>
                  <span className="wfh-info-value">
                    {selectedRequest.organizationId?.name || "—"}
                  </span>
                </div>
              </div>

              {/* Period Box */}
              <div className="wfh-modal-period-box">
                <div className="wfh-period-dates">
                  <div>
                    <span className="wfh-period-sub">Start Date</span>
                    <h4>{formatDate(selectedRequest.start_date)}</h4>
                  </div>
                  <div className="wfh-period-arrow">&rarr;</div>
                  <div>
                    <span className="wfh-period-sub">End Date</span>
                    <h4>{formatDate(selectedRequest.end_date)}</h4>
                  </div>
                </div>
                <div className="wfh-period-total">
                  <span>Total Duration:</span>
                  <strong>
                    {calculateDays(selectedRequest.start_date, selectedRequest.end_date)}{" "}
                    {calculateDays(selectedRequest.start_date, selectedRequest.end_date) === 1
                      ? "Day"
                      : "Days"}
                  </strong>
                </div>
              </div>

              {/* Reason Box */}
              <div className="wfh-modal-reason-box">
                <label className="wfh-section-label">Reason for Remote Work:</label>
                <div className="wfh-reason-text">{selectedRequest.reason}</div>
              </div>

              {/* Attachments Section */}
              <div className="wfh-modal-attachments-box">
                <label className="wfh-section-label">
                  Attached Supporting Documents (
                  {selectedRequest.attached_files?.length || 0}):
                </label>
                {(!selectedRequest.attached_files ||
                  selectedRequest.attached_files.length === 0) ? (
                  <p className="wfh-no-files-text">No documents were attached to this request.</p>
                ) : (
                  <div className="wfh-files-list">
                    {selectedRequest.attached_files.map((file, idx) => (
                      <div key={idx} className="wfh-file-item">
                        <div className="wfh-file-item-info">
                          <FiFileText size={18} className="wfh-file-icon" />
                          <div>
                            <div className="wfh-filename">{file.file_name}</div>
                            <div className="wfh-filesize">
                              {file.file_size
                                ? `${(file.file_size / (1024 * 1024)).toFixed(2)} MB`
                                : "Attachment"}
                            </div>
                          </div>
                        </div>
                        <button
                          className="wfh-file-download-btn"
                          onClick={() =>
                            handleDownloadFile(
                              selectedRequest._id,
                              idx,
                              file.file_name
                            )
                          }
                          disabled={downloadingId === `${selectedRequest._id}-${idx}`}
                        >
                          <FiDownload size={14} /> Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Decision Section if decided or withdrawn */}
              {selectedRequest.status !== "Pending" && (
                <div
                  className={`wfh-modal-decision-box ${selectedRequest.status.toLowerCase()}`}
                >
                  <label className="wfh-section-label">Decision Summary:</label>
                  <div className="wfh-decision-details">
                    <div>
                      <strong>Outcome:</strong> {selectedRequest.status}
                    </div>
                    {selectedRequest.status === "Withdrawn" ? (
                      <div>
                        <strong>Withdrawn On:</strong>{" "}
                        {formatDate(selectedRequest.withdrawn_at || selectedRequest.updatedAt)}
                        <p style={{ margin: "0.25rem 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                          This request was voluntarily withdrawn by the employee prior to administrative review.
                        </p>
                      </div>
                    ) : (
                      <>
                        {selectedRequest.decided_at && (
                          <div>
                            <strong>Decided On:</strong>{" "}
                            {formatDate(selectedRequest.decided_at)}
                          </div>
                        )}
                        {selectedRequest.decided_by?.name && (
                          <div>
                            <strong>Decided By:</strong>{" "}
                            {selectedRequest.decided_by.name} (Super Admin)
                          </div>
                        )}
                        {selectedRequest.status === "Rejected" &&
                          selectedRequest.rejection_reason && (
                            <div className="wfh-decision-reason-text">
                              <strong>Rejection Reason:</strong>{" "}
                              {selectedRequest.rejection_reason}
                            </div>
                          )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          {/* Quick decision buttons if Super Admin and Pending */}
          {isSuperAdmin && selectedRequest?.status === "Pending" ? (
            <div className="wfh-modal-footer-dual">
              <div className="wfh-footer-actions">
                <Button
                  variant="success"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    openApproveModal(selectedRequest);
                  }}
                >
                  <FiCheck size={16} /> Approve Request
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    openRejectModal(selectedRequest);
                  }}
                >
                  <FiX size={16} /> Reject Request
                </Button>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedRequest(null);
                }}
              >
                Close
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                setIsDetailModalOpen(false);
                setSelectedRequest(null);
              }}
            >
              Close
            </Button>
          )}
        </ModalFooter>
      </Modal>

      {/* ============================================================== */}
      {/* 2. Approve Confirmation Modal (Super Admin Only) */}
      {/* ============================================================== */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => {
          if (!actionLoading) {
            setIsApproveModalOpen(false);
            setSelectedRequest(null);
          }
        }}
        maxWidth="500px"
      >
        <ModalHeader
          onClose={() => {
            if (!actionLoading) {
              setIsApproveModalOpen(false);
              setSelectedRequest(null);
            }
          }}
        >
          <div className="wfh-modal-title success">
            <FiCheckCircle size={20} />
            <span>Approve Work From Home</span>
          </div>
        </ModalHeader>

        <ModalBody>
          {selectedRequest && (
            <div className="wfh-confirm-body">
              <p>
                Are you sure you want to approve the Work From Home request for:
              </p>
              <div className="wfh-confirm-emp-card">
                <strong>
                  {selectedRequest.employee_id?.user_id?.name || "Employee"}
                </strong>
                <span>
                  Dates: {formatDate(selectedRequest.start_date)} &ndash;{" "}
                  {formatDate(selectedRequest.end_date)} (
                  {calculateDays(selectedRequest.start_date, selectedRequest.end_date)}{" "}
                  days)
                </span>
                <span className="wfh-confirm-org">
                  Org: {selectedRequest.organizationId?.name || "Organization"}
                </span>
              </div>
              <p className="wfh-confirm-note">
                An automated notification will be sent directly to the employee.
              </p>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setIsApproveModalOpen(false);
              setSelectedRequest(null);
            }}
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleConfirmApprove}
            disabled={actionLoading}
          >
            {actionLoading ? "Approving..." : "Yes, Approve Request"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ============================================================== */}
      {/* 3. Reject Modal with Reason (Super Admin Only) */}
      {/* ============================================================== */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => {
          if (!actionLoading) {
            setIsRejectModalOpen(false);
            setSelectedRequest(null);
          }
        }}
        maxWidth="540px"
      >
        <ModalHeader
          onClose={() => {
            if (!actionLoading) {
              setIsRejectModalOpen(false);
              setSelectedRequest(null);
            }
          }}
        >
          <div className="wfh-modal-title danger">
            <FiXCircle size={20} />
            <span>Reject Work From Home Request</span>
          </div>
        </ModalHeader>

        <ModalBody>
          {selectedRequest && (
            <div className="wfh-reject-body">
              <p>
                Rejecting request for{" "}
                <strong>
                  {selectedRequest.employee_id?.user_id?.name || "Employee"}
                </strong>{" "}
                ({formatDate(selectedRequest.start_date)} to{" "}
                {formatDate(selectedRequest.end_date)}).
              </p>

              <div className="wfh-form-group">
                <label className="wfh-form-label">
                  Rejection Reason <span className="required">*</span>
                </label>
                <textarea
                  className="wfh-textarea"
                  rows={4}
                  placeholder="Explain why this request is being rejected (required for the employee)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  disabled={actionLoading}
                />
                <span className="wfh-hint">
                  The employee will see this reason in their settings history and notification.
                </span>
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setIsRejectModalOpen(false);
              setSelectedRequest(null);
            }}
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmReject}
            disabled={actionLoading || !rejectionReason.trim()}
          >
            {actionLoading ? "Rejecting..." : "Confirm Rejection"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* ============================================================== */}
      {/* 4. Withdraw Confirmation Modal (Employee Self-Service) */}
      {/* ============================================================== */}
      <ConfirmModal
        isOpen={isWithdrawModalOpen}
        onClose={() => {
          if (!actionLoading) {
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
                Are you sure you want to withdraw your Work From Home request for:
              </p>
              <div className="wfh-confirm-emp-card">
                <strong>
                  Dates: {formatDate(requestToWithdraw.start_date)} &ndash;{" "}
                  {formatDate(requestToWithdraw.end_date)}
                </strong>
                <span>
                  Duration: {calculateDays(requestToWithdraw.start_date, requestToWithdraw.end_date)}{" "}
                  {calculateDays(requestToWithdraw.start_date, requestToWithdraw.end_date) === 1 ? "day" : "days"}
                </span>
                <span>Reason: {requestToWithdraw.reason}</span>
              </div>
              <p className="wfh-confirm-note">
                Once withdrawn, this request will be marked as Withdrawn and removed from the Pending review queue.
              </p>
            </div>
          ) : (
            "Are you sure you want to withdraw this request?"
          )
        }
        confirmText={actionLoading ? "Withdrawing..." : "Yes, Withdraw Request"}
        cancelText="Cancel"
        variant="warning"
        loading={actionLoading}
      />
    </div>
  );
}
