"use client";

import Link from "next/link";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import {
  Box,
  Button,
  Chip,
  Container,
  List,
  ListItem,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { useAuthSession } from "@/hooks/use-auth-session";
import { useCurrentStudentProfile } from "@/hooks/use-current-student-profile";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { mockStudent } from "@/lib/mock/fixtures";

function StatusRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <ListItem disableGutters sx={{ py: 0.75, justifyContent: "space-between" }}>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {label}
      </Typography>
      <Chip
        size="small"
        color={tone === "success" ? "success" : tone === "warning" ? "warning" : "default"}
        label={value}
      />
    </ListItem>
  );
}

export default function SettingsPage() {
  const { mode, user, signOut } = useAuthSession();
  const profile = useCurrentStudentProfile(user?.uid);
  const setup = useSetupStatus();
  const effectiveStudent = profile.student ?? mockStudent;

  const setupTips: string[] = [];
  if (!setup.firebaseReady) {
    setupTips.push("Complete Firebase connection values to enable live sign-in and data sync.");
  }
  if (!setup.mapsReady) {
    setupTips.push("Add a browser key for Maps JavaScript API to enable live map tiles.");
  }
  if (!setup.projectIdMatchesExpected) {
    setupTips.push("Use the expected BusPulse Firebase project before production rollout.");
  }
  if (!setup.hasAllowedDomains) {
    setupTips.push("Add college domains to enforce student account access policies.");
  }

  return (
    <Box sx={{ minHeight: "100dvh", py: { xs: 2, sm: 4 } }}>
      <Container maxWidth="md">
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button
              component={Link}
              href="/dashboard"
              startIcon={<ArrowBackRoundedIcon />}
              sx={{ borderRadius: 999 }}
            >
              Back
            </Button>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Settings
            </Typography>
          </Stack>

          <Paper sx={{ p: 2.5, borderRadius: 3, border: "1px solid rgba(15, 23, 42, 0.08)" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Account
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.email ?? "Preview mode"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Assigned bus: {effectiveStudent.busId}
            </Typography>
            {user ? (
              <Button
                sx={{ mt: 2, borderRadius: 999 }}
                startIcon={<LogoutRoundedIcon />}
                onClick={() => {
                  void signOut();
                }}
              >
                Sign out
              </Button>
            ) : null}
          </Paper>

          <Paper sx={{ p: 2.5, borderRadius: 3, border: "1px solid rgba(15, 23, 42, 0.08)" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              App status
            </Typography>
            <List disablePadding>
              <StatusRow
                label="Data mode"
                value={mode === "live" ? "Live" : "Preview"}
                tone={mode === "live" ? "success" : "default"}
              />
              <StatusRow
                label="Map experience"
                value={setup.mapsReady ? "Ready" : "Fallback"}
                tone={setup.mapsReady ? "success" : "warning"}
              />
              <StatusRow
                label="Authentication"
                value={setup.firebaseReady ? "Configured" : "Needs setup"}
                tone={setup.firebaseReady ? "success" : "warning"}
              />
            </List>
          </Paper>

          <Paper sx={{ p: 2.5, borderRadius: 3, border: "1px solid rgba(15, 23, 42, 0.08)" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Setup help
            </Typography>
            {setupTips.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Everything required for live student tracking is configured.
              </Typography>
            ) : (
              <Stack spacing={1.1}>
                {setupTips.map((tip) => (
                  <Typography key={tip} variant="body2" color="text.secondary">
                    {tip}
                  </Typography>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
