const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Dataset = require('../models/Dataset');
const {
  parseFile,
  detectSchema,
  createDynamicTable,
  dropDynamicTable,
  sanitizeName,
} = require('../services/ingestionService');


const uploadDataset = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
  if (!['csv', 'json'].includes(ext)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file format. Only CSV and JSON are supported.',
    });
  }

  const datasetId = uuidv4();
  const tableName = `ds_${sanitizeName(path.basename(req.file.originalname, path.extname(req.file.originalname)))}_${datasetId.replace(/-/g, '').substring(0, 8)}`;
  const name = req.body.name || path.basename(req.file.originalname, path.extname(req.file.originalname));

  const dataset = await Dataset.create({
    id: datasetId,
    name,
    originalFilename: req.file.originalname,
    fileType: ext,
    tableName,
    status: 'processing',
  });

  setImmediate(async () => {
    try {
      const rows = parseFile(req.file.buffer, ext);

      if (!rows || rows.length === 0) {
        await dataset.update({ status: 'error', errorMessage: 'The uploaded file contains no data rows.' });
        return;
      }

      const schema = detectSchema(rows);
      if (Object.keys(schema).length === 0) {
        await dataset.update({ status: 'error', errorMessage: 'Could not detect schema from uploaded file.' });
        return;
      }

      await createDynamicTable(tableName, schema, rows);

      await dataset.update({
        schema,
        rowCount: rows.length,
        status: 'ready',
      });
    } catch (err) {
      console.error('Upload processing error:', err);
      await dataset.update({
        status: 'error',
        errorMessage: err.message,
      }).catch(() => { });
    }
  });

  return res.status(202).json({
    success: true,
    message: 'File uploaded and processing started.',
    dataset: {
      id: dataset.id,
      name: dataset.name,
      status: dataset.status,
    },
  });
};

const listDatasets = async (req, res) => {
  const datasets = await Dataset.findAll({
    attributes: ['id', 'name', 'originalFilename', 'fileType', 'rowCount', 'status', 'schema', 'createdAt'],
    order: [['createdAt', 'DESC']],
  });
  return res.json({ success: true, datasets });
};


const getDataset = async (req, res) => {
  const dataset = await Dataset.findByPk(req.params.id);
  if (!dataset) return res.status(404).json({ success: false, message: 'Dataset not found.' });
  return res.json({ success: true, dataset });
};

const deleteDataset = async (req, res) => {
  const dataset = await Dataset.findByPk(req.params.id);
  if (!dataset) return res.status(404).json({ success: false, message: 'Dataset not found.' });

  await dropDynamicTable(dataset.tableName);
  await dataset.destroy();

  return res.json({ success: true, message: 'Dataset deleted successfully.' });
};

module.exports = { uploadDataset, listDatasets, getDataset, deleteDataset };
