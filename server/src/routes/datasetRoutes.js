const express = require('express');
const multer = require('multer');
const { uploadDataset, listDatasets, getDataset, deleteDataset } = require('../controllers/datasetController');
const { queryDataset, getSchema, getDistinct, getStats } = require('../controllers/queryController');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// Multer: store in memory, limit 50MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.json'];
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and JSON files are allowed.'));
    }
  },
});

// Dataset CRUD
router.post('/upload', upload.single('file'), asyncHandler(uploadDataset));
router.get('/', asyncHandler(listDatasets));
router.get('/:id', asyncHandler(getDataset));
router.delete('/:id', asyncHandler(deleteDataset));

// Query & Schema
router.post('/:id/query', asyncHandler(queryDataset));
router.get('/:id/schema', asyncHandler(getSchema));
router.get('/:id/distinct', asyncHandler(getDistinct));
router.get('/:id/stats', asyncHandler(getStats));

module.exports = router;
