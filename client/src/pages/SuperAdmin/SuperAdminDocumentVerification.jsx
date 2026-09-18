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
  FiLayers,
  FiUserCheck,
} from "react-icons/fi";
import {
  getAllDocuments,
  getHrUploaders,
  verifyDocument,
  downloadDocumentFile,
} from "../../services/documentService";
import { getOrganizations } from "../../services/superAdminService";
import Modal, { ModalHeader, ModalBody, ModalFooter } from "../../components/Modal/Modal";
import Button from "../../components/Button/Button";
import Loader from "../../components/Loader/Loader";
import "./SuperAdminDocumentVerification.css";

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

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
          className={isLarge ? "reject-modal-preview" : "sa-doc-thumb-box"}
          onClick={onClick}
          title="Click to view full preview"
        >
          <img
            src={imgSrc}
            alt={doc.file_name}
            className={isLarge ? "reject-modal-img" : "sa-doc-thumb-img"}
          />
        </div>
      );
    }
    return (
      <div
        className={isLarge ? "reject-modal-preview" : "sa-doc-thumb-box"}
        onClick={onClick}
        title="Click to preview"
      >
        <div className="sa-doc-thumb-icon other">
          <FiImage size={isLarge ? 34 : 22} />
          <span className="sa-doc-thumb-label">{loading ? "..." : "IMG"}</span>
        </div>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div
        className={isLarge ? "reject-modal-preview" : "sa-doc-thumb-box"}
        onClick={onClick}
        title="Click to preview PDF"
      >
        <div className="sa-doc-thumb-icon pdf">
          <FiFileText size={isLarge ? 36 : 22} />
          <span className="sa-doc-thumb-label">PDF</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={isLarge ? "reject-modal-preview" : "sa-doc-thumb-box"}
      onClick={onClick}
      title="Click to download document"
    >
      <div className="sa-doc-thumb-icon other">
        <FiFile size={isLarge ? 36 : 22} />
        <span className="sa-doc-thumb-label">FILE</span>
      </div>
    </div>
  );
}

