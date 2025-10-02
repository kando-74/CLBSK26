const fs = require('fs');
const path = 'src/pages/__tests__/Board.test.tsx';
let text = fs.readFileSync(path, 'utf8');
text = text.replace(
  "function renderBoard() {",
  "function normalizeText(value: string) {\n  return value.normalize('NFD').replace(/\\\u0300-\\\u036f/g, '').toLowerCase();\n}\n\nfunction renderBoard() {"
);
text = text.replace(
  "const hideJoinedCheckbox = await screen.findByLabelText(/Ocultar mesas donde ya est/i)",
  "const hideJoinedCheckbox = await screen.findByLabelText((content) =>\n      normalizeText(content).includes('ocultar mesas donde ya estas apuntado'),\n    )"
);
text = text.replace(
  "const errorMessage = await screen.findByText(\r\n      'Describe la mesa para que otras personas sepan qu? esperar.',\r\n    )",
  "const errorMessage = await screen.findByText((content) =>\n      normalizeText(content).includes('describe la mesa para que otras personas sepan que esperar'),\n    )"
);
text = text.replace(
  "await user.type(screen.getByPlaceholderText(/Sala o ubicaci/i), 'Sala Roja')",
  "await user.type(\n      screen.getByPlaceholderText((placeholder) =>\n        normalizeText(placeholder).includes('sala o ubicacion'),\n      ),\n      'Sala Roja',\n    )"
);
text = text.replace(
  "screen.getByPlaceholderText(/A?ade detalles relevantes/i)",
  "screen.getByPlaceholderText((placeholder) =>\n        normalizeText(placeholder).includes('anade detalles relevantes'),\n      )"
);
fs.writeFileSync(path, text);
