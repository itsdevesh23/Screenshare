import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createRealtimeSocket, sendRealtimeMessage } from '../services/realtimeClient.js';
import { endInspectorSession } from '../services/requestApi.js';
import { useAuth } from '../services/AuthContext.jsx';

const rtcConfig = { iceServers: [] };

export function InspectorScreenSharePanel({ acceptedRequest, onSessionEnded }) {
  const { token } = useAuth();
  const videoRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const readyIntervalRef = useRef(null);
  const lastMoveTimeRef = useRef(0);
  const [status, setStatus] = useState('Idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!acceptedRequest) {
      stopRealtime();
      setStatus('Idle');
      return;
    }

    openSocket();
    return stopRealtime;
  }, [acceptedRequest?.id]);

  function openSocket() {
    const socket = createRealtimeSocket({ token, requestId: acceptedRequest.id });
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setStatus('Waiting for SBU');
      requestStream();
      readyIntervalRef.current = window.setInterval(requestStream, 2000);
    });

    socket.addEventListener('message', async (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'sbu-ready' || message.type === 'peer-joined') {
        sendRealtimeMessage(socket, 'viewer-ready', acceptedRequest.id);
      }

      if (message.type === 'offer') {
        await handleOffer(message.payload);
      }

      if (message.type === 'ice-candidate' && message.payload?.candidate) {
        await peerRef.current?.addIceCandidate(message.payload);
      }

      if (message.type === 'peer-left') {
        setStatus('SBU disconnected');
      }
    });

    socket.addEventListener('close', () => {
      if (acceptedRequest) {
        setStatus('Disconnected');
      }
    });

    socket.addEventListener('error', () => {
      setStatus('Connection error');
      setError('Could not connect to realtime server. Check that Spring Boot is running on port 8080.');
    });
  }

  function requestStream() {
    sendRealtimeMessage(socketRef.current, 'viewer-ready', acceptedRequest.id);
  }

  async function handleOffer(offer) {
    try {
      peerRef.current?.close();
      const peer = new RTCPeerConnection(rtcConfig);
      peerRef.current = peer;

      peer.addEventListener('track', (event) => {
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
        }
        window.clearInterval(readyIntervalRef.current);
        setStatus('Viewing');
      });

      peer.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
          sendRealtimeMessage(socketRef.current, 'ice-candidate', acceptedRequest.id, event.candidate);
        }
      });

      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendRealtimeMessage(socketRef.current, 'answer', acceptedRequest.id, answer);
      setStatus((current) => current === 'Viewing' ? 'Viewing' : 'Answer sent');
    } catch (err) {
      setStatus('Viewer failed');
      setError(err.message || 'Could not connect to SBU screen share');
    }
  }

  function sendCommand(command, label) {
    const sent = sendRealtimeMessage(socketRef.current, 'control-command', acceptedRequest.id, {
      command,
      label
    });
    if (!sent) {
      setError('Realtime connection is not open yet.');
    }
  }

  function handlePointerEvent(event) {
    const video = videoRef.current;
    if (!video?.srcObject) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const contentRect = getRenderedVideoContentRect(video, rect);
    const xRatio = (event.clientX - contentRect.left) / contentRect.width;
    const yRatio = (event.clientY - contentRect.top) / contentRect.height;

    if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) {
      return;
    }

    let action;
    if (event.type === 'pointermove') {
      const now = Date.now();
      if (now - lastMoveTimeRef.current < 30) {
        return;
      }
      lastMoveTimeRef.current = now;
      action = 'mousemove';
    } else if (event.type === 'pointerdown') {
      action = 'mousedown';
    } else if (event.type === 'pointerup') {
      action = 'mouseup';
    } else {
      return;
    }

    sendRealtimeMessage(socketRef.current, 'remote-input', acceptedRequest.id, {
      action,
      xRatio,
      yRatio,
      button: event.button
    });
  }

  function handleKeyEvent(event) {
    if (status !== 'Viewing') return;
    
    // Prevent default scrolling when pressing space/arrows inside the video
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }

    const action = event.type === 'keydown' ? 'keydown' : 'keyup';
    sendRealtimeMessage(socketRef.current, 'remote-input', acceptedRequest.id, {
      action,
      keyCode: event.keyCode,
      code: event.code,
      key: event.key
    });
  }

  async function endSession() {
    stopRealtime();
    try {
      await endInspectorSession(token, acceptedRequest.id);
      onSessionEnded?.();
    } catch (err) {
      setError(err.message);
    }
  }

  function stopRealtime() {
    window.clearInterval(readyIntervalRef.current);
    peerRef.current?.close();
    socketRef.current?.close();
    peerRef.current = null;
    socketRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  if (!acceptedRequest) {
    return null;
  }

  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 3 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
          <Box>
            <Typography fontWeight={700}>SBU Screen Viewer</Typography>
            <Typography variant="body2" color="text.secondary">
              Station: {acceptedRequest.sbuUsername}. Click inside the viewer to control the SBU browser page.
            </Typography>
          </Box>
          <Chip label={status} color={status === 'Viewing' ? 'success' : 'default'} />
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        <Box
          component="video"
          ref={videoRef}
          autoPlay
          playsInline
          tabIndex={0}
          onPointerMove={handlePointerEvent}
          onPointerDown={handlePointerEvent}
          onPointerUp={handlePointerEvent}
          onKeyDown={handleKeyEvent}
          onKeyUp={handleKeyEvent}
          onContextMenu={(e) => e.preventDefault()}
          sx={{
            width: '100%',
            bgcolor: '#111827',
            aspectRatio: '16 / 9',
            objectFit: 'contain',
            cursor: status === 'Viewing' ? 'crosshair' : 'default',
            outline: 'none',
            touchAction: 'none'
          }}
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
          <Button variant="outlined" onClick={requestStream}>
            Retry Viewer
          </Button>
          <Button startIcon={<CheckCircleIcon />} variant="contained" color="success" onClick={() => sendCommand('MARK_PASS', 'Mark test as pass')}>
            Mark Pass
          </Button>
          <Button startIcon={<ReportProblemIcon />} variant="contained" color="warning" onClick={() => sendCommand('MARK_REVIEW', 'Flag test for review')}>
            Flag Review
          </Button>
          <Button startIcon={<PauseCircleIcon />} variant="outlined" onClick={() => sendCommand('PAUSE_TEST', 'Pause testing workflow')}>
            Pause
          </Button>
          <Button startIcon={<StopCircleIcon />} variant="outlined" color="error" onClick={endSession}>
            End Session
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function getRenderedVideoContentRect(video, elementRect) {
  const videoWidth = video.videoWidth || elementRect.width;
  const videoHeight = video.videoHeight || elementRect.height;
  const videoAspect = videoWidth / videoHeight;
  const elementAspect = elementRect.width / elementRect.height;

  if (elementAspect > videoAspect) {
    const contentWidth = elementRect.height * videoAspect;
    return {
      left: elementRect.left + (elementRect.width - contentWidth) / 2,
      top: elementRect.top,
      width: contentWidth,
      height: elementRect.height
    };
  }

  const contentHeight = elementRect.width / videoAspect;
  return {
    left: elementRect.left,
    top: elementRect.top + (elementRect.height - contentHeight) / 2,
    width: elementRect.width,
    height: contentHeight
  };
}
