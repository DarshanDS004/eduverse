# `certificates.service.js` — Certificates Business Logic & Database Operations

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `certificates.service.js` |
| **Location** | `modules/certificates/certificates.service.js` |
| **File Type** | Service Layer (Business Logic) |
| **Project** | EduVerse |

**Purpose:** This file implements all database operations and business logic for the EduVerse certificates module. It handles listing a student's earned certificates, fetching certificate details, generating download URLs, and publicly verifying a certificate's authenticity by its unique code.

---

## 2. Responsibility

- Query and return all certificates earned by a specific student.
- Fetch full details of a single certificate with ownership enforcement.
- Return download URL and metadata for a specific certificate (with ownership check).
- Verify that a certificate code exists and is authentic — for public verification use cases.

**Why this file exists:** Separates data access and business logic from HTTP handling (controller), consistent with EduVerse's service pattern. All SQL lives here; the controller only calls these functions.

---

## 3. Imports / Dependencies

| Import | Source | Purpose |
|---|---|---|
| `db` | `../../config/db` | MySQL connection pool for all queries |
| `AppError` | `../../shared/errorHandler` | Structured errors with HTTP status and code |

---

## 4. Core Logic Breakdown

The service is straightforward — four focused async functions, each performing one or two SQL queries and returning a result or throwing `AppError`. There is no mutation logic (no inserts or updates) — this is a purely read service. Certificate creation happens in `student.service.js` automatically on course completion.

All functions use the `[[row]]` double-destructuring pattern:
```js
const [[cert]] = await db.query(...);
```
This extracts the first row from `mysql2`'s `[rows, fields]` return and immediately pulls the first element — a concise way to fetch a single expected record.

---

## 5. Functions / Methods

### `listCertificates(studentId)`
| Property | Details |
|---|---|
| **Parameters** | `studentId` — integer |
| **Returns** | Array of certificate summary objects |

**SQL:**
```sql
SELECT
  cert.id, cert.title, cert.certificate_code,
  cert.issued_at, cert.file_url,
  c.title AS course_title,
  up_inst.full_name AS instructor_name
FROM certificates cert
LEFT JOIN courses c ON c.id = cert.course_id
LEFT JOIN user_profiles up_inst ON up_inst.user_id = c.instructor_id
WHERE cert.student_id = ?
ORDER BY cert.issued_at DESC
```

Key behaviors:
- **`LEFT JOIN` on courses and user_profiles:** Uses LEFT JOIN (not INNER JOIN) — if a certificate has no associated course (edge case: manually issued or `course_id` is null), it is still returned with `course_title` and `instructor_name` as `null`.
- Returns certificates ordered by most recently issued first.
- Returns a summary set of fields (not `cert.*`) — excludes internal fields like raw file paths or DB metadata.

---

### `getCertificate(certId, studentId)`
| Property | Details |
|---|---|
| **Parameters** | `certId` — integer, `studentId` — integer |
| **Returns** | Full certificate object with course title and student name |
| **Error** | `AppError(404, 'NOT_FOUND')` if certificate not found or doesn't belong to student |

**SQL:**
```sql
SELECT cert.*, c.title AS course_title,
       up.full_name AS student_name
FROM certificates cert
LEFT JOIN courses c ON c.id = cert.course_id
JOIN user_profiles up ON up.user_id = cert.student_id
WHERE cert.id = ? AND cert.student_id = ?
```

Key behaviors:
- **`cert.*`** — returns all columns from the certificates table (unlike `listCertificates` which returns a subset).
- **Ownership enforced in SQL:** `AND cert.student_id = ?` ensures a student cannot fetch another student's certificate — the query returns no result if the IDs don't match.
- `JOIN user_profiles` (not LEFT JOIN) — if the student profile is missing, the query returns null and the `NOT_FOUND` error is thrown. This is a strict join.
- Throws `AppError` if `cert` is `undefined` (query returned no rows).

---

### `getDownloadUrl(certId, studentId)`
| Property | Details |
|---|---|
| **Parameters** | `certId` — integer, `studentId` — integer |
| **Returns** | `{ download_url, certificate_code, title }` |
| **Error** | `AppError(404, 'NOT_FOUND')` if not found or not owned |

**SQL:**
```sql
SELECT id, file_url, title, certificate_code
FROM certificates WHERE id = ? AND student_id = ?
```

Key behaviors:
- **Ownership check via SQL:** Same `AND student_id = ?` pattern as `getCertificate`.
- **`download_url` may be `null`:** `cert.file_url || null` — if no file has been generated for this certificate yet (e.g., PDF generation is async or not implemented), the response includes `download_url: null`. The controller still returns 200 in this case — the caller must handle a null URL.
- Returns minimal fields only — not the full certificate object.

---

### `verifyCertificate(code)`
| Property | Details |
|---|---|
| **Parameters** | `code` — string (certificate code, e.g., `'EV-A1B2C3D4-5'`) |
| **Returns** | `{ valid: true, certificate }` |
| **Error** | `AppError(404, 'NOT_FOUND')` with message `'Certificate not found or invalid.'` |

