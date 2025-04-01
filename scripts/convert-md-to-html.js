const fs = require('fs');
const path = require('path');

// Read the markdown file
const markdownContent = fs.readFileSync(path.join(__dirname, '..', 'fazaa_art_documentation.md'), 'utf-8');

// Simple markdown to HTML conversion (basic implementation)
function markdownToHtml(markdown) {
  // Handle headers
  let html = markdown
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^##### (.*$)/gm, '<h5>$1</h5>')
    .replace(/^###### (.*$)/gm, '<h6>$1</h6>');
  
  // Handle bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Handle italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Handle links
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
  
  // Handle images
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2" />');
  
  // Handle lists
  html = html.replace(/^\d+\. (.*$)/gm, '<li>$1</li>');
  html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
  
  // Handle paragraphs
  html = html.replace(/^(?!<h|<li|<img|<a)(.*$)/gm, '<p>$1</p>');
  
  // Handle horizontal rule
  html = html.replace(/^---$/gm, '<hr />');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FAZAA - Art Platform Documentation</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #2563eb;
      margin-top: 1.5em;
    }
    h1 {
      text-align: center;
      font-size: 2.5em;
      margin-bottom: 1em;
    }
    h2 {
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 0.3em;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 2em auto;
    }
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 2em 0;
    }
    ul, ol {
      padding-left: 2em;
    }
    li {
      margin-bottom: 0.5em;
    }
    code {
      background-color: #f1f5f9;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: monospace;
    }
    a {
      color: #2563eb;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    blockquote {
      border-left: 4px solid #e5e7eb;
      padding-left: 1em;
      margin-left: 0;
      color: #64748b;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 2em 0;
    }
    table, th, td {
      border: 1px solid #e5e7eb;
    }
    th, td {
      padding: 0.75em;
      text-align: left;
    }
    th {
      background-color: #f8fafc;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
}

// Convert markdown to HTML
const htmlContent = markdownToHtml(markdownContent);

// Write HTML file
fs.writeFileSync(path.join(__dirname, '..', 'fazaa_art_documentation.html'), htmlContent);

console.log('Documentation converted to HTML successfully.');