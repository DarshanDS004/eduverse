# `materials.service.js` — Study Materials Business Logic & Database Operations

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `materials.service.js` |
| **Location** | `modules/materials/materials.service.js` |
| **File Type** | Service Layer (Business Logic) |
| **Project** | EduVerse |

**Purpose:** This file implements all business logic for the EduVerse study materials marketplace. It handles browsing/searching materials, viewing material details, managing purchases (free and paid), download access control, reviews with rating aggregation, and full instructor CRUD for uploaded materials.

---

## 2. Responsibility

- Browse and search materials with full-text search, filtering, sorting, and pagination.
- Return material details with purchase status and reviews for authenticated users.
- Handle the two-step purchase flow: initiate (free → direct, paid → return payment info) and confirm (record after payment).
- Enforce access control for downloads (purchase verification).
- Allow students to add/update reviews and auto-recalculate rating averages.
- Allow instructors to upload, list, and delete their materials (with physical file cleanup).
- Provide category listing for frontend filter UI.

---

## 3. Imports / Dependencies

| Import | Source | Purpose |
|---|---|---|
| `db` | `../../config/db` | MySQL connection pool for all queries |
| `AppError` | `../../shared/errorHandler` | Structured errors with HTTP status codes |
| `path` | Node.js built-in | Constructs file system paths for deletion |
| `fs` | Node.js built-in | Deletes physical files on material deletion |

---

## 4. Core Logic Breakdown

Functions are organized into four logical groups:
1. **Browse/View** — `getMaterials`, `getMaterial`
2. **Student operations** — `purchaseMaterial`, `confirmPurchase`, `getDownloadUrl`, `getMyPurchases`, `addReview`
3. **Instructor operations** — `uploadMaterial`, `getMyMaterials`, `deleteMaterial`
4. **Utility** — `getCategories`

---

## 5. Functions / Methods

### `getMaterials(filters)`
| Property | Details |
|---|---|
| **Parameters** | `filters` — object from `req.query`: `search`, `type`, `level`, `category`, `is_free`, `sort`, `page`, `limit` |
| **Returns** | `{ materials, pagination }` |

**Full-text search:**
```sql
MATCH(sm.title, sm.description, sm.subject, sm.tags) AGAINST(? IN BOOLEAN MODE)
```
Uses MySQL boolean full-text search with a wildcard suffix (`search + '*'`). Requires a FULLTEXT index on `(title, description, subject, tags)`.

**Dynamic WHERE clause construction:**
```js
let where  = ['sm.status = "published"'];
let params = [];
// Conditions added conditionally based on which filters are present
```
Base condition always filters for published materials. Additional filters are appended only when provided.

**Sort options:**
| `sort` value | SQL ORDER BY |
|---|---|
| `newest` (default) | `sm.created_at DESC` |
| `popular` | `sm.purchase_count DESC` |
| `rating` | `sm.avg_rating DESC` |
| `price_asc` | `sm.price ASC` |
| `price_desc` | `sm.price DESC` |
| `downloads` | `sm.download_count DESC` |

**Pagination:**
- Default: page 1, 12 per page.
- Runs a second COUNT query with the same WHERE clause for `total_pages` calculation.

**`is_free` filter:**
Handles both boolean and string types:
```js
if (is_free === 'true' || is_free === true) { where.push('sm.is_free = 1'); }
```
Query strings arrive as strings, so both `'true'`/`'false'` and `true`/`false` are handled.

---

### `getMaterial(materialId, studentId)`
| Property | Details |
|---|---|
| **Parameters** | `materialId` — integer, `studentId` — integer or null |
| **Returns** | Material object with `purchased` boolean and `reviews` array |
| **Error** | `404 NOT_FOUND` if material doesn't exist or isn't published |

**Logic:**
1. Fetches full material details with instructor profile info.
2. If `studentId` is provided, checks `material_purchases` for a successful payment record.
3. Fetches last 10 reviews with student names and avatars.
4. Returns merged object: `{ ...material, purchased, reviews }`.

---

### `purchaseMaterial(materialId, studentId)`
| Property | Details |
|---|---|
| **Parameters** | `materialId` — integer, `studentId` — integer |
| **Returns** | Different shapes depending on free vs paid |

**Two-path purchase flow:**

**Free path:**
```js
// Inserts purchase record with amount_paid = 0, payment_status = 'success'
// Increments purchase_count
// Returns { success: true, free: true, message: '...' }
```