**SQL:**
```sql
SELECT cert.certificate_code, cert.issued_at, cert.title,
       up.full_name AS student_name,
       c.title AS course_title
FROM certificates cert
JOIN user_profiles up ON up.user_id = cert.student_id
LEFT JOIN courses c ON c.id = cert.course_id
WHERE cert.certificate_code = ?
```

Key behaviors:
- **No `studentId` parameter** — this is a public function. Anyone can call it with any certificate code.
- Returns only publicly appropriate fields: code, issued date, title, student name, course title. No internal IDs or file URLs are exposed.
- **`valid: true`** is always in the response on success — it is never returned as `valid: false`. An invalid code throws `AppError(404)` instead. Callers receive either a valid result or an error.
- `LEFT JOIN` on courses — handles certificates with `course_id = null`.

---

## 6. API Role

All functions are called by `certificates.controller.js`:

| Service Function | Called By | HTTP Route |
|---|---|---|
| `listCertificates` | `controller.list` | `GET /api/certificates/` |
| `getCertificate` | `controller.detail` | `GET /api/certificates/:id` |
| `getDownloadUrl` | `controller.download` | `GET /api/certificates/:id/download` |
| `verifyCertificate` | `controller.verify` | `GET /api/certificates/verify/:code` |

---

## 8. Data Flow

```
certificates.controller.*()
        │
        ▼
certificates.service.*()
        │
        ▼
db.query(SQL, [params])
        │
        ▼
[[result]] or [rows]
        │
        ├── result is falsy → throw AppError(404)
        │
        └── result is valid → return data object
```

---

## 9. Connections

### Files That Call This File
- `modules/certificates/certificates.controller.js`

### Files That Write to the Same Tables (Not in This File)
- `modules/student/student.service.js` — `_issueCertificateIfNotExists()` auto-creates certificates on course completion.

### Files This File Depends On
- `../../config/db` — MySQL pool
- `../../shared/errorHandler` — `AppError`

### DB Tables Used
| Table | Access Type | Usage |
|---|---|---|
| `certificates` | READ only | All four functions |
| `courses` | READ (JOIN) | `listCertificates`, `getCertificate`, `verifyCertificate` |
| `user_profiles` | READ (JOIN) | `getCertificate`, `verifyCertificate` |

---

## 11. Error Handling

| Function | Error Condition | Error |
|---|---|---|
| `getCertificate` | `cert` is `undefined` (not found or wrong owner) | `AppError('Certificate not found.', 404, 'NOT_FOUND')` |
| `getDownloadUrl` | `cert` is `undefined` | `AppError('Certificate not found.', 404, 'NOT_FOUND')` |
| `verifyCertificate` | `cert` is `undefined` (code not found) | `AppError('Certificate not found or invalid.', 404, 'NOT_FOUND')` |
| `listCertificates` | No certificates found | Returns empty array `[]` — not an error |

All errors are thrown as `AppError` instances, caught by the controller's `catch(err)` block, and passed to `next(err)` for global error handling.

---

## 12. Example Usage

```js
// Controller usage
const certs = await service.listCertificates(42);
// → [{ id, title, certificate_code, issued_at, file_url, course_title, instructor_name }, ...]

const cert = await service.getCertificate(3, 42);
// → Full cert object with cert.*, course_title, student_name
// → Throws AppError(404) if cert ID 3 doesn't belong to student 42

const dl = await service.getDownloadUrl(3, 42);
// → { download_url: '/uploads/certs/cert-3.pdf', certificate_code: 'EV-...', title: '...' }
// → download_url may be null if file hasn't been generated

const verification = await service.verifyCertificate('EV-A1B2C3-5');
// → { valid: true, certificate: { certificate_code, issued_at, title, student_name, course_title } }
// → Throws AppError(404) if code doesn't exist
```

---

## 13. Edge Cases / Notes

- **`download_url` can be `null`:** The service returns a 200 response even when `file_url` is null. This suggests PDF generation may not be implemented yet, or it's handled asynchronously/externally. The frontend must handle a null download URL gracefully.
- **`valid: false` is never returned:** `verifyCertificate` either returns `{ valid: true, ... }` or throws. There is no `{ valid: false }` case — invalid codes always result in a 404 error.
- **`listCertificates` returns `[]` for no results:** Unlike the single-fetch functions, finding no certificates is not an error — it's an expected state for new students.
- **`getCertificate` uses `cert.*`:** This exposes all database columns including potentially sensitive or internal ones (like raw `file_url`, internal IDs). If the API is public-facing, consider explicitly selecting columns.
- **No pagination on `listCertificates`:** Returns all certificates for a student. Students with many completions will receive a full unbounded list — acceptable for typical use, but could be paginated if needed.
- **Certificate code format (`EV-{uuid}-{courseId}`)** is set in `student.service.js`. This service only reads — it never generates codes.

---

## 14. Summary

`certificates.service.js` is a focused, read-only service that handles four database operations for EduVerse's certificate system. It enforces student ownership via SQL (`AND student_id = ?`) on all student-specific queries, exposes public certificate verification via a unique code lookup, and provides download URLs (which may be null if PDF generation is pending). Certificate creation is not handled here — it is an automated side effect of course completion managed by `student.service.js`.
