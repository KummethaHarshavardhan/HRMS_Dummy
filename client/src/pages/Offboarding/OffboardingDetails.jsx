import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiShield,
  FiServer,
  FiDollarSign,
  FiUserCheck,
  FiCheck,
  FiDownload,
  FiFileText,
  FiRotateCcw,
  FiLock,
  FiCalendar,
  FiCheckSquare,
  FiPaperclip,
  FiPlus,
  FiFolder,
} from "react-icons/fi";
import {
  getOffboardingById,
  getEmployeeOffboarding,
  updateOffboardingTask,
  signDepartmentClearance,
  completeOffboarding,
  downloadExperienceLetter,
  getExitPackageDetails,
  downloadAttendanceSummary,
  downloadLeaveSummary,
  downloadNoDuesCertificate,
  downloadRelievingLetter,
} from "../../services/offboardingService";
import { downloadPayslip } from "../../services/payrollService";
import { uploadDocument, downloadDocumentFile } from "../../services/documentService";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/permission";
import Button from "../../components/Button/Button";
import Modal from "../../components/Modal/Modal";
import Loader from "../../components/Loader/Loader";
import "../Onboarding/Onboarding.css";

export default function OffboardingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = normalizeRole(user?.role);
  const isStaff = userRole === "admin" || userRole === "super_admin" || userRole === "hr_manager";

  const [offboarding, setOffboarding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  // Clearance modal
  const [clearanceDept, setClearanceDept] = useState(null);
  const [clearanceComments, setClearanceComments] = useState("");
  const [signingClearance, setSigningClearance] = useState(false);

  // Complete modal
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Exit Package state
  const [exitPackage, setExitPackage] = useState(null);
  const [loadingExitPackage, setLoadingExitPackage] = useState(true);
  const [downloadingAction, setDownloadingAction] = useState(null);

  // Other document attachment modal
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [docDescription, setDocDescription] = useState("");

  const fetchExitPackage = async (processId) => {
    if (!processId) return;
    try {
      setLoadingExitPackage(true);
      const res = await getExitPackageDetails(processId);
      if (res?.success) {
        setExitPackage(res.data);
      }
    } catch (err) {
      console.warn("Failed to load exit package:", err.message);
    } finally {
      setLoadingExitPackage(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const promise = id ? getOffboardingById(id) : getEmployeeOffboarding("me");
    promise
      .then((data) => {
        if (!ignore) {
          const off = data?.offboarding || null;
          setOffboarding(off);
          setLoading(false);
          if (off?._id) {
            fetchExitPackage(off._id);
          }
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "Failed to load offboarding process");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [id]);

  const handleTaskStatusChange = async (taskId, newStatus) => {
    if (!isStaff) return;
    try {
      setUpdatingTaskId(taskId);
      setError("");
      const res = await updateOffboardingTask(offboarding._id, taskId, {
        status: newStatus,
      });
      setOffboarding(res?.offboarding || offboarding);
      setSuccess("Task updated");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to update checklist item");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleClearanceSubmit = async (signed) => {
    if (!clearanceDept) return;
    try {
      setSigningClearance(true);
      setError("");
      const res = await signDepartmentClearance(offboarding._id, {
        department: clearanceDept,
        signed,
        comments: clearanceComments,
      });
      setOffboarding(res?.offboarding || offboarding);
      setClearanceDept(null);
      setClearanceComments("");
      setSuccess(`${clearanceDept.toUpperCase()} clearance updated successfully`);
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to sign clearance");
    } finally {
      setSigningClearance(false);
    }
  };

  const handleFinalizeOffboarding = async () => {
    try {
      setCompleting(true);
      setError("");
      const res = await completeOffboarding(offboarding._id);
      setOffboarding(res?.offboarding || offboarding);
      setCompleteOpen(false);
      setSuccess("Offboarding finalized! Employee status set to Inactive.");
      setTimeout(() => setSuccess(""), 4500);
    } catch (err) {
      setError(err.message || "Failed to complete offboarding");
    } finally {
      setCompleting(false);
    }
  };

  // Experience letter state
  const [downloadingLetter, setDownloadingLetter] = useState(false);

  const handleDownloadExperienceLetter = async (regenerate = false) => {
    try {
      setDownloadingLetter(true);
      setError("");
      const empName = offboarding?.employee_id?.user_id?.name || "Employee";
      await downloadExperienceLetter(offboarding._id, {
        regenerate,
        fileName: `Experience_Letter_${empName.replace(/\s+/g, "_")}.pdf`,
      });
      if (regenerate) {
        setSuccess("Experience letter regenerated and downloaded successfully.");
      } else {
        setSuccess("Experience letter downloaded successfully.");
      }
      setTimeout(() => setSuccess(""), 4000);

      // Refresh offboarding record to reflect experience_letter_generated_at timestamp
      const promise = id ? getOffboardingById(id) : getEmployeeOffboarding("me");
      const refreshed = await promise;
      if (refreshed?.offboarding) {
        setOffboarding(refreshed.offboarding);
      }
    } catch (err) {
      setError(err.message || "Failed to download experience letter.");
    } finally {
      setDownloadingLetter(false);
    }
  };

  const handleDownloadAttendanceSummary = async () => {
    try {
      setDownloadingAction("attendance");
      await downloadAttendanceSummary(offboarding._id);
      setSuccess("Attendance Summary downloaded successfully.");
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to download Attendance Summary");
    } finally {
      setDownloadingAction(null);
    }
  };

  const handleDownloadLeaveSummary = async () => {
    try {
      setDownloadingAction("leave");
      await downloadLeaveSummary(offboarding._id);
      setSuccess("Leave Summary downloaded successfully.");
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to download Leave Summary");
    } finally {
      setDownloadingAction(null);
    }
  };

  const handleDownloadNoDues = async () => {
    try {
      setDownloadingAction("nodues");
      await downloadNoDuesCertificate(offboarding._id);
      setSuccess("No-Dues Certificate downloaded successfully.");
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to download No-Dues Certificate");
    } finally {
      setDownloadingAction(null);
    }
  };

  const handleDownloadRelievingLetter = async () => {
    try {
      setDownloadingAction("relieving");
      await downloadRelievingLetter(offboarding._id);
      setSuccess("Relieving Letter downloaded successfully.");
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to download Relieving Letter");
    } finally {
      setDownloadingAction(null);
    }
  };

  const handleDownloadFinalPayslip = async () => {
    if (!exitPackage?.finalPayslip?._id) return;
    try {
      setDownloadingAction("final_payslip");
      await downloadPayslip(exitPackage.finalPayslip._id);
      setSuccess("Final payslip downloaded successfully.");
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to download final payslip");
    } finally {
      setDownloadingAction(null);
    }
  };

  const handleDownloadSinglePayslip = async (payrollId) => {
    try {
      setDownloadingAction(`payslip_${payrollId}`);
      await downloadPayslip(payrollId);
      setSuccess("Payslip downloaded successfully.");
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to download payslip");
    } finally {
      setDownloadingAction(null);
    }
  };

  const handleUploadOtherDocument = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please choose a file to attach");
      return;
    }
    const empId = offboarding.employee_id?._id || offboarding.employee_id;
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("category", "Other");
    formData.append("employee_id", empId);
    if (docDescription) {
      formData.append("description", docDescription);
    }

    try {
      setUploadingDoc(true);
      setError("");
      await uploadDocument(formData);
      setSuccess("Additional exit document attached successfully.");
      setAttachModalOpen(false);
      setSelectedFile(null);
      setDocDescription("");
      fetchExitPackage(offboarding._id);
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err.message || "Failed to attach document");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDownloadOtherDoc = async (docId, fileName) => {
    try {
      setDownloadingAction(`doc_${docId}`);
      await downloadDocumentFile(docId, fileName);
    } catch (err) {
      setError(err.message || "Failed to download document");
    } finally {
      setDownloadingAction(null);
    }
  };

  if (loading && !offboarding) {
    return (
      <div className="onboarding-page" style={{ textAlign: "center", padding: 60 }}>
        <Loader text="Loading offboarding details..." />
      </div>
    );
  }

  if (error && !offboarding) {
    return (
      <div className="onboarding-page">
        <div className="emp-alert error">{error}</div>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          <FiArrowLeft size={15} /> Go Back
        </Button>
      </div>
    );
  }

  if (!offboarding) {
    return (
      <div className="onboarding-page">
        <div className="emp-empty-state">
          <p>No active offboarding record found.</p>
        </div>
      </div>
    );
  }

  const emp = offboarding.employee_id;
  const name = emp?.user_id?.name || "Employee";
  const email = emp?.user_id?.email || "";
  const code = emp?.employee_code || "EMP";
  const dept = emp?.department_id?.departmentName || "—";
  const designation = emp?.designation || "—";

  const checklist = offboarding.checklist || [];
  const totalTasks = checklist.length;
  const doneTasks = checklist.filter((t) => t.status === "Done").length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const clearance = offboarding.clearance_status || {};
  const depts = [
    { key: "hr", label: "Human Resources", icon: <FiShield size={20} /> },
    { key: "it", label: "IT & Infrastructure", icon: <FiServer size={20} /> },
    { key: "finance", label: "Finance & Payroll", icon: <FiDollarSign size={20} /> },
    { key: "manager", label: "Reporting Manager", icon: <FiUserCheck size={20} /> },
  ];

  const allClearancesSigned = depts.every((d) => clearance[d.key]?.signed);

  return (
    <div className="onboarding-page">
      {/* Navigation Top */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Button
          variant="secondary"
          size="sm"
          icon={<FiArrowLeft size={15} />}
          onClick={() => (isStaff ? navigate("/offboarding") : navigate("/profile"))}
        >
          {isStaff ? "Back to Offboarding List" : "Back to Profile"}
        </Button>

        {isStaff && offboarding.status !== "Completed" && (
          <Button
            variant="danger"
            size="sm"
            icon={<FiCheckCircle size={15} />}
            onClick={() => setCompleteOpen(true)}
          >
            Finalize Offboarding & Deactivate
          </Button>
        )}

        {/* Experience Letter Actions when Completed */}
        {offboarding.status === "Completed" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isStaff ? (
              offboarding.experience_letter_generated_at ? (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<FiDownload size={15} />}
                    disabled={downloadingLetter}
                    onClick={() => handleDownloadExperienceLetter(false)}
                  >
                    {downloadingLetter ? "Downloading..." : "Download Experience Letter"}
                  </Button>
                  <button
                    type="button"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#6366f1",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      textDecoration: "underline",
                      padding: "4px 8px",
                    }}
                    disabled={downloadingLetter}
                    onClick={() => handleDownloadExperienceLetter(true)}
                    title="Regenerate experience letter with updated organizational details or tasks"
                  >
                    <FiRotateCcw size={12} /> Regenerate
                  </button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<FiFileText size={15} />}
                  disabled={downloadingLetter}
                  onClick={() => handleDownloadExperienceLetter(false)}
                >
                  {downloadingLetter ? "Generating..." : "Generate Experience Letter"}
                </Button>
              )
            ) : (
              /* Employee Self-View */
              <Button
                variant="primary"
                size="sm"
                icon={<FiDownload size={15} />}
                disabled={downloadingLetter}
                onClick={() => handleDownloadExperienceLetter(false)}
              >
                {downloadingLetter ? "Downloading..." : "Download Experience Letter"}
              </Button>
            )}
          </div>
        )}
      </div>

      {error && <div className="emp-alert error">{error}</div>}
      {success && <div className="emp-alert success">{success}</div>}

      {/* Hero Card */}
      <div className="emp-detail-hero" style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)" }}>
        <div className="emp-detail-avatar" style={{ background: "#f87171", color: "#ffffff" }}>
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="emp-detail-hero-info">
          <h2 style={{ color: "#ffffff" }}>{name} — Exit Offboarding</h2>
          <p style={{ color: "#94a3b8" }}>
            {designation} &bull; {dept} &bull; {code} &bull; {email}
          </p>
          <p style={{ color: "#cbd5e1", fontSize: 13, marginTop: 4 }}>
            Resigned: {new Date(offboarding.resignation_date).toLocaleDateString("en-IN")} &bull;{" "}
            <strong>Last Working Day: {new Date(offboarding.last_working_day).toLocaleDateString("en-IN")}</strong>
          </p>
          {offboarding.exit_reason && (
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
              <em>"{offboarding.exit_reason}"</em>
            </p>
          )}
        </div>
        <div className="emp-detail-hero-badge">
          <span
            className={`doc-badge ${
              offboarding.status === "Completed" ? "doc-badge-active" : "doc-badge-expiring"
            }`}
            style={{ fontSize: 13, padding: "6px 14px" }}
          >
            {offboarding.status === "Completed" ? <FiCheckCircle size={14} /> : <FiClock size={14} />}
            {offboarding.status}
          </span>
        </div>
      </div>

      {/* Experience Letter Banner Card (Visible when Completed) */}
      {offboarding.status === "Completed" && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "18px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "10px",
                background: "#ede9fe",
                color: "#6c5ce7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
              }}
            >
              <FiFileText size={22} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>
                Official Experience & Relieving Certificate
              </h4>
              <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#64748b" }}>
                {offboarding.experience_letter_generated_at
                  ? `Generated on ${new Date(offboarding.experience_letter_generated_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })} • Ready for official download.`
                  : "Certified PDF document ready to be generated for this employee."}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Button
              variant="primary"
              size="sm"
              icon={<FiDownload size={14} />}
              disabled={downloadingLetter}
              onClick={() => handleDownloadExperienceLetter(false)}
            >
              {downloadingLetter
                ? "Processing..."
                : offboarding.experience_letter_generated_at
                ? "Download Certificate (PDF)"
                : "Generate Certificate (PDF)"}
            </Button>
            {isStaff && offboarding.experience_letter_generated_at && (
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#6366f1",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  textDecoration: "underline",
                  padding: "4px 6px",
                }}
                disabled={downloadingLetter}
                onClick={() => handleDownloadExperienceLetter(true)}
                title="Regenerate with latest details"
              >
                <FiRotateCcw size={12} /> Regenerate
              </button>
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          EXIT DOCUMENTS & HANDOVER PACKAGE
         ===================================================== */}
      <div className="exit-pkg-container">
        <div className="exit-pkg-header">
          <div>
            <h3>
              <FiFolder size={20} color="#4f46e5" /> Exit Documents & Clearance Package
            </h3>
            <p>
              Month-wise salary records, official clearance statements, tenure attendance & leave audits, and exit certifications.
            </p>
          </div>
          {exitPackage?.tenure && (
            <span
              style={{
                fontSize: 12,
                color: "#475569",
                background: "#f1f5f9",
                padding: "6px 12px",
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              Tenure: {exitPackage.tenure.startDate ? new Date(exitPackage.tenure.startDate).toLocaleDateString("en-IN") : "—"} to{" "}
              {exitPackage.tenure.lastWorkingDay ? new Date(exitPackage.tenure.lastWorkingDay).toLocaleDateString("en-IN") : "—"}
            </span>
          )}
        </div>

        {loadingExitPackage && !exitPackage ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "#64748b" }}>
            <Loader text="Loading exit package documents..." />
          </div>
        ) : (
          <>
            {/* 1. Month-Wise Payslips Sub-section */}
            <div>
              <div className="exit-subsection-title">
                <span>Month-Wise Payslips Archive</span>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<FiDownload size={14} />}
                  disabled={!exitPackage?.finalPayslip || downloadingAction === "final_payslip"}
                  onClick={handleDownloadFinalPayslip}
                  title="Download the latest payslip generated for this employee"
                  id="download-final-payslip-btn"
                >
                  {downloadingAction === "final_payslip" ? "Downloading..." : "Download Final Payslip"}
                </Button>
              </div>

              {!exitPackage?.payslips || exitPackage.payslips.length === 0 ? (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px dashed #cbd5e1",
                    borderRadius: 10,
                    padding: "24px",
                    textAlign: "center",
                    color: "#64748b",
                    fontSize: 13,
                  }}
                >
                  No payslips were generated for this employee
                </div>
              ) : (
                <div className="exit-table-wrapper">
                  <table className="exit-table">
                    <thead>
                      <tr>
                        <th>Salary Month</th>
                        <th>Net Salary</th>
                        <th>Payment Date</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exitPackage.payslips.map((p) => {
                        const MONTH_NAMES = [
                          "", "January", "February", "March", "April", "May", "June",
                          "July", "August", "September", "October", "November", "December"
                        ];
                        const monthName = MONTH_NAMES[p.month] || `Month ${p.month}`;
                        const isDownloadingThis = downloadingAction === `payslip_${p._id}`;

                        return (
                          <tr key={p._id}>
                            <td style={{ fontWeight: 600 }}>
                              {monthName} {p.year}
                              {exitPackage?.finalPayslip?._id === p._id && (
                                <span
                                  style={{
                                    marginLeft: 8,
                                    fontSize: 10,
                                    background: "#e0e7ff",
                                    color: "#4338ca",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Final
                                </span>
                              )}
                            </td>
                            <td>₹{Number(p.netSalary || p.basicSalary || 0).toLocaleString("en-IN")}</td>
                            <td>{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-IN") : "—"}</td>
                            <td>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  background: p.status === "Paid" ? "#dcfce7" : "#fef3c7",
                                  color: p.status === "Paid" ? "#15803d" : "#b45309",
                                }}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <Button
                                variant="outline"
                                size="sm"
                                icon={<FiDownload size={13} />}
                                disabled={isDownloadingThis}
                                onClick={() => handleDownloadSinglePayslip(p._id)}
                              >
                                {isDownloadingThis ? "Downloading..." : "Download Payslip"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. Attendance & Leave Summaries Sub-section */}
            <div>
              <div className="exit-subsection-title">
                <span>Tenure Attendance & Leave Statements</span>
              </div>
              <div className="exit-pkg-grid">
                {/* Attendance Summary Card */}
                <div className="exit-doc-card">
                  <div className="exit-doc-card-top">
                    <div className="exit-doc-icon" style={{ background: "#e0f2fe", color: "#0284c7" }}>
                      <FiCalendar size={20} />
                    </div>
                    <div className="exit-doc-info">
                      <h4>Attendance Summary (PDF)</h4>
                      <p>Full attendance log covering entire tenure, including present days, late checks, and compliance rate.</p>
                    </div>
                  </div>
                  <div className="exit-doc-actions">
                    <span style={{ fontSize: 11, color: "#64748b" }}>Tenure audit statement</span>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<FiDownload size={13} />}
                      disabled={downloadingAction === "attendance"}
                      onClick={handleDownloadAttendanceSummary}
                      id="download-attendance-summary-btn"
                    >
                      {downloadingAction === "attendance" ? "Generating..." : "Download Attendance (PDF)"}
                    </Button>
                  </div>
                </div>

                {/* Leave Summary Card */}
                <div className="exit-doc-card">
                  <div className="exit-doc-card-top">
                    <div className="exit-doc-icon" style={{ background: "#f3e8ff", color: "#7c3aed" }}>
                      <FiCheckSquare size={20} />
                    </div>
                    <div className="exit-doc-info">
                      <h4>Leave Summary (PDF)</h4>
                      <p>Complete record of leaves applied, approved quota breakdown (Annual, Sick, Casual), and utilization ledger.</p>
                    </div>
                  </div>
                  <div className="exit-doc-actions">
                    <span style={{ fontSize: 11, color: "#64748b" }}>Tenure accrual statement</span>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<FiDownload size={13} />}
                      disabled={downloadingAction === "leave"}
                      onClick={handleDownloadLeaveSummary}
                      id="download-leave-summary-btn"
                    >
                      {downloadingAction === "leave" ? "Generating..." : "Download Leave (PDF)"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Exit Clearance Specific Documents (No-Dues & Relieving Letter) */}
            <div>
              <div className="exit-subsection-title">
                <span>Exit Clearance Certificates</span>
              </div>
              <div className="exit-pkg-grid">
                {/* No-Dues Certificate Card */}
                <div className="exit-doc-card">
                  <div className="exit-doc-card-top">
                    <div
                      className="exit-doc-icon"
                      style={{
                        background: exitPackage?.noDuesEligible ? "#dcfce7" : "#fef3c7",
                        color: exitPackage?.noDuesEligible ? "#16a34a" : "#d97706",
                      }}
                    >
                      {exitPackage?.noDuesEligible ? <FiCheckCircle size={20} /> : <FiLock size={20} />}
                    </div>
                    <div className="exit-doc-info">
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h4>No-Dues Certificate (PDF)</h4>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: 4,
                            textTransform: "uppercase",
                            background: exitPackage?.noDuesEligible ? "#dcfce7" : "#fef3c7",
                            color: exitPackage?.noDuesEligible ? "#15803d" : "#b45309",
                          }}
                        >
                          {exitPackage?.noDuesEligible ? "Cleared & Eligible" : "Clearance Incomplete"}
                        </span>
                      </div>
                      <p>
                        Certifies that all company assets are returned (0 unreturned assets) and all 4 department sign-offs are approved.
                        {!exitPackage?.noDuesEligible && (
                          <span style={{ display: "block", color: "#dc2626", marginTop: 4, fontWeight: 500 }}>
                            {exitPackage?.activeAssetCount > 0
                              ? `⚠️ ${exitPackage.activeAssetCount} asset(s) still unreturned.`
                              : "⚠️ Department clearances pending."}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="exit-doc-actions">
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      {exitPackage?.noDuesEligible ? "Verified clearance" : "Gated certificate"}
                    </span>
                    <Button
                      variant={exitPackage?.noDuesEligible ? "primary" : "secondary"}
                      size="sm"
                      icon={exitPackage?.noDuesEligible ? <FiDownload size={13} /> : <FiLock size={13} />}
                      disabled={!exitPackage?.noDuesEligible || downloadingAction === "nodues"}
                      onClick={handleDownloadNoDues}
                      id="download-no-dues-btn"
                      title={
                        exitPackage?.noDuesEligible
                          ? "Download certified No-Dues Certificate"
                          : "Cannot download until all assets are returned and department clearances signed"
                      }
                    >
                      {downloadingAction === "nodues" ? "Generating..." : "Download No-Dues (PDF)"}
                    </Button>
                  </div>
                </div>

                {/* Relieving Letter Card */}
                <div className="exit-doc-card">
                  <div className="exit-doc-card-top">
                    <div className="exit-doc-icon" style={{ background: "#dbeafe", color: "#2563eb" }}>
                      <FiFileText size={20} />
                    </div>
                    <div className="exit-doc-info">
                      <h4>Relieving Letter (PDF)</h4>
                      <p>Formal service discharge and resignation acceptance order relieving the employee of all employment duties.</p>
                    </div>
                  </div>
                  <div className="exit-doc-actions">
                    <span style={{ fontSize: 11, color: "#64748b" }}>Official service release</span>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<FiDownload size={13} />}
                      disabled={downloadingAction === "relieving"}
                      onClick={handleDownloadRelievingLetter}
                      id="download-relieving-letter-btn"
                    >
                      {downloadingAction === "relieving" ? "Generating..." : "Download Relieving Letter (PDF)"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Provident Fund (PF) Settlement Sub-section */}
            <div>
              <div className="exit-subsection-title">
                <span>Provident Fund (PF) Settlement</span>
              </div>
              <div
                className="exit-doc-card"
                style={{
                  background: exitPackage?.pfSettlement?.settled ? "#f0fdf4" : "#ffffff",
                  borderColor: exitPackage?.pfSettlement?.settled ? "#86efac" : "#e2e8f0",
                }}
              >
                <div className="exit-doc-card-top">
                  <div
                    className="exit-doc-icon"
                    style={{
                      background: exitPackage?.pfSettlement?.settled ? "#dcfce7" : "#e0e7ff",
                      color: exitPackage?.pfSettlement?.settled ? "#16a34a" : "#4f46e5",
                    }}
                  >
                    <FiDollarSign size={22} />
                  </div>
                  <div className="exit-doc-info" style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <h4 style={{ margin: 0 }}>Total PF Accumulated</h4>
                      {(exitPackage?.pfSettlement?.settled || offboarding.status === "Completed") ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: "#dcfce7",
                            color: "#15803d",
                            textTransform: "uppercase",
                          }}
                        >
                          ✓ Settled Automatically
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: "#fef3c7",
                            color: "#b45309",
                            textTransform: "uppercase",
                          }}
                        >
                          Pending Settlement
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: "#1e293b" }}>
                        ₹{Number(exitPackage?.totalAccumulatedPf || 0).toLocaleString("en-IN")}/-
                      </span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        Total cumulative PF contributions across employee's tenure
                      </span>
                    </div>
                    {(exitPackage?.pfSettlement?.settled || offboarding.status === "Completed") ? (
                      <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4, fontWeight: 600 }}>
                        PF Settled: ₹{Number(exitPackage?.pfSettlement?.amount || exitPackage?.totalAccumulatedPf || 0).toLocaleString("en-IN")} on {new Date(exitPackage?.pfSettlement?.settledAt || offboarding.completed_at || offboarding.updatedAt || Date.now()).toLocaleDateString("en-IN")}
                      </div>
                    ) : (
                      <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#64748b" }}>
                        Provident Fund settlement occurs automatically upon completing the offboarding process.
                      </p>
                    )}
                  </div>
                </div>

                <div className="exit-doc-actions">
                  <span style={{ fontSize: 12, color: (exitPackage?.pfSettlement?.settled || offboarding.status === "Completed") ? "#16a34a" : "#64748b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {(exitPackage?.pfSettlement?.settled || offboarding.status === "Completed") ? (
                      <>
                        <FiCheckCircle size={15} /> PF Settled
                      </>
                    ) : (
                      <>
                        <FiClock size={15} /> Automatic on Completion
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Other Exit Documents Sub-section */}
            <div>
              <div className="exit-subsection-title">
                <span>Other Exit & Handover Documents</span>
                {isStaff && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<FiPlus size={14} />}
                    onClick={() => {
                      setSelectedFile(null);
                      setDocDescription("");
                      setAttachModalOpen(true);
                    }}
                    id="attach-exit-doc-btn"
                  >
                    Attach Additional Document
                  </Button>
                )}
              </div>

              {!exitPackage?.otherDocuments || exitPackage.otherDocuments.length === 0 ? (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px dashed #cbd5e1",
                    borderRadius: 10,
                    padding: "20px",
                    textAlign: "center",
                    color: "#64748b",
                    fontSize: 13,
                  }}
                >
                  <FiPaperclip size={24} style={{ display: "block", margin: "0 auto 6px", color: "#94a3b8" }} />
                  No additional exit documents attached yet.
                  {isStaff && " Click 'Attach Additional Document' to upload exit handovers, agreements, or signed forms."}
                </div>
              ) : (
                <div className="exit-table-wrapper">
                  <table className="exit-table">
                    <thead>
                      <tr>
                        <th>Document Title / File</th>
                        <th>Description / Notes</th>
                        <th>Uploaded Date</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exitPackage.otherDocuments.map((doc) => (
                        <tr key={doc._id}>
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <FiPaperclip size={14} color="#6366f1" />
                              {doc.file_name}
                            </div>
                          </td>
                          <td style={{ color: "#64748b" }}>{doc.description || "—"}</td>
                          <td>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString("en-IN") : "—"}</td>
                          <td style={{ textAlign: "right" }}>
                            <Button
                              variant="outline"
                              size="sm"
                              icon={<FiDownload size={13} />}
                              disabled={downloadingAction === `doc_${doc._id}`}
                              onClick={() => handleDownloadOtherDoc(doc._id, doc.file_name)}
                            >
                              Download
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Department Clearance Cards */}
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
          Department Clearance Sign-Offs
        </h3>
        <div className="clearance-grid">
          {depts.map((d) => {
            const clr = clearance[d.key] || {};
            const isSigned = clr.signed;

            return (
              <div key={d.key} className={`clearance-card ${isSigned ? "signed" : ""}`}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#334155" }}>
                      {d.icon}
                      <strong style={{ fontSize: 15 }}>{d.label}</strong>
                    </div>
                    <span
                      className={`clearance-status-pill ${
                        isSigned ? "status-signed" : "status-pending"
                      }`}
                    >
                      {isSigned ? <FiCheck size={13} /> : <FiClock size={13} />}
                      {isSigned ? "Approved" : "Pending"}
                    </span>
                  </div>

                  {clr.comments && (
                    <p style={{ fontSize: 12, color: "#64748b", margin: "10px 0 0 0", fontStyle: "italic" }}>
                      "{clr.comments}"
                    </p>
                  )}

                  {isSigned && clr.signed_at && (
                    <div style={{ fontSize: 11, color: "#15803d", marginTop: 8 }}>
                      Signed: {new Date(clr.signed_at).toLocaleDateString("en-IN")}
                      {clr.signed_by?.name ? ` by ${clr.signed_by.name}` : ""}
                    </div>
                  )}
                </div>

                {isStaff && offboarding.status !== "Completed" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {isSigned ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        style={{ width: "100%", fontSize: 12 }}
                        onClick={() => {
                          setClearanceDept(d.key);
                          handleClearanceSubmit(false);
                        }}
                      >
                        Revoke Sign-Off
                      </Button>
                    ) : (
                      <Button
                        variant="success"
                        size="sm"
                        style={{ width: "100%", fontSize: 12 }}
                        onClick={() => {
                          setClearanceDept(d.key);
                          setClearanceComments("");
                        }}
                      >
                        Sign-Off Clearance
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress Track Card */}
      <div
        style={{
          background: "#ffffff",
          padding: 20,
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
            Offboarding Tasks Checklist
          </span>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#ef4444" }}>
            {progressPct}% ({doneTasks}/{totalTasks} Completed)
          </span>
        </div>
        <div className="progress-track" style={{ height: 12 }}>
          <div
            className="progress-fill"
            style={{
              width: `${progressPct}%`,
              background: "linear-gradient(90deg, #f59e0b, #10b981)",
            }}
          />
        </div>
      </div>

      {/* Checklist Task Items */}
      <div className="checklist-container">
        {checklist.map((task) => {
          const isDone = task.status === "Done";
          const isInProgress = task.status === "In Progress";
          const isUpdating = updatingTaskId === task._id;

          return (
            <div key={task._id} className={`checklist-card ${isDone ? "done" : ""}`}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1 }}>
                <div style={{ marginTop: 2 }}>
                  {isDone ? (
                    <FiCheckCircle size={22} style={{ color: "#15803d" }} />
                  ) : (
                    <FiClock size={22} style={{ color: "#f59e0b" }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className="category-tag tag-hr">{task.category}</span>
                    <span className="task-title" style={{ fontSize: 15, fontWeight: 600, color: "#1e293b" }}>
                      {task.task_name}
                    </span>
                  </div>

                  {task.notes && (
                    <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#64748b" }}>
                      {task.notes}
                    </p>
                  )}

                  {task.completed_at && (
                    <div style={{ fontSize: 12, color: "#15803d", marginTop: 4 }}>
                      Completed on: {new Date(task.completed_at).toLocaleString("en-IN")}
                    </div>
                  )}
                </div>
              </div>

              {isStaff ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    type="button"
                    disabled={isUpdating}
                    className="doc-filter-select"
                    style={{
                      fontSize: 12,
                      padding: "6px 12px",
                      background: task.status === "Pending" ? "#f1f5f9" : "#ffffff",
                      borderColor: task.status === "Pending" ? "#64748b" : "#e2e8f0",
                      fontWeight: task.status === "Pending" ? 700 : 400,
                    }}
                    onClick={() => handleTaskStatusChange(task._id, "Pending")}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    disabled={isUpdating}
                    className="doc-filter-select"
                    style={{
                      fontSize: 12,
                      padding: "6px 12px",
                      background: isInProgress ? "#fef3c7" : "#ffffff",
                      borderColor: isInProgress ? "#f59e0b" : "#e2e8f0",
                      color: isInProgress ? "#b45309" : "#475569",
                      fontWeight: isInProgress ? 700 : 400,
                    }}
                    onClick={() => handleTaskStatusChange(task._id, "In Progress")}
                  >
                    In Progress
                  </button>
                  <button
                    type="button"
                    disabled={isUpdating}
                    className="doc-filter-select"
                    style={{
                      fontSize: 12,
                      padding: "6px 12px",
                      background: isDone ? "#dcfce7" : "#ffffff",
                      borderColor: isDone ? "#22c55e" : "#e2e8f0",
                      color: isDone ? "#15803d" : "#475569",
                      fontWeight: isDone ? 700 : 400,
                    }}
                    onClick={() => handleTaskStatusChange(task._id, "Done")}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <span
                  className={`doc-badge ${
                    isDone
                      ? "doc-badge-active"
                      : isInProgress
                      ? "doc-badge-expiring"
                      : "doc-badge-expired"
                  }`}
                >
                  {task.status}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Clearance Sign-Off Modal */}
      <Modal
        isOpen={!!clearanceDept}
        onClose={() => !signingClearance && setClearanceDept(null)}
        title={`Sign-Off ${clearanceDept?.toUpperCase()} Clearance`}
        size="sm"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={signingClearance}
              onClick={() => setClearanceDept(null)}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              loading={signingClearance}
              onClick={() => handleClearanceSubmit(true)}
            >
              Confirm Sign-Off
            </Button>
          </div>
        }
      >
        <div>
          <p style={{ fontSize: 14, color: "#475569", margin: "0 0 12px 0" }}>
            Confirm that all departmental handover items for <strong>{clearanceDept?.toUpperCase()}</strong> have been satisfied.
          </p>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
            Notes / Verification Details
          </label>
          <textarea
            className="doc-filter-select"
            style={{ width: "100%", padding: "8px 12px", minHeight: 60, fontSize: 13 }}
            placeholder="e.g., All equipment returned in good condition"
            value={clearanceComments}
            onChange={(e) => setClearanceComments(e.target.value)}
          />
        </div>
      </Modal>

      {/* Finalize Offboarding Modal */}
      <Modal
        isOpen={completeOpen}
        onClose={() => !completing && setCompleteOpen(false)}
        title="Finalize Offboarding & Deactivate Employee?"
        size="md"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={completing}
              onClick={() => setCompleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={completing}
              onClick={handleFinalizeOffboarding}
            >
              Complete Offboarding & Deactivate
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 14, color: "#334155", margin: 0 }}>
            Are you sure you want to finalize offboarding for <strong>{name}</strong>?
          </p>
          <div style={{ background: "#fee2e2", padding: "12px 16px", borderRadius: 8, color: "#991b1b", fontSize: 13 }}>
            <strong>Action Notice:</strong> This action will mark offboarding as Completed and
            automatically set the employee's status to <strong>"Inactive"</strong> in the directory.
          </div>
          {!allClearancesSigned && (
            <p style={{ fontSize: 13, color: "#b45309", margin: 0 }}>
              <FiAlertTriangle size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Note: Some department clearances are still pending approval.
            </p>
          )}
        </div>
      </Modal>

      {/* Attach Additional Document Modal (HR/Admin only) */}
      <Modal
        isOpen={attachModalOpen}
        onClose={() => !uploadingDoc && setAttachModalOpen(false)}
        title={`Attach Exit Document: ${name}`}
        size="md"
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={uploadingDoc}
              onClick={() => setAttachModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={uploadingDoc}
              onClick={handleUploadOtherDocument}
              id="confirm-attach-doc-btn"
            >
              Upload & Attach
            </Button>
          </div>
        }
      >
        <form onSubmit={handleUploadOtherDocument}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              Upload any additional exit documents (e.g. signed handover forms, non-disclosure agreements, exit surveys). This will be filed under category <strong>"Other"</strong> and be visible to both HR and the employee.
            </p>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Select File (PDF, PNG, JPG, DOCX - max 10MB) <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="file"
                className="doc-filter-select"
                style={{ width: "100%", padding: "8px" }}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Document Description / Purpose
              </label>
              <textarea
                className="doc-filter-select"
                style={{ width: "100%", padding: "8px 12px", minHeight: 60 }}
                placeholder="e.g. Signed physical asset handover form, NDA reaffirmation..."
                value={docDescription}
                onChange={(e) => setDocDescription(e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
