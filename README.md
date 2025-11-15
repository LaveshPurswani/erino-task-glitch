
# Overview
This document contains a complete breakdown of all five bug fixes implemented in the project. Each entry includes:
- The original bug
- Why it happened
- Fix attempts
- New bugs I encountered during fixing
- Final stable solution
---

# Fix #1 – Double Fetch Bug
## Bug Summary
Tasks were being fetched twice on page load, causing:
- Duplicate tasks in the UI
- Incorrect metrics
- Extra API calls
- Flickering charts and task items in the table

## 🚨 Original Bug – Double Fetch on Page Load

## Why It Happened
- React StrictMode intentionally runs `useEffect` twice.
- The project used **two separate fetch effects** originally. First one to fetch the original tasks anf the second one to generate fallback tasks.
- No protection existed to prevent duplicate fetching.

---

## 🧪 Fix Attempt #1 – Adding `fetchedRef`

I introduced a safe guard:

```ts
if (fetchedRef.current) return;
fetchedRef.current = true;
```

✔ this prevented duplicate requests  
❌ But also introduced a new bug: **tasks stopped rendering** when StrictMode re-mounted the component.

### Issue: Premature loading reset
A faulty early-return contained `setLoading(false)` which caused infinite loading and empty data.


### Attempt 2 — Removed premature `setLoading(false)`
Fixed the empty UI issue.

### Issue: `isMounted` caused tasks never to load
StrictMode unmounted → `isMounted = false` → fetch finished → state never updated.

✔ Removing `isMounted` fully fixed the issue.

### Issue: Fallback data generation was commented out
Restoring:
```ts
setTasks(generateSalesTasks(50));
```
fixed the fallback flow.

## Final Solution
- I Used a **single** fetch effect.
- Protected it with `fetchedRef`.
- Removed unsafe `isMounted` logic.
- Restored fallback task generation.
- Added debugging logs during development.

---


# FIX #2 – Undo Snackbar Bug

## Bug Summary
When deleting tasks:
- Undo functionality was working inconsistently.
- Snackbar closing did NOT clear `lastDeleted`.
- Undo restored old deleted tasks even after snackbar disappeared.

## Why It Happened
- `onClose` handler never did reset undo state.
- Undo logic restored the last deleted task even when the snackbar was no longer active
---

## 🛠 Fix Attempts & Issues I Found

### ✅ 1. I Added `clearLastDeleted()` function in `useTasks()`
```ts
const clearLastDeleted = useCallback(() => {
  setLastDeleted(null);
}, []);
```

### ✅ 2. I Exposed `clearLastDeleted` through `TasksContext`
```ts
clearLastDeleted: () => void;
```

### ✅ 3. The App.tsx file now clears last deleted task when Snackbar closes
```ts
const handleCloseUndo = () => {
  clearLastDeleted();
};
```


### ✅ 5. Undo button restores only the latest deleted task
```ts
const undoDelete = useCallback(() => {
  if (!lastDeleted) return;
  setTasks(prev => [...prev, lastDeleted]);
  setLastDeleted(null);
}, [lastDeleted]);
```

---

## 🧪 Additional bugs identified me
During testing, the following issues were found:

### 🟡 Snackbar was not closing  
Cause: the snackbar was not closing when clicking on delete.

### 🟡 Undo was causing duplicate tasks  
Cause: Undo firing even after the snackbar was closed, because `lastDeleted` was not cleared.

Both were resolved by the fixes above.

---

## ✔ Final Working Behavior
- Snackbar auto‑hides correctly.
- Undo works reliably only during snackbar visibility.
- Closing Snackbar instantly clears undo state.
- No phantom tasks reappear.
- No duplicated tasks appear after undo.

---

# FIX#3 – Stable Sorting Bug Fix (ROI Ties)

## Bug Summary
When tasks had identical:
- ROI  
- Priority  
Their order would randomly change on every render, causing:
- Flickering rows
- Inconsistent UI
- Non-deterministic sorting

## Why It Happened
The sorting function intentionally injected randomness:
```ts
return Math.random() < 0.5 ? -1 : 1;
```

This *intentionally injected bug* made equal items reorder randomly on every render.

---

## Fix Attempts & Issues I Found
I replaced unstable logic with deterministic tie-breakers.

## Final Solution
```ts
export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (b.roi !== a.roi) return b.roi - a.roi;
    if (b.priorityWeight !== a.priorityWeight) return b.priorityWeight - a.priorityWeight;
    
    const titleCompare = a.title.localeCompare(b.title);
    if (titleCompare !== 0) return titleCompare;

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
```
✔ Sorting now becomes more stable and reliable.
✔ No flickering or random shuffling in the Task Table.
✔ deterministic ordering logic.
---

# FIX #4 — Double Dialog Opening Bug (Edit/Delete Triggering View Dialog)

## Bug Summary
Clicking Edit/Delete inside a table row caused:
- BOTH the action dialog AND the view dialog to open.

## Why It Happened
- `TableRow` had an `onClick` that opened the view dialog.
- Clicking buttons inside the row **bubbled** the event to the row.

This caused **double dialogs**, UI confusion, and overlapping animations.

---

## 🧠 Root Cause
Inside `TaskTable.tsx`, each table row had this handler:

```tsx
<TableRow
  hover
  onClick={() => setDetails(t)}
  sx={{ cursor: 'pointer' }}
>
```

However, the Edit/Delete buttons inside the row also triggered this handler because:

### ❗ Event Bubbling
Clicking the Edit/Delete button **bubbles up** to the parent `<TableRow>` which also receives the click event.

So:

- User clicks **Edit**
- `IconButton` handler runs → edit modal opens
- Event bubbles to `<TableRow>` → view modal opens

---

## ✅ FIX — I Used `stopPropagation()` on Action Buttons
To prevent bubbling, added:

```tsx
onClick={(e) => {
  e.stopPropagation();
  handleEditClick(t);
}}
```

and for delete:

```tsx
onClick={(e) => {
  e.stopPropagation();
  onDelete(t.id);
}}
```
## Final Solution
- Edit now opens only edit dialog.
- Delete now opens only delete dialog.
- Row click opens only view dialog.
- No overlapping dialogs anymore.

---

# ✅ FIX #5 — ROI Calculation & Data Validation Bug

## Bug Summary
Invalid task data caused:
- NaN, Infinity, or wrong ROI values
- Crashes in analytics and charts
- Tasks with negative time, empty titles, undefined IDs
- Malformed injected tasks bypassing earlier normalization

## Why It Happened
### 1. `computeROI()` did not validate inputs  
Allowed division by zero and invalid numbers.

### 2. Malformed/generated tasks were injected *after normalization*  
Example:
```json
{
  "id": undefined,
  "title": "",
  "revenue": NaN,
  "timeTaken": 0
}
```

### 3. Charts do NOT tolerate NaN values  
Even if table filtered them out, charts were still breaking and inconsistent.

---

## Fix Attempts & Issues Found

### Fix 1 — Strengthened ROI calculation
```ts
if (!isFinite(r) || !isFinite(t) || t <= 0) return 0;
```

### Fix 2 — Strengthened normalization BEFORE mapping

### Fix 3 — Added second-phase cleanup AFTER malformed values were injection  
I ensured that the injected corrupt tasks never reach the UI or charts.

---

## Final Solution
- Two-phase validation (before & after normalization).
- Guaranteed clean dataset for UI and analytics.
- Safe ROI computation that removed invalid values.
- Completely removed invalid entries.

✔ No NaN tasks  
✔ No chart crashes  
✔ No inconsistent ROI calculation  
