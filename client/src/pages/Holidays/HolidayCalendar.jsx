import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FiList,
  FiGrid,
  FiChevronLeft,
  FiChevronRight,
  FiSettings,
  FiBriefcase,
} from "react-icons/fi";
import { getAllHolidays } from "../../services/holidayService";
import { getOrganizations } from "../../services/superAdminService";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../utils/permission";
import Loader from "../../components/Loader/Loader";
import Button from "../../components/Button/Button";
import "./Holidays.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function HolidayCalendar() {
  const { user } = useAuth();
  const userRole = normalizeRole(user?.role);
  const isSuperAdmin = userRole === "super_admin";
  const isStaff = userRole === "admin" || isSuperAdmin || userRole === "hr_manager";

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [viewMode, setViewMode] = useState("calendar"); // "calendar" or "list"
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load organizations for super_admin
  useEffect(() => {
    if (isSuperAdmin) {
      getOrganizations()
        .then((res) => {
          if (res?.success) {
            setOrganizations(res.organizations || []);
          }
        })
        .catch((err) => console.error("Failed to load organizations:", err));
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    const params = { year: currentYear };
    if (typeFilter !== "ALL") params.type = typeFilter;
    if (isSuperAdmin && selectedOrg !== "all") {
      params.organizationId = selectedOrg;
    }
    getAllHolidays(params)
      .then((data) => {
        if (!ignore) {
          setHolidays(data?.holidays || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "Failed to load holidays");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [currentYear, typeFilter, selectedOrg, isSuperAdmin]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Calendar cells generation for currentMonth and currentYear
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ isEmpty: true, key: `empty-${i}` });
  }

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const isCurrentDate =
      today.getDate() === d &&
      today.getMonth() === currentMonth &&
      today.getFullYear() === currentYear;

    const dayHolidays = holidays.filter((h) => {
      const hDate = new Date(h.date);
      return (
        hDate.getDate() === d &&
        hDate.getMonth() === currentMonth &&
        hDate.getFullYear() === currentYear
      );
    });

    cells.push({
      isEmpty: false,
      dayNumber: d,
      isToday: isCurrentDate,
      holidays: dayHolidays,
      key: `day-${d}`,
    });
  }

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case "National":
        return "badge-national";
      case "Regional":
        return "badge-regional";
      case "Optional":
        return "badge-optional";
      case "Restricted":
        return "badge-restricted";
      default:
        return "badge-national";
    }
  };

  // Summary counts
  const nationalCount = holidays.filter((h) => h.type === "National").length;
  const optionalCount = holidays.filter((h) => h.type === "Optional" || h.type === "Restricted").length;

  return (
    <div className="holiday-page">
      {/* Header */}
      <div className="holiday-header">
        <div className="holiday-header-text">
          <h1>Official Holiday Calendar</h1>
          <p>View organization holidays, national festivals, and restricted leaves for {currentYear}.</p>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* View Toggle */}
          <div className="view-toggle-group">
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === "calendar" ? "active" : ""}`}
              onClick={() => setViewMode("calendar")}
            >
              <FiGrid size={15} /> Month View
            </button>
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
            >
              <FiList size={15} /> Year List
            </button>
          </div>

          {isStaff && (
            <Link to="/holidays/manage" style={{ textDecoration: "none" }}>
              <Button variant="primary" size="sm" icon={<FiSettings size={15} />}>
                Manage Holidays
              </Button>
            </Link>
          )}
        </div>
      </div>

      {error && <div className="emp-alert error">{error}</div>}

      {/* Stats row */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div
          style={{
            background: "#ffffff",
            padding: "16px 20px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            flex: 1,
            minWidth: 160,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>TOTAL HOLIDAYS</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#1e293b", marginTop: 4 }}>
            {holidays.length}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "16px 20px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            flex: 1,
            minWidth: 160,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>NATIONAL HOLIDAYS</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#b91c1c", marginTop: 4 }}>
            {nationalCount}
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "16px 20px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            flex: 1,
            minWidth: 160,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#4f46e5" }}>OPTIONAL / RESTRICTED</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#4338ca", marginTop: 4 }}>
            {optionalCount}
          </div>
        </div>
      </div>

      {/* Month & Filter Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          background: "#ffffff",
          padding: "12px 18px",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevMonth}
            icon={<FiChevronLeft size={16} />}
            aria-label="Previous month"
          />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0, minWidth: 180, textAlign: "center" }}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            icon={<FiChevronRight size={16} />}
            aria-label="Next month"
          />
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {isSuperAdmin && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FiBriefcase size={14} color="#4f46e5" />
              <select
                className="doc-filter-select"
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                style={{ minWidth: 200, fontWeight: 600 }}
              >
                <option value="all">All Organizations / Global</option>
                {organizations.map((org) => (
                  <option key={org._id} value={org._id}>
                    {org.name} ({org.orgCode || "ORG"})
                  </option>
                ))}
              </select>
            </div>
          )}

          <select
            className="doc-filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Holiday Types</option>
            <option value="National">National</option>
            <option value="Regional">Regional</option>
            <option value="Optional">Optional</option>
            <option value="Restricted">Restricted</option>
          </select>

          <select
            className="doc-filter-select"
            value={currentYear}
            onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main View */}
      {loading ? (
        <div style={{ padding: 60, textAlign: "center" }}>
          <Loader text="Loading holiday calendar..." />
        </div>
      ) : viewMode === "calendar" ? (
        /* Month Grid Calendar */
        <div>
          <div className="holiday-cal-grid">
            {DAY_NAMES.map((name) => (
              <div key={name} className="holiday-cal-dayname">
                {name}
              </div>
            ))}

            {cells.map((cell) => {
              if (cell.isEmpty) {
                return <div key={cell.key} className="holiday-cal-cell empty" />;
              }

              const hasHol = cell.holidays && cell.holidays.length > 0;
              return (
                <div
                  key={cell.key}
                  className={`holiday-cal-cell ${hasHol ? "has-holiday" : ""} ${
                    cell.isToday ? "is-today" : ""
                  }`}
                >
                  <div className="holiday-cell-date">{cell.dayNumber}</div>
                  <div>
                    {cell.holidays?.map((h) => (
                      <div
                        key={h._id}
                        className={`holiday-cell-badge ${getTypeBadgeClass(h.type)}`}
                        title={`${h.name} (${h.type})${h.description ? ` - ${h.description}` : ""}`}
                      >
                        {h.name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Year List View */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {holidays.length === 0 ? (
            <div className="emp-empty-state">
              <p>No holidays found for {currentYear}.</p>
            </div>
          ) : (
            holidays.map((h) => {
              const hDate = new Date(h.date);
              const dateStr = hDate.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "2-digit",
                month: "long",
                year: "numeric",
              });

              return (
                <div
                  key={h._id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "16px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 10,
                        background: "#eef2ff",
                        color: "#4f46e5",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                      }}
                    >
                      <span style={{ fontSize: 11, textTransform: "uppercase" }}>
                        {MONTH_NAMES[hDate.getMonth()].slice(0, 3)}
                      </span>
                      <span style={{ fontSize: 18 }}>{hDate.getDate()}</span>
                    </div>

                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                        {h.name}
                      </div>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                        {dateStr}
                      </div>
                      {h.description && (
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                          {h.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {isSuperAdmin && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 8px",
                          borderRadius: 6,
                          background: h.organizationId ? "#eef2ff" : "#ecfdf5",
                          color: h.organizationId ? "#4f46e5" : "#059669",
                          border: `1px solid ${h.organizationId ? "#c7d2fe" : "#a7f3d0"}`,
                        }}
                      >
                        {h.organizationId?.name
                          ? `${h.organizationId.name} (${h.organizationId.orgCode || "ORG"})`
                          : "Global"}
                      </span>
                    )}
                    <span className={`holiday-cell-badge ${getTypeBadgeClass(h.type)}`} style={{ fontSize: 12, padding: "6px 12px" }}>
                      {h.type} Holiday
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
