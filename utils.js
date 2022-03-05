const fs = require('fs/promises');

const writeFile = (path, content) => fs.writeFile(path, JSON.stringify(content, null, 2), 'utf-8');

module.exports = { writeFile }