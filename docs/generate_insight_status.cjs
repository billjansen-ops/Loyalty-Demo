const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        ImageRun, Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber, PageBreak } = require('docx');

// Primada brand colors
const PRIMADA_BLUE = "1B3A5C";
const PRIMADA_ACCENT = "2E75B6";
const LIGHT_BLUE_BG = "E8F0F8";
const LIGHT_GRAY_BG = "F5F7FA";
const BORDER_COLOR = "D0D5DD";
const TEXT_DARK = "1E293B";
const TEXT_MED = "475569";

const logoData = fs.readFileSync('/Users/billjansen/Projects/Loyalty-Demo/logos/primada.png');

const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0 };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function headerCell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: PRIMADA_BLUE, type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: "center",
    children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [
      new TextRun({ text, bold: true, font: "Arial", size: 20, color: "FFFFFF" })
    ]})]
  });
}

function dataCell(text, width, opts = {}) {
  const runs = [];
  if (opts.bold) {
    runs.push(new TextRun({ text, bold: true, font: "Arial", size: 19, color: TEXT_DARK }));
  } else {
    runs.push(new TextRun({ text, font: "Arial", size: 19, color: opts.color || TEXT_DARK }));
  }
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    verticalAlign: "center",
    children: [new Paragraph({ alignment: AlignmentType.LEFT, children: runs })]
  });
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 28, color: PRIMADA_BLUE })]
  });
}

function subHeading(text) {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 24, color: PRIMADA_ACCENT })]
  });
}

function bodyText(text, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.spaceBefore || 60, after: opts.spaceAfter || 60 },
    children: [new TextRun({ text, font: "Arial", size: 21, color: TEXT_DARK, ...(opts.bold ? { bold: true } : {}), ...(opts.italics ? { italics: true } : {}) })]
  });
}

function dividerLine() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMADA_ACCENT, space: 1 } },
    children: []
  });
}

