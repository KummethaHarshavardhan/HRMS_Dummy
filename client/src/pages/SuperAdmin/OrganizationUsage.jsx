import React, { useState, useEffect } from "react";
import { useToast } from "../../context/ToastContext.jsx";
import {
  getOrganizationUsage,
  updateOrganizationLimit,
} from "../../services/superAdminService.js";
import Card from "../../components/Card/Card.jsx";
import Button from "../../components/Button/Button.jsx";
import Table from "../../components/Table/Table.jsx";
import Modal from "../../components/Modal/Modal.jsx";
import Loader from "../../components/Loader/Loader.jsx";
import {
  FiPieChart,
  FiUsers,
  FiCheckCircle,
  FiAlertTriangle,
  FiSliders,
} from "react-icons/fi";
import "./OrganizationUsage.css";

export default function OrganizationUsage() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState(null);

  // Update Limit Modal
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [newLimit, setNewLimit] = useState(50);
  const [submittingLimit, setSubmittingLimit] = useState(false);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      const res = await getOrganizationUsage();
      if (res?.success) {
        setUsageData(res);
      }
    } catch (err) {
      showToast("error", err.message || "Failed to load organization usage data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  const openUpdateLimit = (org) => {
    setSelectedOrg(org);
    setNewLimit(org.memberLimit || 50);
    setIsLimitModalOpen(true);
  };

  const handleUpdateLimitSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrg) return;

    const parsedLimit = parseInt(newLimit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      showToast("error", "Member limit must be a positive number of at least 1");
      return;
    }

    try {
      setSubmittingLimit(true);
      await updateOrganizationLimit(selectedOrg.id, parsedLimit);
      showToast("success", `Member limit for ${selectedOrg.name} updated to ${parsedLimit}`);
      setIsLimitModalOpen(false);
      fetchUsage();
    } catch (err) {
      showToast("error", err.message || "Failed to update member limit");
    } finally {
      setSubmittingLimit(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Organization",
      width: "24%",
      render: (row) => (
        <div>
          <strong style={{ display: "block", color: "#0f172a" }}>{row.name}</strong>
          <span style={{ fontSize: "12px", color: "#4f46e5", fontWeight: 700 }}>
            {row.orgCode}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "10%",
      render: (row) => (
        <span
          className={`sa-status-badge ${
            row.status === "Active" ? "sa-status-active" : "sa-status-inactive"
          }`}
        >
          ● {row.status}
        </span>
      ),
    },
    {
      key: "members",
      header: "Members Enrolled",
      width: "20%",
      render: (row) => (
        <div style={{ fontSize: "13px" }}>
          <strong style={{ color: "#1e293b" }}>{row.currentMemberCount}</strong>
          <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "6px" }}>
            ({row.hrCount} HR + {row.employeeCount} Employees)
          </span>
        </div>
      ),
    },
    {
      key: "limit",
      header: "Limit & Free Slots",
      width: "16%",
      render: (row) => (
        <div style={{ fontSize: "13px" }}>
          <span style={{ fontWeight: 600, color: "#334155", display: "block" }}>
            Cap: {row.memberLimit}
          </span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: row.remainingSlots <= 0 ? "#dc2626" : "#059669",
            }}
          >
            {row.remainingSlots <= 0
              ? "0 slots left (At Limit)"
              : `${row.remainingSlots} slots remaining`}
          </span>
        </div>
      ),
    },
    {
      key: "utilization",
      header: "Capacity Meter",
      width: "18%",
      render: (row) => {
        const pct = row.utilizationPercentage || 0;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#475569" }}>
              {pct}% Utilized
            </span>
            <div className="capacity-bar-track">
              <div
                className={`capacity-bar-fill ${
                  pct >= 100
                    ? "fill-danger"
                    : pct >= 80
                    ? "fill-warning"
                    : "fill-normal"
                }`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Action",
      width: "12%",
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openUpdateLimit(row)}
          title="Adjust member limit"
        >
          <FiSliders style={{ marginRight: 4 }} /> Set Limit
        </Button>
      ),
    },
  ];

  const summary = usageData?.summary;
  const breakdown = usageData?.breakdown || [];
  const nearCapacityCount = breakdown.filter((b) => b.isNearCapacity).length;

  return (
    <div className="usage-page-container">
      {/* Page Header */}
      <div className="usage-page-header">
        <div>
          <h1>Organization Usage & Member Limits</h1>
          <p>
            Monitor organization capacity, active member count, remaining slots, and enforce limits.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="usage-stats-grid">
        <div className="usage-stat-card">
          <div className="usage-stat-icon-wrapper usage-icon-blue">
            <FiPieChart size={24} />
          </div>
          <div className="usage-stat-details">
            <p>Total Capacity Pool</p>
            {loading ? (
              <Loader.Spinner size="sm" />
            ) : (
              <h2>{summary?.totalCapacity ?? 0}</h2>
            )}
            <span className="usage-trend-text">All organization limits combined</span>
          </div>
        </div>

        <div className="usage-stat-card">
          <div className="usage-stat-icon-wrapper usage-icon-purple">
            <FiUsers size={24} />
          </div>
          <div className="usage-stat-details">
            <p>Total Members Enrolled</p>
            {loading ? (
              <Loader.Spinner size="sm" />
            ) : (
              <h2>{summary?.totalMembers ?? 0}</h2>
            )}
            <span className="usage-trend-text">HR Managers + Employees</span>
          </div>
        </div>

        <div className="usage-stat-card">
          <div className="usage-stat-icon-wrapper usage-icon-green">
            <FiCheckCircle size={24} />
          </div>
          <div className="usage-stat-details">
            <p>Remaining Slots Available</p>
            {loading ? (
              <Loader.Spinner size="sm" />
            ) : (
              <h2>{summary?.totalRemaining ?? 0}</h2>
            )}
            <span className="usage-trend-text">Available across all tenants</span>
          </div>
        </div>

        <div className="usage-stat-card">
          <div className="usage-stat-icon-wrapper usage-icon-amber">
            <FiAlertTriangle size={24} />
          </div>
          <div className="usage-stat-details">
            <p>High Capacity Alerts</p>
            {loading ? (
              <Loader.Spinner size="sm" />
            ) : (
              <h2>{nearCapacityCount}</h2>
            )}
            <span className="usage-trend-text">Organizations &ge; 80% full</span>
          </div>
        </div>
      </div>

      {/* Usage Table Card */}
      <Card
        title="Tenant Organizations Capacity Quota"
        subtitle="Live calculation of enrolled members against enforced member limits"
      >
        <Table
          columns={columns}
          data={breakdown}
          loading={loading}
          emptyText="No organization quota data available."
        />
      </Card>

      {/* =====================================================
          MODAL: Update Member Limit
         ===================================================== */}
      <Modal
        isOpen={isLimitModalOpen}
        onClose={() => setIsLimitModalOpen(false)}
        title={`Update Member Limit: ${selectedOrg?.name || ""}`}
        size="md"
        footer={
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsLimitModalOpen(false)}
              disabled={submittingLimit}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpdateLimitSubmit}
              disabled={submittingLimit}
            >
              {submittingLimit ? "Updating..." : "Save Member Limit"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleUpdateLimitSubmit} className="sa-modal-form">
          <div className="sa-form-group">
            <label className="sa-form-label">Organization Name</label>
            <input
              type="text"
              className="sa-form-input"
              value={`${selectedOrg?.name || ""} (${selectedOrg?.orgCode || ""})`}
              disabled
              style={{ background: "#f8fafc", color: "#475569", cursor: "not-allowed", fontWeight: 600 }}
            />
          </div>

          <div className="sa-form-group">
            <label className="sa-form-label">Currently Enrolled Members</label>
            <input
              type="text"
              className="sa-form-input"
              value={`${selectedOrg?.currentMemberCount || 0} members (${selectedOrg?.hrCount || 0} HR + ${selectedOrg?.employeeCount || 0} Employees)`}
              disabled
              style={{ background: "#f8fafc", color: "#475569", cursor: "not-allowed" }}
            />
          </div>

          <div className="sa-form-group">
            <label className="sa-form-label">
              New Member Limit <span>*</span>
            </label>
            <input
              type="number"
              min="1"
              className="sa-form-input"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              required
            />
            <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
              Backend enforces this limit. When reached, further HR or employee creations are blocked.
            </span>
          </div>
        </form>
      </Modal>
    </div>
  );
}