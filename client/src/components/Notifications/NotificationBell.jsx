import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/permission";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../services/notificationService";
import { approveLeave, rejectLeave } from "../../services/leaveService";
import {
  FiBell,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiCheck,
  FiInfo,
  FiArrowRight,
  FiDollarSign,
  FiGift,
  FiCheckSquare,
  FiExternalLink,
  FiAlertTriangle,
} from "react-icons/fi";
import "./NotificationBell.css";

const NOTIF_ICONS = {
  leave_applied:  <FiClock className="notif-icon notif-icon-pending" size={16} />,
  leave_approved: <FiCheckCircle className="notif-icon notif-icon-success" size={16} />,
  leave_rejected: <FiXCircle className="notif-icon notif-icon-error" size={16} />,
  leave_cancelled:<FiInfo className="notif-icon notif-icon-info" size={16} />,
  payroll:        <FiDollarSign className="notif-icon notif-icon-success" size={16} />,
  bonus:          <FiGift className="notif-icon notif-icon-warning" size={16} />,
  task_assigned:  <FiCheckSquare className="notif-icon notif-icon-info" size={16} />,
  task_submitted: <FiCheckSquare className="notif-icon notif-icon-success" size={16} />,
  task_approved:  <FiCheckCircle className="notif-icon notif-icon-success" size={16} />,
  task_rework:    <FiAlertTriangle className="notif-icon notif-icon-warning" size={16} />,
  task_reassigned:<FiClock className="notif-icon notif-icon-info" size={16} />,
  general:        <FiBell className="notif-icon notif-icon-info" size={16} />,
};

const NOTIF_LABELS = {
  leave_applied:  "Leave Application",
  leave_approved: "Leave Approved",
  leave_rejected: "Leave Rejected",
  leave_cancelled:"Leave Cancelled",
  payroll:        "Salary Credited",
  bonus:          "Bonus Credited",
  task_assigned:  "Task Assigned",
  task_submitted: "Task Submitted",
  task_approved:  "Task Approved",
  task_rework:    "Rework Requested",
  task_reassigned:"Task Reassigned",
  general:        "Notification",
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};

