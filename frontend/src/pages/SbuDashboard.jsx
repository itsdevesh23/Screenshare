import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MonitorIcon from '@mui/icons-material/Monitor';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import CancelIcon from '@mui/icons-material/Cancel';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Typography
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import {
  acceptAccessRequest,
  fetchSbuRequests,
  rejectAccessRequest
} from '../services/requestApi.js';
import { useAuth } from '../services/AuthContext.jsx';
import { DashboardShell } from '../shared/DashboardShell.jsx';
import { SbuScreenSharePanel } from '../shared/SbuScreenSharePanel.jsx';

export function SbuDashboard() {
  const { token } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyRequestId, setBusyRequestId] = useState(null);
  const [error, setError] = useState('');
  
  // Dialog state
  const [acceptDialogRequestId, setAcceptDialogRequestId] = useState(null);
  const [selectedAccessLevel, setSelectedAccessLevel] = useState('VIEW_ONLY');

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === 'PENDING'),
    [requests]
  );
  const acceptedRequest = useMemo(
    () => requests.find((request) => request.status === 'ACCEPTED'),
    [requests]
  );

  useEffect(() => {
    let ignore = false;

    async function loadRequests({ showSpinner = false } = {}) {
      if (showSpinner) {
        setLoading(true);
      }

      try {
        const nextRequests = await fetchSbuRequests(token);
        if (!ignore) {
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

    loadRequests({ showSpinner: true });
    const interval = window.setInterval(loadRequests, 5000);

    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, [token]);

  async function updateRequest(requestId, action, accessLevel = 'VIEW_ONLY') {
    setBusyRequestId(requestId);
    setError('');

    try {
      if (action === 'accept') {
        await acceptAccessRequest(token, requestId, accessLevel);
      } else {
        await rejectAccessRequest(token, requestId);
      }
      setRequests(await fetchSbuRequests(token));
      setAcceptDialogRequestId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyRequestId(null);
    }
  }

  async function refreshRequests() {
    setRequests(await fetchSbuRequests(token));
  }

  return (
    <DashboardShell title="SBU Dashboard">
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Testing Station
            </Typography>
            <Typography color="text.secondary">
              Manage incoming inspector access requests and screen sharing sessions.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 2
            }}
          >
            <StatusPanel icon={<MonitorIcon />} label="Station Status" value="Online" />
            <StatusPanel icon={<PendingActionsIcon />} label="Pending Requests" value={pendingRequests.length} />
            <StatusPanel icon={<ScreenShareIcon />} label="Screen Session" value={acceptedRequest ? 'Accepted' : 'Not sharing'} />
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <SbuScreenSharePanel acceptedRequest={acceptedRequest} onSessionEnded={refreshRequests} />

          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 3 }}>
            <Stack spacing={2}>
              <SectionHeader
                title="Incoming Requests"
                subtitle="Accept an inspector request before screen sharing starts."
              />

              {loading ? (
                <CircularProgress size={28} />
              ) : pendingRequests.length === 0 ? (
                <Typography color="text.secondary">No pending requests.</Typography>
              ) : (
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {pendingRequests.map((request) => (
                    <Stack
                      key={request.id}
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={2}
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      justifyContent="space-between"
                      sx={{ py: 2 }}
                    >
                      <Box>
                        <Typography fontWeight={700}>{request.inspectorUsername}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Requested {formatDateTime(request.createdAt)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<CheckCircleIcon />}
                          disabled={busyRequestId === request.id || Boolean(acceptedRequest)}
                          onClick={() => setAcceptDialogRequestId(request.id)}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<CancelIcon />}
                          disabled={busyRequestId === request.id}
                          onClick={() => updateRequest(request.id, 'reject')}
                        >
                          Reject
                        </Button>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 3 }}>
            <Stack spacing={2}>
              <SectionHeader
                title="Request History"
                subtitle="Recent inspector requests for this SBU station."
              />
              {requests.length === 0 ? (
                <Typography color="text.secondary">No requests received yet.</Typography>
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
                        <Typography fontWeight={700}>{request.inspectorUsername}</Typography>
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

      <Dialog open={Boolean(acceptDialogRequestId)} onClose={() => setAcceptDialogRequestId(null)}>
        <DialogTitle>Select Access Level</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            What level of access would you like to grant to the inspector?
          </DialogContentText>
          <RadioGroup
            value={selectedAccessLevel}
            onChange={(e) => setSelectedAccessLevel(e.target.value)}
          >
            <FormControlLabel
              value="VIEW_ONLY"
              control={<Radio />}
              label={
                <Box>
                  <Typography fontWeight={700}>View Only</Typography>
                  <Typography variant="body2" color="text.secondary">
                    The inspector can only watch your screen. Mouse and keyboard control are disabled.
                  </Typography>
                </Box>
              }
              sx={{ mb: 1 }}
            />
            <FormControlLabel
              value="FULL_CONTROL"
              control={<Radio />}
              label={
                <Box>
                  <Typography fontWeight={700}>Full Control</Typography>
                  <Typography variant="body2" color="text.secondary">
                    The inspector can watch and interact with your screen using their mouse and keyboard.
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAcceptDialogRequestId(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            disabled={Boolean(busyRequestId)}
            onClick={() => updateRequest(acceptDialogRequestId, 'accept', selectedAccessLevel)}
          >
            Confirm Accept
          </Button>
        </DialogActions>
      </Dialog>
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
