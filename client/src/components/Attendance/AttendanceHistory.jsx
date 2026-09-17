import { useState, useMemo } from "react";
import { FiSearch, FiArrowUp, FiArrowDown } from "react-icons/fi";

function AttendanceHistory({ history = [] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortField, setSortField] = useState("date");
  const [sortAsc, setSortAsc] = useState(false);

  const formatDate = (date) => {
    if (!date) return "--";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (time) => {
    if (!time) return "--";
    return new Date(time).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatWorkingHours = (hours) => {
    if (hours === undefined || hours === null) {
      return "--";
    }
    const totalMinutes = Math.round(hours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs}h ${mins}m`;
  };

  const getStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    let bg = "#ecfdf5", color = "#047857", border = "#a7f3d0";
    if (s === "late") { bg = "#fffbeb"; color = "#b45309"; border = "#fde68a"; }
    else if (s === "half day" || s === "half_day") { bg = "#fef3c7"; color = "#92400e"; border = "#fcd34d"; }
    else if (s === "early checkout" || s === "early_checkout") { bg = "#f3e8ff"; color = "#6b21a8"; border = "#d8b4fe"; }
    else if (s === "absent") { bg = "#fef2f2"; color = "#b91c1c"; border = "#fecaca"; }

    return {
      backgroundColor: bg,
      color: color,
      border: `1px solid ${border}`,
      padding: "4px 10px",
      borderRadius: "9999px",
      fontWeight: 600,
      fontSize: "12px",
      display: "inline-block",
      whiteSpace: "nowrap",
    };
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredHistory = useMemo(() => {
    const filtered = history.filter((item) => {
      const formattedDate = formatDate(item.date).toLowerCase();
      const status = (item.status || "").toLowerCase();
      const matchesSearch = search === "" || formattedDate.includes(search.toLowerCase()) || status.includes(search.toLowerCase());
      const matchesStatus = statusFilter === "All" || status === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === "date") {
        aVal = new Date(a.date || 0).getTime();
        bVal = new Date(b.date || 0).getTime();
      } else {
        aVal = (aVal || "").toString().toLowerCase();
        bVal = (bVal || "").toString().toLowerCase();
      }
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [history, search, statusFilter, sortField, sortAsc]);

  return (
    <div className="attendance-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Attendance History</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <FiSearch size={14} style={{ position: "absolute", left: 10, color: "#94a3b8", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Search date or status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "6px 12px 6px 30px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 13,
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              background: "#fff",
            }}
          >
            <option value="All">All Statuses</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Half Day">Half Day</option>
            <option value="Early Checkout">Early Checkout</option>
            <option value="Absent">Absent</option>
          </select>
        </div>
      </div>

      <div className="table-responsive table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th onClick={() => handleSort("date")} style={{ cursor: "pointer" }}>
                Date {sortField === "date" && (sortAsc ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />)}
              </th>
              <th onClick={() => handleSort("status")} style={{ cursor: "pointer" }}>
                Status {sortField === "status" && (sortAsc ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />)}
              </th>
              <th onClick={() => handleSort("checkIn")} style={{ cursor: "pointer" }}>
                Check In {sortField === "checkIn" && (sortAsc ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />)}
              </th>
              <th onClick={() => handleSort("checkOut")} style={{ cursor: "pointer" }}>
                Check Out {sortField === "checkOut" && (sortAsc ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />)}
              </th>
              <th onClick={() => handleSort("workingHours")} style={{ cursor: "pointer" }}>
                Working Hours {sortField === "workingHours" && (sortAsc ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />)}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-state" style={{ textAlign: "center", padding: "24px 0", color: "#64748b" }}>
                  No Attendance Records Found
                </td>
              </tr>
            ) : (
              filteredHistory.map((attendance) => (
                <tr key={attendance._id}>
                  <td>{formatDate(attendance.date)}</td>
                  <td>
                    <span style={getStatusBadge(attendance.status)}>
                      {attendance.status}
                    </span>
                  </td>
                  <td>{formatTime(attendance.checkIn)}</td>
                  <td>{formatTime(attendance.checkOut)}</td>
                  <td>{formatWorkingHours(attendance.workingHours)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AttendanceHistory;