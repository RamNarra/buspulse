import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const ignorableConsoleErrors = [
  /Failed to load resource:\s+the server responded with a status of 404/i,
  /Failed to load resource:\s+the server responded with a status of 403/i,
  /@firebase\/firestore: Firestore .*Could not reach Cloud Firestore backend/i,
  /FirebaseError: \[code=unavailable\]: The operation could not be completed/i,
  /Google Maps JavaScript API error:/i,
  /Google Maps JavaScript API warning:/i,
];

const routeExpectations = [
  { route: "/", expectedPath: /\/(|login|dashboard)$/ },
  { route: "/login", expectedPath: /\/(login|dashboard)$/ },
  { route: "/dashboard", expectedPath: /\/(dashboard|login)$/ },
  { route: "/bus/bus-a1", expectedPath: /\/(dashboard|login)$/ },
  { route: "/parent", expectedPath: /\/(dashboard|login)$/ },
  { route: "/admin", expectedPath: /\/(dashboard|login)$/ },
  { route: "/settings", expectedPath: /\/settings$/ },
] as const;

test.beforeAll(() => {
  mkdirSync("test-results/screenshots", { recursive: true });
});

test.describe("BusPulse smoke", () => {
  test("app boots and route navigation is stable", async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (!ignorableConsoleErrors.some((pattern) => pattern.test(text))) {
          consoleErrors.push(text);
        }
      }
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    for (const { route, expectedPath } of routeExpectations) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response, `Missing response for route ${route}`).not.toBeNull();
      expect(response!.status(), `Unexpected status for route ${route}`).toBeLessThan(400);
      await expect(page.locator("body")).toBeVisible();
      await expect(page).toHaveURL(expectedPath);

      const hasHorizontalOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        return Math.max(doc.scrollWidth, body.scrollWidth) - window.innerWidth > 2;
      });
      expect(hasHorizontalOverflow, `Horizontal overflow detected on route ${route}`).toBeFalsy();

      if (route === "/login") {
        await expect(
          page.getByRole("button", {
            name: /Continue with Google|Open Tracker Preview/,
          }),
        ).toBeVisible();
      }

      if (route === "/dashboard") {
        const loginAction = page.getByRole("button", {
          name: /Continue with Google|Open Tracker Preview/,
        });
        const trackerAction = page.getByRole("button", { name: /Share|Stop/ });

        await expect
          .poll(
            async () => {
              if (await loginAction.isVisible()) {
                return "login";
              }

              if (await trackerAction.isVisible()) {
                return "dashboard";
              }

              return "pending";
            },
            { timeout: 15_000 },
          )
          .not.toBe("pending");

        await expect(
          page.getByText(/Google Maps Platform rejected your request/i),
        ).toHaveCount(0);
      }

      await page.screenshot({
        path: `test-results/screenshots/${testInfo.project.name}-${
          route === "/" ? "home" : route.replaceAll("/", "_")
        }.png`,
        fullPage: false,
      });
    }

    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("App status")).toBeVisible();

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const loginAction = page.getByRole("button", {
      name: /Continue with Google|Open Tracker Preview/,
    });
    const trackerAction = page.getByRole("button", { name: /Share|Stop/ });

    const resolveDashboardState = async () => {
      if (await loginAction.isVisible()) {
        return "login";
      }

      if (await trackerAction.isVisible()) {
        return "dashboard";
      }

      return "pending";
    };

    await expect
      .poll(resolveDashboardState, { timeout: 15_000 })
      .not.toBe("pending");

    const resolvedState = await resolveDashboardState();

    if (resolvedState === "login") {
      await expect(loginAction).toBeVisible();
    } else {
      await expect(page.getByText("BusPulse").first()).toBeVisible();
      await expect(page.getByLabel("Open account menu")).toBeVisible();
    }

    expect(pageErrors, `Unhandled runtime errors: ${pageErrors.join(" | ")}`).toEqual([]);
    expect(consoleErrors, `Console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
  });
});
