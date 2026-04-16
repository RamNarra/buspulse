"use client";

import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  responsiveFontSizes,
} from "@mui/material";

const baseTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#125ad4",
    },
    secondary: {
      main: "#00a37a",
    },
    background: {
      default: "#eef2f7",
      paper: "#ffffff",
    },
  },
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
    h1: {
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontWeight: 700,
      letterSpacing: "-0.015em",
    },
    h3: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          borderBottom: "1px solid rgba(12, 25, 56, 0.08)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.10)",
        },
      },
    },
  },
});

const theme = responsiveFontSizes(baseTheme);

type AppThemeProviderProps = {
  children: React.ReactNode;
};

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
