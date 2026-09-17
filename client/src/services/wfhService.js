const API_BASE = "/api/wfh-requests";

const getAuthHeaders = (isMultipart = false) => {
  const token = localStorage.getItem("token");
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
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
    const errorMsg = data?.message || data?.error || "Request failed";
    const err = new Error(errorMsg);
    err.response = { data, status: res.status };
    throw err;
  }
  return data;
};

/**
 * 1. Submit Work From Home Request (with optional multi-file attachments)
 * @param {FormData} formData
 */
export const submitWFHRequest = async (formData) => {
  const res = await fetch(`${API_BASE}`, {
    method: "POST",
    headers: getAuthHeaders(true),
    body: formData,
  });
  return handleResponse(res);
};

/**
 * 2. Get Logged-in Employee's WFH Requests
 */
export const getMyWFHRequests = async () => {
  const res = await fetch(`${API_BASE}/my-requests`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

/**
 * 3. Get All WFH Requests (HR scoped to org, Super Admin global)
 * @param {Object} params - { status, organizationId, employeeId }
 */
export const getAllWFHRequests = async ({ status, organizationId, employeeId } = {}) => {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.append("status", status);
  if (organizationId && organizationId !== "ALL") params.append("organizationId", organizationId);
  if (employeeId && employeeId !== "ALL") params.append("employeeId", employeeId);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}${query}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

/**
 * 4. Decide WFH Request (Super Admin ONLY)
 * @param {string} id
 * @param {Object} decisionData - { decision: "Approved" | "Rejected", rejection_reason: string }
 */
export const decideWFHRequest = async (id, { decision, rejection_reason }) => {
  const res = await fetch(`${API_BASE}/${id}/decide`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ decision, rejection_reason }),
  });
  return handleResponse(res);
};

/**
 * 5. Download Attachment File
 * @param {string} id
 * @param {number} fileIndex
 * @param {string} fileName
 */
export const downloadAttachment = async (id, fileIndex, fileName = "attachment") => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/${id}/files/${fileIndex}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: "Failed to download file" }));
    throw new Error(errorData.message || "Failed to download file");
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

/**
 * 6. Withdraw WFH Request (Employee self-service)
 * @param {string} id
 */
export const withdrawWFHRequest = async (id) => {
  const res = await fetch(`${API_BASE}/${id}/withdraw`, {
    method: "PATCH",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export default {
  submitWFHRequest,
  getMyWFHRequests,
  getAllWFHRequests,
  decideWFHRequest,
  downloadAttachment,
  withdrawWFHRequest,
};
