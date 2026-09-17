import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useToast } from "../../context/ToastContext.jsx";
import {
  getSuperAdminPayroll,
  paySingleSalary,
  payBonus,
  payAllSalaries,
  updateEmployeePayrollConfig,
} from "../../services/superAdminPayrollService.js";
import Card from "../../components/Card/Card.jsx";
import Button from "../../components/Button/Button.jsx";
import Table from "../../components/Table/Table.jsx";
import Modal from "../../components/Modal/Modal.jsx";
import {
  FiDollarSign,
  FiSend,
  FiCheckCircle,
  FiClock,
  FiGift,
  FiLock,
  FiSearch,
  FiRefreshCw,
  FiEdit2,
  FiBriefcase,
  FiCreditCard,
  FiLayers,
  FiAlertCircle,
  FiShield,
} from "react-icons/fi";
import "./SuperAdminPayroll.css";

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export default function SuperAdminPayroll() {
  const { showToast } = useToast();

  const currentDate = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const [loading, setLoading] = useState(true);
  const [payrollData, setPayrollData] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrgFilter, setSelectedOrgFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [paySalaryModalData, setPaySalaryModalData] = useState(null);
  const [submittingPaySalary, setSubmittingPaySalary] = useState(false);

  const [bonusModalData, setBonusModalData] = useState(null);
  const [bonusAmount, setBonusAmount] = useState(50000);
  const [submittingBonus, setSubmittingBonus] = useState(false);

  const [isPayAllModalOpen, setIsPayAllModalOpen] = useState(false);
  const [submittingPayAll, setSubmittingPayAll] = useState(false);

  const [editConfigModalData, setEditConfigModalData] = useState(null);
  const [editSalaryVal, setEditSalaryVal] = useState(50000);
  const [editPfPercentage, setEditPfPercentage] = useState(12);
  const [editAccountVal, setEditAccountVal] = useState("");
  const [editIfscVal, setEditIfscVal] = useState("");
  const [editBankNameVal, setEditBankNameVal] = useState("");
  const [editBranchVal, setEditBranchVal] = useState("");
  const [editUpiVal, setEditUpiVal] = useState("");
  const [submittingConfig, setSubmittingConfig] = useState(false);

  // Fetch payroll data
  const fetchPayroll = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getSuperAdminPayroll(selectedMonth, selectedYear, selectedOrgFilter);
      if (res && res.success) {
        const rawRecords = res.records || res.data?.records || res.data?.employees || [];
        const normalizedEmployees = rawRecords.map((r) => ({
          _id: r._id,
          employeeId: r._id,
          code: r.employeeCode || r.code || "EMP001",
          name: r.name || "Employee",
          email: r.email,
          phone: r.phone,
          role: r.role || "Employee",
          department: r.department || "General",
          organization: {
            _id: r.organizationId || r.organization?._id,
            name: r.organizationName || r.organization?.name || "Infinetra Technologies",
          },
          organizationName: r.organizationName || r.organization?.name || "Infinetra Technologies",
          accountNumber: r.accountNumber || "XXXX6787",
          rawAccountNumber: r.rawAccountNumber || r.accountNumber || "XXXX6787",
          bankAccountNumber: r.bankAccountNumber || r.rawAccountNumber || r.accountNumber || "",
          hasBankAccount: Boolean(r.hasBankAccount),
          ifscCode: r.ifscCode || "HDFC0001234",
          bankName: r.bankName || "HDFC Bank",
          branch: r.branch || "Main Branch",
          upiId: r.upiId || "",
          monthSalary: Number(r.monthSalary) || 50000,
          yearlySalary: Number(r.yearlySalary) || (Number(r.monthSalary) || 50000) * 12,
          pfPercentage: r.pfPercentage !== undefined ? Number(r.pfPercentage) : (r.pf_percentage !== undefined ? Number(r.pf_percentage) : 12),
          pfAmount: r.pfAmount !== undefined ? Number(r.pfAmount) : Math.round(((Number(r.monthSalary) || 50000) * (r.pfPercentage !== undefined ? Number(r.pfPercentage) : 12)) / 100),
          totalPf: r.total_pf !== undefined ? Number(r.total_pf) : (r.totalPf !== undefined ? Number(r.totalPf) : (Number(r.totalAccumulatedPf) || 0)),
          netSalary: r.netSalary !== undefined ? Number(r.netSalary) : ((Number(r.monthSalary) || 50000) - (r.pfAmount || Math.round(((Number(r.monthSalary) || 50000) * 12) / 100))),
          remainingSalary: r.remainingSalary !== undefined ? Number(r.remainingSalary) : (Number(r.monthSalary) || 50000) * 12,
          paidCountThisYear: r.monthsPaidCount || r.paidCountThisYear || 0,
          paidThisYearAmount: r.totalPaidThisYear || 0,
          currentMonthStatus: r.status === "Sending" || r.status === "Paid" ? "Sending" : "Pending",
          status: r.status === "Sending" || r.status === "Paid" ? "Sending" : "Pending",
          isPayLocked: Boolean(r.isPayLocked),
          payLockRemainingDays: r.payLockRemainingDays || 0,
          payLockText: r.payLockText || (r.isPayLocked ? "Paid (30d lock)" : "Pay"),
          isBonusEligible: r.isBonusEligible !== undefined ? r.isBonusEligible : true,
          bonusCooldownText: r.bonusCooldownText || "Active (Eligible)",
          bonusCooldownMonths: r.bonusCooldownMonths || 0,
        }));

        const totalSending = res.totalSendingAmount !== undefined
          ? res.totalSendingAmount
          : normalizedEmployees.filter(e => e.status === "Pending").reduce((s, e) => s + e.monthSalary, 0);

        const totalPaid = res.totalPaidAmount !== undefined
          ? res.totalPaidAmount
          : normalizedEmployees.filter(e => e.status === "Sending").reduce((s, e) => s + e.monthSalary, 0);

        // Compute or read PF statistics
        const computedCurrentMonthPf = res.current_month_total_pf !== undefined
          ? Number(res.current_month_total_pf)
          : normalizedEmployees.reduce((sum, e) => sum + (e.pfAmount || 0), 0);
        const computedAccumulatedPf = Number(res.total_accumulated_pf_active || 0);
        const computedSettledPf = Number(res.total_pf_settled_offboarded || 0);

        setPayrollData({
          monthName: res.monthName || "Current Month",
          year: res.selectedYear || selectedYear,
          totalSendingAmount: totalSending,
          totalPaidThisMonth: totalPaid,
          totalMonthlyPayrollBudget: totalSending + totalPaid,
          totalEmployeesCount: res.totalEmployees || normalizedEmployees.length,
          pendingCount: res.pendingCount !== undefined ? res.pendingCount : normalizedEmployees.filter(e => e.status === "Pending").length,
          paidCount: res.sentCount !== undefined ? res.sentCount : normalizedEmployees.filter(e => e.status === "Sending").length,
          current_month_total_pf: computedCurrentMonthPf,
          total_accumulated_pf_active: computedAccumulatedPf,
          total_pf_settled_offboarded: computedSettledPf,
          serverOrganizations: res.organizations || [],
          employees: normalizedEmployees,
        });
      }
    } catch (err) {
      console.error("Failed to load Super Admin payroll:", err);
      showToast(err.message || "Failed to load payroll records", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, selectedOrgFilter, showToast]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  // Extract unique organizations for filter
  const organizationsList = useMemo(() => {
    const orgMap = new Map();
    if (payrollData?.serverOrganizations?.length > 0) {
      payrollData.serverOrganizations.forEach((org) => {
        if (org._id) orgMap.set(String(org._id), org.name);
      });
    }
    if (payrollData?.employees) {
      payrollData.employees.forEach((emp) => {
        if (emp.organization?._id) {
          orgMap.set(String(emp.organization._id), emp.organization.name);
        }
      });
    }
    return Array.from(orgMap.entries()).map(([id, name]) => ({ id, name }));
  }, [payrollData]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    if (!payrollData?.employees) return [];
    return payrollData.employees.filter((emp) => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        emp.name?.toLowerCase().includes(q) ||
        emp.code?.toLowerCase().includes(q) ||
        emp.email?.toLowerCase().includes(q) ||
        emp.organization?.name?.toLowerCase().includes(q);

      // Org filter
      const matchesOrg =
        selectedOrgFilter === "all" ||
        emp.organization?._id === selectedOrgFilter;

      // Status filter
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "paid" && emp.currentMonthStatus === "Paid") ||
        (statusFilter === "pending" && emp.currentMonthStatus === "Pending");

      return matchesSearch && matchesOrg && matchesStatus;
    });
  }, [payrollData, searchQuery, selectedOrgFilter, statusFilter]);

  // Action handlers
  const handleOpenPaySalaryModal = (employee) => {
    setPaySalaryModalData(employee);
    if (!employee.hasBankAccount) {
      showToast(
        `Notice: No bank account number is set for ${employee.name}. Default payment route will be used.`,
        "warning"
      );
    }
  };

  const handleConfirmPaySalary = async () => {
    if (!paySalaryModalData) return;
    try {
      setSubmittingPaySalary(true);
      const res = await paySingleSalary({
        employeeId: paySalaryModalData.employeeId,
        month: selectedMonth,
        year: selectedYear,
        paymentMethod: "Bank Transfer",
        notes: `Salary credited by Super Admin for ${payrollData?.monthName || "current month"}`,
      });

      if (res && res.success) {
        showToast(
          res.message ||
            `Salary of ₹${(paySalaryModalData.netSalary || paySalaryModalData.monthSalary).toLocaleString()} credited successfully! Email and notifications sent.`,
          "success"
        );
        setPaySalaryModalData(null);
        window.dispatchEvent(new Event("notification-updated"));
        fetchPayroll();
      }
    } catch (err) {
      console.error("Pay salary failed:", err);
      showToast(err.message || "Failed to disburse salary", "error");
    } finally {
      setSubmittingPaySalary(false);
    }
  };

  const handleOpenBonusModal = (employee) => {
    setBonusModalData(employee);
    setBonusAmount(employee.monthSalary || 50000);
  };

  const handleConfirmBonus = async () => {
    if (!bonusModalData) return;
    try {
      setSubmittingBonus(true);
      const res = await payBonus({
        employeeId: bonusModalData.employeeId,
        amount: Number(bonusAmount),
        notes: `Annual bonus credited by Super Admin`,
      });

      if (res && res.success) {
        showToast(
          res.message ||
            `Bonus of ₹${Number(bonusAmount).toLocaleString()} credited successfully! 12-month lock activated.`,
          "success"
        );
        setBonusModalData(null);
        window.dispatchEvent(new Event("notification-updated"));
        fetchPayroll();
      }
    } catch (err) {
      console.error("Pay bonus failed:", err);
      showToast(err.message || "Failed to disburse bonus", "error");
    } finally {
      setSubmittingBonus(false);
    }
  };

  const handleOpenPayAllModal = () => {
    setIsPayAllModalOpen(true);
  };

  const handleConfirmPayAll = async () => {
    try {
      setSubmittingPayAll(true);
      const res = await payAllSalaries({
        month: selectedMonth,
        year: selectedYear,
        paymentMethod: "Bank Transfer",
        notes: `Bulk payroll batch disbursement by Super Admin for ${payrollData?.monthName} ${payrollData?.year}`,
      });

      if (res && res.success) {
        showToast(
          res.message ||
            `Batch payment completed! Disbursed to ${res.processedCount} employees. Emails & notifications sent.`,
          "success"
        );
        setIsPayAllModalOpen(false);
        window.dispatchEvent(new Event("notification-updated"));
        fetchPayroll();
      }
    } catch (err) {
      console.error("Pay all failed:", err);
      showToast(err.message || "Failed to process bulk payroll", "error");
    } finally {
      setSubmittingPayAll(false);
    }
  };

  const handleOpenConfigModal = (employee) => {
    setEditConfigModalData(employee);
    setEditSalaryVal(employee.monthSalary || 50000);
    setEditPfPercentage(employee.pfPercentage !== undefined ? employee.pfPercentage : 12);
    setEditAccountVal(employee.bankAccountNumber || employee.rawAccountNumber || employee.accountNumber || "");
    setEditIfscVal(employee.ifscCode || "");
    setEditBankNameVal(employee.bankName || "");
    setEditBranchVal(employee.branch || "");
    setEditUpiVal(employee.upiId || "");
  };

  const handleConfirmConfig = async () => {
    if (!editConfigModalData) return;
    try {
      setSubmittingConfig(true);
      const res = await updateEmployeePayrollConfig(editConfigModalData.employeeId, {
        month_salary: Number(editSalaryVal),
        pf_percentage: Number(editPfPercentage),
        bank_account_number: editAccountVal,
        account_number: editAccountVal,
        ifsc_code: editIfscVal,
        bank_name: editBankNameVal,
        branch: editBranchVal,
        upi_id: editUpiVal,
      });

      if (res && res.success) {
        showToast("Payroll & banking details updated successfully!", "success");
        setEditConfigModalData(null);
        fetchPayroll();
      }
    } catch (err) {
      console.error("Update config failed:", err);
      showToast(err.message || "Failed to update configuration", "error");
    } finally {
      setSubmittingConfig(false);
    }
  };

  // Table column configuration matching exact user request:
  // EmpID | Employeename | month_salary | display yearly salary | year-month salary / remaing amount | PF | pay button Month salary | Bonus | status
  const columns = [
    {
      key: "code",
      header: "EmpID",
      width: "100px",
      render: (row) => (
        <span className="emp-id-badge">{row.code || "EMP001"}</span>
      ),
    },
    {
      key: "name",
      header: "Employeename",
      minWidth: "240px",
      render: (row) => (
        <div className="emp-name-cell">
          <span className="emp-name-title">{row.name}</span>
          <div className="emp-meta-tags">
            <span
              className={`role-pill ${
                row.role === "HR Manager" ? "hr" : "employee"
              }`}
            >
              {row.role}
            </span>
            <span className="org-pill">
              {row.organization?.name || "Infinetra Technologies"}
            </span>
          </div>
          <div className="account-num-sub" title="Bank Details">
            <FiCreditCard size={11} /> {row.accountNumber || "XXXX6787"}
            {row.bankName && <span className="bank-meta">{row.bankName}</span>}
            {row.ifscCode && <span className="bank-meta">{row.ifscCode}</span>}
            {row.upiId && <span className="bank-meta">UPI: {row.upiId}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "month_salary",
      header: "month_salary",
      width: "140px",
      render: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span className="salary-val-cell">
            ₹{Number(row.monthSalary).toLocaleString("en-IN")}/-
          </span>
          <button
            onClick={() => handleOpenConfigModal(row)}
            title="Edit salary, yearly calculation & banking details"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#6366f1",
              padding: "3px 5px",
              borderRadius: "4px",
            }}
          >
            <FiEdit2 size={13} />
          </button>
        </div>
      ),
    },
    {
      key: "yearly_salary",
      header: "display yearly salary",
      width: "160px",
      render: (row) => (
        <span className="salary-yearly-val">
          ₹{Number(row.yearlySalary).toLocaleString("en-IN")}/-
        </span>
      ),
    },
    {
      key: "remaining_salary",
      header: "year-month salary / remaing amount",
      minWidth: "180px",
      render: (row) => (
        <div>
          <div className="remaining-val-cell">
            ₹{Number(row.remainingSalary).toLocaleString("en-IN")}/-
          </div>
          <div className="remaining-subtext">
            {row.paidCountThisYear > 0
              ? `${row.paidCountThisYear}/12 paid (₹${row.paidThisYearAmount.toLocaleString("en-IN")})`
              : "0/12 months paid"}
          </div>
        </div>
      ),
    },
    {
      key: "pf_amount",
      header: "PF",
      width: "130px",
      render: (row) => {
        const pfVal = row.pfAmount !== undefined ? row.pfAmount : Math.round(((row.monthSalary || 50000) * (row.pfPercentage || 12)) / 100);
        return (
          <div>
            <div style={{ fontWeight: "700", color: "#6366f1", fontSize: "14px" }}>
              ₹{Number(pfVal).toLocaleString("en-IN")}/-
            </div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>
              ({row.pfPercentage || 12}% PF)
            </div>
          </div>
        );
      },
    },
    {
      key: "total_pf",
      header: "Total PF",
      width: "135px",
      render: (row) => {
        const totalPfVal = row.totalPf !== undefined ? row.totalPf : (row.total_pf !== undefined ? row.total_pf : 0);
        return (
          <div>
            <div style={{ fontWeight: "700", color: "#059669", fontSize: "14px" }}>
              ₹{Number(totalPfVal || 0).toLocaleString("en-IN")}/-
            </div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>
              Accumulated
            </div>
          </div>
        );
      },
    },
    {
      key: "pay_salary_action",
      header: "pay button Month salary",
      width: "165px",
      render: (row) => {
        if (row.isPayLocked) {
          return (
            <button
              className="btn-row-paid"
              disabled
              title={`Salary payment is locked for 30 days after disbursement. Remaining: ${row.payLockRemainingDays || 30} days.`}
            >
              <FiLock size={12} /> {row.payLockText || "Paid (30d lock)"}
            </button>
          );
        }
        return (
          <button
            className="btn-row-pay"
            onClick={() => handleOpenPaySalaryModal(row)}
            title={`Pay ${row.name} for ${payrollData?.monthName || "current month"}`}
          >
            <FiDollarSign size={13} /> Pay
          </button>
        );
      },
    },
    {
      key: "bonus_action",
      header: "Bonus",
      minWidth: "170px",
      render: (row) => {
        if (!row.isBonusEligible) {
          return (
            <button
              className="btn-bonus-locked"
              disabled
              title={`Bonus locked: ${row.bonusCooldownText}`}
            >
              <FiLock size={12} /> {row.bonusCooldownText}
            </button>
          );
        }
        return (
          <button
            className="btn-bonus-pay"
            onClick={() => handleOpenBonusModal(row)}
            title="Credit annual bonus (12-month lock activates upon payment)"
          >
            <FiGift size={13} /> Pay Bonus
          </button>
        );
      },
    },
    {
      key: "status",
      header: "status",
      width: "120px",
      render: (row) => {
        const isSending = row.status === "Sending" || row.isPayLocked;
        return (
          <span className={`status-pill ${isSending ? "sent" : "pending"}`}>
            {isSending ? (
              <>
                <FiCheckCircle size={12} /> Sending
              </>
            ) : (
              <>
                <FiClock size={12} /> Pending
              </>
            )}
          </span>
        );
      },
    },
  ];

  const totalSendingAmount = payrollData?.totalSendingAmount || 0;
  const pendingCount = payrollData?.pendingCount || 0;
  const paidCount = payrollData?.paidCount || 0;
  const eligibleBonusCount = useMemo(() => {
    if (!payrollData?.employees) return 0;
    return payrollData.employees.filter((e) => e.isBonusEligible).length;
  }, [payrollData]);

  return (
    <div className="sa-payroll-container">
      {/* Top Header Banner */}
      <div className="sa-payroll-header">
        <div>
          <h1 className="sa-payroll-header-title">
            <FiDollarSign className="header-icon" /> Super Admin Payroll & Disbursements
          </h1>
          <p className="sa-payroll-header-subtitle">
            Enterprise compensation center: view HR and employee salaries, trigger instant bank credits, and disburse 12-month locked bonuses.
          </p>
        </div>

        <div className="sa-payroll-header-actions">
          {/* payment All Employees Button */}
          <button
            className="btn-pay-all"
            onClick={handleOpenPayAllModal}
            disabled={pendingCount === 0 || loading}
            title={
              pendingCount === 0
                ? "All employees have already been paid for this month"
                : `Pay all ${pendingCount} pending employees at once`
            }
          >
            <FiSend size={16} /> Pay All Employees ({pendingCount})
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="sa-payroll-kpi-grid">
        {/* Total sending amount card requested */}
        <div className="sa-kpi-card hero-sending-card">
          <div>
            <div className="kpi-header">
              <span className="kpi-label">Total Sending Amount</span>
              <span className="kpi-icon-pill" style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}>
                <FiSend />
              </span>
            </div>
            <div className="kpi-amount-val">
              ₹{totalSendingAmount.toLocaleString("en-IN")}
              <span className="curr-suffix">/-</span>
            </div>
          </div>
          <div className="kpi-footer-note">
            <FiClock size={12} /> For {payrollData?.monthName || "Selected Month"} {payrollData?.year || selectedYear} • {pendingCount} Pending Payment{pendingCount === 1 ? "" : "s"}
          </div>
        </div>

        <div className="sa-kpi-card">
          <div>
            <div className="kpi-header">
              <span className="kpi-label">Total Monthly Payroll</span>
              <span className="kpi-icon-pill indigo">
                <FiDollarSign />
              </span>
            </div>
            <div className="kpi-amount-val">
              ₹{(payrollData?.totalMonthlyPayrollBudget || 0).toLocaleString("en-IN")}/-
            </div>
          </div>
          <div className="kpi-footer-note">
            {payrollData?.totalEmployeesCount || 0} Total HRs & Employees Enrolled
          </div>
        </div>

        <div className="sa-kpi-card">
          <div>
            <div className="kpi-header">
              <span className="kpi-label">Disbursed This Month</span>
              <span className="kpi-icon-pill emerald">
                <FiCheckCircle />
              </span>
            </div>
            <div className="kpi-amount-val" style={{ color: "#10b981" }}>
              ₹{(payrollData?.totalPaidThisMonth || 0).toLocaleString("en-IN")}/-
            </div>
          </div>
          <div className="kpi-footer-note">
            {paidCount} Disbursed & Email Sent
          </div>
        </div>

        <div className="sa-kpi-card">
          <div>
            <div className="kpi-header">
              <span className="kpi-label">Bonus Eligibility</span>
              <span className="kpi-icon-pill amber">
                <FiGift />
              </span>
            </div>
            <div className="kpi-amount-val" style={{ color: "#f59e0b" }}>
              {eligibleBonusCount} Eligible
            </div>
          </div>
          <div className="kpi-footer-note">
            12-Month Cooldown Lock Enforced
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="sa-payroll-toolbar">
        <div className="sa-toolbar-filters">
          {/* Month Selector */}
          <div className="sa-filter-group">
            <label className="sa-filter-label">Month:</label>
            <select
              className="sa-select-input"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div className="sa-filter-group">
            <label className="sa-filter-label">Year:</label>
            <select
              className="sa-select-input"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Organization Filter */}
          <div className="sa-filter-group">
            <label className="sa-filter-label">Organization:</label>
            <select
              className="sa-select-input"
              value={selectedOrgFilter}
              onChange={(e) => setSelectedOrgFilter(e.target.value)}
            >
              <option value="all">All Organizations</option>
              {organizationsList.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="sa-filter-group">
            <label className="sa-filter-label">Status:</label>
            <select
              className="sa-select-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="paid">Sent / Paid</option>
            </select>
          </div>
        </div>

        {/* Search & Refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="sa-search-box">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search ID, name, org..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sa-search-input"
            />
          </div>

          <button
            onClick={fetchPayroll}
            title="Refresh payroll data"
            className="sa-select-input"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <FiRefreshCw className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="sa-payroll-table-card">
        <Table
          columns={columns}
          data={filteredEmployees}
          loading={loading}
          emptyText={`No employees or HR managers found for ${payrollData?.monthName || "the selected month"}.`}
        />
      </div>

      {/* =========================================================================
          MODAL 1: Pay Single Month Salary
          ========================================================================= */}
      <Modal
        isOpen={Boolean(paySalaryModalData)}
        onClose={() => !submittingPaySalary && setPaySalaryModalData(null)}
        title="Disburse Monthly Salary"
        size="md"
        footer={
          <div className="modal-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPaySalaryModalData(null)}
              disabled={submittingPaySalary}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmPaySalary}
              disabled={submittingPaySalary}
            >
              {submittingPaySalary ? "Processing Payment..." : "Confirm & Send Salary"}
            </Button>
          </div>
        }
      >
        {paySalaryModalData && (
          <div>
            <div className="modal-alert-info">
              <FiAlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>Automated Notification & Email:</strong> Upon payment confirmation, an official salary credit confirmation email will be dispatched to <strong>{paySalaryModalData.email}</strong> and Super Admin's email, plus an instant in-app notification will be added to the recipient's notification bell.
              </div>
            </div>

            <div className="modal-detail-box">
              <div className="modal-detail-row">
                <span className="modal-detail-label">Employee Name:</span>
                <span className="modal-detail-value">{paySalaryModalData.name} ({paySalaryModalData.role})</span>
              </div>
              <div className="modal-detail-row">
                <span className="modal-detail-label">Employee ID:</span>
                <span className="modal-detail-value">{paySalaryModalData.code}</span>
              </div>
              <div className="modal-detail-row">
                <span className="modal-detail-label">Organization:</span>
                <span className="modal-detail-value">{paySalaryModalData.organization?.name || "Infinetra Technologies"}</span>
              </div>
              <div className="modal-detail-row">
                <span className="modal-detail-label">Crediting Account:</span>
                <span className="modal-detail-value" style={{ fontFamily: "monospace", fontSize: "14px" }}>
                  {paySalaryModalData.accountNumber || "XXXX6787"}
                </span>
              </div>
              <div className="modal-detail-row">
                <span className="modal-detail-label">Salary Month:</span>
                <span className="modal-detail-value">{payrollData?.monthName} {payrollData?.year}</span>
              </div>
              <div className="modal-detail-row">
                <span className="modal-detail-label">Monthly Gross Salary:</span>
                <span className="modal-detail-value">₹{Number(paySalaryModalData.monthSalary).toLocaleString("en-IN")}/-</span>
              </div>
              <div className="modal-detail-row">
                <span className="modal-detail-label">PF Deduction ({paySalaryModalData.pfPercentage || 12}%):</span>
                <span className="modal-detail-value" style={{ color: "#dc2626", fontWeight: 600 }}>
                  - ₹{Number(paySalaryModalData.pfAmount || Math.round((paySalaryModalData.monthSalary * (paySalaryModalData.pfPercentage || 12)) / 100)).toLocaleString("en-IN")}/-
                </span>
              </div>
              <div className="modal-detail-row" style={{ paddingTop: "12px", borderTop: "2px solid #e2e8f0" }}>
                <span className="modal-detail-label" style={{ fontSize: "15px", fontWeight: 700 }}>Net Disbursement:</span>
                <span className="modal-amount-highlight">
                  ₹{Number(paySalaryModalData.netSalary || (paySalaryModalData.monthSalary - (paySalaryModalData.pfAmount || 0))).toLocaleString("en-IN")}/-
                </span>
              </div>
              {!paySalaryModalData.hasBankAccount && (
                <div style={{ marginTop: "10px", padding: "8px 12px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "6px", fontSize: "12px", color: "#92400e" }}>
                  ⚠️ <strong>Notice:</strong> No custom bank account number is configured for this employee. Payment will proceed using the default account identifier.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* =========================================================================
          MODAL 2: Pay Bonus (With 12-Month Lock Notice)
          ========================================================================= */}
      <Modal
        isOpen={Boolean(bonusModalData)}
        onClose={() => !submittingBonus && setBonusModalData(null)}
        title="Disburse Annual Bonus"
        size="md"
        footer={
          <div className="modal-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setBonusModalData(null)}
              disabled={submittingBonus}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmBonus}
              disabled={submittingBonus || !bonusAmount || bonusAmount <= 0}
              style={{ background: "#f59e0b", borderColor: "#d97706" }}
            >
              {submittingBonus ? "Crediting Bonus..." : "Confirm & Pay Bonus"}
            </Button>
          </div>
        }
      >
        {bonusModalData && (
          <div>
            <div className="modal-alert-warning">
              <FiLock size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>12-Month Lock Policy:</strong> Once this bonus is confirmed, bonus disbursement for <strong>{bonusModalData.name}</strong> will be <strong>strictly locked for 12 months</strong>. The system will track and display the remaining lock countdown in months.
              </div>
            </div>

            <div className="modal-detail-box">
              <div className="modal-detail-row">
                <span className="modal-detail-label">Recipient:</span>
                <span className="modal-detail-value">{bonusModalData.name} ({bonusModalData.code})</span>
              </div>
              <div className="modal-detail-row">
                <span className="modal-detail-label">Organization:</span>
                <span className="modal-detail-value">{bonusModalData.organization?.name || "Infinetra Technologies"}</span>
              </div>
              <div className="modal-detail-row">
                <span className="modal-detail-label">Crediting Account:</span>
                <span className="modal-detail-value" style={{ fontFamily: "monospace" }}>
                  {bonusModalData.accountNumber || "XXXX6787"}
                </span>
              </div>
              <div className="modal-detail-row">
                <span className="modal-detail-label">Regular Monthly Salary:</span>
                <span className="modal-detail-value">₹{Number(bonusModalData.monthSalary).toLocaleString("en-IN")}/-</span>
              </div>
            </div>

            <div style={{ marginTop: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1e293b", marginBottom: "6px" }}>
                Bonus Amount to Credit (₹)
              </label>
              <input
                type="number"
                min={1000}
                step={500}
                value={bonusAmount}
                onChange={(e) => setBonusAmount(Number(e.target.value))}
                className="sa-select-input"
                style={{ width: "100%", fontSize: "16px", fontWeight: 700, padding: "10px 14px" }}
              />
              <span style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", display: "block" }}>
                Default: 1 full month salary (₹{bonusModalData.monthSalary.toLocaleString("en-IN")})
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* =========================================================================
          MODAL 3: Pay All Employees Batch Confirmation
          ========================================================================= */}
      <Modal
        isOpen={isPayAllModalOpen}
        onClose={() => !submittingPayAll && setIsPayAllModalOpen(false)}
        title="Disburse Payroll to All Pending Employees"
        size="md"
        footer={
          <div className="modal-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsPayAllModalOpen(false)}
              disabled={submittingPayAll}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmPayAll}
              disabled={submittingPayAll || pendingCount === 0}
              style={{ background: "#10b981", borderColor: "#059669" }}
            >
              {submittingPayAll ? "Processing All Payments..." : `Disburse to All ${pendingCount} Employees`}
            </Button>
          </div>
        }
      >
        <div>
          <div className="modal-alert-info">
            <FiSend size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <strong>Batch Processing:</strong> This will process bank disbursements for all <strong>{pendingCount}</strong> pending employees and HR managers for <strong>{payrollData?.monthName} {payrollData?.year}</strong>. Each employee will receive their individual email confirmation and notification.
            </div>
          </div>

          <div className="modal-detail-box">
            <div className="modal-detail-row">
              <span className="modal-detail-label">Payroll Period:</span>
              <span className="modal-detail-value">{payrollData?.monthName} {payrollData?.year}</span>
            </div>
            <div className="modal-detail-row">
              <span className="modal-detail-label">Pending Recipients:</span>
              <span className="modal-detail-value">{pendingCount} workforce members</span>
            </div>
            <div className="modal-detail-row" style={{ paddingTop: "12px", borderTop: "2px solid #e2e8f0" }}>
              <span className="modal-detail-label" style={{ fontSize: "15px", fontWeight: 700 }}>Total Disbursement Amount:</span>
              <span className="modal-amount-highlight">
                ₹{totalSendingAmount.toLocaleString("en-IN")}/-
              </span>
            </div>
          </div>
        </div>
      </Modal>

      {/* =========================================================================
          MODAL 4: Quick Edit Employee Salary, Live Yearly & Banking Settings
          ========================================================================= */}
      <Modal
        isOpen={Boolean(editConfigModalData)}
        onClose={() => !submittingConfig && setEditConfigModalData(null)}
        title="Edit Employee Payroll & Banking Settings"
        size="md"
        footer={
          <div className="modal-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditConfigModalData(null)}
              disabled={submittingConfig}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmConfig}
              disabled={submittingConfig || !editSalaryVal || editSalaryVal <= 0}
            >
              {submittingConfig ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        }
      >
        {editConfigModalData && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", fontWeight: 700, letterSpacing: "0.05em" }}>
                Target Employee
              </div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                {editConfigModalData.name} ({editConfigModalData.code})
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                {editConfigModalData.role} • {editConfigModalData.organizationName}
              </div>
            </div>

            {/* Monthly Salary Input with Live Calculation */}
            <div className="form-field-group">
              <label className="form-field-label">
                Monthly Salary (₹) <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={editSalaryVal}
                onChange={(e) => setEditSalaryVal(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 50000"
                className="form-field-input"
                style={{ width: "100%", fontSize: "15px", fontWeight: 700 }}
              />
            </div>

            {/* Dynamic Live Yearly Salary Display Card (Monthly Salary * 12) */}
            <div className="edit-salary-preview-card">
              <div className="preview-card-left">
                <span className="preview-card-title">Display Yearly Salary</span>
                <span className="preview-card-formula">
                  ₹{Number(editSalaryVal || 0).toLocaleString("en-IN")} × 12 months
                </span>
              </div>
              <div className="preview-card-amount">
                ₹{(Number(editSalaryVal || 0) * 12).toLocaleString("en-IN")}/-
              </div>
            </div>

            {/* PF Percentage Input with Live Computed Preview */}
            <div className="form-field-group">
              <label className="form-field-label">
                Provident Fund (PF) % <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={editPfPercentage}
                onChange={(e) => setEditPfPercentage(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="12"
                className="form-field-input"
                style={{ width: "100%", fontSize: "15px", fontWeight: 700 }}
              />
            </div>

            {/* Live-computed preview: PF deduction & Net payable */}
            {(() => {
              const sal = Number(editSalaryVal || 0);
              const pct = Number(editPfPercentage || 0);
              const pfDed = Math.round((sal * pct) / 100);
              const netPayable = sal - pfDed;
              return (
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "13px",
                    color: "#166534",
                    fontWeight: 600,
                  }}
                >
                  PF deduction: ₹{pfDed.toLocaleString("en-IN")} · Net payable: ₹{netPayable.toLocaleString("en-IN")}
                </div>
              );
            })()}

            {/* Banking Details Form Grid */}
            <div className="form-grid-2col">
              <div className="form-field-group">
                <label className="form-field-label">
                  <FiCreditCard size={12} /> Bank Account Number
                </label>
                <input
                  type="text"
                  value={editAccountVal}
                  onChange={(e) => setEditAccountVal(e.target.value)}
                  placeholder="e.g. 123456789012"
                  className="form-field-input"
                  style={{ fontFamily: "monospace" }}
                />
              </div>

              <div className="form-field-group">
                <label className="form-field-label">
                  IFSC Code
                </label>
                <input
                  type="text"
                  value={editIfscVal}
                  onChange={(e) => setEditIfscVal(e.target.value.toUpperCase())}
                  placeholder="e.g. HDFC0001234"
                  className="form-field-input"
                  style={{ textTransform: "uppercase", fontFamily: "monospace" }}
                />
              </div>

              <div className="form-field-group">
                <label className="form-field-label">
                  <FiBriefcase size={12} /> Bank Name
                </label>
                <input
                  type="text"
                  value={editBankNameVal}
                  onChange={(e) => setEditBankNameVal(e.target.value)}
                  placeholder="e.g. HDFC Bank"
                  className="form-field-input"
                />
              </div>

              <div className="form-field-group">
                <label className="form-field-label">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={editBranchVal}
                  onChange={(e) => setEditBranchVal(e.target.value)}
                  placeholder="e.g. Madhapur Branch"
                  className="form-field-input"
                />
              </div>
            </div>

            <div className="form-field-group">
              <label className="form-field-label">
                UPI ID (Virtual Payment Address)
              </label>
              <input
                type="text"
                value={editUpiVal}
                onChange={(e) => setEditUpiVal(e.target.value)}
                placeholder="e.g. name@okaxis / 9876543210@paytm"
                className="form-field-input"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}