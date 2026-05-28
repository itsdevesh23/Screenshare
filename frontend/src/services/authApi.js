const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export async function loginUser(credentials) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(credentials)
  });

  const data = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(data?.message || 'Login failed. Please check that the backend is running.');
  }

  return data;
}

export async function fetchCurrentUser(token) {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('Session expired');
  }

  return readResponseBody(response);
}

async function readResponseBody(response) {
  const text = await response.text();

  if (!text) {
    if (!response.ok) {
      return null;
    }
    throw new Error('Empty response from server. Please check that the backend is running.');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid response from server. Please check that the backend is running.');
  }
}