**Paid path:**
```js
// Returns { success: false, requires_payment: true, amount, title }
// No DB write — payment hasn't happened yet
```

**Guard checks:**
- Material must exist and be published → `404 NOT_FOUND`
- Already purchased → `409 ALREADY_PURCHASED`

---

### `confirmPurchase(materialId, studentId, paymentId, amountPaid)`
| Property | Details |
|---|---|
| **Parameters** | `materialId` — integer, `studentId` — integer, `paymentId` — string, `amountPaid` — number |
| **Returns** | `{ success: true, message }` |

Called after the payment gateway confirms a successful transaction.

Uses `ON DUPLICATE KEY UPDATE` — if the student somehow already has a pending/failed record, it updates to `success`:
```sql
INSERT INTO material_purchases (...) VALUES (...)
ON DUPLICATE KEY UPDATE payment_status = 'success', payment_id = ?, amount_paid = ?
```

Also increments `purchase_count` on the material.

---

### `getDownloadUrl(materialId, studentId)`
| Property | Details |
|---|---|
| **Parameters** | `materialId` — integer, `studentId` — integer |
| **Returns** | `{ download_url, file_name }` |
| **Error** | `403 NOT_PURCHASED`, `404 NOT_FOUND` |

**Access control:** Verifies purchase with `payment_status = 'success'` before returning the file URL.

**Side effect:** Increments `download_count` on the material on every successful download URL generation.

---

### `getMyPurchases(studentId)`
| Property | Details |
|---|---|
| **Parameters** | `studentId` — integer |
| **Returns** | Array of purchased materials with instructor name and purchase metadata |

Joins `material_purchases` → `study_materials` → `user_profiles`. Ordered by purchase date descending.

---

### `addReview(materialId, studentId, rating, reviewText)`
| Property | Details |
|---|---|
| **Parameters** | `materialId` — integer, `studentId` — integer, `rating` — integer (1–5), `reviewText` — string or null |
| **Returns** | `{ message }` |
| **Error** | `403 NOT_PURCHASED` if not purchased |

**Logic:**
1. Verifies the student has a successful purchase.
2. Upserts the review (students can update their own review):
```sql
INSERT INTO material_reviews (...) VALUES (...)
ON DUPLICATE KEY UPDATE rating = ?, review_text = ?
```
3. Recalculates and updates `avg_rating` and `total_ratings` on the material:
```sql
UPDATE study_materials SET
  avg_rating   = (SELECT AVG(rating) FROM material_reviews WHERE material_id = ?),
  total_ratings= (SELECT COUNT(*) FROM material_reviews WHERE material_id = ?)
WHERE id = ?
```

---

### `uploadMaterial(instructorId, data, file)`
| Property | Details |
|---|---|
| **Parameters** | `instructorId` — integer, `data` — object (body fields), `file` — multer file object |
| **Returns** | `{ id, message }` |
| **Error** | `400 NO_FILE`, `400 MISSING_TITLE` |

**Field processing:**
```js
const isFree  = is_free === 'true' || is_free === true;
const priceVal = isFree ? 0 : parseFloat(price) || 0;
const fileUrl  = '/uploads/materials/' + file.filename;
const fileSize = file.size;
const fileName = file.originalname;
```
- Handles `is_free` as string or boolean (from multipart form data, values arrive as strings).
- Forces `price = 0` if `is_free` is true.
- Status is always set to `'published'` immediately on upload.

---

### `getMyMaterials(instructorId)`
| Property | Details |
|---|---|
| **Parameters** | `instructorId` — integer |
| **Returns** | Array of instructor's materials with `total_earnings` |

Uses `LEFT JOIN` on `material_purchases` and `GROUP BY` to calculate earnings per material:
```sql
COALESCE(SUM(mp.amount_paid), 0) AS total_earnings
```
Only counts successful payments. `COALESCE` ensures `0` is returned for materials with no purchases.

---

### `deleteMaterial(materialId, instructorId)`
| Property | Details |
|---|---|
| **Parameters** | `materialId` — integer, `instructorId` — integer |
| **Returns** | `{ message }` |
| **Error** | `404 NOT_FOUND` if not found or not owned |

**Physical file deletion:**
```js
try {
  const filePath = path.join(__dirname, '../../..', rows[0].file_url);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
} catch(e) {}
```
Wrapped in try/catch with empty catch — file deletion failure is silently ignored. The DB record is still deleted even if the physical file can't be removed.

