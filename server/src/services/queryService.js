const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

const VALID_AGGREGATIONS = ['sum', 'avg', 'count', 'min', 'max'];
const VALID_OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN'];

const buildWhereClause = (filters, schema) => {
  if (!filters || filters.length === 0) return { sql: '', replacements: {} };

  const conditions = [];
  const replacements = {};

  for (let i = 0; i < filters.length; i++) {
    const { field, operator, value } = filters[i];
    const col = sanitizeCol(field, schema);
    if (!col) throw new Error(`Invalid filter field: "${field}"`);

    const op = (operator || '=').toUpperCase();
    if (!VALID_OPERATORS.includes(op)) throw new Error(`Invalid operator: "${operator}"`);

    const paramKey = `filter_${i}`;

    if (op === 'IN' || op === 'NOT IN') {
      const vals = Array.isArray(value) ? value : [value];
      const paramKeys = vals.map((_, j) => `:${paramKey}_${j}`);
      vals.forEach((v, j) => { replacements[`${paramKey}_${j}`] = v; });
      conditions.push(`[${col}] ${op} (${paramKeys.join(', ')})`);
    } else if (op === 'LIKE' || op === 'NOT LIKE') {
      replacements[paramKey] = `%${value}%`;
      conditions.push(`CAST([${col}] AS NVARCHAR(MAX)) ${op} :${paramKey}`);
    } else {
      replacements[paramKey] = value;
      conditions.push(`[${col}] ${op} :${paramKey}`);
    }
  }

  return { sql: `WHERE ${conditions.join(' AND ')}`, replacements };
};

const buildAggregationClause = (groupBy, aggregations, schema) => {
  const selects = [];
  const groupCols = [];

  if (groupBy && groupBy.length > 0) {
    for (const g of groupBy) {
      const col = sanitizeCol(g, schema);
      if (!col) throw new Error(`Invalid groupBy field: "${g}"`);
      selects.push(`[${col}]`);
      groupCols.push(`[${col}]`);
    }
  }

  if (aggregations && aggregations.length > 0) {
    for (const agg of aggregations) {
      const func = (agg.function || 'count').toLowerCase();
      if (!VALID_AGGREGATIONS.includes(func)) throw new Error(`Invalid aggregation: "${agg.function}"`);

      if (func === 'count' && (!agg.field || agg.field === '*')) {
        const alias = agg.alias || 'count';
        selects.push(`COUNT(*) AS [${alias}]`);
      } else {
        const col = sanitizeCol(agg.field, schema);
        if (!col) throw new Error(`Invalid aggregation field: "${agg.field}"`);
        const alias = agg.alias || `${func}_${col}`;
        selects.push(`${func.toUpperCase()}([${col}]) AS [${alias}]`);
      }
    }
  }

  if (selects.length === 0) selects.push('*');

  const groupBySQL = groupCols.length > 0 ? `GROUP BY ${groupCols.join(', ')}` : '';
  return { selectSQL: selects.join(', '), groupBySQL };
};

const sanitizeCol = (field, schema) => {
  if (!field) return null;
  const clean = field.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
  if (schema && !schema[clean] && !Object.values(schema).some((s) => s.originalName === field)) {
    return null;
  }
  return clean;
};

const executeQuery = async (tableName, schema, queryParams) => {
  const {
    filters = [],
    groupBy = [],
    aggregations = [],
    orderBy = [],
    limit = 1000,
    offset = 0,
  } = queryParams;

  const safeLimit = Math.min(Math.max(parseInt(limit) || 1000, 1), 10000);
  const safeOffset = Math.max(parseInt(offset) || 0, 0);

  const { selectSQL, groupBySQL } = buildAggregationClause(groupBy, aggregations, schema);
  const { sql: whereSQL, replacements } = buildWhereClause(filters, schema);

  // ORDER BY
  let orderSQL = '';
  if (orderBy && orderBy.length > 0) {
    const orderCols = orderBy.map(({ field, direction }) => {
      const col = sanitizeCol(field, schema);
      if (!col) throw new Error(`Invalid orderBy field: "${field}"`);
      const dir = (direction || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      return `[${col}] ${dir}`;
    });
    orderSQL = `ORDER BY ${orderCols.join(', ')}`;
  } else {
    if (groupBySQL) {
      orderSQL = `ORDER BY (SELECT NULL)`;
    } else {
      orderSQL = `ORDER BY [_row_id]`;
    }
  }

  // Count query
  const countSQL = `SELECT COUNT(*) AS total FROM (
      SELECT ${selectSQL}
      FROM [${tableName}]
      ${whereSQL}
      ${groupBySQL}
    ) AS sub
  `;

  const dataSQL = `
    SELECT ${selectSQL}
    FROM [${tableName}]
    ${whereSQL}
    ${groupBySQL}
    ${orderSQL}
    OFFSET ${safeOffset} ROWS FETCH NEXT ${safeLimit} ROWS ONLY
  `;

  const [countResult, dataResult] = await Promise.all([
    sequelize.query(countSQL, { replacements, type: QueryTypes.SELECT }),
    sequelize.query(dataSQL, { replacements, type: QueryTypes.SELECT }),
  ]);

  const total = countResult[0]?.total ?? 0;

  return {
    data: dataResult,
    pagination: {
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + dataResult.length < total,
    },
  };
};

const getDistinctValues = async (tableName, schema, field) => {
  const col = sanitizeCol(field, schema);
  if (!col) throw new Error(`Invalid field: "${field}"`);

  const sql = `SELECT DISTINCT TOP 100 [${col}] FROM [${tableName}] WHERE [${col}] IS NOT NULL ORDER BY [${col}]`;
  const result = await sequelize.query(sql, { type: QueryTypes.SELECT });
  return result.map((r) => r[col]);
};

const getColumnStats = async (tableName, schema) => {
  const numericCols = Object.entries(schema)
    .filter(([, def]) => def.sqlType === 'BIGINT' || def.sqlType === 'FLOAT')
    .map(([col]) => col);

  if (numericCols.length === 0) return {};

  const stats = {};
  for (const col of numericCols) {
    const sql = `
      SELECT 
        MIN([${col}]) AS min_val,
        MAX([${col}]) AS max_val,
        AVG(CAST([${col}] AS FLOAT)) AS avg_val,
        SUM(CAST([${col}] AS FLOAT)) AS sum_val,
        COUNT([${col}]) AS count_val
      FROM [${tableName}]
      WHERE [${col}] IS NOT NULL
    `;
    const [result] = await sequelize.query(sql, { type: QueryTypes.SELECT });
    stats[col] = result;
  }
  return stats;
};

module.exports = { executeQuery, getDistinctValues, getColumnStats, sanitizeCol };
