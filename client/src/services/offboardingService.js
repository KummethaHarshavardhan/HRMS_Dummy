const API_BASE = "/api/offboarding";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (res) => {
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    throw new Error(data?.message || data?.error || "Request failed");
  }
  return data;
};

export const createOffboarding = async (payload) => {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

export const getAllOffboarding = async ({ status = "ALL", search = "" } = {}) => {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.append("status", status);
  if (search) params.append("search", search);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}${query}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getOffboardingById = async (id) => {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getEmployeeOffboarding = async (employeeId = "me") => {
  const res = await fetch(`${API_BASE}/employee/${employeeId}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const updateOffboardingTask = async (processId, taskId, updates) => {
  const res = await fetch(`${API_BASE}/${processId}/task/${taskId}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  return handleResponse(res);
};

export const signDepartmentClearance = async (processId, { department, signed, comments = "" }) => {
  const res = await fetch(`${API_BASE}/${processId}/clearance`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ department, signed, comments }),
  });
  return handleResponse(res);
};

export const completeOffboarding = async (processId) => {
  const res = await fetch(`${API_BASE}/${processId}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status: "Completed" }),
  });
  return handleResponse(res);
};

export const downloadExperienceLetter = async (processId, { regenerate = false, fileName = "Experience_Letter.pdf" } = {}) => {
  const queryParam = regenerate ? "?regenerate=true" : "";
  const res = await fetch(`${API_BASE}/${processId}/experience-letter${queryParam}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    let errorMsg = "Failed to download experience letter";
    try {
      const errData = await res.json();
      if (errData?.message) errorMsg = errData.message;
    } catch {}
    throw new Error(errorMsg);
  }

  // Extract filename from header if present
  const disposition = res.headers.get("Content-Disposition");
  let downloadFileName = fileName;
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      downloadFileName = decodeURIComponent(match[1]);
    }
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", downloadFileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  return true;
};

const downloadBinaryEndpoint = async (endpoint, defaultFileName = "document.pdf") => {
  const res = await fetch(endpoint, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    let errorMsg = "Failed to download document";
    try {
      const errData = await res.json();
      if (errData?.message) errorMsg = errData.message;
    } catch {}
    throw new Error(errorMsg);
  }

  const disposition = res.headers.get("Content-Disposition");
  let downloadFileName = defaultFileName;
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      downloadFileName = decodeURIComponent(match[1]);
    }
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", downloadFileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  return true;
};

export const getExitPackageDetails = async (processId) => {
  const res = await fetch(`${API_BASE}/${processId}/exit-package`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const downloadAttendanceSummary = async (processId) => {
  return downloadBinaryEndpoint(`${API_BASE}/${processId}/attendance-summary`, "Attendance_Summary.pdf");
};

export const downloadLeaveSummary = async (processId) => {
  return downloadBinaryEndpoint(`${API_BASE}/${processId}/leave-summary`, "Leave_Summary.pdf");
};

export const downloadNoDuesCertificate = async (processId) => {
  return downloadBinaryEndpoint(`${API_BASE}/${processId}/no-dues-certificate`, "No_Dues_Certificate.pdf");
};

export const downloadRelievingLetter = async (processId) => {
  return downloadBinaryEndpoint(`${API_BASE}/${processId}/relieving-letter`, "Relieving_Letter.pdf");
};

export const settleOffboardingPF = async (processId) => {
  const res = await fetch(`${API_BASE}/${processId}/settle-pf`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};


