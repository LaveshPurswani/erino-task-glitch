
# Overview
This document explains the complete debugging journey for **Bug fixes**, including:
- What the original bug was
- What new bugs appeared while fixing it
- Why they happened
- How each issue was resolved
- Important insights noted in the code comments

---

# Fix #1 – Double Fetch Bug: Full Summary
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