export default function NotificationBell() {
  const navigate                          = useNavigate();
  const { user }                          = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [isOpen, setIsOpen]               = useState(false);
  const [loading, setLoading]             = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [actionStatus, setActionStatus]   = useState({});
  const dropdownRef                       = useRef(null);

  const normRole = normalizeRole(user?.role);
  const canManageLeave = normRole === "super_admin" || normRole === "admin" || normRole === "hr_manager";

  // Request browser Notification API permission gracefully
  const requestBrowserPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch (err) {
        console.warn("Browser notification permission request skipped:", err.message);
      }
    }
  }, []);

  const fetchNotifs = useCallback(async () => {
    try {
      const data = await getNotifications();
      const list = data?.notifications || [];
      setNotifications(list);
      setUnreadCount(data?.unreadCount || list.filter((n) => !n.read).length);

      // Trigger browser notification for the latest unread notification if permission granted
      if ("Notification" in window && Notification.permission === "granted") {
        const latestUnread = list.find((n) => !n.read);
        if (latestUnread) {
          const key = `shown_notif_${latestUnread._id}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            new Notification("HRMS Notification", {
              body: latestUnread.message,
              icon: "/favicon.ico",
            });
          }
        }
      }
    } catch (err) {
      // Fail silently if unauthenticated or network error
    }
  }, []);

  useEffect(() => {
    fetchNotifs();
    requestBrowserPermission();

    const handleNotifUpdate = () => {
      fetchNotifs();
    };
    window.addEventListener("notification-updated", handleNotifUpdate);

    // Poll every 15 seconds for new notifications
    const interval = setInterval(fetchNotifs, 15000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notification-updated", handleNotifUpdate);
    };
  }, [fetchNotifs, requestBrowserPermission]);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleActionLeave = async (notif, action) => {
    const leaveId = notif.relatedLeave?._id || notif.relatedLeave;
    if (!leaveId) return;

    setActionLoading((prev) => ({ ...prev, [notif._id]: action }));
    try {
      if (action === "approve") {
        await approveLeave(leaveId);
        setActionStatus((prev) => ({ ...prev, [notif._id]: "Approved" }));
      } else {
        await rejectLeave(leaveId);
        setActionStatus((prev) => ({ ...prev, [notif._id]: "Rejected" }));
      }

      // Mark notification as read
      await markNotificationRead(notif._id);
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notif._id
            ? {
                ...n,
                read: true,
                relatedLeave:
                  typeof n.relatedLeave === "object" && n.relatedLeave !== null
                    ? { ...n.relatedLeave, status: action === "approve" ? "Approved" : "Rejected" }
                    : n.relatedLeave,
              }
            : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Action leave error:", err);
      const errMsg = err.response?.data?.message || err.message || "Action failed";
      setActionStatus((prev) => ({ ...prev, [notif._id]: `Error: ${errMsg}` }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [notif._id]: null }));
    }
  };

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setLoading(true);
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="notif-bell-wrap" ref={dropdownRef}>
      <button
        type="button"
        className={`notif-bell-btn ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : "Notifications"}
        aria-label={unreadCount > 0 ? `Notifications - ${unreadCount} unread` : "Notifications"}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <FiBell size={18} />
        {unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <div className="notif-header-title">
              <h3>Notifications</h3>
              {unreadCount > 0 && <span className="notif-count-pill">{unreadCount} unread</span>}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                className="notif-mark-all-btn"
                onClick={handleMarkAllRead}
                disabled={loading}
              >
                <FiCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <FiBell size={28} style={{ color: "var(--slate-300)" }} />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const currentStatus =
                  actionStatus[notif._id] ||
                  (typeof notif.relatedLeave === "object" ? notif.relatedLeave?.status : null);

                return (
                  <div
                    key={notif._id}
                    className={`notif-item ${notif.read ? "read" : "unread"}`}
                    onClick={(e) => !notif.read && handleMarkRead(notif._id, e)}
                    role="listitem"
                  >
                    <div className="notif-item-left">
                      {NOTIF_ICONS[notif.type] || NOTIF_ICONS.general}
                    </div>

                    <div className="notif-item-content">
                      <div className="notif-item-top">
                        <span className="notif-item-type">
                          {NOTIF_LABELS[notif.type] || "Notification"}
                        </span>
                        <span className="notif-item-time">{formatTimeAgo(notif.createdAt)}</span>
                      </div>

                      <p className="notif-item-msg">{notif.message}</p>

                      {/* Attachment URL box if deliverable link exists */}
                      {notif.attachmentUrl && (
                        <div className="notif-attachment-box" onClick={(e) => e.stopPropagation()}>
                          <span className="notif-attachment-label">Submission Link:</span>
                          <a
                            href={notif.attachmentUrl.startsWith("http") ? notif.attachmentUrl : `https://${notif.attachmentUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="notif-attachment-link"
                            title="Open submission deliverable link"
                          >
                            <FiExternalLink size={12} />
                            <span className="notif-attachment-url">{notif.attachmentUrl}</span>
                          </a>
                        </div>
                      )}

                      {/* Quick action for Task Submissions -> Review Queue */}
                      {notif.type === "task_submitted" && (
                        <div className="notif-actions-wrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="notif-view-leave-link notif-task-action-btn"
                            onClick={() => {
                              setIsOpen(false);
                              navigate(notif.link || "/hr/reviews");
                            }}
                          >
                            Open Review Queue <FiArrowRight size={11} />
                          </button>
                        </div>
                      )}

                      {/* Quick action for Employee Tasks -> My Tasks */}
                      {(notif.type === "task_assigned" ||
                        notif.type === "task_rework" ||
                        notif.type === "task_approved" ||
                        notif.type === "task_reassigned") && (
                        <div className="notif-actions-wrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="notif-view-leave-link notif-task-action-btn"
                            onClick={() => {
                              setIsOpen(false);
                              navigate(notif.link || "/employee/tasks");
                            }}
                          >
                            View Assigned Tasks <FiArrowRight size={11} />
                          </button>
                        </div>
                      )}

                      {/* Quick action buttons for Super Admin / Admin / HR on Leave notifications */}
                      {(notif.type === "leave_applied" || notif.relatedLeave) && (
                        <div className="notif-actions-wrap" onClick={(e) => e.stopPropagation()}>
                          {canManageLeave && notif.relatedLeave && (
                            <div className="notif-btn-group">
                              {currentStatus === "Approved" ? (
                                <span className="notif-decision-badge approved">
                                  <FiCheckCircle size={12} /> Approved
                                </span>
                              ) : currentStatus === "Rejected" ? (
                                <span className="notif-decision-badge rejected">
                                  <FiXCircle size={12} /> Rejected
                                </span>
                              ) : currentStatus?.startsWith("Error:") ? (
                                <span className="notif-decision-badge error">{currentStatus}</span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="notif-action-btn notif-btn-approve"
                                    onClick={() => handleActionLeave(notif, "approve")}
                                    disabled={!!actionLoading[notif._id]}
                                  >
                                    <FiCheckCircle size={12} />
                                    {actionLoading[notif._id] === "approve" ? "Approving…" : "Approve"}
                                  </button>
                                  <button
                                    type="button"
                                    className="notif-action-btn notif-btn-reject"
                                    onClick={() => handleActionLeave(notif, "reject")}
                                    disabled={!!actionLoading[notif._id]}
                                  >
                                    <FiXCircle size={12} />
                                    {actionLoading[notif._id] === "reject" ? "Rejecting…" : "Reject"}
                                  </button>
                                </>
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            className="notif-view-leave-link"
                            onClick={() => {
                              setIsOpen(false);
                              navigate("/leave");
                            }}
                          >
                            Open Leave Management <FiArrowRight size={11} />
                          </button>
                        </div>
                      )}
                    </div>

                    {!notif.read && (
                      <button
                        type="button"
                        className="notif-read-dot-btn"
                        onClick={(e) => handleMarkRead(notif._id, e)}
                        title="Mark as read"
                        aria-label="Mark notification as read"
                      >
                        <span className="notif-unread-dot" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}