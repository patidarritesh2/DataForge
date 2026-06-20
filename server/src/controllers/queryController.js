const Dataset = require('../models/Dataset');
const { executeQuery, getDistinctValues, getColumnStats } = require('../services/queryService');


const queryDataset = async (req, res) => {
  const dataset = await Dataset.findByPk(req.params.id);
  if (!dataset) return res.status(404).json({ success: false, message: 'Dataset not found.' });
  if (dataset.status !== 'ready') {
    return res.status(400).json({
      success: false,
      message: `Dataset is not ready. Current status: ${dataset.status}`,
    });
  }

  const schema = dataset.schema;
  if (!schema || Object.keys(schema).length === 0) {
    return res.status(400).json({ success: false, message: 'Dataset schema is unavailable.' });
  }

  const result = await executeQuery(dataset.tableName, schema, req.body);
  return res.json({ success: true, ...result });
};

const getSchema = async (req, res) => {
  const dataset = await Dataset.findByPk(req.params.id);
  if (!dataset) return res.status(404).json({ success: false, message: 'Dataset not found.' });

  const schema = dataset.schema || {};
  const columns = Object.entries(schema).map(([colName, def]) => ({
    name: colName,
    originalName: def.originalName,
    type: def.sqlType,
    isNumeric: def.sqlType === 'BIGINT' || def.sqlType === 'FLOAT',
  }));

  return res.json({ success: true, columns, rowCount: dataset.rowCount });
};


const getDistinct = async (req, res) => {
  const dataset = await Dataset.findByPk(req.params.id);
  if (!dataset) return res.status(404).json({ success: false, message: 'Dataset not found.' });
  if (dataset.status !== 'ready') {
    return res.status(400).json({ success: false, message: 'Dataset is not ready.' });
  }

  const { field } = req.query;
  if (!field) return res.status(400).json({ success: false, message: 'field query parameter is required.' });

  const values = await getDistinctValues(dataset.tableName, dataset.schema, field);
  return res.json({ success: true, field, values });
};


const getStats = async (req, res) => {
  const dataset = await Dataset.findByPk(req.params.id);
  if (!dataset) return res.status(404).json({ success: false, message: 'Dataset not found.' });
  if (dataset.status !== 'ready') {
    return res.status(400).json({ success: false, message: 'Dataset is not ready.' });
  }

  const stats = await getColumnStats(dataset.tableName, dataset.schema);
  return res.json({ success: true, stats });
};

module.exports = { queryDataset, getSchema, getDistinct, getStats };
