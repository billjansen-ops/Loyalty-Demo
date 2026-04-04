#!/usr/bin/env node
/**
 * Generate Release Notes PDF from markdown source.
 * Usage: node generate_release_pdf.js
 */
const fs = require('fs');
const PDFDocument = require('pdfkit');

const INPUT = 'verticals/workforce_monitoring/tenants/wi_php/Release_Notes.md';
const OUTPUT = 'verticals/workforce_monitoring/tenants/wi_php/Release_Notes.pdf';

const md = fs.readFileSync(INPUT, 'utf8');
const lines = md.split('\n');

const doc = new PDFDocument({
  size: 'letter',
  margins: { top: 60, bottom: 60, left: 60, right: 60 }
});
const stream = fs.createWriteStream(OUTPUT);
doc.pipe(stream);

const PAGE_WIDTH = 612 - 120; // letter width minus margins

// Fonts
const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';
const FONT_BOLD_ITALIC = 'Helvetica-BoldOblique';

let firstDate = true;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Title
  if (line.startsWith('# ') && !line.startsWith('## ')) {
    doc.font(FONT_BOLD).fontSize(20).fillColor('#1e293b')
      .text(line.replace('# ', ''), { align: 'center' });
    doc.moveDown(0.5);
    // Horizontal rule
    doc.moveTo(60, doc.y).lineTo(552, doc.y).strokeColor('#cbd5e1').lineWidth(1).stroke();
    doc.moveDown(1);
    continue;
  }

  // Date heading
  if (line.startsWith('## ')) {
    if (!firstDate) {
      doc.moveDown(0.5);
      doc.moveTo(60, doc.y).lineTo(552, doc.y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.moveDown(0.5);
    }
    firstDate = false;

    // Check if we need a new page (at least 100pt for heading + some content)
    if (doc.y > 650) doc.addPage();

    doc.font(FONT_BOLD).fontSize(14).fillColor('#2563eb')
      .text(line.replace('## ', ''), { align: 'left' });
    doc.moveDown(0.4);
    continue;
  }

  // Top-level bullet
  if (line.startsWith('- ')) {
    if (doc.y > 700) doc.addPage();
    const content = line.replace('- ', '');
    renderBullet(doc, content, 0);
    continue;
  }

  // Sub-bullet
  if (line.startsWith('  - ')) {
    if (doc.y > 710) doc.addPage();
    const content = line.replace('  - ', '');
    renderBullet(doc, content, 1);
    continue;
  }

  // Empty line
  if (line.trim() === '') {
    doc.moveDown(0.2);
    continue;
  }
}

// Page numbers
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  doc.font(FONT).fontSize(8).fillColor('#94a3b8')
    .text(`Page ${i + 1} of ${range.count}`, 60, 740, { align: 'center', width: PAGE_WIDTH });
}

doc.end();
stream.on('finish', () => {
  console.log(`PDF generated: ${OUTPUT} (${range.count} pages)`);
});

/**
 * Render a bullet point with inline bold and italic markdown formatting.
 */
function renderBullet(doc, text, level) {
  const indent = level === 0 ? 0 : 16;
  const bulletChar = level === 0 ? '\u2022' : '\u2013';
  const fontSize = level === 0 ? 10 : 9;
  const textColor = level === 0 ? '#1e293b' : '#475569';

  // Bullet character
  doc.font(FONT).fontSize(fontSize).fillColor(textColor);
  const bulletX = 60 + indent;
  const textX = bulletX + 14;
  const textWidth = PAGE_WIDTH - indent - 14;

  doc.text(bulletChar, bulletX, doc.y, { continued: false, width: 14 });
  // Move back up to same line
  doc.moveUp(1);

  // Parse and render inline markdown (bold, italic, bold+italic)
  const segments = parseMarkdown(text);
  let first = true;
  for (const seg of segments) {
    let font = FONT;
    if (seg.bold && seg.italic) font = FONT_BOLD_ITALIC;
    else if (seg.bold) font = FONT_BOLD;
    else if (seg.italic) font = FONT_ITALIC;

    doc.font(font).fontSize(fontSize).fillColor(textColor);

    if (first) {
      doc.text(seg.text, textX, doc.y, { continued: segments.indexOf(seg) < segments.length - 1, width: textWidth });
      first = false;
    } else {
      doc.text(seg.text, { continued: segments.indexOf(seg) < segments.length - 1, width: textWidth });
    }
  }
  doc.moveDown(0.25);
}

/**
 * Parse markdown inline formatting: **bold**, *italic*, ***bold italic***
 * Also handles backtick code spans by treating them as italic.
 */
function parseMarkdown(text) {
  const segments = [];
  // Match ***text***, **text**, *text*, `text`
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false, italic: false });
    }

    if (match[2]) {
      // ***bold italic***
      segments.push({ text: match[2], bold: true, italic: true });
    } else if (match[3]) {
      // **bold**
      segments.push({ text: match[3], bold: true, italic: false });
    } else if (match[4]) {
      // *italic*
      segments.push({ text: match[4], bold: false, italic: true });
    } else if (match[5]) {
      // `code` — render as italic
      segments.push({ text: match[5], bold: false, italic: true });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false, italic: false });
  }

  if (segments.length === 0) {
    segments.push({ text, bold: false, italic: false });
  }

  return segments;
}
