const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize({
  dialect: 'mssql',
  host: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_DATABASE,

  dialectOptions: {
    authentication: {
      type: 'ntlm',
      options: {
        domain: process.env.DB_DOMAIN,
        userName: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      },
    },
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
  },

  pool: {
    max: 10,
    min: 0,
    idle: 30000,
  },

  logging:
    process.env.NODE_ENV === 'development'
      ? console.log
      : false,
});

const connectDB = async () => {
  try {
    console.log('Connecting with:');
    console.log({
      server: process.env.DB_SERVER,
      database: process.env.DB_DATABASE,
      domain: process.env.DB_DOMAIN,
      user: process.env.DB_USER,
    });

    await sequelize.authenticate();
    console.log(' MSSQL connection established successfully.');

    await sequelize.sync();
    console.log(' Database synchronized.');
  } catch (error) {
    console.error(' Database connection failed');
    console.error(error);
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  connectDB,
};