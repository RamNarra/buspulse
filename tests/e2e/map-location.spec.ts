import { test } from '@playwright/test';

test.use({
  geolocation: { latitude: 37.7749, longitude: -122.4194 },
  permissions: ['geolocation'],
});

test('map centers on user location', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('/dashboard');
  
  await page.waitForSelector('div[aria-label*="live map"]');
  await page.waitForTimeout(4000);

  const result = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w._test_mapCenter) return "No map center found";
    const center = w._test_mapCenter.getCenter();
    return { lat: center.lat(), lng: center.lng() };
  });
  console.log("Map center from evaluate:", result);
  
  await page.screenshot({ path: 'test-results/screenshots/map-location-mocked2.png', fullPage: true });
});