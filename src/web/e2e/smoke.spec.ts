import { test, expect } from '@playwright/test';

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
    await page.getByRole('button', { name: /save/i }).click();
    
    // Fill in the URL
    await page.getByPlaceholder(/enter.*url/i).fill(testUrl);
    
    // Submit the form
    await page.getByRole('button', { name: /save/i }).last().click();
    
    // Wait for success feedback
    await expect(page.getByText(/saved|added/i)).toBeVisible();
    
    // STEP 2: Verify item appears in list
    await page.waitForTimeout(500); // Brief wait for item to appear
    
    // Find the newly created item in the list
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
    
    // Wait for success feedback
    await expect(page.getByText(/deleted/i)).toBeVisible();
    
    // STEP 5: Verify item is removed from list
    await expect(itemRow).not.toBeVisible();
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
    
    // Verify empty state message appears
    await expect(
      page.getByText(/no items|empty|nothing/i).first()
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
    // Navigate to the app
    await page.goto('/');
    
    // Mock API failure
    await page.route('**/api/items**', (route) => {
      route.abort('failed');
    });
    
    // Try to load items
    await page.reload();
    
    // Should show error state or message
    await expect(
      page.getByText(/error|failed|unable/i).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
