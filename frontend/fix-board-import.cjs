const fs = require('fs');
const path = 'src/pages/__tests__/Board.test.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace("import React from 'react'", "import React from 'react';\n");
if (!content.startsWith("import React from 'react';")) {
  content = "import React from 'react';\n" + content;
}
fs.writeFileSync(path, content);
