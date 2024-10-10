const fs = require('fs');
const JSON5 = require('json5');
const path = require('path');

const dashboardDir = 'src/dashboards';
const alertDir = 'src/alerts';

const parseFunc = (dir, f) => {
  const filepath = path.join(dir, f);
  fs.writeFileSync(
    filepath.replace(/\.json5$/, '.json'),
    JSON.stringify(
      JSON5.parse( fs.readFileSync(filepath) ),
      null,
      2
    )
  );
};

fs.readdirSync(dashboardDir)
  .filter(f => f.endsWith(".json5"))
  .forEach(f => parseFunc(dashboardDir, f));

fs.readdirSync(alertDir)
  .filter(f => f.endsWith(".json5"))
  .forEach(f => parseFunc(alertDir, f));
