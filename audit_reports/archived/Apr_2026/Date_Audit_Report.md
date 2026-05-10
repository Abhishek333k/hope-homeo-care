# 📅 Date Formats & Standards Audit Report

**Project:** Hope Homeo Care  
**Audit Date:** April 2026  
**Scope:** Investigation of date capturing, storage, and display logic across the entire platform.

---

## 1. Summary of Date Standards

The project utilizes three primary date formats depending on the context (User Input, Storage, or Aesthetic Display).

| Context | Format | Example | Source/Engine |
| :--- | :--- | :--- | :--- |
| **Booking Input** | `DD/MM/YYYY` | `21/04/2026` | Flatpickr JS |
| **Database Storage** | `String` + `Timestamp` | `21/04/2026` / `1713700000` | Firestore |
| **Aesthetic Display** | `MMM D, YYYY` | `Apr 21, 2026` | `toLocaleDateString` |
| **Reviews** | `Relative Text` | `3 weeks ago` | Google Reviews JSON |

---

## 2. Format Deep-Dive by Feature

### A. Appointment System (The Core Engine)
*   **Capture:** Users select dates via the Flatpickr calendar. We use the **UK/Indian standard (`d/m/Y`)** because it is familiar to local patients.
*   **Validation:** In `main.js` and `portal.js`, we parse this string into a JS `Date` object momentarily to check if a selected time slot has already passed for "Today".
*   **Storage:** The date is stored as a **String** in Firestore (`date: "21/04/2026"`) for easy human readability, while `timestamp: serverTimestamp()` is used for backend sorting.

### B. Patient Portal & Records
*   **Clinical Timeline:** Displays dates exactly as retrieved from the record (`DD/MM/YYYY`).
*   **Member Since:** Calculated by finding the oldest appointment in the database for that user and extracting the `date` string.
*   **Prescriptions:** The `lastCheckup` field in `patient_records` stores the date as a string, typically following the `DD/MM/YYYY` pattern.

### C. Blogger Feed (Health Updates)
*   **Source:** The Blogger API provides an ISO timestamp (e.g., `2024-10-12T...`).
*   **Transform:** Our `fetchBlogPosts` function converts this using:
    ```javascript
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    ```
*   **Result:** Displayed as "Jan 01, 2024" for a scientific/journalistic feel.

### D. Google Reviews
*   **Format:** These are static relative strings (`relative_time_description`) retrieved via the reviews sync. They do not follow a strict numeric format as they are intended for social proof.

---

## 3. Potential Conflict Points (Architect's Note)

1.  **Sorting Risk:** Because dates are stored as strings (`DD/MM/YYYY`), they cannot be sorted alphabetically in the database (e.g., `31/01/2024` would come after `01/02/2024` if comparing strings).
    *   **Resolution Status:** Already solved. We use the separate `timestamp` (Firestore Server Timestamp) field for all sorting operations.
2.  **Date Parsing:** In `main.js`, we manually split the string `parts = dateStr.split('/')` to create a `new Date(parts[2], parts[1]-1, parts[0])`. This is fragile if the format is ever changed in the HTML.

---
*Report generated for Clinical Quality Assurance.*
