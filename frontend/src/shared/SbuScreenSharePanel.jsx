import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { createRealtimeSocket, sendRealtimeMessage } from '../services/realtimeClient.js';
import { endSbuSession } from '../services/requestApi.js';
import { useAuth } from '../services/AuthContext.jsx';

const rtcConfig = { iceServers: [] };

export function SbuScreenSharePanel({ acceptedRequest, onSessionEnded }) {
  const { token } = useAuth();
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const creatingOfferRef = useRef(false);
  const [status, setStatus] = useState('Idle');
  const [error, setError] = useState('');
  const [commands, setCommands] = useState([]);
  const [remoteCursor, setRemoteCursor] = useState({ visible: false, x: 0, y: 0, clicking: false });
  const [testState, setTestState] = useState({
    status: 'RUNNING',
    note: 'Waiting for inspector command'
  });

  useEffect(() => {
    return () => {
      stopLocalResources();
    };
  }, []);

  useEffect(() => {
    if (!acceptedRequest) {
      stopLocalResources();
      setStatus('Idle');
      setCommands([]);
    }
  }, [acceptedRequest]);

  async function startSharing() {
    if (!acceptedRequest) {
      return;
    }

    setError('');
    setStatus('Choosing screen');

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen sharing is not available. Use localhost, HTTPS, or a supported browser.');
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      stream.getVideoTracks()[0]?.addEventListener('ended', stopSharing);
      openSocket();
      setStatus('Waiting for inspector');
    } catch (err) {
      setStatus('Idle');
      setError(err.message || 'Could not start screen sharing');
    }
  }

  async function stopSharing() {
    stopLocalResources();
    setStatus('Stopped');
    if (acceptedRequest) {
      try {
        await endSbuSession(token, acceptedRequest.id);
        onSessionEnded?.();
      } catch (err) {
        setError(err.message);
      }
    }
  }

  function openSocket() {
    const socket = createRealtimeSocket({ token, requestId: acceptedRequest.id });
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setStatus('Connected');
      sendRealtimeMessage(socket, 'sbu-ready', acceptedRequest.id);
    });

    socket.addEventListener('message', async (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'viewer-ready' || message.type === 'peer-joined') {
        await createOffer();
      }

      if (message.type === 'answer') {
        await peerRef.current?.setRemoteDescription(message.payload);
        setStatus('Sharing');
      }

      if (message.type === 'ice-candidate' && message.payload?.candidate) {
        await peerRef.current?.addIceCandidate(message.payload);
      }

      if (message.type === 'control-command') {
        applyCommand(message.payload?.command, message.payload?.label);
        setCommands((current) => [
          {
            id: crypto.randomUUID(),
            label: message.payload?.label || message.payload?.command || 'Command',
            receivedAt: new Date()
          },
          ...current
        ].slice(0, 6));
      }

      if (message.type === 'remote-input') {
        handleRemoteInput(message.payload);
      }
    });

    socket.addEventListener('close', () => {
      if (streamRef.current) {
        setStatus('Disconnected');
      }
    });

    socket.addEventListener('error', () => {
      setStatus('Connection error');
      setError('Could not connect to realtime server. Check that Spring Boot is running on port 8080.');
    });
  }

  function handleRemoteInput(payload) {
    if (!payload) return;

    const x = Math.round(payload.xRatio * window.innerWidth);
    const y = Math.round(payload.yRatio * window.innerHeight);

    if (payload.action === 'mousemove') {
      setRemoteCursor((current) => ({ ...current, visible: true, x, y }));
      dispatchRemoteEvent(x, y, 'pointermove', payload);
      dispatchRemoteEvent(x, y, 'mousemove', payload);
    } else if (payload.action === 'mousedown') {
      setRemoteCursor((current) => ({ ...current, visible: true, x, y, clicking: true }));
      dispatchRemoteEvent(x, y, 'pointerdown', payload);
      dispatchRemoteEvent(x, y, 'mousedown', payload);
    } else if (payload.action === 'mouseup') {
      setRemoteCursor((current) => ({ ...current, visible: true, x, y, clicking: false }));
      dispatchRemoteEvent(x, y, 'pointerup', payload);
      dispatchRemoteEvent(x, y, 'mouseup', payload);
      dispatchRemoteEvent(x, y, 'click', payload);
    } else if (payload.action === 'browser-click') {
      setRemoteCursor({ visible: true, x, y, clicking: true });
      window.setTimeout(() => {
        setRemoteCursor((current) => ({ ...current, clicking: false }));
      }, 140);
      dispatchRemoteEvent(x, y, 'pointerdown', payload);
      dispatchRemoteEvent(x, y, 'mousedown', payload);
      dispatchRemoteEvent(x, y, 'pointerup', payload);
      dispatchRemoteEvent(x, y, 'mouseup', payload);
      dispatchRemoteEvent(x, y, 'click', payload);
    }
  }

  function dispatchRemoteEvent(x, y, eventName, payload = {}) {
    const cursor = document.querySelector('[data-remote-cursor="true"]');
    const previousPointerEvents = cursor?.style.pointerEvents;
    if (cursor) {
      cursor.style.pointerEvents = 'none';
    }

    const target = document.elementFromPoint(x, y);
    if (cursor) {
      cursor.style.pointerEvents = previousPointerEvents || 'none';
    }

    if (!target) {
      return;
    }

    const eventOptions = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
      button: payload.button || 0,
      buttons: payload.action === 'mousedown' || payload.action === 'mousemove' && payload.button !== -1 ? 1 : 0,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true
    };

    let EventClass = MouseEvent;
    if (eventName.startsWith('pointer') && typeof window.PointerEvent !== 'undefined') {
      EventClass = PointerEvent;
    }

    target.dispatchEvent(new EventClass(eventName, eventOptions));
  }

  function applyCommand(command, label) {
    const stateByCommand = {
      MARK_PASS: {
        status: 'PASSED',
        note: 'Inspector marked this test as pass'
      },
      MARK_REVIEW: {
        status: 'REVIEW',
        note: 'Inspector flagged this test for review'
      },
      PAUSE_TEST: {
        status: 'PAUSED',
        note: 'Inspector paused the testing workflow'
      }
    };

    setTestState(stateByCommand[command] || {
      status: 'COMMAND RECEIVED',
      note: label || command || 'Inspector command received'
    });
  }

  async function createOffer() {
    if (!streamRef.current || !socketRef.current || creatingOfferRef.current) {
      return;
    }

    try {
      creatingOfferRef.current = true;
      peerRef.current?.close();
      const peer = new RTCPeerConnection(rtcConfig);
      peerRef.current = peer;

      streamRef.current.getTracks().forEach((track) => peer.addTrack(track, streamRef.current));
      peer.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
          sendRealtimeMessage(socketRef.current, 'ice-candidate', acceptedRequest.id, event.candidate);
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendRealtimeMessage(socketRef.current, 'offer', acceptedRequest.id, offer);
      setStatus('Offer sent');
    } catch (err) {
      setStatus('Offer failed');
      setError(err.message || 'Could not create WebRTC offer');
    } finally {
      creatingOfferRef.current = false;
    }
  }

  function stopLocalResources() {
    creatingOfferRef.current = false;
    peerRef.current?.close();
    socketRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    peerRef.current = null;
    socketRef.current = null;
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  if (!acceptedRequest) {
    return null;
  }

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 3 }}>
      <RemoteCursor cursor={remoteCursor} />
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
          <Box>
            <Typography fontWeight={700}>Screen Sharing Session</Typography>
            <Typography variant="body2" color="text.secondary">
              Inspector: {acceptedRequest.inspectorUsername}. For browser control, click Start Screen Share and select this dashboard tab.
            </Typography>
          </Box>
          <Chip label={status} color={status === 'Sharing' ? 'success' : 'default'} />
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        <Box
          component="video"
          ref={videoRef}
          autoPlay
          muted
          playsInline
          sx={{
            width: '100%',
            bgcolor: '#111827',
            aspectRatio: '16 / 9',
            objectFit: 'contain'
          }}
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="contained" startIcon={<ScreenShareIcon />} onClick={startSharing}>
            Start Screen Share
          </Button>
          <Button variant="outlined" color="error" startIcon={<StopScreenShareIcon />} onClick={stopSharing}>
            End Session
          </Button>
        </Stack>

        <Box sx={{ border: 1, borderColor: 'divider', p: 2 }}>
          <Typography fontWeight={700}>SBU Test Work Area</Typography>
          <Typography variant="body2" color="text.secondary">
            Inspector commands update this section on the SBU dashboard.
          </Typography>
          <Chip
            sx={{ mt: 1 }}
            label={testState.status}
            color={testState.status === 'PASSED' ? 'success' : testState.status === 'REVIEW' ? 'warning' : 'default'}
          />
          <Typography sx={{ mt: 1 }}>{testState.note}</Typography>
        </Box>

        <Box>
          <Typography fontWeight={700}>Inspector Commands</Typography>
          {commands.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No commands received yet.
            </Typography>
          ) : (
            <Stack spacing={1} sx={{ mt: 1 }}>
              {commands.map((command) => (
                <Alert key={command.id} severity="info">
                  {command.label} at {command.receivedAt.toLocaleTimeString()}
                </Alert>
              ))}
            </Stack>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

function RemoteCursor({ cursor }) {
  if (!cursor.visible) {
    return null;
  }

  return (
    <Box
      data-remote-cursor="true"
      sx={{
        position: 'fixed',
        left: cursor.x,
        top: cursor.y,
        zIndex: 9999,
        pointerEvents: 'none',
        transform: 'translate(-2px, -2px)',
        transition: 'left 80ms linear, top 80ms linear'
      }}
    >
      <Box
        sx={{
          width: 0,
          height: 0,
          borderLeft: '10px solid #1f6feb',
          borderTop: '7px solid transparent',
          borderBottom: '7px solid transparent',
          filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))',
          transform: 'rotate(35deg)'
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          left: 12,
          top: 10,
          width: cursor.clicking ? 22 : 12,
          height: cursor.clicking ? 22 : 12,
          borderRadius: '50%',
          border: '2px solid #1f6feb',
          opacity: cursor.clicking ? 0.45 : 0.25,
          transform: 'translate(-50%, -50%)',
          transition: 'width 120ms ease, height 120ms ease, opacity 120ms ease'
        }}
      />
    </Box>
  );
}
