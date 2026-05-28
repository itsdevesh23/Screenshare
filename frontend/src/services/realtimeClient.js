export function createRealtimeSocket({ token, requestId }) {
  const wsBaseUrl =
    import.meta.env.VITE_WS_BASE_URL ||
    `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:8080`;
  const params = new URLSearchParams({ token, requestId: String(requestId) });
  return new WebSocket(`${wsBaseUrl}/ws/sessions?${params.toString()}`);
}

export function sendRealtimeMessage(socket, type, requestId, payload = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  socket.send(JSON.stringify({ type, requestId, payload }));
  return true;
}
