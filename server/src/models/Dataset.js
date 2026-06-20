const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Dataset = sequelize.define('Dataset', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  originalFilename: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  fileType: {
    type: DataTypes.ENUM('csv', 'json'),
    allowNull: false,
  },
  schema: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const raw = this.getDataValue('schema');
      return raw ? JSON.parse(raw) : null;
    },
    set(value) {
      this.setDataValue('schema', JSON.stringify(value));
    },
  },
  rowCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  tableName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.ENUM('processing', 'ready', 'error'),
    defaultValue: 'processing',
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'Datasets',
  timestamps: true,
});

module.exports = Dataset;
