import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/permission";
import {
  FiUploadCloud,
  FiFileText,
  FiImage,
  FiFile,
  FiDownload,
  FiTrash2,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiPlus,
  FiX,
  FiFilter,
  FiCheck,
} from "react-icons/fi";
import {
  uploadDocument,
  getEmployeeDocuments,
  downloadDocumentFile,
  deleteDocument,
  verifyDocument,
} from "../../services/documentService.js";
import Button from "../Button/Button";
import Modal from "../Modal/Modal";
import Loader from "../Loader/Loader";
import "./DocumentManager.css";

const CATEGORIES = [
  "ID Proof",
  "Educational Certificate",
  "Offer Letter",
  "Relieving Letter",
  "Payslip",
  "Contract",
  "Other",
];

function formatBytes(bytes, decimals = 1) {
  if (!bytes) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getFileIcon(mimeType = "") {
  if (mimeType.includes("pdf")) {
    return (
      <div className="doc-icon-wrapper doc-icon-pdf">
        <FiFileText size={22} />
      </div>
    );
  }
  if (mimeType.includes("image")) {
    return (
      <div className="doc-icon-wrapper doc-icon-image">
        <FiImage size={22} />
      </div>
    );
  }
  if (
    mimeType.includes("word") ||
    mimeType.includes("officedocument") ||
    mimeType.includes("doc")
  ) {
    return (
      <div className="doc-icon-wrapper doc-icon-word">
        <FiFileText size={22} />
      </div>
    );
  }
  return (
    <div className="doc-icon-wrapper doc-icon-other">
      <FiFile size={22} />
    </div>
  );
}

function getExpiryStatus(expiryDate, status, rejectionReason) {
  if (status === "Archived") {
    return { label: "Archived", className: "doc-badge-archived" };
  }
  if (status === "Rejected") {
    return {
      label: "Rejected",
      className: "doc-badge-rejected",
      icon: <FiAlertTriangle size={12} />,
      tooltip: rejectionReason ? `Rejection Reason: ${rejectionReason}` : "Document Rejected (click to view details)",
    };
  }
  if (status === "Pending Verification") {
    return {
      label: "Pending Verification",
      className: "doc-badge-pending",
      icon: <FiClock size={12} />,
      tooltip: "Awaiting HR/Admin Verification",
    };
  }
  if (status === "Verified") {
    if (expiryDate && new Date(expiryDate) < new Date()) {
      return {
        label: "Expired",
        className: "doc-badge-expired",
        icon: <FiAlertTriangle size={12} />,
        tooltip: "Document expired",
      };
    }
    return {
      label: "Verified",
      className: "doc-badge-verified",
      icon: <FiCheckCircle size={12} />,
      tooltip: "Document Verified by HR",
    };
  }
  if (!expiryDate) {
    return { label: status || "Active", className: "doc-badge-active" };
  }

  const now = new Date();
  const exp = new Date(expiryDate);
  const diffTime = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0 || status === "Expired") {
    return {
      label: `Expired (${Math.abs(diffDays)}d ago)`,
      className: "doc-badge-expired",
      icon: <FiAlertTriangle size={12} />,
    };
  }
  if (diffDays <= 30) {
    return {
      label: `Expiring in ${diffDays}d`,
      className: "doc-badge-expiring",
      icon: <FiClock size={12} />,
    };
  }
  return {
    label: "Active",
    className: "doc-badge-active",
    icon: <FiCheckCircle size={12} />,
  };
}

