"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";

import { useAuthSession } from "@/hooks/use-auth-session";

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuthSession();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    router.replace(user ? "/dashboard" : "/login");
  }, [isLoading, router, user]);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at 12% 15%, rgba(18,90,212,.18), transparent 35%), radial-gradient(circle at 88% 14%, rgba(0,163,122,.16), transparent 35%), #eef2f7",
      }}
    >
      <Stack spacing={2} sx={{ alignItems: "center" }}>
        <CircularProgress size={28} />
        <Typography variant="body2" color="text.secondary">
          Opening BusPulse...
        </Typography>
      </Stack>
    </Box>
  );
}
