# Browser Extension Manual Testing Checklist

**Version**: 0.1.0 | **Last Updated**: January 2026

Use this checklist to manually test the Recall browser extension before releases.

---

## Prerequisites

Before testing, ensure:

- [ ] Extension is loaded in browser (`chrome://extensions`)
- [ ] Recall API is running at `http://localhost:5080`
- [ ] Recall web app is running at `http://localhost:5173`
- [ ] Valid test user credentials available
- [ ] Browser is Chrome 116+ or Edge 116+

---

## Test Environment Setup

| Component | URL | Status |
|-----------|-----|--------|
| Extension | Loaded in browser | ☐ |
| API | http://localhost:5080 | ☐ |
| Web App | http://localhost:5173 | ☐ |

---

## User Story 1: Save Current Tab Quickly

### Authentication Flow

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 1.1 | Sign-in from popup | Click extension icon → Click "Sign In" | Entra sign-in popup appears | ☐ |
| 1.2 | Complete sign-in | Enter credentials → Complete MFA if prompted | Popup shows user name/email | ☐ |
| 1.3 | Persistent session | Close popup → Reopen → Check auth state | Still signed in | ☐ |
| 1.4 | Sign-out | Click extension icon → Click "Sign Out" | Returns to signed-out state | ☐ |
| 1.5 | Sign-in canceled | Start sign-in → Close Entra popup | Error message: "Sign-in was cancelled" | ☐ |

### Save Current Tab

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 2.1 | Save new URL | Navigate to new page → Click extension → Click "Save current tab" | Success: "Saved to inbox!" | ☐ |
| 2.2 | Save duplicate URL | Save same URL again | Success: "Already in your inbox" | ☐ |
| 2.3 | Verify in API | Check items in web app or API | Item appears with correct URL/title | ☐ |
| 2.4 | Loading state | Click save → Watch button | Button shows loading spinner | ☐ |

### Keyboard Shortcut

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 3.1 | Quick save shortcut | Press Alt+Shift+S on any page | Notification: "Saved to Recall" | ☐ |
| 3.2 | Shortcut on restricted page | Press shortcut on chrome:// page | Notification: "Cannot save this page" | ☐ |
| 3.3 | Shortcut when signed out | Sign out → Press shortcut | Notification: "Please sign in first" | ☐ |

