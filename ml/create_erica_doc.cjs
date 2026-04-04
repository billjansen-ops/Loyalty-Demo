const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, PageNumber, PageBreak, LevelFormat } = require('docx');

// Load data
const before = JSON.parse(fs.readFileSync('ml_before_retrain_v0.1.json', 'utf8'));
const after = JSON.parse(fs.readFileSync('ml_after_retrain_v0.2.json', 'utf8'));

// Build comparison data
const rows = before.report.map(b => {
  const a = after.report.find(r => r.membership_number === b.membership_number);
  return {
    name: b.name,
    id: b.membership_number,
    ppii: b.features.ppii_current,
    ppsi: b.features.ppsi_current,
    compliance: Math.round(b.features.compliance_rate * 100),
    pulse: b.features.pulse_current,
    beforeScore: b.prediction.risk_score,
    beforeLabel: b.prediction.risk_label,
    afterScore: a.prediction.risk_score,
    afterLabel: a.prediction.risk_label,
    delta: a.prediction.risk_score - b.prediction.risk_score,
  };
});

// Styling
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };
const headerShading = { fill: "1B5E20", type: ShadingType.CLEAR };
const headerRun = (text) => new TextRun({ text, bold: true, color: "FFFFFF", font: "Arial", size: 18 });
const cellRun = (text, opts = {}) => new TextRun({ text: String(text), font: "Arial", size: 18, ...opts });

// Table column widths (DXA) - total 9360
const colWidths = [2200, 600, 1000, 1000, 1000, 1000, 880, 880, 800];

function makeCell(content, width, shading, align = AlignmentType.LEFT) {
  const children = typeof content === 'string' || typeof content === 'number'
    ? [new Paragraph({ alignment: align, children: [cellRun(String(content))] })]
    : [new Paragraph({ alignment: align, children: content })];
  const opts = { borders, width: { size: width, type: WidthType.DXA }, margins: cellMargins, children };
  if (shading) opts.shading = shading;
  return new TableCell(opts);
}

function makeHeaderCell(text, width) {
  return new TableCell({
    borders, width: { size: width, type: WidthType.DXA }, margins: cellMargins,
    shading: headerShading,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [headerRun(text)] })]
  });
}

// Score color coding
function scoreColor(score) {
  if (score >= 70) return "C62828"; // red
  if (score >= 40) return "E65100"; // orange
  if (score >= 20) return "F9A825"; // amber
  return "2E7D32"; // green
}

function scoreCells(score, label, width1, width2) {
  return [
    makeCell([cellRun(String(score), { bold: true, color: scoreColor(score) })], width1, null, AlignmentType.CENTER),
    makeCell([cellRun(label, { color: scoreColor(score), size: 16 })], width2, null, AlignmentType.CENTER),
  ];
}

function deltaCell(delta, width) {
  const sign = delta > 0 ? "+" : "";
  const color = Math.abs(delta) <= 5 ? "616161" : delta > 0 ? "C62828" : "2E7D32";
  return makeCell([cellRun(`${sign}${delta}`, { bold: true, color })], width, null, AlignmentType.CENTER);
}

// Build table rows
const headerRow = new TableRow({
  children: [
    makeHeaderCell("Physician", colWidths[0]),
    makeHeaderCell("PPII", colWidths[1]),
    makeHeaderCell("v0.1 Score", colWidths[2]),
    makeHeaderCell("v0.1 Risk", colWidths[3]),
    makeHeaderCell("v0.2 Score", colWidths[4]),
    makeHeaderCell("v0.2 Risk", colWidths[5]),
    makeHeaderCell("Delta", colWidths[6]),
  ]
});

// Merge some columns for a cleaner look - use 7 columns
const col7Widths = [2200, 800, 1100, 1100, 1100, 1100, 960];

const headerRow2 = new TableRow({
  children: [
    makeHeaderCell("Physician", col7Widths[0]),
    makeHeaderCell("PPII", col7Widths[1]),
    makeHeaderCell("v0.1 Score", col7Widths[2]),
    makeHeaderCell("v0.1 Risk", col7Widths[3]),
    makeHeaderCell("v0.2 Score", col7Widths[4]),
    makeHeaderCell("v0.2 Risk", col7Widths[5]),
    makeHeaderCell("Delta", col7Widths[6]),
  ]
});

