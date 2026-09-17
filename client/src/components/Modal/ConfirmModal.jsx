import React, { useEffect } from 'react';
import { FiAlertTriangle, FiTrash2, FiInfo, FiCheckCircle } from 'react-icons/fi';
import './Modal.css';

/**
 * Reusable Confirmation Modal Component
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: function
 * - onConfirm: function
 * - title: string (e.g. "Deactivate Employee?")
 * - message: string or React node (e.g. "Are you sure you want to deactivate John Doe (EMP001)?")
 * - confirmText: string (default "Confirm")
 * - cancelText: string (default "Cancel")
 * - variant: "danger" | "warning" | "primary" | "success" (default "danger")
 * - loading: boolean (shows spinner and disables buttons)
 */
export default function ConfirmModal({
  isOpen = false,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed with this action?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  loading = false,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !loading && onClose) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (variant) {
      case "danger":
        return <FiTrash2 size={24} color="#dc2626" />;
      case "warning":
        return <FiAlertTriangle size={24} color="#d97706" />;
      case "success":
        return <FiCheckCircle size={24} color="#16a34a" />;
      default:
        return <FiInfo size={24} color="#4f46e5" />;
    }
  };

  const getConfirmBtnClass = () => {
    switch (variant) {
      case "danger":
        return "emp-btn-danger";
      case "warning":
        return "emp-btn-warning";
      case "success":
        return "emp-btn-primary";
      default:
        return "emp-btn-primary";
    }
  };

  return (
    <div
      className="hrms-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading && onClose) {
          onClose();
        }
      }}
    >
      <div className="hrms-modal-dialog hrms-modal-sm" style={{ padding: 0 }}>
        <div style={{ padding: "24px 24px 16px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              backgroundColor:
                variant === "danger"
                  ? "#fee2e2"
                  : variant === "warning"
                  ? "#fef3c7"
                  : "#e0e7ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {getIcon()}
          </div>
          <div style={{ flex: 1 }}>
            <h3
              id="confirm-modal-title"
              style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}
            >
              {title}
            </h3>
            <div style={{ fontSize: "0.875rem", color: "#64748b", lineHeight: 1.5 }}>
              {message}
            </div>
          </div>
        </div>

        <div className="hrms-modal-footer" style={{ borderTop: "1px solid #f1f5f9", padding: "14px 20px" }}>
          <button
            type="button"
            className="emp-btn-secondary"
            onClick={onClose}
            disabled={loading}
            style={{ padding: "8px 16px", fontSize: "0.875rem" }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={getConfirmBtnClass()}
            onClick={onConfirm}
            disabled={loading}
            id="confirm-modal-btn"
            style={{
              padding: "8px 18px",
              fontSize: "0.875rem",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              ...(variant === "danger"
                ? { backgroundColor: "#dc2626", color: "#ffffff", border: "none" }
                : {}),
            }}
          >
            {loading ? (
              <>
                <span
                  className="emp-spinner"
                  style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: "#ffffff" }}
                />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}