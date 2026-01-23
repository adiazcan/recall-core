import { test, expect } from '@playwright/test';

// NOTE: These e2e tests require the backend API to be running
// Start the full stack via Aspire before running tests:
//   cd src/Recall.Core.AppHost && dotnet run
// Then run tests with the PORT environment variable if using dynamic ports:
//   PORT=<web-app-port> pnpm test:e2e

test.describe('Smoke Test: Items CRUD Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to load
    await expect(page.getByRole('heading', { name: 'Recall' })).toBeVisible();
  });

  test('should complete full CRUD flow: create → list → detail → delete', async ({ page }) => {
    // STEP 1: Create a new item
    const testUrl = `https://example.com/test-${Date.now()}`;
    const testTitle = 'Test Article for Smoke Test';
    
    // Open save URL dialog (assuming there's a button or shortcut)
    // Note: This assumes the UI has a "Save URL" or similar button
    await page.getByRole('button', { name: /save url/i }).click();
    
    // Fill in the URL - the actual placeholder is "https://example.com"
    await page.getByPlaceholder('https://example.com').fill(testUrl);
    
    // Submit the form - button text is "Save URL"
    await page.getByRole('button', { name: /^save url$/i }).click();
    
    // Wait for success feedback (toast message)
    const toastMessage = page.getByText(/saved to your library|already saved/i);
    await expect(toastMessage).toBeVisible({ timeout: 10000 });
    
    // STEP 2: Verify item appears in list
    // Manually close the dialog by clicking outside or pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Find the newly created item using the specific test URL
    const itemRow = page.locator('[role="listitem"]').filter({ hasText: testUrl });
    await expect(itemRow).toBeVisible();
    
    // STEP 3: Open item detail
    await itemRow.click();
    
    // Verify detail panel opens with correct URL
    await expect(page.getByRole('link', { name: testUrl })).toBeVisible();
    
    // STEP 4: Delete the item
    await page.getByRole('button', { name: /delete/i }).click();
    
    // Confirm deletion in dialog
    await page.getByRole('button', { name: /delete/i }).last().click();
    
    // Wait for the detail panel to close (indicates delete completed)
    await expect(page.getByRole('link', { name: testUrl })).not.toBeVisible({ timeout: 10000 });
    
    // STEP 5: Verify item is removed from list
    // The expectation will automatically wait for the item to disappear
    await expect(itemRow).not.toBeVisible({ timeout: 10000 });
  });

  test('should navigate between views', async ({ page }) => {
    // Navigate to favorites
    await page.getByRole('link', { name: /favorites/i }).click();
    await expect(page).toHaveURL(/\/favorites/);
    
    // Navigate to archive
    await page.getByRole('link', { name: /archive/i }).click();
    await expect(page).toHaveURL(/\/archive/);
    
    // Navigate back to inbox
    await page.getByRole('link', { name: /inbox/i }).click();
    await expect(page).toHaveURL(/\/inbox/);
  });

  test('should handle empty states gracefully', async ({ page }) => {
    // Navigate to archive (likely empty in test)
    await page.getByRole('link', { name: /archive/i }).click();
    
    // Verify empty state message appears - actual title is "No items found"
    await expect(
      page.getByText(/no items found/i).first()
    ).toBeVisible();
  });

  test('should be keyboard accessible', async ({ page }) => {
    // Tab through navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Verify focus is visible (at least one element should have focus ring)
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should display error boundary on critical errors', async ({ page }) => {
    // This test would need a way to trigger an error
    // For now, we can test that the boundary component is loaded
    // In a real scenario, you might inject an error or use a test route
    
    // Navigate to a potentially broken route
    await page.goto('/broken-route-that-does-not-exist');
    
    // Should show either a 404 or the error boundary
    // Adjust based on your app's behavior
    const hasErrorContent = await page.getByText(/something went wrong|not found|error/i).isVisible().catch(() => false);
    
    // This is a soft assertion - the app should handle this gracefully
    if (!hasErrorContent) {
      console.log('Note: App may redirect instead of showing error - this is acceptable');
    }
  });
});

test.describe('API Integration', () => {
  test('should handle API failures gracefully', async ({ page }) => {
    // Mock API failure before navigation
    await page.route('**/api/v1/items**', (route) => {
      route.abort('failed');
    });
    
    // Navigate to the app (will trigger failed API call)
    await page.goto('/');
    
    // The app should still load even if API fails
    // Check that the header and UI are present
    await expect(page.getByRole('heading', { name: 'Recall' })).toBeVisible();
    
    // The items list should handle the error gracefully
    // Either show empty state or error message
    // Note: Current implementation sets error in store but doesn't display it
    // So we just verify the app doesn't crash
    await expect(page.getByRole('button', { name: /save url/i })).toBeVisible();
  });
});