export default function DocumentManager({ employeeId, canManage = true }) {
  const { user } = useAuth();
  const userRole = normalizeRole(user?.role);
  const isStaff = userRole === "admin" || userRole === "hr_manager";

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Verification states
  const [verifyingId, setVerifyingId] = useState(null);
  const [rejectDoc, setRejectDoc] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [activeReasonModal, setActiveReasonModal] = useState(null);

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState(CATEGORIES[0]);
  const [uploadExpiry, setUploadExpiry] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Delete modal state
  const [deleteDoc, setDeleteDoc] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Download state
  const [downloadingId, setDownloadingId] = useState(null);

  const handleVerify = async (docId) => {
    try {
      setVerifyingId(docId);
      setError("");
      await verifyDocument(docId, { decision: "Verified" });
      setSuccess("Document verified successfully!");
      fetchDocuments();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to verify document");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectDoc) return;
    if (!rejectionReason.trim()) {
      setError("Please provide a rejection reason.");
      return;
    }
    try {
      setRejecting(true);
      setError("");
      await verifyDocument(rejectDoc._id, {
        decision: "Rejected",
        rejection_reason: rejectionReason.trim(),
      });
      setSuccess("Document marked as Rejected.");
      setRejectDoc(null);
      setRejectionReason("");
      fetchDocuments();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to reject document");
    } finally {
      setRejecting(false);
    }
  };

  const fetchDocuments = useCallback(async () => {
    if (!employeeId) return;
    try {
      setError("");
      const params = {};
      if (selectedCategory !== "ALL") params.category = selectedCategory;
      if (selectedStatus !== "ALL") params.status = selectedStatus;

      const data = await getEmployeeDocuments(employeeId, params);
      setDocuments(data?.documents || []);
    } catch (err) {
      setError(err.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [employeeId, selectedCategory, selectedStatus]);

  useEffect(() => {
    let ignore = false;
    if (!employeeId) return;
    const params = {};
    if (selectedCategory !== "ALL") params.category = selectedCategory;
    if (selectedStatus !== "ALL") params.status = selectedStatus;

    getEmployeeDocuments(employeeId, params)
      .then((data) => {
        if (!ignore) {
          setDocuments(data?.documents || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "Failed to load documents");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [employeeId, selectedCategory, selectedStatus]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select a file to upload.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("employee_id", employeeId);
      formData.append("category", uploadCategory);
      if (uploadExpiry) {
        formData.append("expiry_date", uploadExpiry);
      }

      await uploadDocument(formData);
      setSuccess("Document uploaded successfully!");
      setUploadOpen(false);
      setSelectedFile(null);
      setUploadExpiry("");
      fetchDocuments();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      setDownloadingId(doc._id);
      await downloadDocumentFile(doc._id, doc.file_name);
    } catch (err) {
      setError(err.message || "Failed to download file");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDoc) return;
    try {
      setDeleting(true);
      await deleteDocument(deleteDoc._id);
      setSuccess("Document archived successfully.");
      setDeleteDoc(null);
      fetchDocuments();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to delete document");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="doc-manager-container">
      {/* Top Header & Toolbar */}
      <div className="doc-manager-header">
        <div className="doc-manager-title">
          <h3>Employee Documents</h3>
          <p>Manage ID proofs, certificates, employment letters, and contracts.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              icon={<FiPlus size={16} />}
              onClick={() => setUploadOpen(true)}
              id="upload-doc-btn"
            >
              Upload Document
            </Button>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="emp-alert error" style={{ margin: "4px 0" }}>
          <FiAlertTriangle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="emp-alert success" style={{ margin: "4px 0" }}>
          <FiCheckCircle size={16} /> {success}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="doc-filter-bar">
        <span style={{ fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
          <FiFilter size={14} /> Filter:
        </span>
        <select
          className="doc-filter-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="ALL">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className="doc-filter-select"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          aria-label="Filter by status"
          id="doc-filter-status"
        >
          <option value="ALL">All Statuses</option>
          <option value="Pending Verification">Pending</option>
          <option value="Verified">Verified</option>
          <option value="Rejected">Rejected</option>
          <option value="Expired">Expired</option>
          <option value="Archived">Archived</option>
        </select>
      </div>

      {/* Content Grid or Loader */}
      {loading ? (
        <div style={{ padding: "32px 0", textAlign: "center" }}>
          <Loader text="Loading documents..." />
        </div>
      ) : documents.length === 0 ? (
        <div className="emp-empty-state" style={{ padding: 40, border: "1px dashed #cbd5e1", borderRadius: 12 }}>
          <div className="emp-empty-icon">
            <FiFileText size={42} />
          </div>
          <p style={{ fontWeight: 600, color: "#475569" }}>No documents found</p>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
            {canManage
              ? "Upload government IDs, academic credentials, or employment letters."
              : "No documents have been uploaded to this profile yet."}
          </p>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              style={{ marginTop: 14 }}
              icon={<FiPlus size={15} />}
              onClick={() => setUploadOpen(true)}
            >
              Upload First Document
            </Button>
          )}
        </div>
      ) : (
        <div className="doc-grid">
          {documents.map((doc) => {
            const expiry = getExpiryStatus(
              doc.expiry_date,
              doc.status,
              doc.rejection_reason
            );
            return (
              <div key={doc._id} className="doc-card">
                <div>
                  <div className="doc-card-top">
                    {getFileIcon(doc.mime_type)}
                    <div className="doc-card-meta">
                      <div className="doc-card-name" title={doc.file_name}>
                        {doc.file_name}
                      </div>
                      <div className="doc-card-category">{doc.category}</div>
                      <div className="doc-card-size">{formatBytes(doc.file_size)}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <span
                      className={`doc-badge ${expiry.className}`}
                      title={expiry.tooltip || expiry.label}
                      onClick={() => {
                        if (doc.status === "Rejected") {
                          setActiveReasonModal(doc);
                        }
                      }}
                    >
                      {expiry.icon}
                      {expiry.label}
                    </span>
                  </div>

                  {/* Rejection callout for employee/staff view */}
                  {doc.status === "Rejected" && doc.rejection_reason && (
                    <div
                      className="doc-rejection-callout"
                      onClick={() => setActiveReasonModal(doc)}
                      title="Click to view full rejection details"
                      style={{ cursor: "pointer" }}
                    >
                      <strong>Reason:</strong> {doc.rejection_reason}
                    </div>
                  )}

                  {/* Verified metadata */}
                  {doc.status === "Verified" && (
                    <div style={{ fontSize: 11, color: "#15803d", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <FiCheckCircle size={12} />
                      Verified {doc.verified_by?.name ? `by ${doc.verified_by.name}` : ""}{doc.verified_at ? ` · ${formatDate(doc.verified_at)}` : ""}
                    </div>
                  )}

                  <div className="doc-card-details" style={{ marginTop: 10 }}>
                    <div>
                      <strong>Uploaded:</strong> {formatDate(doc.uploaded_at || doc.createdAt)}
                    </div>
                    {doc.expiry_date && (
                      <div>
                        <strong>Expires:</strong> {formatDate(doc.expiry_date)}
                      </div>
                    )}
                    {doc.uploaded_by?.name && (
                      <div>
                        <strong>By:</strong> {doc.uploaded_by.name}
                      </div>
                    )}
                  </div>
                </div>

                <div className="doc-card-actions">
                  {/* HR/Admin Verify & Reject buttons for Pending Verification documents */}
                  {isStaff && doc.status === "Pending Verification" && (
                    <>
                      <Button
                        variant="primary"
                        className="doc-verify-btn"
                        size="sm"
                        loading={verifyingId === doc._id}
                        icon={<FiCheck size={14} />}
                        onClick={() => handleVerify(doc._id)}
                        title="Verify this document"
                      >
                        Verify
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<FiX size={14} />}
                        onClick={() => {
                          setRejectDoc(doc);
                          setRejectionReason("");
                        }}
                        title="Reject this document"
                      >
                        Reject
                      </Button>
                    </>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    loading={downloadingId === doc._id}
                    icon={<FiDownload size={14} />}
                    onClick={() => handleDownload(doc)}
                    title="Download document"
                  >
                    Download
                  </Button>
                  {canManage && doc.status !== "Archived" && (
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<FiTrash2 size={14} />}
                      onClick={() => setDeleteDoc(doc)}
                      title="Archive document"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Document Modal */}
      <Modal
        isOpen={uploadOpen}
        onClose={() => !uploading && setUploadOpen(false)}
        title="Upload Employee Document"
        size="md"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => setUploadOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={uploading}
              disabled={!selectedFile}
              onClick={handleUploadSubmit}
            >
              Upload Document
            </Button>
          </div>
        }
      >
        <form onSubmit={handleUploadSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Drag and Drop Zone */}
            <div
              className={`doc-dropzone ${isDragActive ? "drag-active" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              />
              <div className="doc-dropzone-icon">
                <FiUploadCloud size={36} />
              </div>
              <div className="doc-dropzone-text">
                {selectedFile ? "Click or drag to change file" : "Choose a file or drag & drop it here"}
              </div>
              <div className="doc-dropzone-hint">
                Supported: PDF, JPG, PNG, DOCX (Max 10MB)
              </div>
            </div>

            {selectedFile && (
              <div className="doc-selected-file">
                <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                  <FiFileText size={18} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedFile.name} ({formatBytes(selectedFile.size)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#4f46e5" }}
                >
                  <FiX size={16} />
                </button>
              </div>
            )}

            {/* Category picker */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Document Category <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                className="doc-filter-select"
                style={{ width: "100%", padding: "10px 14px", fontSize: 14 }}
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                required
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Expiry Date picker (optional) */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Expiry Date <span style={{ fontSize: 12, fontWeight: 400, color: "#94a3b8" }}>(Optional, e.g. for visas, certifications)</span>
              </label>
              <input
                type="date"
                className="doc-filter-select"
                style={{ width: "100%", padding: "10px 14px", fontSize: 14 }}
                value={uploadExpiry}
                onChange={(e) => setUploadExpiry(e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteDoc}
        onClose={() => !deleting && setDeleteDoc(null)}
        title="Archive Document?"
        size="sm"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={deleting}
              onClick={() => setDeleteDoc(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleting}
              onClick={handleDeleteConfirm}
            >
              Archive
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: 14, color: "#475569", margin: 0 }}>
          Are you sure you want to archive <strong>{deleteDoc?.file_name}</strong>?
          The file will be soft-deleted and removed from active employee views.
        </p>
      </Modal>

      {/* Reject Reason Modal for HR/Admin */}
      <Modal
        isOpen={!!rejectDoc}
        onClose={() => !rejecting && setRejectDoc(null)}
        title="Reject Document"
        size="sm"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={rejecting}
              onClick={() => setRejectDoc(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={rejecting}
              disabled={!rejectionReason.trim()}
              onClick={handleRejectConfirm}
              id="confirm-reject-btn"
            >
              Confirm Rejection
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>
            Please state the rejection reason for <strong>{rejectDoc?.file_name}</strong>:
          </p>
          <textarea
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g. Incomplete scan, missing stamp, blurred name, expired ID..."
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
            }}
            id="rejection-reason-input"
            autoFocus
          />
        </div>
      </Modal>

      {/* View Rejection Details Modal for Employee */}
      <Modal
        isOpen={!!activeReasonModal}
        onClose={() => setActiveReasonModal(null)}
        title="Document Rejection Details"
        size="sm"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setActiveReasonModal(null)}>
            Close
          </Button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#dc2626" }}>
            <FiAlertTriangle size={20} />
            <strong style={{ fontSize: 15 }}>This document was rejected</strong>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            Document: <strong>{activeReasonModal?.file_name}</strong> ({activeReasonModal?.category})
          </p>
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: 12,
              color: "#991b1b",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <strong>Reason:</strong> {activeReasonModal?.rejection_reason || "No specific reason provided."}
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
            Please upload a corrected version or contact HR if you have questions.
          </p>
        </div>
      </Modal>
    </div>
  );
}
