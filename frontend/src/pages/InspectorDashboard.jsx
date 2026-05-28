import CameraAltIcon from '@mui/icons-material/CameraAlt';
import ComputerIcon from '@mui/icons-material/Computer';
import ScreenSearchDesktopIcon from '@mui/icons-material/ScreenSearchDesktop';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import {
  createAccessRequest,
  fetchInspectorRequests,
  fetchSbuStations
} from '../services/requestApi.js';
import { useAuth } from '../services/AuthContext.jsx';
import { CctvPanel } from '../shared/CctvPanel.jsx';
import { DashboardShell } from '../shared/DashboardShell.jsx';
import { InspectorScreenSharePanel } from '../shared/InspectorScreenSharePanel.jsx';

export function InspectorDashboard() {
  const { token } = useAuth();
  const [stations, setStations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busySbuId, setBusySbuId] = useState(null);
  const [error, setError] = useState('');

  const activeRequests = useMemo(
    () => requests.filter((request) => ['PENDING', 'ACCEPTED'].includes(request.status)),
    [requests]
  );
  const acceptedRequest = useMemo(
    () => requests.find((request) => request.status === 'ACCEPTED'),
    [requests]
  );

  useEffect(() => {
    let ignore = false;

    async function loadData({ showSpinner = false } = {}) {
      if (showSpinner) {
        setLoading(true);
      }

      try {
        const [nextStations, nextRequests] = await Promise.all([
          fetchSbuStations(token),
          fetchInspectorRequests(token)
        ]);

        if (!ignore) {
          setStations(nextStations);
          setRequests(nextRequests);
          setError('');
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData({ showSpinner: true });
    const interval = window.setInterval(loadData, 5000);

    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, [token]);

  async function handleRequestAccess(sbuUserId) {
    setBusySbuId(sbuUserId);
    setError('');

    try {
      await createAccessRequest(token, sbuUserId);
      const [nextStations, nextRequests] = await Promise.all([
        fetchSbuStations(token),
        fetchInspectorRequests(token)
      ]);
      setStations(nextStations);
      setRequests(nextRequests);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusySbuId(null);
    }
  }

  async function refreshDashboard() {
    const [nextStations, nextRequests] = await Promise.all([
      fetchSbuStations(token),
      fetchInspectorRequests(token)
    ]);
    setStations(nextStations);
    setRequests(nextRequests);
  }

  return (
    <DashboardShell title="Inspector Dashboard">
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Inspection Console
            </Typography>
            <Typography color="text.secondary">
              Request SBU screen access and monitor inspection resources.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 2
            }}
          >
            <StatusPanel icon={<ComputerIcon />} label="Available SBUs" value={stations.length} />
            <StatusPanel icon={<ScreenSearchDesktopIcon />} label="Screen Requests" value={`${activeRequests.length} active`} />
            <StatusPanel icon={<CameraAltIcon />} label="CCTV Feeds" value="Phase 3/4" />
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <InspectorScreenSharePanel acceptedRequest={acceptedRequest} onSessionEnded={refreshDashboard} />

          <CctvPanel />

          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 3 }}>
            <Stack spacing={2}>
              <SectionHeader
                title="SBU Stations"
                subtitle="Choose an SBU station and request screen access."
              />

              {loading ? (
                <CircularProgress size={28} />
              ) : stations.length === 0 ? (
                <Typography color="text.secondary">No SBU users found.</Typography>
              ) : (
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {stations.map((station) => (
                    <Stack
                      key={station.userId}
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2}
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      justifyContent="space-between"
                      sx={{ py: 2 }}
                    >
                      <Box>
                        <Typography fontWeight={700}>{station.username}</Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                          <Chip size="small" label="Online" color="success" variant="outlined" />
                          {station.hasPendingRequest && <Chip size="small" label="Pending request" color="warning" />}
                          {station.hasAcceptedSession && <Chip size="small" label="Session accepted" color="primary" />}
                        </Stack>
                      </Box>
                      <Button
                        variant="contained"
                        disabled={busySbuId === station.userId || station.hasPendingRequest || station.hasAcceptedSession}
                        onClick={() => handleRequestAccess(station.userId)}
                      >
                        {busySbuId === station.userId ? 'Sending...' : 'Request Access'}
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 3 }}>
            <Stack spacing={2}>
              <SectionHeader
                title="My Requests"
                subtitle="Recent access requests and responses from SBU users."
              />
              {requests.length === 0 ? (
                <Typography color="text.secondary">No requests sent yet.</Typography>
              ) : (
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {requests.slice(0, 8).map((request) => (
                    <Stack
                      key={request.id}
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      justifyContent="space-between"
                      sx={{ py: 1.5 }}
                    >
                      <Box>
                        <Typography fontWeight={700}>{request.sbuUsername}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Requested {formatDateTime(request.createdAt)}
                        </Typography>
                      </Box>
                      <StatusChip status={request.status} />
                    </Stack>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </DashboardShell>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <Box>
      <Typography fontWeight={700}>{title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {subtitle}
      </Typography>
    </Box>
  );
}

function StatusPanel({ icon, label, value }) {
  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 3 }}>
      <Stack spacing={1}>
        <Box sx={{ color: 'primary.main' }}>{icon}</Box>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h6" fontWeight={700}>
          {value}
        </Typography>
      </Stack>
    </Paper>
  );
}

function StatusChip({ status }) {
  const colorByStatus = {
    PENDING: 'warning',
    ACCEPTED: 'success',
    REJECTED: 'error',
    ENDED: 'default'
  };

  return <Chip size="small" label={status} color={colorByStatus[status] || 'default'} />;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}