**Ownership check:**
```sql
WHERE id = ? AND instructor_id = ?
```
The instructor can only delete their own materials — the query fails if `instructorId` doesn't match.

---

### `getCategories()`
| Property | Details |
|---|---|
| **Parameters** | None |
| **Returns** | Array of category strings |

```sql
SELECT DISTINCT category FROM study_materials
WHERE status = 'published' AND category IS NOT NULL
ORDER BY category
```
Returns dynamic categories derived from existing published materials — no separate categories table needed.

---

## 6. API Role

All functions are called by `materials.controller.js`. No direct HTTP exposure.

---

## 8. Data Flow

```
materials.controller.js  →  materials.service.function(params)
                                      │
                           SQL queries to:
                         ┌────────────────────────────────┐
                         │ study_materials                 │
                         │ material_purchases              │
                         │ material_reviews                │
                         │ users, user_profiles            │
                         └────────────────────────────────┘
                                      │
                           Physical file system (upload/delete)
                                      │
                           Assembled result object
                                      │
                           Returned to controller
```

---

## 9. Connections

### Files That Call This File
- `modules/materials/materials.controller.js`

### Files This File Depends On
- `../../config/db` — Database operations
- `../../shared/errorHandler` — `AppError`
- `path`, `fs` — File path construction and deletion

---

## 11. Error Handling

| Function | Error | Code | HTTP |
|---|---|---|---|
| `getMaterial` | Not found or unpublished | `NOT_FOUND` | 404 |
| `purchaseMaterial` | Material not found | `NOT_FOUND` | 404 |
| `purchaseMaterial` | Already purchased | `ALREADY_PURCHASED` | 409 |
| `confirmPurchase` | Material not found | `NOT_FOUND` | 404 |
| `getDownloadUrl` | Not purchased | `NOT_PURCHASED` | 403 |
| `getDownloadUrl` | Material not found | `NOT_FOUND` | 404 |
| `addReview` | Not purchased | `NOT_PURCHASED` | 403 |
| `uploadMaterial` | No file uploaded | `NO_FILE` | 400 |
| `uploadMaterial` | No title | `MISSING_TITLE` | 400 |
| `deleteMaterial` | Not found / not owned | `NOT_FOUND` | 404 |

---

## 12. Example Usage

```js
// Browse with filters
const result = await service.getMaterials({
  search: 'physics',
  type: 'notes',
  is_free: 'false',
  sort: 'rating',
  page: '1',
  limit: '12'
});

// View a material as an authenticated student
const material = await service.getMaterial(5, 42);
// material.purchased = true/false based on purchase records

// Purchase a free material
const purchase = await service.purchaseMaterial(3, 42);
// purchase.free = true → immediate access

// Purchase a paid material
const purchase = await service.purchaseMaterial(7, 42);
// purchase.requires_payment = true → client initiates payment flow

// After payment gateway callback:
await service.confirmPurchase(7, 42, 'pay_xyz123', 99.00);

// Get download link
const download = await service.getDownloadUrl(7, 42);
// download.download_url = '/uploads/materials/material-abc.pdf'
```

---

## 13. Edge Cases / Notes

- **Full-text search requires MySQL FULLTEXT index** on `(title, description, subject, tags)` columns. Without it, the search query will fail.
- **`purchaseMaterial` for paid items writes nothing to DB** — only returns payment parameters. The actual purchase is recorded via `confirmPurchase` after the payment gateway callback.
- **`addReview` allows re-review** — `ON DUPLICATE KEY UPDATE` means students can update their rating/review, but each student has exactly one review per material.
- **`deleteMaterial` silently ignores file deletion errors** — if the file has already been moved or deleted, the material DB record is still removed cleanly.
- **`getDownloadUrl` increments download count on every call** — even if the student downloads multiple times. No throttling or deduplication.
- **Material status is always `'published'` on upload** — there is no draft/review workflow for instructors.
- **`avg_rating` is calculated via subquery** on every review add — for high-traffic materials with many reviews, this could be slow and might benefit from being updated via application-level math instead.

---

## 14. Summary

`materials.service.js` is the business logic engine for EduVerse's study materials marketplace. It supports full-text search with dynamic filtering and pagination, a two-step purchase flow supporting both free and paid materials, download access gating, review management with automatic average recalculation, and instructor-side material lifecycle management including physical file deletion. All access control (ownership, purchase verification) is enforced at the service layer via SQL queries.
