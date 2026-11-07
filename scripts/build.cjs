const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src');
const output = path.join(root, 'dist');
const downloads = path.join(root, 'downloads');
fs.mkdirSync(path.join(output, 'assets'), { recursive: true });
fs.mkdirSync(downloads, { recursive: true });

for (const name of ['index.html', 'fitting.css', 'fitting-math.js', 'fitting.js', 'assets/logo.jpg']) {
  fs.copyFileSync(path.join(source, name), path.join(output, name));
}
fs.writeFileSync(path.join(output, '.nojekyll'), '');

// Keep the double-click edition generated from the same editable source.
let html = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="fitting.css">',
  '<style>' + fs.readFileSync(path.join(source, 'fitting.css'), 'utf8') + '</style>');
for (const name of ['fitting-math.js', 'fitting.js']) {
  const script = fs.readFileSync(path.join(source, name), 'utf8').replace(/<\/script/gi, '<\\/script');
  html = html.replace(`<script src="${name}"></script>`, '<script>' + script + '</script>');
}
const logo = fs.readFileSync(path.join(source, 'assets/logo.jpg')).toString('base64');
html = html.replace('assets/logo.jpg', 'data:image/jpeg;base64,' + logo);
const filename = '广微云_拟合实验室.html';
fs.writeFileSync(path.join(downloads, filename), html);
fs.writeFileSync(path.join(output, filename), html);
console.log('Built dist/ and downloads/' + filename);
