const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function fetchSbuStations(token) {
  return authRequest(token, '/api/inspector/sbus');
}

export async function fetchInspectorRequests(token) {
  return authRequest(token, '/api/inspector/access-requests');
}

export async function createAccessRequest(token, sbuUserId) {
  return authRequest(token, '/api/inspector/access-requests', {
    method: 'POST',
    body: JSON.stringify({ sbuUserId })
  });
}

export async function fetchSbuRequests(token) {
  return authRequest(token, '/api/sbu/access-requests');
}

export async function acceptAccessRequest(token, requestId) {
  return authRequest(token, `/api/sbu/access-requests/${requestId}/accept`, {
    method: 'POST'
  });
}

export async function rejectAccessRequest(token, requestId) {
  return authRequest(token, `/api/sbu/access-requests/${requestId}/reject`, {
    method: 'POST'
  });
}

export async function endInspectorSession(token, requestId) {
  return authRequest(token, `/api/inspector/access-requests/${requestId}/end`, {
    method: 'POST'
  });
}

export async function endSbuSession(token, requestId) {
  return authRequest(token, `/api/sbu/access-requests/${requestId}/end`, {
    method: 'POST'
  });
}

async function authRequest(token, path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: options.body
  });

  const data = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Request failed');
  }

  return data;
}

async function readResponseBody(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid response from server. Please check that the backend is running.');
  }
}
