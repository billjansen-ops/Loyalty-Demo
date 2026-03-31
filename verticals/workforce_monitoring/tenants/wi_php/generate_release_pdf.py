#!/usr/bin/env python3
"""Generate branded Insight Release Notes PDF from Release_Notes.md"""
import re
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Image, KeepTogether
)
from reportlab.lib.enums import TA_LEFT

BLUE = HexColor('#2563eb')
TEAL = HexColor('#0891b2')
GRAY = HexColor('#64748b')
LIGHT_GRAY = HexColor('#e2e8f0')
DARK = HexColor('#1e293b')

# Styles
style_title = ParagraphStyle('Title', fontSize=26, leading=32, textColor=DARK,
                              fontName='Helvetica', spaceAfter=4)
style_subtitle = ParagraphStyle('Subtitle', fontSize=13, leading=18, textColor=GRAY,
                                 fontName='Helvetica', spaceAfter=20)
style_date = ParagraphStyle('Date', fontSize=18, leading=24, textColor=BLUE,
                             fontName='Helvetica-Bold', spaceBefore=16, spaceAfter=10)
style_feature = ParagraphStyle('Feature', fontSize=11, leading=16, textColor=DARK,
                                fontName='Helvetica', spaceAfter=4, leftIndent=20)
style_bullet = ParagraphStyle('Bullet', fontSize=10, leading=14, textColor=DARK,
                               fontName='Helvetica', spaceAfter=3, leftIndent=40,
                               bulletIndent=28, bulletFontSize=10)
style_where = ParagraphStyle('Where', fontSize=9.5, leading=13, textColor=TEAL,
                              fontName='Helvetica-Oblique', spaceAfter=8, leftIndent=40)

def parse_markdown(md_path):
    """Parse Release_Notes.md into structured data."""
    with open(md_path, 'r') as f:
        lines = f.readlines()

    sections = []
    current_date = None
    current_items = []

    for line in lines:
        line = line.rstrip()

        # Skip title
        if line.startswith('# '):
            continue

        # Date header
        if line.startswith('## '):
            if current_date:
                sections.append((current_date, current_items))
            current_date = line[3:].strip()
            current_items = []
            continue

        # Feature line (top-level bullet)
        if line.startswith('- **'):
            # Parse: - **Name** — description
            match = re.match(r'^- \*\*(.+?)\*\*\s*(?:—|--)\s*(.+)$', line)
            if match:
                current_items.append({
                    'type': 'feature',
                    'name': match.group(1),
                    'desc': match.group(2)
                })
            else:
                # Feature without description separator
                match2 = re.match(r'^- \*\*(.+?)\*\*\s*(.*)$', line)
                if match2:
                    current_items.append({
                        'type': 'feature',
                        'name': match2.group(1),
                        'desc': match2.group(2)
                    })
            continue

        # Sub-bullet with bold
        if line.startswith('  - **'):
            match = re.match(r'^\s+- \*\*(.+?)\*\*\s*(?:—|--)\s*(.+)$', line)
            if match:
                current_items.append({
                    'type': 'bold_bullet',
                    'name': match.group(1),
                    'desc': match.group(2)
                })
            continue

        # Sub-bullet (where to find it)
        if line.strip().startswith('- *Where to find it:'):
            text = re.sub(r'^\s*- \*', '', line).rstrip('*')
            current_items.append({'type': 'where', 'text': text})
            continue

        # Regular sub-bullet
        if line.strip().startswith('- '):
            text = re.sub(r'^\s*- ', '', line)
            # Clean markdown bold
            text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
            # Clean backticks
            text = re.sub(r'`(.+?)`', r'<font face="Courier">\1</font>', text)
            current_items.append({'type': 'bullet', 'text': text})
            continue

    if current_date:
        sections.append((current_date, current_items))

    return sections


def build_pdf(sections, output_path, logo_path):
    """Build the branded PDF."""
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        topMargin=0.6*inch,
        bottomMargin=0.6*inch,
        leftMargin=0.8*inch,
        rightMargin=0.8*inch
    )

    story = []

    # Logo
    if os.path.exists(logo_path):
        img = Image(logo_path, width=1.8*inch, height=0.55*inch)
        img.hAlign = 'LEFT'
        story.append(img)
        story.append(Spacer(1, 12))

    # Title and subtitle
    story.append(Paragraph('Insight Platform \u2014 Release Notes', style_title))
    story.append(Paragraph('Wisconsin Physician Health Program', style_subtitle))
    story.append(HRFlowable(width='100%', thickness=1, color=LIGHT_GRAY, spaceAfter=16))

    for i, (date, items) in enumerate(sections):
        if i > 0:
            story.append(HRFlowable(width='100%', thickness=0.5, color=LIGHT_GRAY,
                                     spaceBefore=12, spaceAfter=8))

        story.append(Paragraph(date, style_date))

        for item in items:
            if item['type'] == 'feature':
                text = f"<b>{item['name']}</b>"
                if item['desc']:
                    text += f"<br/>{item['desc']}"
                story.append(Paragraph(text, style_feature))

            elif item['type'] == 'bold_bullet':
                text = f"\u2022 <b>{item['name']}</b> \u2014 {item['desc']}"
                story.append(Paragraph(text, style_bullet))

            elif item['type'] == 'bullet':
                text = f"\u2022 {item['text']}"
                story.append(Paragraph(text, style_bullet))

            elif item['type'] == 'where':
                story.append(Paragraph(item['text'], style_where))

    doc.build(story)
    print(f'PDF generated: {output_path}')


if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(base, '..', '..', '..', '..'))
    md_path = os.path.join(base, 'Release_Notes.md')
    output_path = os.path.join(base, 'Insight_Release_Notes.pdf')
    logo_path = os.path.join(project_root, 'logos', 'primada.png')

    sections = parse_markdown(md_path)
    build_pdf(sections, output_path, logo_path)
