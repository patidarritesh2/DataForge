const { parse } = require('csv-parse/sync');
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');


const inferColumnType = (value) => {
  if (value === null || value === undefined || value === '') return 'NVARCHAR(MAX)';
  if (!isNaN(value) && value !== '') {
    const num = Number(value);
    if (Number.isInteger(num)) return 'BIGINT';
    return 'FLOAT';
  }
  if (!isNaN(Date.parse(value)) && isNaN(Number(value))) return 'NVARCHAR(MAX)';
  return 'NVARCHAR(MAX)';
};


const sanitizeName = (name) => {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^(\d)/, '_$1')
    .substring(0, 128);
};

const parseFile = (buffer, fileType) => {
  if (fileType === 'csv') {
    const rows = parse(buffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
    });
    return rows;
  } else if (fileType === 'json') {
    const parsed = JSON.parse(buffer.toString('utf-8'));
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'object' && parsed !== null) {
      // Support { data: [...] } or { rows: [...] } wrapper
      const keys = Object.keys(parsed);
      for (const key of keys) {
        if (Array.isArray(parsed[key])) return parsed[key];
      }
      return [parsed];
    }
    throw new Error('JSON must be an array or an object containing an array');
  }
  throw new Error('Unsupported file type');
};


const detectSchema = (rows) => {
  if (!rows || rows.length === 0) return {};
  const sampleRows = rows.slice(0, 50);
  const allKeys = [...new Set(sampleRows.flatMap((r) => Object.keys(r)))];
  const schema = {};

  for (const key of allKeys) {
    const values = sampleRows.map((r) => r[key]).filter((v) => v !== null && v !== undefined && v !== '');
    let colType = 'NVARCHAR(MAX)';
    if (values.length > 0) {
      const allInt = values.every((v) => !isNaN(v) && Number.isInteger(Number(v)));
      const allFloat = values.every((v) => !isNaN(v) && v !== '');
      if (allInt) colType = 'BIGINT';
      else if (allFloat) colType = 'FLOAT';
      else colType = 'NVARCHAR(MAX)';
    }
    schema[sanitizeName(key)] = {
      originalName: key,
      sqlType: colType,
    };
  }
  return schema;
};

const createDynamicTable = async (tableName, schema, rows) => {
  const columns = Object.entries(schema)
    .map(([colName, colDef]) => `[${colName}] ${colDef.sqlType} NULL`)
    .join(',\n  ');

  const createSQL = `
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '${tableName}')
    CREATE TABLE [${tableName}] (
      [_row_id] INT IDENTITY(1,1) PRIMARY KEY,
      ${columns}
    )
  `;
  await sequelize.query(createSQL, { type: QueryTypes.RAW });

  const colNames = Object.keys(schema);
  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    if (batch.length === 0) continue;

    const valueRows = batch.map((row) => {
      const vals = colNames.map((col) => {
        const originalName = schema[col].originalName;
        const val = row[originalName];
        if (val === null || val === undefined || val === '') return 'NULL';
        const sqlType = schema[col].sqlType;
        if (sqlType === 'BIGINT' || sqlType === 'FLOAT') {
          const num = Number(val);
          return isNaN(num) ? 'NULL' : num.toString();
        }

        return `N'${String(val).replace(/'/g, "''")}'`;
      });
      return `(${vals.join(', ')})`;
    });

    const colList = colNames.map((c) => `[${c}]`).join(', ');
    const insertSQL = `INSERT INTO [${tableName}] (${colList}) VALUES ${valueRows.join(',\n')}`;
    await sequelize.query(insertSQL, { type: QueryTypes.INSERT });
    inserted += batch.length;
  }

  return inserted;
};


const dropDynamicTable = async (tableName) => {
  await sequelize.query(
    `IF EXISTS (SELECT * FROM sys.tables WHERE name = '${tableName}') DROP TABLE [${tableName}]`,
    { type: QueryTypes.RAW }
  );
};

module.exports = { parseFile, detectSchema, createDynamicTable, dropDynamicTable, sanitizeName };
