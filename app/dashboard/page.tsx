"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DirectionsBusRoundedIcon from "@mui/icons-material/DirectionsBusRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";

import { BusMap } from "@/components/map/bus-map";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useCurrentBusState } from "@/hooks/use-current-bus-state";
import { useCurrentStudentProfile } from "@/hooks/use-current-student-profile";
import { useLocationContribution } from "@/hooks/use-location-contribution";
import { mockBus, mockStudent } from "@/lib/mock/fixtures";

function minutesAgo(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return "No recent update";
  }

  const deltaMs = Date.now() - timestamp;
  const deltaMin = Math.max(0, Math.floor(deltaMs / 60_000));
  if (deltaMin <= 0) {
    return "Updated just now";
  }

  if (deltaMin < 60) {
    return `Updated ${deltaMin} min ago`;
  }

  const deltaHours = Math.floor(deltaMin / 60);
  if (deltaHours < 24) {
    return `Updated ${deltaHours} hr ago`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 7) {
    return `Updated ${deltaDays} day${deltaDays === 1 ? "" : "s"} ago`;
  }

  return "Last updated a while ago";
}

export default function DashboardPage() {
  const router = useRouter();
  const { mode, user, isLoading: authLoading, signOut } = useAuthSession();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const { student, error: studentError, isLoading: studentLoading } =
    useCurrentStudentProfile(user?.uid);

  useEffect(() => {
    if (mode === "live" && !authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, mode, router, user]);

  const effectiveStudent = student ?? mockStudent;
  const accountInitial =
    user?.email?.slice(0, 1).toUpperCase() ??
    effectiveStudent.fullName.slice(0, 1).toUpperCase();
  const accountName = user?.email ?? effectiveStudent.fullName;

  const busId = effectiveStudent.busId ?? mockBus.id;
  const routeId = effectiveStudent.routeId ?? mockStudent.routeId;
  const busState = useCurrentBusState({ busId });
  const contribution = useLocationContribution({
    uid: user?.uid ?? effectiveStudent.uid,
    busId,
    routeId,
    deviceId: "student-web",
  });

  const liveLabel = useMemo(() => {
    if (!busState.location) {
      return "No live signal";
    }
    return busState.isStale ? "Stale" : "Live";
  }, [busState.isStale, busState.location]);

  const etaSummary = useMemo(() => {
    if (!busState.location || busState.stops.length === 0) {
      return "ETA will appear when route updates are available.";
    }

    const nextStop = busState.stops[0];
    return `Approaching ${nextStop.name}`;
  }, [busState.location, busState.stops]);

  if ((mode === "live" && authLoading) || studentLoading || busState.isLoading) {
    return (
      <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        <Stack spacing={1.5} sx={{ alignItems: "center" }}>
          <CircularProgress size={30} />
          <Typography variant="body2" color="text.secondary">
            Syncing your bus...
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <AppBar position="static" color="inherit">
        <Toolbar sx={{ minHeight: 64, px: { xs: 1.5, sm: 2 } }}>
          <DirectionsBusRoundedIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            BusPulse
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton
            aria-label="Open account menu"
            onClick={(event) => {
              setMenuAnchor(event.currentTarget);
            }}
            sx={{ p: 0.5 }}
          >
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: "primary.main",
                color: "common.white",
                fontSize: "0.9rem",
                fontWeight: 700,
              }}
            >
              {accountInitial}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => {
              setMenuAnchor(null);
            }}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{
              paper: {
                sx: {
                  mt: 1,
                  minWidth: 210,
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  borderRadius: 2.5,
                },
              },
            }}
          >
            <MenuItem disabled sx={{ opacity: "1 !important" }}>
              <Stack spacing={0.25}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {accountName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Student tracking
                </Typography>
              </Stack>
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                router.push("/settings");
              }}
            >
              <ListItemIcon>
                <SettingsRoundedIcon fontSize="small" />
              </ListItemIcon>
              <Typography variant="body2">Settings</Typography>
            </MenuItem>
            {user ? (
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null);
                  void signOut();
                }}
              >
                <ListItemIcon>
                  <LogoutRoundedIcon fontSize="small" />
                </ListItemIcon>
                <Typography variant="body2">Sign out</Typography>
              </MenuItem>
            ) : null}
          </Menu>
        </Toolbar>
      </AppBar>

      <Box sx={{ position: "relative", flex: 1, minHeight: 0 }}>
        <BusMap bus={busState.bus ?? mockBus} busLocation={busState.location} />

        <Paper
          elevation={6}
          sx={{
            position: "absolute",
            left: { xs: 12, sm: 20 },
            right: { xs: 12, sm: 20 },
            bottom: { xs: 12, sm: 20 },
            p: 2,
            borderRadius: 3,
            border: "1px solid rgba(15, 23, 42, 0.08)",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Stack spacing={1.3}>
            <Stack
              direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {busState.bus?.code ?? mockBus.code}
              </Typography>
              <Chip
                label={liveLabel}
                color={liveLabel === "Live" ? "success" : "default"}
                size="small"
              />
            </Stack>

            <Typography variant="body2" color="text.secondary">
              {etaSummary}
            </Typography>

            <Typography variant="caption" color="text.secondary">
              {minutesAgo(busState.location?.updatedAt)}
            </Typography>

            <Stack
              direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Typography variant="body2" color="text.secondary">
                {contribution.isTracking
                  ? "Sharing your location"
                  : contribution.permissionState === "denied"
                    ? "Location permission denied"
                    : "Location sharing off"}
              </Typography>
              <Button
                size="small"
                variant={contribution.isTracking ? "outlined" : "contained"}
                onClick={contribution.isTracking ? contribution.stop : contribution.start}
              >
                {contribution.isTracking ? "Stop" : "Share"}
              </Button>
            </Stack>

            {studentError ? (
              <Typography variant="caption" color="warning.main">
                Your bus assignment could not be refreshed right now.
              </Typography>
            ) : null}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}