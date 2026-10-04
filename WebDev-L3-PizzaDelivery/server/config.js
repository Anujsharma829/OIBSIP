// Central place for settings read from the .env file.
module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
};