### Restricted URLs

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 4.1 | Chrome internal page | Navigate to chrome://extensions → Open popup | Save button disabled: "Cannot save this page" | ☐ |
| 4.2 | Edge internal page | Navigate to edge://settings → Open popup | Save button disabled: "Cannot save this page" | ☐ |
| 4.3 | Chrome Web Store | Navigate to chrome.google.com/webstore → Open popup | Save button disabled | ☐ |
| 4.4 | New tab page | Open new tab (chrome://newtab) → Open popup | Save button disabled | ☐ |

### Error Handling

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 5.1 | API unavailable | Stop API → Try to save | Error: "Could not connect to server" | ☐ |
| 5.2 | Token expired | Wait for token expiry → Save | Auto-refresh or re-auth prompt | ☐ |
| 5.3 | Network offline | Disconnect network → Save | Error: "Network error" | ☐ |

---

## User Story 2: Side Panel with Recall Web App

### Opening Side Panel

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 6.1 | Open side panel | Click extension → Click "Open Side Panel" | Side panel opens with web app | ☐ |
| 6.2 | Web app loads | Check side panel content | Recall web app visible | ☐ |
| 6.3 | Panel persists | Navigate to different tab | Side panel stays open | ☐ |
| 6.4 | Close and reopen | Close panel → Open again | Works correctly | ☐ |

### Single Sign-On

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 7.1 | SSO from extension | Sign in via popup → Open side panel | Web app shows same user | ☐ |
| 7.2 | No additional login | Open side panel when signed in | No login prompt in web app | ☐ |
| 7.3 | Token sharing | Check web app auth state | Has valid token | ☐ |

### Side Panel Content

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 8.1 | Browse inbox | Navigate to Inbox in side panel | Items display correctly | ☐ |
| 8.2 | Browse collections | Navigate to Collections | Collections display | ☐ |
| 8.3 | Browse tags | Navigate to Tags | Tags display | ☐ |
| 8.4 | Responsive layout | Resize browser window | Web app adapts | ☐ |

### Error States

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 9.1 | Web app unavailable | Stop web app → Open side panel | Error with retry option | ☐ |
| 9.2 | Open in new tab | Click "Open in new tab" link | Web app opens in new tab | ☐ |
| 9.3 | Not authenticated | Sign out → Open side panel | Shows sign-in guidance | ☐ |

---

## User Story 3: Save Multiple Selected Tabs

### Tab Selection

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 10.1 | Open batch view | Click "Save selected tabs" button | Tab list with checkboxes appears | ☐ |
| 10.2 | List all tabs | Check tab list | All open tabs displayed | ☐ |
| 10.3 | Select individual | Click checkbox on tabs | Tabs selected/deselected | ☐ |
| 10.4 | Select all | Click "Select all" | All valid tabs selected | ☐ |
| 10.5 | Deselect all | Click "Deselect all" | All tabs deselected | ☐ |

### Restricted Tab Handling

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 11.1 | Restricted tab display | Open chrome:// tab → Open batch view | Tab shows grayed/disabled | ☐ |
| 11.2 | Cannot select restricted | Try to select chrome:// tab | Checkbox disabled | ☐ |
| 11.3 | Restricted reason | Hover/view restricted tab | Shows why can't be saved | ☐ |

### Batch Save

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 12.1 | Save selected | Select 3 tabs → Click "Save Selected" | Progress indicator shows | ☐ |
| 12.2 | Progress updates | Watch during save | Shows X of Y progress | ☐ |
| 12.3 | Success summary | Complete batch save | Shows: "X saved, Y already existed" | ☐ |
| 12.4 | Mixed results | Save mix of new/existing URLs | Correct counts in summary | ☐ |
| 12.5 | All duplicates | Save all previously saved URLs | "Y already in your inbox" | ☐ |

### Cancel and Navigation

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 13.1 | Cancel before save | Click Cancel in batch view | Returns to main popup | ☐ |
| 13.2 | Back to main | Complete save → Click "Done" | Returns to main popup | ☐ |
| 13.3 | Cancel during save | Start save → Click Cancel | Save stops, returns to list | ☐ |

### Edge Cases

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 14.1 | No tabs selected | Try to save with nothing selected | Button disabled or error | ☐ |
| 14.2 | Many tabs (10+) | Open 10+ tabs → Save all | All save with progress | ☐ |
| 14.3 | Partial failure | Stop API mid-batch | Summary shows failed count | ☐ |

---

## Cross-Cutting Concerns

### Token Refresh

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 15.1 | Silent refresh | Wait for token near expiry → Save | Auto-refreshes token | ☐ |
| 15.2 | Refresh failure | Invalidate refresh token → Save | Prompts to sign in again | ☐ |

### Browser Compatibility

| # | Test Case | Browser | Steps | Expected Result | Pass |
|---|-----------|---------|-------|-----------------|------|
| 16.1 | Chrome save | Chrome | Complete US1 flow | All tests pass | ☐ |
| 16.2 | Chrome side panel | Chrome | Complete US2 flow | All tests pass | ☐ |
| 16.3 | Chrome batch | Chrome | Complete US3 flow | All tests pass | ☐ |
| 16.4 | Edge save | Edge | Complete US1 flow | All tests pass | ☐ |
| 16.5 | Edge side panel | Edge | Complete US2 flow | All tests pass | ☐ |
| 16.6 | Edge batch | Edge | Complete US3 flow | All tests pass | ☐ |

### Performance

| # | Test Case | Steps | Expected Result | Pass |
|---|-----------|-------|-----------------|------|
| 17.1 | Popup open time | Click extension icon | Opens in < 500ms | ☐ |
| 17.2 | Single save time | Save one URL | Completes in < 3s | ☐ |
| 17.3 | Side panel open | Open side panel | Opens in < 2s | ☐ |
| 17.4 | Batch save 10 | Save 10 tabs | Completes in < 15s | ☐ |

---

## Regression Tests

Run these after any code changes:

| # | Test Area | Tests to Re-run |
|---|-----------|-----------------|
| R1 | Auth changes | 1.1-1.5, 7.1-7.3, 15.1-15.2 |
| R2 | Save changes | 2.1-2.4, 3.1-3.3 |
| R3 | UI changes | All visual tests |
| R4 | Service worker | 2.1, 6.1, 12.1 |
| R5 | Storage changes | 1.3, 15.1 |

---

## Test Results Summary

| User Story | Total Tests | Passed | Failed | Blocked |
|------------|-------------|--------|--------|---------|
| US1: Save Current Tab | 17 | ☐ | ☐ | ☐ |
| US2: Side Panel | 12 | ☐ | ☐ | ☐ |
| US3: Batch Save | 15 | ☐ | ☐ | ☐ |
| Cross-Cutting | 11 | ☐ | ☐ | ☐ |
| **Total** | **55** | ☐ | ☐ | ☐ |

---

## Notes

Record any issues found during testing:

| Test # | Issue Description | Severity | Ticket |
|--------|-------------------|----------|--------|
| | | | |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tester | | | |
| Developer | | | |
| QA Lead | | | |