const dataRows = rows.map((r, i) => {
  const stripe = i % 2 === 1 ? { fill: "F5F5F5", type: ShadingType.CLEAR } : null;
  return new TableRow({
    children: [
      makeCell(r.name, col7Widths[0], stripe),
      makeCell([cellRun(String(r.ppii), { bold: true })], col7Widths[1], stripe, AlignmentType.CENTER),
      makeCell([cellRun(String(r.beforeScore), { bold: true, color: scoreColor(r.beforeScore) })], col7Widths[2], stripe, AlignmentType.CENTER),
      makeCell([cellRun(r.beforeLabel, { color: scoreColor(r.beforeScore), size: 16 })], col7Widths[3], stripe, AlignmentType.CENTER),
      makeCell([cellRun(String(r.afterScore), { bold: true, color: scoreColor(r.afterScore) })], col7Widths[4], stripe, AlignmentType.CENTER),
      makeCell([cellRun(r.afterLabel, { color: scoreColor(r.afterScore), size: 16 })], col7Widths[5], stripe, AlignmentType.CENTER),
      (() => {
        const sign = r.delta > 0 ? "+" : "";
        const color = Math.abs(r.delta) <= 5 ? "616161" : r.delta > 0 ? "C62828" : "2E7D32";
        return makeCell([cellRun(`${sign}${r.delta}`, { bold: true, color })], col7Widths[6], stripe, AlignmentType.CENTER);
      })(),
    ]
  });
});

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "1B5E20" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "2E7D32" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1B5E20", space: 1 } },
          children: [
            new TextRun({ text: "INSIGHT HEALTH SOLUTIONS", font: "Arial", size: 16, color: "1B5E20", bold: true }),
            new TextRun({ text: "  |  CONFIDENTIAL", font: "Arial", size: 16, color: "999999" }),
          ]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 1 } },
          children: [
            new TextRun({ text: "ML Model Retrain Report  |  Page ", font: "Arial", size: 16, color: "999999" }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "999999" }),
          ]
        })]
      })
    },
    children: [
      // Title
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "Predictive Model Retrain Results", font: "Arial", size: 44, bold: true, color: "1B5E20" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "ML Model v0.1.0 \u2192 v0.2.0", font: "Arial", size: 28, color: "616161" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: "April 2, 2026  |  Wisconsin PHP Pilot Cohort", font: "Arial", size: 22, color: "999999" })]
      }),

      // What Changed
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("What Changed")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: "The predictive destabilization model was completely retrained using the clinical parameters and evidence-based archetypes from your elicitation document. The previous model (v0.1.0) was trained on basic statistical distributions. The new model (v0.2.0) was trained on ", size: 22 }),
          new TextRun({ text: "your clinical expertise", bold: true, italic: true, size: 22 }),
          new TextRun({ text: ".", size: 22 })]
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Your Seven Archetypes")] }),
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: "The model now trains on 3,239 synthetic physician trajectories distributed across seven clinical archetypes you defined:", size: 22 })]
      }),

      // Archetype list
      ...[
        ["Stable Green (58%)", "Low, flat scores across all domains. Occasional transient spikes that self-resolve. Not destabilized."],
        ["Slow Burn (13%)", "Sequential domain activation: Sleep \u2192 Recovery \u2192 Burnout \u2192 Cognitive \u2192 Isolation \u2192 Meaning. Gradual escalation with 1\u20133 week lags between domains."],
        ["Acute Break (7%)", "Sudden +4\u20138 point jump across all domains simultaneously. Critical event trigger."],
        ["Oscillator (10%)", "Sinusoidal pattern, 3\u20136 week period. 25\u201335% ultimately destabilize despite apparent recovery phases."],
        ["Silent Slide (4%)", "PPSI barely moves (physician underreporting), but compliance declines and Provider Pulse diverges by 15\u201325 points. The most dangerous pattern to miss."],
        ["Recovery Arc (10%)", "Reverse J-curve from peak distress. Genuine recovery trajectory. Not destabilized."],
        ["Chronic Borderline (6%)", "PPSI stays in 25\u201338 range for 12\u201324 weeks. Never quite triggers red, but never stabilizes."],
      ].map(([title, desc]) => new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 60 },
        children: [
          new TextRun({ text: title, bold: true, size: 22 }),
          new TextRun({ text: " \u2014 " + desc, size: 22 }),
        ]
      })),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Signal-Streams-First Training")] }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: "Per your guidance, the model now trains on raw signal streams (PPSI scores, Provider Pulse, compliance behavior) rather than registry status. Registry features are still included as model inputs for prediction, but the training labels are derived from the temporal trajectory itself \u2014 not from whether a physician happens to have an open registry entry. This eliminates the circular learning problem you identified.", size: 22 })]
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Your Clinical Thresholds")] }),
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: "The following thresholds from your document are now embedded in the training data generation:", size: 22 })]
      }),
      ...[
        "Burnout domain score 9\u201310 out of 15 rarely reverses without intervention",
        "Cognitive domain score 8\u201310 = patient safety concern",
        "Isolation score >8 = 65\u201375% probability of destabilization within 60 days",
        "Provider Pulse concordance r = 0.70\u20130.80 with self-report (except Silent Slide)",
        "PPII composite weighting: PPSI 35%, Provider Pulse 25%, Compliance 25%, Events 15%",
      ].map(t => new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 60 },
        children: [new TextRun({ text: t, size: 22 })]
      })),

      // Page break before results
      new Paragraph({ children: [new PageBreak()] }),

      // Results
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Before & After: WI PHP Pilot Cohort")] }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "Same 9 physicians. Same input data. Same features. Only the model changed.", size: 22, italic: true, color: "616161" })]
      }),

      // Comparison table
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: col7Widths,
        rows: [headerRow2, ...dataRows],
      }),

      new Paragraph({ spacing: { before: 100, after: 200 }, children: [
        new TextRun({ text: "PPII = Predictive Performance Instability Index (composite risk score, 0\u2013100). Delta = score change from v0.1 to v0.2.", size: 18, color: "999999", italic: true })
      ]}),

      // Key observations
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Key Observations")] }),

      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 100 },
        children: [
          new TextRun({ text: "The binary cliff is gone. ", bold: true, size: 22 }),
          new TextRun({ text: "v0.1 produced a bimodal distribution \u2014 most physicians scored 0 (Minimal) or jumped straight to 96 (High). There was almost no middle ground. v0.2 produces graduated, clinically meaningful scores across the full spectrum.", size: 22 }),
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 100 },
        children: [
          new TextRun({ text: "Silent Slide detection. ", bold: true, size: 22 }),
          new TextRun({ text: "Bill Jansen #44 went from 0 \u2192 88. His PPSI is only 5 (low self-report), but he has 0% compliance rate with 2 missed compliance checks and no Provider Pulse data. The old model saw low PPSI and said \"fine.\" The new model recognizes this as a Silent Slide pattern \u2014 exactly the scenario you described as most dangerous to miss.", size: 22 }),
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 100 },
        children: [
          new TextRun({ text: "Better calibration at the top. ", bold: true, size: 22 }),
          new TextRun({ text: "Patricia Walsh was previously 96. She has the highest PPSI (85) and PPII (92) in the cohort, but she also has perfect compliance and survey completion. v0.2 scores her at 51 (Moderate) \u2014 still elevated, but reflecting that her engagement with the program is a protective factor.", size: 22 }),
        ]
      }),
      new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        spacing: { after: 100 },
        children: [
          new TextRun({ text: "Compliance and engagement matter. ", bold: true, size: 22 }),
          new TextRun({ text: "The model has learned that the combination of signals matters more than any single score. Low PPSI with declining compliance is more concerning than moderate PPSI with full engagement. This reflects the multi-stream approach from your elicitation document.", size: 22 }),
        ]
      }),

      // What's Next
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Next Steps")] }),
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: "Planned enhancements for the next model iteration (v0.3.0):", size: 22 })]
      }),
      ...[
        ["Domain Breadth", "Count of domains simultaneously above threshold \u2014 distinguishes single-domain elevation from systemic destabilization."],
        ["Concordance Gap", "PPSI vs. Provider Pulse discordance score \u2014 directly captures the Silent Slide signal."],
        ["Chronicity", "Weeks spent in elevated PPII range \u2014 identifies the Chronic Borderline pattern."],
      ].map(([title, desc]) => new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 60 },
        children: [
          new TextRun({ text: title, bold: true, size: 22 }),
          new TextRun({ text: " \u2014 " + desc, size: 22 }),
        ]
      })),
      new Paragraph({
        spacing: { before: 200 },
        children: [new TextRun({ text: "We would welcome your review of these results and any feedback on whether the score distribution aligns with your clinical expectations for these profiles.", size: 22, italic: true })]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('Erica_ML_Retrain_Results_v0.2.docx', buffer);
  console.log('Document created: Erica_ML_Retrain_Results_v0.2.docx');
});
