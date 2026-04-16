"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DirectionsBusRoundedIcon from "@mui/icons-material/DirectionsBusRounded";
import GoogleIcon from "@mui/icons-material/Google";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { useAuthSession } from "@/hooks/use-auth-session";

export function LoginForm() {
  const router = useRouter();
  const { mode, isLoading, user, error, signIn } = useAuthSession();

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [router, user]);

  const isLiveAuthReady = mode === "live";
  const primaryLabel = isLiveAuthReady
    ? "Continue with Google"
    : "Open Tracker Preview";

  const handlePrimaryAction = async () => {
    if (!isLiveAuthReady) {
      router.push("/dashboard");
      return;
    }

    await signIn();
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        px: 2,
        background:
          "radial-gradient(circle at 10% 15%, rgba(18,90,212,.2), transparent 36%), radial-gradient(circle at 88% 10%, rgba(0,163,122,.15), transparent 34%), #eef2f7",
      }}
    >
      <Container maxWidth="sm" disableGutters>
        <Paper
          elevation={0}
          sx={{
            border: "1px solid rgba(16, 24, 40, 0.09)",
            borderRadius: 5,
            p: { xs: 3, sm: 5 },
            backdropFilter: "blur(8px)",
            backgroundColor: "rgba(255,255,255,.92)",
          }}
        >
          <Stack spacing={3}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "primary.main",
                  color: "common.white",
                }}
              >
                <DirectionsBusRoundedIcon />
              </Box>
              <Box>
                <Typography variant="h5">BusPulse</Typography>
                <Typography variant="body2" color="text.secondary">
                  Student live bus tracker
                </Typography>
              </Box>
            </Stack>

            <Box>
              <Typography variant="h4" sx={{ mb: 1 }}>
                Track your bus in real time.
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Sign in and go straight into your assigned bus map view.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Chip
                size="small"
                color={isLiveAuthReady ? "success" : "default"}
                label={isLiveAuthReady ? "Live Sign-In" : "Preview Mode"}
              />
            </Stack>

            <Button
              size="large"
              variant="contained"
              startIcon={isLiveAuthReady ? <GoogleIcon /> : <DirectionsBusRoundedIcon />}
              onClick={() => {
                void handlePrimaryAction();
              }}
              disabled={isLoading}
              sx={{ py: 1.25, borderRadius: 999 }}
            >
              {primaryLabel}
            </Button>

            {isLiveAuthReady && error ? (
              <Alert severity="warning" variant="outlined">
                Sign-in is temporarily unavailable. Please try again.
              </Alert>
            ) : null}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
