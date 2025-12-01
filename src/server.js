const app = require('./app');
const config = require('./config');

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Weather Dashboard server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT}/weather to view the dashboard`);
});
