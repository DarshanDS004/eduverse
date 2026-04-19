/**
 * EduVerse — Pagination Helper
 * shared/paginate.js
 *
 * Centralized pagination logic used by all list endpoints.
 *
 * Usage:
 *   const { pageNum, limitNum, offset } = parsePagination(req.query);
 *   const { meta } = buildMeta(total, pageNum, limitNum);
 *
 *   return res.json({ success: true, data: { rows, pagination: meta } });
 */

'use strict';

/* ============================================================
   PARSE PAGINATION FROM QUERY PARAMS
============================================================ */

/**
 * Parse and sanitize page + per_page from query string
 *
 * @param {object} query        - req.query
 * @param {number} defaultLimit - Default items per page (default: 20)
 * @param {number} maxLimit     - Maximum allowed per page (default: 100)
 *
 * @returns {{ pageNum, limitNum, offset }}
 */
function parsePagination(query = {}, defaultLimit = 20, maxLimit = 100) {
  const pageNum  = Math.max(1, parseInt(query.page  || query.p)   || 1);
  const limitNum = Math.min(maxLimit, Math.max(1, parseInt(query.per_page || query.limit) || defaultLimit));
  const offset   = (pageNum - 1) * limitNum;

  return { pageNum, limitNum, offset };
}

/* ============================================================
   BUILD PAGINATION META OBJECT
============================================================ */

/**
 * Build standardized pagination metadata
 *
 * @param {number} total    - Total number of records
 * @param {number} pageNum  - Current page
 * @param {number} limitNum - Items per page
 *
 * @returns {{ meta }} - Pagination meta object
 */
function buildMeta(total, pageNum, limitNum) {
  const totalPages = Math.ceil(total / limitNum);

  return {
    meta: {
      total,
      page:        pageNum,
      per_page:    limitNum,
      total_pages: totalPages,
      has_next:    pageNum < totalPages,
      has_prev:    pageNum > 1,
      next_page:   pageNum < totalPages ? pageNum + 1 : null,
      prev_page:   pageNum > 1 ? pageNum - 1 : null,
    },
  };
}

/* ============================================================
   PAGINATE QUERY HELPER
   Runs a count + data query together and returns a structured result
============================================================ */

/**
 * Execute a paginated database query
 *
 * @param {object} db          - MySQL pool
 * @param {string} dataSQL     - SQL for fetching rows (without LIMIT/OFFSET)
 * @param {string} countSQL    - SQL for counting total rows
 * @param {Array}  dataParams  - Params for data query
 * @param {Array}  countParams - Params for count query
 * @param {number} pageNum     - Current page
 * @param {number} limitNum    - Items per page
 *
 * @returns {{ rows, pagination }}
 */
async function paginateQuery(db, dataSQL, countSQL, dataParams, countParams, pageNum, limitNum) {
  const offset = (pageNum - 1) * limitNum;

  const [rows]      = await db.query(`${dataSQL} LIMIT ? OFFSET ?`, [...dataParams, limitNum, offset]);
  const [[countRow]] = await db.query(countSQL, countParams);
  const total        = countRow?.total || 0;

  const { meta } = buildMeta(total, pageNum, limitNum);

  return { rows, pagination: meta };
}

/* ============================================================
   FILTER BUILDER
   Builds WHERE clause + params from a filter object
============================================================ */

/**
 * Build SQL WHERE clause and params from filters
 *
 * @param {object} filters - Key-value filter map:
 *   {
 *     'u.role':       { op: '=',    value: 'student' },
 *     'u.is_active':  { op: '=',    value: 1 },
 *     'up.full_name': { op: 'LIKE', value: '%john%' },
 *     'u.created_at': { op: '>=',   value: '2024-01-01' },
 *   }
 *
 * @param {Array} initial - Initial WHERE conditions (strings)
 *
 * @returns {{ where: string[], params: Array }}
 */
function buildFilters(filters = {}, initial = []) {
  const where  = [...initial];
  const params = [];

  for (const [column, config] of Object.entries(filters)) {
    if (config.value === undefined || config.value === null || config.value === '') continue;

    const op = config.op || '=';
    where.push(`${column} ${op} ?`);
    params.push(config.value);
  }

  return { where, params };
}

/**
 * Build WHERE SQL string from array of conditions
 */
function buildWhereSQL(conditions) {
  if (!conditions.length) return '';
  return 'WHERE ' + conditions.join(' AND ');
}

/* ============================================================
   SORT BUILDER
============================================================ */

/**
 * Build ORDER BY clause from allowed sort options
 *
 * @param {string} sortParam  - Sort value from query string (e.g. 'newest')
 * @param {object} sortMap    - Map of sort key → SQL expression
 * @param {string} defaultSort - Default SQL sort expression
 *
 * @returns {string} ORDER BY SQL
 */
function buildSort(sortParam, sortMap, defaultSort = 'created_at DESC') {
  const sql = sortMap?.[sortParam] || defaultSort;
  return `ORDER BY ${sql}`;
}

module.exports = {
  parsePagination,
  buildMeta,
  paginateQuery,
  buildFilters,
  buildWhereSQL,
  buildSort,
};