export default function SuperAdminDocumentVerification() {
  const { user } = useAuth();

  // Data states
  const [documents, setDocuments] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [hrUploaders, setHrUploaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filter Bar Controls (in exact order: HR name, Organization name, All Documents)
  const [selectedHrId, setSelectedHrId] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [isAllDocsMode, setIsAllDocsMode] = useState(true);
  const [statusFilter, setStatusFilter] = useState("Pending Verification");
  const [searchTerm, setSearchTerm] = useState("");

  // Action states
  const [verifyingId, setVerifyingId] = useState(null);

  // Reject Modal state
  const [rejectModalDoc, setRejectModalDoc] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectReasonError, setRejectReasonError] = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);

  // View Rejection Reason Modal
  const [viewReasonDoc, setViewReasonDoc] = useState(null);

  // Full Preview Modal state
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // 1. Initial Reference Data Loading (Organizations & HR Uploaders)
  useEffect(() => {
    let ignore = false;
    Promise.all([
      getOrganizations().catch(() => ({ organizations: [] })),
      getHrUploaders().catch(() => ({ hrUploaders: [] })),
    ]).then(([orgRes, hrRes]) => {
      if (!ignore) {
        setOrganizations(orgRes?.organizations || []);
        setHrUploaders(hrRes?.hrUploaders || []);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  // 2. Fetch HR-Uploaded Documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        status: statusFilter === "ALL" ? "ALL" : statusFilter,
      };

      if (!isAllDocsMode) {
        if (selectedOrgId) params.organizationId = selectedOrgId;
        if (selectedHrId) params.uploaderId = selectedHrId;
      }

      const res = await getAllDocuments(params);
      setDocuments(res?.documents || []);
    } catch (err) {
      setError(err.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, isAllDocsMode, selectedOrgId, selectedHrId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // When organization is selected, narrow the HR name dropdown to that org's HR users
  const filteredHrUploaders = useMemo(() => {
    if (!selectedOrgId) return hrUploaders;
    return hrUploaders.filter((hr) => {
      const orgId = hr.organizationId?._id || hr.organizationId;
      return String(orgId) === String(selectedOrgId);
    });
  }, [hrUploaders, selectedOrgId]);

  // Combined In-Table Search Filter
  const displayedDocuments = useMemo(() => {
    if (!searchTerm.trim()) return documents;
    const lower = searchTerm.toLowerCase();
    return documents.filter((doc) => {
      const fileName = (doc.file_name || "").toLowerCase();
      const category = (doc.category || "").toLowerCase();
      const uploaderName = (doc.uploaded_by?.name || "").toLowerCase();
      const orgName = (
        doc.organizationId?.name ||
        doc.uploaded_by?.organizationId?.name ||
        ""
      ).toLowerCase();
      return (
        fileName.includes(lower) ||
        category.includes(lower) ||
        uploaderName.includes(lower) ||
        orgName.includes(lower)
      );
    });
  }, [documents, searchTerm]);

  // Summary counts
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

  // Control Handlers
  const handleHrChange = (e) => {
    const hrId = e.target.value;
    setSelectedHrId(hrId);
    if (hrId) {
      setIsAllDocsMode(false);
    }
  };

  const handleOrgChange = (e) => {
    const orgId = e.target.value;
    setSelectedOrgId(orgId);
    setSelectedHrId(""); // Reset HR filter on org change
    if (orgId) {
      setIsAllDocsMode(false);
    }
  };

  const handleToggleAllDocs = () => {
    setIsAllDocsMode(true);
    setSelectedOrgId("");
    setSelectedHrId("");
  };

  // =========================================================================
  // 4. VERIFIED ACTION (Immediate PATCH)
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
        verified_by: { _id: user?._id || user?.id, name: user?.name || "Platform Admin" },
        verified_at: new Date().toISOString(),
      };

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
  // 5. REJECT ACTION — MODAL
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
        verified_by: { _id: user?._id || user?.id, name: user?.name || "Platform Admin" },
        verified_at: new Date().toISOString(),
      };

      setDocuments((prev) =>
        prev.map((d) =>
          d._id === rejectModalDoc._id ? { ...d, ...updatedDoc } : d
        )
      );

      setSuccess(`Document "${rejectModalDoc.file_name}" marked as Rejected.`);
      handleCloseRejectModal();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setRejectReasonError(err.message || "Failed to reject document.");
      setSubmittingReject(false);
    }
  };

  // Preview Modal
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
    <div className="sa-doc-page">
      {/* Top Header */}
      <div className="sa-doc-header">
        <div className="sa-doc-title">
          <h1>
            <FiCheckCircle size={26} style={{ color: "#4f46e5" }} />
            Platform Document Verification
          </h1>
          <p>
            Review and verify compliance documents and corporate credentials uploaded by Organization HR and Admin users.
          </p>
        </div>

        {/* Status Count Stats */}
        <div className="sa-doc-stats">
          <div className="sa-doc-stat-card sa-doc-stat-pending">
            <div className="sa-doc-stat-icon">
              <FiClock />
            </div>
            <div>
              <div className="sa-doc-stat-val">{pendingCount}</div>
              <div className="sa-doc-stat-label">Pending Verification</div>
            </div>
          </div>
          <div className="sa-doc-stat-card sa-doc-stat-verified">
            <div className="sa-doc-stat-icon">
              <FiCheckCircle />
            </div>
            <div>
              <div className="sa-doc-stat-val">{verifiedCount}</div>
              <div className="sa-doc-stat-label">Verified</div>
            </div>
          </div>
          <div className="sa-doc-stat-card sa-doc-stat-rejected">
            <div className="sa-doc-stat-icon">
              <FiXCircle />
            </div>
            <div>
              <div className="sa-doc-stat-val">{rejectedCount}</div>
              <div className="sa-doc-stat-label">Rejected</div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div className="emp-alert error" style={{ margin: 0 }}>
          <FiAlertTriangle size={18} /> {error}
        </div>
      )}
      {success && (
        <div className="emp-alert success" style={{ margin: 0 }}>
          <FiCheckCircle size={18} /> {success}
        </div>
      )}

      {/* =====================================================================
          2. TOP FILTER BAR — Three controls in exact order:
             1. "HR name" (searchable dropdown of admin/hr_manager uploaders)
             2. "Organization name" (dropdown of all orgs)
             3. "All Documents" (clears both filters)
          ===================================================================== */}
      <div className="sa-doc-filter-panel">
        <div className="sa-doc-filter-row">
          {/* Status Tabs */}
          <div className="sa-doc-status-tabs">
            {[
              { id: "Pending Verification", label: "Pending Verification", icon: <FiClock size={13} /> },
              { id: "Verified", label: "Verified", icon: <FiCheckCircle size={13} /> },
              { id: "Rejected", label: "Rejected", icon: <FiXCircle size={13} /> },
              { id: "ALL", label: "All Statuses" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`sa-doc-status-tab-btn ${statusFilter === tab.id ? "active" : ""}`}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search bar inside toolbar */}
          <div className="sa-doc-search-wrapper">
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
              className="sa-doc-filter-input"
              style={{ paddingLeft: 32, width: "100%" }}
              placeholder="Search by file, category, HR, org..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="sa-doc-filter-row">
          <div className="sa-doc-filter-controls">
            {/* Control 1: HR name */}
            <div className="sa-doc-filter-group">
              <label htmlFor="sa-filter-hr">HR name</label>
              <select
                id="sa-filter-hr"
                className="sa-doc-filter-select"
                value={selectedHrId}
                onChange={handleHrChange}
              >
                <option value="">All HR / Admins</option>
                {filteredHrUploaders.map((hr) => {
                  const orgName = hr.organizationId?.name || "No Org";
                  return (
                    <option key={hr._id} value={hr._id}>
                      {hr.name} ({orgName})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Control 2: Organization name */}
            <div className="sa-doc-filter-group">
              <label htmlFor="sa-filter-org">Organization name</label>
              <select
                id="sa-filter-org"
                className="sa-doc-filter-select"
                value={selectedOrgId}
                onChange={handleOrgChange}
              >
                <option value="">All Organizations</option>
                {organizations.map((org) => (
                  <option key={org._id} value={org._id}>
                    {org.name} {org.orgCode ? `(${org.orgCode})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Control 3: All Documents */}
            <button
              type="button"
              className={`sa-doc-all-btn ${isAllDocsMode ? "active" : ""}`}
              onClick={handleToggleAllDocs}
              title="Clear HR and Organization filters to view all HR-uploaded documents"
            >
              <FiFilter size={14} />
              All Documents
            </button>

            {/* Refresh button */}
            <button
              type="button"
              className="sa-doc-all-btn sa-doc-refresh-btn"
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
          3. DOCUMENT TABLE — Columns in exact order:
             1. Document Name (file_name, category subtitle, uploader + org)
             2. Document Image (thumbnail preview / icon / clickable preview modal)
             3. Actions (Pending: "Verified" + "Reject"; Decided: read-only badge + "Change decision")
          ===================================================================== */}
      <div className="sa-doc-table-card">
        {loading ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <Loader text="Loading HR documents for verification..." />
          </div>
        ) : displayedDocuments.length === 0 ? (
          <div className="emp-empty-state" style={{ padding: "48px 24px" }}>
            <div className="emp-empty-icon">
              <FiFileText size={40} />
            </div>
            <p style={{ fontWeight: 600, color: "#334155", fontSize: 16 }}>
              No HR-uploaded documents match current filters
            </p>
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
              {statusFilter === "Pending Verification"
                ? "There are currently no HR or Admin documents awaiting platform verification."
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
                    <th style={{ width: "32%", minWidth: 220, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDocuments.map((doc) => {
                    const uploaderName = doc.uploaded_by?.name || "HR Staff";
                    const orgName =
                      doc.organizationId?.name ||
                      doc.uploaded_by?.organizationId?.name ||
                      "Organization";

                    const isPending = doc.status === "Pending Verification";
                    const isVerified = doc.status === "Verified";
                    const isRejected = doc.status === "Rejected";

                    return (
                      <tr key={doc._id}>
                        {/* COLUMN 1: Document Name */}
                        <td>
                          <div className="sa-doc-info-cell">
                            <span className="sa-doc-filename" title={doc.file_name}>
                              {doc.file_name}
                            </span>
                            <span className="sa-doc-category-subtitle">
                              {doc.category}
                            </span>
                            <div className="sa-doc-uploader-subtitle">
                              Uploaded by <span className="sa-doc-uploader-name">{uploaderName}</span> ·{" "}
                              <span className="sa-doc-org-tag">{orgName}</span>
                            </div>
                          </div>
                        </td>

                        {/* COLUMN 2: Document Image */}
                        <td>
                          <div className="sa-doc-thumbnail-cell">
                            <DocThumbnail doc={doc} onClick={() => handleOpenPreview(doc)} />
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <button
                                type="button"
                                className="sa-doc-preview-trigger"
                                onClick={() => handleOpenPreview(doc)}
                                title="Click to view file preview"
                              >
                                <FiExternalLink size={12} />
                                View Preview
                              </button>
                              <button
                                type="button"
                                className="sa-doc-preview-trigger"
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

                        {/* COLUMN 3: Actions */}
                        <td>
                          <div className="sa-doc-actions-cell">
                            {isPending ? (
                              <>
                                <button
                                  type="button"
                                  className="sa-btn-verify"
                                  disabled={verifyingId === doc._id}
                                  onClick={() => handleVerify(doc)}
                                  title="Approve and mark document as Verified"
                                >
                                  <FiCheck size={14} />
                                  {verifyingId === doc._id ? "Verifying..." : "Verified"}
                                </button>
                                <button
                                  type="button"
                                  className="sa-btn-reject"
                                  disabled={verifyingId === doc._id}
                                  onClick={() => handleOpenRejectModal(doc)}
                                  title="Reject document with feedback reason"
                                >
                                  <FiX size={14} />
                                  Reject
                                </button>
                              </>
                            ) : isVerified ? (
                              <>
                                <span
                                  className="sa-badge-verified"
                                  title={`Verified by ${doc.verified_by?.name || "Platform Admin"} on ${formatDate(
                                    doc.verified_at
                                  )}`}
                                >
                                  <FiCheckCircle size={13} />
                                  Verified
                                </span>
                                <button
                                  type="button"
                                  className="sa-btn-change-decision"
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
                                  className="sa-badge-rejected"
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
                                  className="sa-btn-change-decision"
                                  disabled={verifyingId === doc._id}
                                  onClick={() => handleVerify(doc)}
                                  title="Change decision to Verified"
                                >
                                  <FiRepeat size={11} />
                                  Change decision
                                </button>
                              </>
                            ) : (
                              <span className="sa-badge-verified" style={{ background: "#f1f5f9", color: "#64748b" }}>
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
          5. REJECT ACTION — MODAL
          ===================================================================== */}
      {rejectModalDoc && (
        <Modal
          isOpen={Boolean(rejectModalDoc)}
          onClose={handleCloseRejectModal}
          size="md"
        >
          <ModalHeader
            title="Reject Document"
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
                    Uploaded by:{" "}
                    <strong>
                      {rejectModalDoc.uploaded_by?.name || "HR Staff"} ·{" "}
                      {rejectModalDoc.organizationId?.name ||
                        rejectModalDoc.uploaded_by?.organizationId?.name ||
                        "Organization"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Reason Input */}
              <div className="reject-reason-group">
                <label htmlFor="sa-rejection-reason">
                  Reason for Rejection <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea
                  id="sa-rejection-reason"
                  rows={4}
                  className={`reject-reason-textarea ${
                    rejectReasonError ? "has-error" : ""
                  }`}
                  placeholder="Explain why this document was not verified (e.g. illegible scan, expired document, incorrect category, authorization mismatch)..."
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
                    Minimum 5 characters. The HR uploader will be notified with this reason.
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
          VIEW REJECTION REASON MODAL
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
                  {viewReasonDoc.verified_by?.name || "Platform Admin"}
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
