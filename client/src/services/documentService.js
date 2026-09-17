const API_BASE = "/api/documents";

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
    throw new Error(data?.message || data?.error || "Request failed");
  }
  return data;
};

export const uploadDocument = async (formData) => {
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    headers: getAuthHeaders(true),
    body: formData,
  });
  return handleResponse(res);
};

export const getEmployeeDocuments = async (employeeId, { category, status } = {}) => {
  const params = new URLSearchParams();
  if (category) params.append("category", category);
  if (status) params.append("status", status);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/employee/${employeeId}${query}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const downloadDocumentFile = async (documentId, fileName = "document") => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}/download/${documentId}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = "Failed to download document";
    try {
      const j = JSON.parse(text);
      msg = j.message || msg;
    } catch {
      // Ignore JSON parse error and keep default msg
    }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
};

export const updateDocument = async (documentId, updateData) => {
  const res = await fetch(`${API_BASE}/${documentId}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(updateData),
  });
  return handleResponse(res);
};

export const deleteDocument = async (documentId) => {
  const res = await fetch(`${API_BASE}/${documentId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const verifyDocument = async (documentId, { decision, rejection_reason }) => {
  const res = await fetch(`${API_BASE}/${documentId}/verify`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ decision, rejection_reason }),
  });
  return handleResponse(res);
};

export const getAllDocuments = async ({
  employeeId,
  departmentId,
  status,
  category,
  organizationId,
  uploaderId,
} = {}) => {
  const params = new URLSearchParams();
  if (employeeId && employeeId !== "ALL") params.append("employeeId", employeeId);
  if (departmentId && departmentId !== "ALL") params.append("departmentId", departmentId);
  if (status && status !== "ALL") params.append("status", status);
  if (category && category !== "ALL") params.append("category", category);
  if (organizationId && organizationId !== "ALL") params.append("organizationId", organizationId);
  if (uploaderId && uploaderId !== "ALL") params.append("uploaderId", uploaderId);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}${query}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getHrUploaders = async ({ organizationId } = {}) => {
  const params = new URLSearchParams();
  if (organizationId && organizationId !== "ALL") params.append("organizationId", organizationId);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_BASE}/hr-uploaders${query}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