// ============================================================
// BUILD THE DOCUMENT
// ============================================================

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
      {
        reference: "bullets2",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
      {
        reference: "numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      },
    ]
  },
  sections: [
    // ── COVER / TITLE PAGE ──
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children: [
        new Paragraph({ spacing: { before: 600 }, children: [] }),
        // Logo
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new ImageRun({
            type: "jpg",
            data: logoData,
            transformation: { width: 280, height: 85 },
            altText: { title: "Primada Logo", description: "Primada company logo", name: "primada-logo" }
          })]
        }),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: "Wisconsin PHP", font: "Arial", size: 48, bold: true, color: PRIMADA_BLUE })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: "Physician Wellness Platform", font: "Arial", size: 40, bold: true, color: PRIMADA_BLUE })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: "Powered by Pointers", font: "Arial", size: 28, color: PRIMADA_ACCENT, italics: true })]
        }),
        dividerLine(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: "Program Status & Development Roadmap", font: "Arial", size: 28, color: TEXT_MED })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: "March 2026", font: "Arial", size: 24, color: TEXT_MED })]
        }),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
        // Footer info
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [new TextRun({ text: "Prepared for Insight Health Solutions", font: "Arial", size: 22, color: TEXT_MED })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [new TextRun({ text: "Damian Novak  |  Dr. Erica Larson  |  Dr. Thomas Joles", font: "Arial", size: 20, color: TEXT_MED })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 40 },
          children: [new TextRun({ text: "CONFIDENTIAL", font: "Arial", size: 18, bold: true, color: "94A3B8", allCaps: true })]
        }),
      ]
    },

    // ── MAIN CONTENT ──
    {
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
            children: [new TextRun({ text: "Primada  |  Insight Health Solutions  |  Confidential", font: "Arial", size: 16, color: "94A3B8" })]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Page ", font: "Arial", size: 16, color: "94A3B8" }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "94A3B8" })
            ]
          })]
        })
      },
      children: [

        // ════════════════════════════════════════════
        // SECTION 1: DEVELOPMENT ROADMAP (WHAT'S NEXT)
        // ════════════════════════════════════════════
        new Paragraph({
          spacing: { before: 100, after: 200 },
          children: [new TextRun({ text: "Section 1: Development Roadmap", font: "Arial", size: 32, bold: true, color: PRIMADA_BLUE })]
        }),

        bodyText("The following items represent the next phase of platform development. They are informed directly by the clinical design work from Dr. Larson, operational input from Damian and Tom, and our ongoing collaboration throughout the build process. The quality and depth of the specifications we have received has been exceptional and has meaningfully accelerated development."),
        new Paragraph({ spacing: { before: 40, after: 80 }, children: [
          new TextRun({ text: "We welcome your input on prioritization ", font: "Arial", size: 21, color: TEXT_DARK }),
          new TextRun({ text: "to ensure we are building what matters most, in the order that matters most.", font: "Arial", size: 21, color: TEXT_DARK, italics: true }),
        ]}),

        // Roadmap table
        new Paragraph({ spacing: { before: 200 }, children: [] }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [400, 3200, 4160, 1600],
          rows: [
            new TableRow({ children: [
              headerCell("#", 400),
              headerCell("Feature", 3200),
              headerCell("Description", 4160),
              headerCell("Priority", 1600),
            ]}),
            // Row 1
            new TableRow({ children: [
              dataCell("1", 400),
              dataCell("Dominant Driver Analysis", 3200, { bold: true }),
              dataCell("Identifies WHY a score increased and routes the correct intervention. Same score, different cause, different response. The bridge between detection and action.", 4160),
              dataCell("", 1600, { shading: LIGHT_GRAY_BG }),
            ]}),
            // Row 2
            new TableRow({ children: [
              dataCell("2", 400),
              dataCell("Stabilization Protocol Cards", 3200, { bold: true }),
              dataCell("17 standardized intervention playbooks (from Dr. Larson) that attach to registry items. Coordinators see exactly what to do, in what order, by when, and what success looks like.", 4160),
              dataCell("", 1600, { shading: LIGHT_GRAY_BG }),
            ]}),
            // Row 3
            new TableRow({ children: [
              dataCell("3", 400),
              dataCell("Outcome Tracking & Follow-up", 3200, { bold: true }),
              dataCell("Auto-scheduled follow-up checks at 2, 4, and 8 weeks after registry item resolution. Measures whether interventions actually worked. Produces population-level effectiveness data.", 4160),
              dataCell("", 1600, { shading: LIGHT_GRAY_BG }),
            ]}),
            // Row 4
            new TableRow({ children: [
              dataCell("4", 400),
              dataCell("Convergent Validation Battery", 3200, { bold: true }),
              dataCell("46-item research battery correlating PPSI domains against gold-standard instruments (PROMIS, Stanford PFI, UCLA, etc.). Publishable convergent validity data at month 6-9. Dr. Larson's accelerated validation strategy.", 4160),
              dataCell("", 1600, { shading: LIGHT_GRAY_BG }),
            ]}),
            // Row 5
            new TableRow({ children: [
              dataCell("5", 400),
              dataCell("MEDS (Missing Event Detection)", 3200, { bold: true }),
              dataCell("Automated detection of missed surveys, appointments, and compliance events. Graduated aging within cadence windows. Consecutive miss compounding.", 4160),
              dataCell("", 1600, { shading: LIGHT_GRAY_BG }),
            ]}),
            // Row 6
            new TableRow({ children: [
              dataCell("6", 400),
              dataCell("Score Feedback (Physician Annotations)", 3200, { bold: true }),
              dataCell("Physicians annotate their own scores with context notes visible to care team. Improves clinical accuracy and supports the transparency commitment in the Consent Framework.", 4160),
              dataCell("", 1600, { shading: LIGHT_GRAY_BG }),
            ]}),
            // Row 7
            new TableRow({ children: [
              dataCell("7", 400),
              dataCell("Pattern-Based Triggers", 3200, { bold: true }),
              dataCell("Three-week upward trend detection, sudden spike detection, and protective factor collapse alerts. Complements existing direct triggers.", 4160),
              dataCell("", 1600, { shading: LIGHT_GRAY_BG }),
            ]}),
            // Row 8
            new TableRow({ children: [
              dataCell("8", 400),
              dataCell("Mobile Notification System", 3200, { bold: true }),
              dataCell("General alert framework for the physician mobile app. Drug test alerts, missed survey reminders, appointment notifications, compliance deadline warnings.", 4160),
              dataCell("", 1600, { shading: LIGHT_GRAY_BG }),
            ]}),
            // Row 9
            new TableRow({ children: [
              dataCell("9", 400),
              dataCell("Clinician-to-Member Relationships", 3200, { bold: true }),
              dataCell("Multiple clinicians per physician with assignment tracking over time. Invitation system and patient-visible care team dashboard.", 4160),
              dataCell("", 1600, { shading: LIGHT_GRAY_BG }),
            ]}),
            // Row 10
            new TableRow({ children: [
              dataCell("10", 400),
              dataCell("Role-Based Access Controls", 3200, { bold: true }),
              dataCell("Formalized data visibility per role as defined in the Consent Framework: coordinator, clinician, medical director, employer, licensing board. Each sees only what they should.", 4160),
              dataCell("", 1600, { shading: LIGHT_GRAY_BG }),
            ]}),
            // Row 11
            new TableRow({ children: [
              dataCell("11", 400),
              dataCell("Physician Affiliations", 3200, { bold: true }),
              dataCell("Display physician group memberships outside their primary clinic (medical societies, research groups, specialty boards).", 4160),
              dataCell("", 1600, { shading: LIGHT_GRAY_BG }),
            ]}),
            // Row 12
            new TableRow({ children: [
              dataCell("12", 400),
              dataCell("Compliance Cadence Overrides", 3200, { bold: true }),
              dataCell("Per-physician override of default compliance item cadence. Item definition sets the recommendation; coordinators can adjust for individual circumstances.", 4160),
              dataCell("", 1600, { shading: LIGHT_GRAY_BG }),
            ]}),
            // Row 13
            new TableRow({ children: [
              dataCell("13", 400),
              dataCell("ML Predictive Modeling Foundation", 3200, { bold: true }),
              dataCell("Feature extraction queries and model architecture designed in advance of pilot data. Survival analysis models predict time-to-destabilization at 30/60/90 day horizons after sufficient data accumulates.", 4160),
              dataCell("", 1600, { shading: LIGHT_GRAY_BG }),
            ]}),
          ]
        }),

        new Paragraph({ spacing: { before: 160, after: 60 }, children: [
          new TextRun({ text: "Priority column is yours to complete.", font: "Arial", size: 20, italics: true, color: TEXT_MED }),
          new TextRun({ text: " Please rank by importance to help us sequence the build.", font: "Arial", size: 20, italics: true, color: TEXT_MED }),
        ]}),

        new Paragraph({ children: [new PageBreak()] }),

        // ════════════════════════════════════════════
        // SECTION 2: WHAT WE'VE BUILT
        // ════════════════════════════════════════════
        new Paragraph({
          spacing: { before: 100, after: 200 },
          children: [new TextRun({ text: "Section 2: Platform Capabilities Delivered", font: "Arial", size: 32, bold: true, color: PRIMADA_BLUE })]
        }),

        // ── Platform Foundation ──
        sectionHeading("Platform Foundation: Pointers Calibration"),

        bodyText("The Wisconsin PHP platform was not built from scratch. It was calibrated from Pointers, Primada's multi-tenant behavioral data engine, purpose-built over decades for tracking members, processing events, calculating status, detecting patterns, and triggering actions. Healthcare professional monitoring is structurally identical to the behavioral engagement tracking Pointers was designed for."),

        bodyText("This calibration gave the project a substantial head start. The data architecture, temporal tracking engine, rules evaluation system, multi-tenant isolation, and API infrastructure were already proven and in production. What we built for Wisconsin PHP was the clinical layer on top of an enterprise-grade foundation."),

        subHeading("What Calibration Delivered on Day One"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Multi-tenant architecture", font: "Arial", size: 21, color: TEXT_DARK, bold: true }),
          new TextRun({ text: " with complete data isolation between state programs. Wisconsin PHP is the first program on the platform. Ohio, or any other state, becomes the next program with its own branding, compliance items, thresholds, and protocol cards. No code changes required.", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Temporal-first data model", font: "Arial", size: 21, color: TEXT_DARK, bold: true }),
          new TextRun({ text: " where every score, every event, every status change is timestamped and preserved. Balances are derived, never stored. Full history is always available for trend analysis, ML training, and outcome measurement.", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Molecule abstraction layer", font: "Arial", size: 21, color: TEXT_DARK, bold: true }),
          new TextRun({ text: " allowing any data point to attach to any activity or member without schema changes. Survey scores, signal types, compliance results, and clinical data all flow through the same universal data engine.", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Rules and promotion engine", font: "Arial", size: 21, color: TEXT_DARK, bold: true }),
          new TextRun({ text: " that evaluates conditions and fires actions automatically. The same engine that triggers loyalty bonuses now detects sentinel compliance events and creates stability registry items.", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "282 API endpoints", font: "Arial", size: 21, color: TEXT_DARK, bold: true }),
          new TextRun({ text: " providing a complete backend for member management, activity processing, data retrieval, configuration, and administration.", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Session-based authentication", font: "Arial", size: 21, color: TEXT_DARK, bold: true }),
          new TextRun({ text: " with tenant isolation, role-based access, and secure login.", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { before: 40, after: 80 }, children: [
          new TextRun({ text: "Database migration system", font: "Arial", size: 21, color: TEXT_DARK, bold: true }),
          new TextRun({ text: " ensuring safe, version-controlled schema changes with automatic startup validation.", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),

        dividerLine(),

        // ── PPSI ──
        sectionHeading("Stream A: PPSI Self-Report Survey"),
        bodyText("Dr. Larson's 34-item Predictive Professional Stability Index, fully implemented. 8 sections, scored 0-3 per item, maximum 102. Physicians complete weekly via mobile in under 2 minutes."),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Full survey instrument in database with scoring", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Mini PPSI (8-question weekly check-in) running in physician mobile app", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Sentinel detection: any question scoring 3 or Global Stability = 3 auto-triggers registry item", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Dashboard displays PPII scores, trend arrows, and sparklines for all enrolled physicians", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),

        // ── Compliance ──
        sectionHeading("Stream B: Compliance Tracking"),
        bodyText("Six compliance items with weighted scoring per Dr. Larson's specifications. Positive confirmation model (staff enters completions; absence triggers detection)."),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Drug Test Completion (25%), Drug Test Results (35%), Check-In Attendance (10%), Appointment Attendance (10%), Program Status Change (10%), Monitoring Engagement (10%)", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "24 statuses across all items, 42 member assignments", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Sentinel detection for confirmed positive drug test, specimen tampering, refusal, program suspension", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Full compliance entry UI, history view, per-physician compliance management", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),

        // ── Provider Pulse ──
        sectionHeading("Stream C: Provider Pulse Survey"),
        bodyText("Dr. Larson's clinician-completed instrument. 14 items, 7 sections, scored 0-3, maximum 42. Completed monthly or after clinical encounters in 30-60 seconds."),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Full multi-step flow: select physician, select respondent, confirmation, 14-question survey, scoring, accrual", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Respondent tracking with clinician relationship management", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Independent Provider Stability Alert (Immediate / Emerging / No Concern)", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Any individual question scoring 3 triggers automatic escalation", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),

        // ── Event Reporting ──
        sectionHeading("Stream G: Rapid Event Reporting"),
        bodyText("15-second event entry with category dropdown and severity slider (0-3). Both staff and physicians can report."),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Entry from dashboard, clinic page, physician detail, physician portal, and mobile app", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Severity 3 events auto-trigger SENTINEL registry items", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Categories tied to dominant driver routing", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),

        new Paragraph({ children: [new PageBreak()] }),

        // ── PPII Composite ──
        sectionHeading("PPII Composite Scoring"),
        bodyText("Four-stream weighted composite calculated automatically after every data entry across any stream. Dr. Larson's formula:"),
        new Paragraph({ spacing: { before: 120, after: 120 }, alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: "PPII = (0.35 x Provider Pulse) + (0.25 x PPSI) + (0.25 x Compliance) + (0.15 x Events)", font: "Arial", size: 21, color: PRIMADA_BLUE, bold: true }),
        ]}),
        bodyText("Maps to 0-100 scale. Drives Green/Yellow/Orange/Red tier assignment. Threshold crossings automatically create stability registry items."),

        // ── Stability Registry ──
        sectionHeading("Stability Registry & Action Queue"),
        bodyText("The central clinical worklist. Every condition requiring attention creates a registry item. A physician's current risk color is derived in real time from their most severe open registry item."),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Urgency-sorted display: Sentinel, Red, Orange, Yellow, Green", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "SLA tracking with visual badges per Dr. Larson's response timelines", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Resolve workflow with notes", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Clinic-scoped filtering", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),
        new Paragraph({ numbering: { reference: "bullets2", level: 0 }, spacing: { before: 40, after: 40 }, children: [
          new TextRun({ text: "Full audit trail with history views (by user, by clinic, global) and undo capability", font: "Arial", size: 21, color: TEXT_DARK }),
        ]}),

        // ── Trigger Paths ──
        sectionHeading("Automated Trigger Paths"),
        bodyText("7 of 10 direct triggers tested and working end-to-end. Each trigger flows through the rules engine automatically: data entry creates a signal molecule, the promotion engine detects it, and the appropriate registry item is created."),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3600, 3360, 2400],
          rows: [
            new TableRow({ children: [
              headerCell("Trigger", 3600),
              headerCell("Signal", 3360),
              headerCell("Status", 2400),
            ]}),
            new TableRow({ children: [
              dataCell("Sentinel Compliance (positive, refused, suspended)", 3600),
              dataCell("SENTINEL_POSITIVE / REFUSED / SUSPENDED", 3360),
              dataCell("Tested", 2400, { color: "16A34A", bold: true }),
            ]}),
            new TableRow({ children: [
              dataCell("Provider Stability Alert: Immediate", 3600),
              dataCell("STABILITY_IMMEDIATE", 3360),
              dataCell("Tested", 2400, { color: "16A34A", bold: true }),
            ]}),
            new TableRow({ children: [
              dataCell("Provider Emerging Concern", 3600),
              dataCell("STABILITY_EMERGING", 3360),
              dataCell("Tested", 2400, { color: "16A34A", bold: true }),
            ]}),
            new TableRow({ children: [
              dataCell("Event Severity 3", 3600),
              dataCell("EVENT_SEVERITY_3", 3360),
              dataCell("Tested", 2400, { color: "16A34A", bold: true }),
            ]}),
            new TableRow({ children: [
              dataCell("Provider Pulse Question >= 3", 3600),
              dataCell("PULSE_Q3", 3360),
              dataCell("Tested", 2400, { color: "16A34A", bold: true }),
            ]}),
            new TableRow({ children: [
              dataCell("PPSI Question >= 3", 3600),
              dataCell("PULSE_Q3 (reused)", 3360),
              dataCell("Built", 2400, { color: "2E75B6", bold: true }),
            ]}),
            new TableRow({ children: [
              dataCell("PPSI Global Stability = 3", 3600),
              dataCell("STABILITY_IMMEDIATE (reused)", 3360),
              dataCell("Built", 2400, { color: "2E75B6", bold: true }),
            ]}),
            new TableRow({ children: [
              dataCell("PPII Composite Threshold Crossing", 3600),
              dataCell("PPII_RED / ORANGE / YELLOW", 3360),
              dataCell("Wired", 2400, { color: "D97706", bold: true }),
            ]}),
          ]
        }),

        new Paragraph({ children: [new PageBreak()] }),

        // ── Pages Built ──
        sectionHeading("Application Pages"),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2800, 6560],
          rows: [
            new TableRow({ children: [
              headerCell("Page", 2800),
              headerCell("Description", 6560),
            ]}),
            new TableRow({ children: [
              dataCell("Wellness Dashboard", 2800, { bold: true }),
              dataCell("Main entry point. Four navigation cards. Physician roster with color badges, PPII scores, trend indicators, and sparklines.", 6560),
            ]}),
            new TableRow({ children: [
              dataCell("Clinic View", 2800, { bold: true }),
              dataCell("Physician roster scoped by clinic. Compliance entry, event entry, Provider Pulse launch, search.", 6560),
            ]}),
            new TableRow({ children: [
              dataCell("Stability Registry", 2800, { bold: true }),
              dataCell("Priority worklist sorted by urgency. SLA badges, filter chips, resolve workflow, audit history with undo.", 6560),
            ]}),
            new TableRow({ children: [
              dataCell("Physician Detail", 2800, { bold: true }),
              dataCell("Full activity timeline, drill-down modals, registry items, summary strip, compliance and event entry.", 6560),
            ]}),
            new TableRow({ children: [
              dataCell("Physician Portal", 2800, { bold: true }),
              dataCell("Physician-facing view (will be SSO). Weekly Check-In, Report Event, Open Mobile App. Pre-choice search: all physicians or by clinic.", 6560),
            ]}),
            new TableRow({ children: [
              dataCell("Mobile App", 2800, { bold: true }),
              dataCell("PPSI self-report (Mini PPSI weekly check-in), event reporting, personalized dashboard.", 6560),
            ]}),
            new TableRow({ children: [
              dataCell("Compliance Member", 2800, { bold: true }),
              dataCell("Per-physician compliance history and entry. Manage compliance item assignments.", 6560),
            ]}),
            new TableRow({ children: [
              dataCell("Registry History", 2800, { bold: true }),
              dataCell("Full audit trail of all registry actions. Three views: all activity, by clinic, by user. Reopen capability.", 6560),
            ]}),
          ]
        }),

        // ── Integration-Ready ──
        sectionHeading("Integration-Ready Design"),
        bodyText("The platform is designed for full integration with external systems in production: physicians authenticate via SSO, drug test results arrive through automated data exchange, EHR scheduling feeds populate operational strain metrics, and wearable data flows in through device APIs."),
        bodyText("For the pilot phase, each of these integration points has a functional stand-in built into the platform. Physician lookup emulates the SSO path. Compliance entry emulates automated drug test feeds. Event reporting emulates EHR and wearable inputs. The platform is fully usable today, and each stand-in is a clean swap point when integrations go live."),

        dividerLine(),

        // ── Multi-tenant ──
        sectionHeading("Built for Multi-State Expansion"),
        bodyText("The platform was architected from the beginning for multi-state deployment. Each state program operates as an independent tenant with complete data isolation, its own branding, compliance items, signal thresholds, scoring weights, and protocol cards. Onboarding a new state requires configuration, not engineering."),
        bodyText("Wisconsin PHP is the first state program on the platform. Adding the next state is a configuration exercise, not an engineering project. Same engine, same codebase, same deployment. Per-state customization through configuration, not code forks."),
        bodyText("This architecture directly supports the vision of a national platform serving all 48 states that need physician wellness monitoring, with de-identified aggregation available for national benchmarking while maintaining strict per-state data isolation."),

      ]
    }
  ]
});

// Generate
const outputPath = '/Users/billjansen/Projects/Loyalty-Demo/docs/Insight_Program_Status_March2026.docx';
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`Document created: ${outputPath}`);
  console.log(`Size: ${(buffer.length / 1024).toFixed(1)} KB`);
});
