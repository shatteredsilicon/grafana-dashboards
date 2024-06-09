const fs = require('fs');
const JSON5 = require('json5');
const path = require('path');

const dashboardDir = 'src/dashboards';

fs.readdirSync(dashboardDir)
  .filter(f => f.endsWith(".json5"))
  .forEach(f => {
    const filepath = path.join(dashboardDir, f);
    fs.writeFileSync(
      filepath.replace(/\.json5$/, '.json'),
      JSON.stringify(
        JSON5.parse( fs.readFileSync(filepath) ),
        null,
        2
      )
    );
  });
