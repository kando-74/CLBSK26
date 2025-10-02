const fs = require('fs');
const path = 'src/pages/__tests__/Board.test.tsx';
const content = fs.readFileSync(path, 'utf8');
if (!content.startsWith("import React from 'react';")) {
  const updated = "import React from 'react';\n" + content;
  fs.writeFileSync(path, updated);
}
