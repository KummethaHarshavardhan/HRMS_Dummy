import { useState, useEffect } from "react";
import { applyLeave } from "../../services/leaveService";
import { getAllHolidays } from "../../services/holidayService";
import { useToast } from "../../context/ToastContext";
import { FiCalendar, FiFileText, FiSend, FiCheckCircle, FiAlertCircle, FiInfo } from "react-icons/fi";

export default function ApplyLeave({ refreshLeaves }) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    leaveType: "",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    getAllHolidays({ year: new Date().getFullYear() })
      .then((data) => {
        const now = new Date();
        const futureOpt = (data?.holidays || [])
          .filter(
            (h) =>
              (h.type === "Optional" || h.type === "Restricted") &&
              new Date(h.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
          )
          .slice(0, 4);
        setUpcomingHolidays(futureOpt);
      })
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.leaveType || !formData.startDate || !formData.endDate || !formData.reason.trim()) {
      const msg = "Please fill in all required fields.";
      setMessage({ type: "error", text: msg });
      showToast("error", msg);
      return;
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      const msg = "End date cannot be before start date.";
      setMessage({ type: "error", text: msg });
      showToast("error", msg);
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: "", text: "" });
      await applyLeave(formData);

      const msg = "Leave application submitted successfully.";
      setMessage({ type: "success", text: msg });
      showToast("success", msg);
      setFormData({ leaveType: "", startDate: "", endDate: "", reason: "" });

      if (refreshLeaves) refreshLeaves();
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message || "Failed to apply for leave.";
      setMessage({
        type: "error",
        text: errMsg,
      });
      showToast("error", errMsg);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="apply-leave-container">
      <div className="leave-sub-header">
        <h2 className="leave-sub-title">
          <FiCalendar size={18} /> Apply for Leave
        </h2>
      </div>

      {upcomingHolidays.length > 0 && (
        <div
          style={{
            background: "#f5f3ff",
            border: "1px solid #ddd6fe",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 13,
            color: "#5b21b6",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 6 }}>
            <FiInfo size={15} /> Upcoming Optional / Restricted Holidays:
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {upcomingHolidays.map((h) => (
              <span
                key={h._id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #c4b5fd",
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#6d28d9",
                }}
              >
                {h.name} — {new Date(h.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} ({h.type})
              </span>
            ))}
          </div>
        </div>
      )}

      <form className="leave-apply-form" onSubmit={handleSubmit}>
        <div className="leave-form-grid">
          <div className="form-group">
            <label className="form-label">Leave Type <span style={{ color: "var(--danger)" }}>*</span></label>
            <select
              name="leaveType"
              value={formData.leaveType}
              onChange={handleChange}
              required
            >
              <option value="">Select Leave Type</option>
              <option value="Sick">Sick Leave</option>
              <option value="Casual">Casual Leave</option>
              <option value="Annual">Annual Leave</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Start Date <span style={{ color: "var(--danger)" }}>*</span></label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">End Date <span style={{ color: "var(--danger)" }}>*</span></label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            <FiFileText size={13} /> Reason <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <textarea
            name="reason"
            placeholder="Describe the reason for your leave request..."
            rows={3}
            value={formData.reason}
            onChange={handleChange}
            required
            style={{ resize: "vertical", minHeight: 80 }}
          />
        </div>

        <div className="leave-form-footer">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <span className="settings-spinner-sm" /> Submitting...
              </>
            ) : (
              <>
                <FiSend size={15} /> Submit Request
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}