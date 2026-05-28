import CameraAltIcon from '@mui/icons-material/CameraAlt';
import VideocamIcon from '@mui/icons-material/Videocam';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';

const feeds = [
  { id: 'CAM-01', label: 'Assembly Line' },
  { id: 'CAM-02', label: 'Test Bench' },
  { id: 'CAM-03', label: 'Packing Area' }
];

export function CctvPanel() {
  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', p: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography fontWeight={700}>CCTV Feeds</Typography>
          <Typography variant="body2" color="text.secondary">
            Camera tiles are ready for RTSP/HLS/WebRTC gateway URLs.
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 2
          }}
        >
          {feeds.map((feed) => (
            <Box
              key={feed.id}
              sx={{
                border: 1,
                borderColor: 'divider',
                bgcolor: '#111827',
                color: 'common.white',
                aspectRatio: '16 / 9',
                display: 'grid',
                placeItems: 'center',
                p: 2
              }}
            >
              <Stack spacing={1} alignItems="center">
                <CameraAltIcon />
                <Typography fontWeight={700}>{feed.id}</Typography>
                <Typography variant="body2" color="grey.300">
                  {feed.label}
                </Typography>
                <Chip size="small" icon={<VideocamIcon />} label="Gateway pending" />
              </Stack>
            </Box>
          ))}
        </Box>
      </Stack>
    </Paper>
  );
}

