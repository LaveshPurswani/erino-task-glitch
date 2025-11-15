
# Overview
This document explains the complete debugging journey for **Bug fixes**, including:
- What the original bug was
- What new bugs appeared while fixing it
- Why they happened
- How each issue was resolved
- Important insights noted in the code comments

---

# Fix #1 – Double Fetch Bug
When the application loads, the tasks API fetching was running twice due to the React StrictMode where effects are run twice.

## 🚨 Original Bug – Double Fetch on Page Load

### **Issues**
- Tasks were being loaded **twice**
- Duplicating tasks data in the table UI
- Metrics and charts were also affected causing them to doubled
- Extra network calls

### **Causes**
1. Two separate `useEffect` hooks were implemented for fetching tasks, 1st - initial fetch, 2nd - fallback generation
2. React StrictMode triggering `useEffect` to run **twice**
3. There were no safe guards to prevent duplicate fetches

---

## 🧪 Fix Attempt #1 – Adding `fetchedRef`

I introduced a safe guard:

```ts
if (fetchedRef.current) return;
fetchedRef.current = true;
```

### ✔ This prevented duplicate fetches  
But it created a **new bug**:

---

## ❌ New Bug #1 – No tasks were rendered / and facing infinite loading
After adding the guard:
- The first fetch ran correctly
- StrictMode unmounted and remounted the component
- On the second run, `fetchedRef.current = true`
- The effect *returned early*
- This prevented `setTasks()` from ever running
- UI showed “No tasks yet” or infinite loading

### ❗ Cause
This early-return version was wrong:

```ts
if (fetchedRef.current) {
  setLoading(false);
  return;
}
```

It stopped the fetch AND prematurely ended loading.

---

## 🧪 Fix Attempt #2 – removing premature loading reset

Removing the incorrect `setLoading(false)` fixed the early-exit logic:

```ts
if (fetchedRef.current) return;
```

Now the safe guard was avoiding duplicate requests without blocking task loading.

But another issue surfaced:

---

## ❌ New Bug #2 – `isMounted` was blocking state updates

StrictMode behavior:
- Runs effect
- Unmounts component
- Runs effect again

Old logic:

```ts
let isMounted = true;
return () => { isMounted = false; };
```

### ❗ Problem  
Between strict-mode unmount/mount cycles:
- `isMounted` became `false`
- `load()` finished **after unmount**
- `setTasks()` inside the fetch never executed

Result: tasks remained empty.

### ✔ Fix  
Removed `isMounted` entirely.

---

## ❌ New Bug #3 – fallback tasks were not added

When `/tasks.json` failed, fallback generation code was commented out:

```ts
// setTasks(generateSalesTasks(50));
```

This caused an empty UI when fetch failed.

### ✔ Fix  
Restored the fallback code line:

```ts
setTasks(generateSalesTasks(50));
setError(null);
```

---

# ✅ Final Working Solution for BUG-FIX#1

Implementing the final `useEffect()` correctly that:

### ✔ Prevented duplicate fetches using `fetchedRef`  
### ✔ Loads tasks.json once  
### ✔ Safely handling StrictMode double-mount  
### ✔ Uses fallback tasks generation on failure  
### ✔ Removing problematic `isMounted` pattern  
### ✔ This Avoids infinite loading  
### ✔ Properly setting tasks state  
### ✔ Logging fetch details with `res.clone().text()` for debugging purposes 

The fetch flow now becomes stable and reliable, not fetching twice and no data duplication

---


# FIX #2 – Undo Snackbar Bug

## 🐞 Bug Description
When a task was deleted, the Snackbar appeared with an Undo option.  
However, **two major issues occurred**:
1. **Undo only worked sometimes**.
2. When the Snackbar auto‑closed or was manually closed,  
   the `lastDeleted` state was **not cleared**, so clicking Undo later restored **old deleted tasks** (phantom restoration).

This caused unpredictable UI behavior and duplicated/phantom tasks.

---

## 🎯 Expected Behavior
- Undo should only restore the **most recently deleted task during the active Snackbar window**.
- Once the Snackbar closes (auto or manual):
  - `lastDeleted` must be reset
  - Undo should do nothing  
- No phantom tasks should reappear.

---

## 🔍 Root Causes
### 1. **Snackbar onClose was not resetting `lastDeleted`**
`onClose` fired, but no logic existed to clear the deleted task.

### 2. **Undo worked even after Snackbar disappeared**
Because `lastDeleted` still had the previous task stored.

### 3. **Auto‑hide was broken**
Snackbar was using an extremely low `autoHideDuration` that prevented proper lifecycle behavior.

---

## 🛠 Fixes Implemented

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

### ✅ 4. Snackbar updated with correct auto-hide duration
```tsx
autoHideDuration={4000}
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
Cause: incorrect/too short auto-hide duration.

### 🟡 Undo was causing duplicate tasks  
Cause: Undo firing even after the snackbar was closed, because `lastDeleted` was not cleared.

Both were resolved by the fixes above.

---

## ✔ Final Working Behavior
- Snackbar auto‑hides correctly.
- Undo works reliably during snackbar visibility.
- Closing Snackbar instantly clears undo state.
- No phantom tasks reappear.
- No duplicated tasks appear after undo.

---


# FIX#3 – Stable Sorting Bug Fix (ROI Ties)

## 🐞 Bug Description  
Tasks with **same ROI** and **same priority weight** were reordering on every render.  
This caused:
- Flickering rows  
- Jumping UI  
- Non-deterministic sorting  

### 💡 Root Cause  
Inside `sortTasks()` in `logic.ts`, the final comparison used:

```ts
return Math.random() < 0.5 ? -1 : 1;
```

This *intentionally injected bug* made equal items reorder randomly on every render.

---

## ✅ Expected Behavior  
Tasks should:
- Keep the **same order** every time  
- Not reshuffle when nothing changed  
- Use a deterministic tiebreaker (e.g., title or createdAt)

---

## 🛠️ Fix Implemented  
Replaced unstable sorting with deterministic tiebreakers:

### ✔️ New stable ordering rules  
1. **ROI descending**  
2. **Priority weight descending**  
3. **Alphabetical title ASC**  
4. **CreatedAt timestamp ASC**  

### 🔧 Fixed Code

```ts
export function sortTasks(tasks: ReadonlyArray<DerivedTask>): DerivedTask[] {
  return [...tasks].sort((a, b) => {
    const aROI = a.roi ?? -Infinity;
    const bROI = b.roi ?? -Infinity;

    if (bROI !== aROI) return bROI - aROI;
    if (b.priorityWeight !== a.priorityWeight) return b.priorityWeight - a.priorityWeight;

    // FIX#3 — Stable deterministic ties
    const titleCompare = a.title.localeCompare(b.title);
    if (titleCompare !== 0) return titleCompare;

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
```

---

## 🧪 Test Outcomes (Pass)  
- Multiple reloads → ordering is consistent  
- Sorting no longer flickers  
- Tasks with same ROI + priority remain stable  
- No more random reshuffling  

---

## 🎉 Final Result  
Your task table is now **stable**, **deterministic**, and **professional-grade**—no more jittering UI due to sorting!



