import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiAlertTriangle,
  FiFileText,
  FiImage,
  FiFile,
  FiExternalLink,
  FiFilter,
  FiSearch,
  FiCheck,
  FiX,
  FiInfo,
  FiDownload,
  FiRefreshCw,
  FiRepeat,
} from "react-icons/fi";
import {
  getAllDocuments,
  verifyDocument,
  downloadDocumentFile,
} from "../../services/documentService";
import { getAllEmployees } from "../../services/employeeService";
import { getAllDepartments } from "../../services/profileService";
import Modal, { ModalHeader, ModalBody, ModalFooter } from "../../components/Modal/Modal";
import Button from "../../components/Button/Button";
import Loader from "../../components/Loader/Loader";
import "./DocumentVerification.css";

/**
 * Helper to format date strings cleanly
 */
function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Thumbnail component with authenticated image loading and fallbacks
 */
function DocThumbnail({ doc, onClick, isLarge = false }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const isImage = doc.mime_type && doc.mime_type.startsWith("image/");
  const isPdf = doc.mime_type && doc.mime_type.includes("pdf");

  useEffect(() => {
    let ignore = false;
    let objectUrl = null;

    if (isImage) {
      setLoading(true);
      const token = localStorage.getItem("token");
      fetch(`/api/documents/download/${doc._id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load thumbnail");
          return res.blob();
        })
        .then((blob) => {
          if (!ignore) {
            objectUrl = window.URL.createObjectURL(blob);
            setImgSrc(objectUrl);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!ignore) setLoading(false);
        });
    }

    return () => {
      ignore = true;
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [doc._id, isImage]);

  if (isImage) {
    if (imgSrc) {
      return (
        <div
          className={isLarge ? "reject-modal-preview" : "doc-thumb-box"}
          onClick={onClick}
          title="Click to view full preview"
        >
          <img
            src={imgSrc}
            alt={doc.file_name}
            className={isLarge ? "reject-modal-img" : "doc-thumb-img"}
          />
        </div>
      );
    }
    return (
      <div
        className={isLarge ? "reject-modal-preview" : "doc-thumb-box"}
        onClick={onClick}
        title="Click to preview"
      >
        <div className="doc-thumb-icon other">
          <FiImage size={isLarge ? 34 : 22} />
          <span className="doc-thumb-label">{loading ? "..." : "IMG"}</span>
        </div>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div
        className={isLarge ? "reject-modal-preview" : "doc-thumb-box"}
        onClick={onClick}
        title="Click to preview or download PDF"
      >
        <div className="doc-thumb-icon pdf">
          <FiFileText size={isLarge ? 36 : 22} />
          <span className="doc-thumb-label">PDF</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={isLarge ? "reject-modal-preview" : "doc-thumb-box"}
      onClick={onClick}
      title="Click to download document"
    >
      <div className="doc-thumb-icon other">
        <FiFile size={isLarge ? 36 : 22} />
        <span className="doc-thumb-label">FILE</span>
      </div>
    </div>
  );
}

export default function DocumentVerification() {
  const { user } = useAuth();

  // Data states
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Metadata dropdown options
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Filter States
  const [statusFilter, setStatusFilter] = useState("Pending Verification");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [isAllDocsMode, setIsAllDocsMode] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Action states
  const [verifyingId, setVerifyingId] = useState(null);

  // Reject Modal state
  const [rejectModalDoc, setRejectModalDoc] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectReasonError, setRejectReasonError] = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);

  // Rejection Details View Modal
  const [viewReasonDoc, setViewReasonDoc] = useState(null);

  // Full Preview Modal state
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Fetch reference data (departments & employees) on initial mount
  useEffect(() => {
    let ignore = false;
    Promise.all([
      getAllDepartments().catch(() => ({ departments: [] })),
      getAllEmployees({ page: 1, limit: 200, status: "Active" }).catch(() => ({ employees: [] })),
    ]).then(([deptRes, empRes]) => {
      if (!ignore) {
        setDepartments(deptRes?.departments || []);
        setEmployees(empRes?.employees || empRes?.data || []);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  // Fetch documents whenever filters change
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        status: statusFilter === "ALL" ? "ALL" : statusFilter,
      };

      if (!isAllDocsMode) {
        if (selectedEmployee) params.employeeId = selectedEmployee;
        if (selectedDepartment) params.departmentId = selectedDepartment;
      }

      const res = await getAllDocuments(params);
      setDocuments(res?.documents || []);
    } catch (err) {
      setError(err.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, isAllDocsMode, selectedEmployee, selectedDepartment]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Filtered employees based on department selection
  const filteredEmployees = useMemo(() => {
    if (!selectedDepartment) return employees;
    return employees.filter((emp) => {
      const deptId = emp.department_id?._id || emp.department_id;
      return String(deptId) === String(selectedDepartment);
    });
  }, [employees, selectedDepartment]);

  // Search filter across documents
  const displayedDocuments = useMemo(() => {
    if (!searchTerm.trim()) return documents;
    const lower = searchTerm.toLowerCase();
    return documents.filter((doc) => {
      const fileName = (doc.file_name || "").toLowerCase();
      const category = (doc.category || "").toLowerCase();
      const empName = (
        doc.employee_id?.user_id?.name ||
        doc.employee_id?.name ||
        ""
      ).toLowerCase();
      const empCode = (doc.employee_id?.employeeId || "").toLowerCase();
      return (
        fileName.includes(lower) ||
        category.includes(lower) ||
        empName.includes(lower) ||
        empCode.includes(lower)
      );
    });
  }, [documents, searchTerm]);

  // Computed summary counts
  const pendingCount = useMemo(
    () => documents.filter((d) => d.status === "Pending Verification").length,
    [documents]
  );
  const verifiedCount = useMemo(
    () => documents.filter((d) => d.status === "Verified").length,
    [documents]
  );
  const rejectedCount = useMemo(
    () => documents.filter((d) => d.status === "Rejected").length,
    [documents]
  );

  // Handle "All Documents" Toggle
  const handleToggleAllDocs = () => {
    setIsAllDocsMode(true);
    setSelectedDepartment("");
    setSelectedEmployee("");
  };

  // Handle Department Change
  const handleDepartmentChange = (e) => {
    const deptId = e.target.value;
    setSelectedDepartment(deptId);
    setSelectedEmployee(""); // Reset employee filter on department change
    if (deptId) {
      setIsAllDocsMode(false);
    }
  };

  // Handle Employee Change
  const handleEmployeeChange = (e) => {
    const empId = e.target.value;
    setSelectedEmployee(empId);
    if (empId) {
      setIsAllDocsMode(false);
    }
  };

  // =========================================================================
  // VERIFY ACTION (Immediate PATCH)
  // =========================================================================
  const handleVerify = async (doc) => {
    setVerifyingId(doc._id);
    setError("");
    setSuccess("");

    try {
      const res = await verifyDocument(doc._id, { decision: "Verified" });
      const updatedDoc = res?.document || {
        ...doc,
        status: "Verified",
        verified_by: { _id: user?._id || user?.id, name: user?.name },
        verified_at: new Date().toISOString(),
      };

      // In-place row update without full page reload
      setDocuments((prev) =>
        prev.map((d) => (d._id === doc._id ? { ...d, ...updatedDoc } : d))
      );

      setSuccess(`Document "${doc.file_name}" verified successfully.`);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to verify document");
    } finally {
      setVerifyingId(null);
    }
  };

  // =========================================================================
  // NOT VERIFIED ACTION (Open Modal)
  // =========================================================================
  const handleOpenRejectModal = (doc) => {
    setRejectModalDoc(doc);
    setRejectionReason("");
    setRejectReasonError("");
  };

  const handleCloseRejectModal = () => {
    setRejectModalDoc(null);
    setRejectionReason("");
    setRejectReasonError("");
    setSubmittingReject(false);
  };

  const handleSubmitReject = async (e) => {
    if (e) e.preventDefault();
    const reason = rejectionReason.trim();

    if (!reason) {
      setRejectReasonError("Rejection reason is required.");
      return;
    }
    if (reason.length < 5) {
      setRejectReasonError("Rejection reason must be at least 5 characters long.");
      return;
    }

    setSubmittingReject(true);
    setRejectReasonError("");

    try {
      const res = await verifyDocument(rejectModalDoc._id, {
        decision: "Rejected",
        rejection_reason: reason,
      });

      const updatedDoc = res?.document || {
        ...rejectModalDoc,
        status: "Rejected",
        rejection_reason: reason,
        verified_by: { _id: user?._id || user?.id, name: user?.name },
        verified_at: new Date().toISOString(),
      };

      // Update in-place
      setDocuments((prev) =>
        prev.map((d) =>
          d._id === rejectModalDoc._id ? { ...d, ...updatedDoc } : d
        )
      );

      setSuccess(`Document "${rejectModalDoc.file_name}" marked as Not Verified.`);
      handleCloseRejectModal();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setRejectReasonError(err.message || "Failed to reject document.");
      setSubmittingReject(false);
    }
  };

  // =========================================================================
  // DOCUMENT PREVIEW MODAL
  // =========================================================================
  const handleOpenPreview = async (doc) => {
    setPreviewDoc(doc);
    setLoadingPreview(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/documents/download/${doc._id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load file preview");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
    } catch {
      // Fallback
      setPreviewBlobUrl(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleClosePreview = () => {
    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewDoc(null);
    setPreviewBlobUrl(null);
    setLoadingPreview(false);
  };

  return (
    <div className="doc-verification-page">
      {/* Page Header */}
      <div className="doc-verification-header">
        <div className="doc-verification-title">
          <h1>
            <FiCheckCircle size={26} style={{ color: "#3b82f6" }} />
            Document Verification
          </h1>
          <p>
            Verify identity credentials, academic certificates, and employment records uploaded by employees.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="doc-verification-stats">
          <div className="doc-stat-card doc-stat-pending">
            <div className="doc-stat-icon">
              <FiClock />
            </div>
            <div>
              <div className="doc-stat-val">{pendingCount}</div>
              <div className="doc-stat-label">Pending</div>
            </div>
          </div>
          <div className="doc-stat-card doc-stat-verified">
            <div className="doc-stat-icon">
              <FiCheckCircle />
            </div>
            <div>
              <div className="doc-stat-val">{verifiedCount}</div>
              <div className="doc-stat-label">Verified</div>
            </div>
          </div>
          <div className="doc-stat-card doc-stat-rejected">
            <div className="doc-stat-icon">
              <FiXCircle />
            </div>
            <div>
              <div className="doc-stat-val">{rejectedCount}</div>
              <div className="doc-stat-label">Rejected</div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="emp-alert error" style={{ margin: "0" }}>
          <FiAlertTriangle size={18} /> {error}
        </div>
      )}
      {success && (
        <div className="emp-alert success" style={{ margin: "0" }}>
          <FiCheckCircle size={18} /> {success}
        </div>
      )}

      {/* =====================================================================
          FILTER BAR
          ===================================================================== */}
      <div className="doc-filter-panel">
        <div className="doc-filter-row">
          {/* Status Tabs */}
          <div className="doc-status-tabs">
            {[
              { id: "Pending Verification", label: "Pending Verification", icon: <FiClock size={13} /> },
              { id: "Verified", label: "Verified", icon: <FiCheckCircle size={13} /> },
              { id: "Rejected", label: "Rejected", icon: <FiXCircle size={13} /> },
              { id: "ALL", label: "All Statuses" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`doc-status-tab-btn ${statusFilter === tab.id ? "active" : ""}`}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search bar inside toolbar */}
          <div className="doc-search-wrapper">
            <FiSearch
              size={15}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
              }}
            />
            <input
              type="text"
              className="doc-filter-input"
              style={{ paddingLeft: 32, width: "100%" }}
              placeholder="Search by name, doc, category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="doc-filter-row">
          <div className="doc-filter-controls">
            {/* Control 1: Department / Role */}
            <div className="doc-filter-group">
              <label htmlFor="filter-dept">Department / Role</label>
              <select
                id="filter-dept"
                className="doc-filter-select"
                value={selectedDepartment}
                onChange={handleDepartmentChange}
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.departmentName}
                  </option>
                ))}
              </select>
            </div>

            {/* Control 2: Employee */}
            <div className="doc-filter-group">
              <label htmlFor="filter-emp">Employee</label>
              <select
                id="filter-emp"
                className="doc-filter-select"
                value={selectedEmployee}
                onChange={handleEmployeeChange}
              >
                <option value="">All Employees in Dept</option>
                {filteredEmployees.map((emp) => {
                  const empName = emp.user_id?.name || emp.name || "Employee";
                  const empCode = emp.employeeId ? ` (${emp.employeeId})` : "";
                  return (
                    <option key={emp._id} value={emp._id}>
                      {empName}{empCode}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Control 3: All Documents Toggle Button */}
            <button
              type="button"
              className={`doc-all-btn ${isAllDocsMode ? "active" : ""}`}
              onClick={handleToggleAllDocs}
              title="Clear Employee and Department filters to show all organization documents"
            >
              <FiFilter size={14} />
              All Documents
            </button>

            {/* Refresh */}
            <button
              type="button"
              className="doc-all-btn doc-refresh-btn"
              onClick={fetchDocuments}
              title="Refresh document list"
            >
              <FiRefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          DOCUMENT LIST TABLE
          Columns in Order:
          1. Document Name (file_name + category subtitle + employee info)
          2. Document Image (thumbnail preview / icon / clickable modal)
          3. Action buttons ("Verified" + "Not Verified" for Pending, badges for decided)
          ===================================================================== */}
      <div className="doc-table-card">
        {loading ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <Loader text="Loading documents for verification..." />
          </div>
        ) : displayedDocuments.length === 0 ? (
          <div className="emp-empty-state" style={{ padding: "48px 24px" }}>
            <div className="emp-empty-icon">
              <FiFileText size={40} />
            </div>
            <p style={{ fontWeight: 600, color: "#334155", fontSize: 16 }}>
              No documents match current filters
            </p>
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
              {statusFilter === "Pending Verification"
                ? "There are currently no documents awaiting verification."
                : "Try selecting another status tab or clearing filters."}
            </p>
            {!isAllDocsMode && (
              <Button
                variant="outline"
                size="sm"
                style={{ marginTop: 12 }}
                onClick={handleToggleAllDocs}
              >
                Show All Organization Documents
              </Button>
            )}
          </div>
        ) : (
          <div className="hrms-table-outer">
            <div className="hrms-table-scroll-body">
              <table className="hrms-table">
                <thead>
                  <tr>
                    <th style={{ width: "42%", minWidth: 260 }}>Document Name</th>
                    <th style={{ width: "26%", minWidth: 160 }}>Document Image</th>
                    <th style={{ width: "32%", minWidth: 200, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDocuments.map((doc) => {
                    const emp = doc.employee_id;
                    const empName = emp?.user_id?.name || emp?.name || "Unknown Employee";
                    const empCode = emp?.employeeId ? `[${emp.employeeId}]` : "";
                    const deptName = emp?.department_id?.departmentName || "";

                    const isPending = doc.status === "Pending Verification";
                    const isVerified = doc.status === "Verified";
                    const isRejected = doc.status === "Rejected";

                    return (
                      <tr key={doc._id}>
                        {/* COLUMN 1: Document Name (file_name + category subtitle) */}
                        <td>
                          <div className="doc-info-cell">
                            <span className="doc-primary-name" title={doc.file_name}>
                              {doc.file_name}
                            </span>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <span className="doc-category-tag">{doc.category}</span>
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                Uploaded {formatDate(doc.uploaded_at || doc.createdAt)}
                              </span>
                            </div>
                            <div className="doc-employee-meta">
                              <strong>{empName}</strong> {empCode}
                              {deptName && <span>· {deptName}</span>}
                            </div>
                          </div>
                        </td>

                        {/* COLUMN 2: Document Image (thumbnail preview for image/pdf-first-page or icon) */}
                        <td>
                          <div className="doc-thumbnail-cell">
                            <DocThumbnail doc={doc} onClick={() => handleOpenPreview(doc)} />
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <button
                                type="button"
                                className="doc-preview-trigger-btn"
                                onClick={() => handleOpenPreview(doc)}
                                title="Click to view file preview"
                              >
                                <FiExternalLink size={12} />
                                View Preview
                              </button>
                              <button
                                type="button"
                                className="doc-preview-trigger-btn"
                                style={{ color: "#64748b" }}
                                onClick={() => downloadDocumentFile(doc._id, doc.file_name)}
                                title="Download copy"
                              >
                                <FiDownload size={12} />
                                Download
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* COLUMN 3: Actions ("Verified" and "Not Verified" buttons or read-only status badge) */}
                        <td>
                          <div
                            className="doc-actions-cell"
                            style={{ justifyContent: "flex-end" }}
                          >
                            {isPending ? (
                              <>
                                <button
                                  type="button"
                                  className="btn-verify"
                                  disabled={verifyingId === doc._id}
                                  onClick={() => handleVerify(doc)}
                                  title="Approve and mark document as Verified"
                                >
                                  <FiCheck size={14} />
                                  {verifyingId === doc._id ? "Verifying..." : "Verified"}
                                </button>
                                <button
                                  type="button"
                                  className="btn-reject"
                                  disabled={verifyingId === doc._id}
                                  onClick={() => handleOpenRejectModal(doc)}
                                  title="Reject document with feedback reason"
                                >
                                  <FiX size={14} />
                                  Not Verified
                                </button>
                              </>
                            ) : isVerified ? (
                              <>
                                <span
                                  className="verification-badge badge-verified"
                                  title={`Verified by ${doc.verified_by?.name || "HR Staff"} on ${formatDate(
                                    doc.verified_at
                                  )}`}
                                >
                                  <FiCheckCircle size={13} />
                                  Verified
                                </span>
                                <button
                                  type="button"
                                  className="btn-change-decision"
                                  onClick={() => handleOpenRejectModal(doc)}
                                  title="Change decision to Rejected"
                                >
                                  <FiRepeat size={11} />
                                  Change decision
                                </button>
                              </>
                            ) : isRejected ? (
                              <>
                                <span
                                  className="verification-badge badge-rejected"
                                  onClick={() => setViewReasonDoc(doc)}
                                  title={
                                    doc.rejection_reason
                                      ? `Reason: ${doc.rejection_reason} (Click for details)`
                                      : "Click to view details"
                                  }
                                >
                                  <FiXCircle size={13} />
                                  Rejected
                                  <FiInfo size={12} style={{ marginLeft: 2 }} />
                                </span>
                                <button
                                  type="button"
                                  className="btn-change-decision"
                                  disabled={verifyingId === doc._id}
                                  onClick={() => handleVerify(doc)}
                                  title="Change decision to Verified"
                                >
                                  <FiRepeat size={11} />
                                  Change decision
                                </button>
                              </>
                            ) : (
                              <span className="verification-badge badge-expired">
                                {doc.status}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          NOT VERIFIED ACTION MODAL
          ===================================================================== */}
      {rejectModalDoc && (
        <Modal
          isOpen={Boolean(rejectModalDoc)}
          onClose={handleCloseRejectModal}
          size="md"
        >
          <ModalHeader
            title="Mark Document as Not Verified"
            onClose={handleCloseRejectModal}
          />
          <ModalBody>
            <form onSubmit={handleSubmitReject} className="reject-modal-content">
              {/* Document Summary */}
              <div className="reject-modal-doc-summary">
                <DocThumbnail
                  doc={rejectModalDoc}
                  isLarge={true}
                  onClick={() => handleOpenPreview(rejectModalDoc)}
                />
                <div className="reject-modal-meta">
                  <div className="reject-modal-filename">
                    {rejectModalDoc.file_name}
                  </div>
                  <div className="reject-modal-category">
                    Category: <strong>{rejectModalDoc.category}</strong>
                  </div>
                  <div className="reject-modal-employee">
                    Employee:{" "}
                    <strong>
                      {rejectModalDoc.employee_id?.user_id?.name ||
                        rejectModalDoc.employee_id?.name ||
                        "Employee"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Rejection Reason Input */}
              <div className="reject-reason-group">
                <label htmlFor="rejection-reason-textarea">
                  Reason for Rejection <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea
                  id="rejection-reason-textarea"
                  rows={4}
                  className={`reject-reason-textarea ${
                    rejectReasonError ? "has-error" : ""
                  }`}
                  placeholder="Explain why this document was not verified (e.g. illegible scan, expired document, incorrect category, name mismatch)..."
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    if (rejectReasonError && e.target.value.trim().length >= 5) {
                      setRejectReasonError("");
                    }
                  }}
                  autoFocus
                />
                {rejectReasonError ? (
                  <span className="reject-error-msg">{rejectReasonError}</span>
                ) : (
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>
                    Minimum 5 characters. The employee will receive this feedback.
                  </span>
                )}
              </div>
            </form>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              size="md"
              disabled={submittingReject}
              onClick={handleCloseRejectModal}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              disabled={submittingReject || !rejectionReason.trim()}
              onClick={handleSubmitReject}
            >
              {submittingReject ? "Sending..." : "Send"}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* =====================================================================
          REJECTION DETAILS MODAL (When clicking a Rejected badge)
          ===================================================================== */}
      {viewReasonDoc && (
        <Modal
          isOpen={Boolean(viewReasonDoc)}
          onClose={() => setViewReasonDoc(null)}
          size="sm"
        >
          <ModalHeader
            title="Rejection Feedback Details"
            onClose={() => setViewReasonDoc(null)}
          />
          <ModalBody>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                {viewReasonDoc.file_name}
              </div>
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  padding: 14,
                  color: "#991b1b",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Reason Provided:
                </div>
                {viewReasonDoc.rejection_reason || "No specific reason provided."}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Reviewed by:{" "}
                <strong>
                  {viewReasonDoc.verified_by?.name || "HR Staff"}
                </strong>{" "}
                on {formatDate(viewReasonDoc.verified_at)}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewReasonDoc(null)}
            >
              Close
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* =====================================================================
          DOCUMENT FULL PREVIEW MODAL
          ===================================================================== */}
      {previewDoc && (
        <Modal
          isOpen={Boolean(previewDoc)}
          onClose={handleClosePreview}
          size="lg"
        >
          <ModalHeader
            title={`Preview: ${previewDoc.file_name}`}
            onClose={handleClosePreview}
          />
          <ModalBody>
            <div className="full-preview-container">
              {loadingPreview ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <Loader text="Loading document preview..." />
                </div>
              ) : previewBlobUrl && previewDoc.mime_type?.startsWith("image/") ? (
                <img
                  src={previewBlobUrl}
                  alt={previewDoc.file_name}
                  className="full-preview-img"
                />
              ) : previewBlobUrl && previewDoc.mime_type?.includes("pdf") ? (
                <iframe
                  src={previewBlobUrl}
                  title={previewDoc.file_name}
                  className="full-preview-frame"
                />
              ) : (
                <div style={{ textAlign: "center", padding: 30 }}>
                  <FiFileText size={56} style={{ color: "#64748b" }} />
                  <p style={{ marginTop: 12, fontWeight: 600, color: "#334155" }}>
                    Inline preview not supported for this file type ({previewDoc.mime_type || "document"}).
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    style={{ marginTop: 14 }}
                    icon={<FiDownload size={14} />}
                    onClick={() => downloadDocumentFile(previewDoc._id, previewDoc.file_name)}
                  >
                    Download File to View
                  </Button>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                Category: <strong>{previewDoc.category}</strong>
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<FiDownload size={14} />}
                  onClick={() => downloadDocumentFile(previewDoc._id, previewDoc.file_name)}
                >
                  Download
                </Button>
                <Button variant="primary" size="sm" onClick={handleClosePreview}>
                  Done
                </Button>
              </div>
            </div>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
