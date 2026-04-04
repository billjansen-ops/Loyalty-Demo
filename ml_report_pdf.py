#!/usr/bin/env python3
"""ML Predictive Risk — Physician Feature Report (PDF)"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from datetime import datetime

# ── Data from the report run ──
GENERATED = "March 26, 2026"

FEATURES_DEF = [
    ("ppsi_current", "Most recent PPSI total score (0-102)", "Activity molecules (MEMBER_SURVEY_LINK + MEMBER_POINTS)"),
    ("ppsi_trend", "Current score minus oldest of last 5. Negative = improving.", "Computed from PPSI activity history"),
    ("ppsi_volatility", "Standard deviation of last 5 PPSI scores. Higher = erratic.", "Computed from PPSI activity history"),
    ("pulse_current", "Most recent Provider Pulse total score (0-42)", "Activity molecules (PULSE_RESPONDENT_LINK + MEMBER_POINTS)"),
    ("pulse_trend", "Current minus oldest of last 5 Pulse scores", "Computed from Pulse activity history"),
    ("compliance_rate", "Completed items / total assigned. 1.0 = fully compliant.", "member_compliance + compliance_result tables"),
    ("compliance_misses_30d", "Total assigned minus completed (all time)", "member_compliance table"),
    ("survey_completion_rate", "1.0 if any completed surveys exist, 0 if none", "member_survey table"),
    ("consecutive_misses", "Notifications containing 'consecutive' in last 30 days", "notification table, filtered by member"),
    ("days_since_last_ppsi", "Days since last completed PPSI survey", "member_survey.end_ts (Unix timestamp)"),
    ("days_since_last_pulse", "Days since last completed Pulse survey. Null if no data.", "member_survey.end_ts (Unix timestamp)"),
    ("meds_flags_30d", "MEDS-related notifications for this member in last 30 days", "notification table, filtered by member"),
    ("registry_open_count", "Open stability registry items (status='O')", "stability_registry table"),
    ("registry_red_count", "Open items with urgency RED or SENTINEL", "stability_registry table"),
    ("days_enrolled", "Days since enrollment", "member.enroll_date (Bill epoch SMALLINT)"),
    ("ppii_current", "Composite PI-squared score (currently copies PPSI — not yet implemented)", "Should combine all streams into 0-100"),
]

PHYSICIANS = [
    {
        "num": "34", "name": "James Okafor",
        "ppsi": "34, 34, 68, 68, 102", "pulse": "none",
        "compliance": "8/8", "registry": "1 open, 1 SENTINEL",
        "features": {
            "ppsi_current": 34, "ppsi_trend": -68, "ppsi_volatility": 25.4,
            "pulse_current": "null", "pulse_trend": 0,
            "compliance_rate": 1.0, "compliance_misses_30d": 0,
            "survey_completion_rate": 1.0, "consecutive_misses": 0,
            "days_since_last_ppsi": 25, "days_since_last_pulse": "null",
            "meds_flags_30d": 0, "registry_open_count": 1, "registry_red_count": 1,
            "days_enrolled": 19, "ppii_current": 34
        },
        "score": 57, "label": "Moderate", "prob": 0.579
    },
    {
        "num": "35", "name": "Bill Jansen",
        "ppsi": "3, 2, 3, 5, 6", "pulse": "3, 3, 2",
        "compliance": "4/4", "registry": "0 open",
        "features": {
            "ppsi_current": 3, "ppsi_trend": -3, "ppsi_volatility": 1.5,
            "pulse_current": 3, "pulse_trend": 1,
            "compliance_rate": 1.0, "compliance_misses_30d": 0,
            "survey_completion_rate": 1.0, "consecutive_misses": 0,
            "days_since_last_ppsi": 12, "days_since_last_pulse": 12,
            "meds_flags_30d": 0, "registry_open_count": 0, "registry_red_count": 0,
            "days_enrolled": 19, "ppii_current": 3
        },
        "score": 0, "label": "Minimal", "prob": 0.0
    },
    {
        "num": "36", "name": "Marcus Reed",
        "ppsi": "5, 1, 102, 102, 102", "pulse": "none",
        "compliance": "8/8", "registry": "1 open, 1 SENTINEL",
        "features": {
            "ppsi_current": 5, "ppsi_trend": -97, "ppsi_volatility": 48.5,
            "pulse_current": "null", "pulse_trend": 0,
            "compliance_rate": 1.0, "compliance_misses_30d": 0,
            "survey_completion_rate": 1.0, "consecutive_misses": 0,
            "days_since_last_ppsi": 25, "days_since_last_pulse": 18,
            "meds_flags_30d": 0, "registry_open_count": 1, "registry_red_count": 1,
            "days_enrolled": 19, "ppii_current": 5
        },
        "score": 56, "label": "Moderate", "prob": 0.566
    },
    {
        "num": "37", "name": "Patricia Walsh",
        "ppsi": "85, 85, 102, 102, 102", "pulse": "none",
        "compliance": "4/4", "registry": "4 open, 1 RED",
        "features": {
            "ppsi_current": 85, "ppsi_trend": -17, "ppsi_volatility": 8.3,
            "pulse_current": "null", "pulse_trend": 0,
            "compliance_rate": 1.0, "compliance_misses_30d": 0,
            "survey_completion_rate": 1.0, "consecutive_misses": 0,
            "days_since_last_ppsi": 25, "days_since_last_pulse": "null",
            "meds_flags_30d": 0, "registry_open_count": 4, "registry_red_count": 1,
            "days_enrolled": 19, "ppii_current": 85
        },
        "score": 92, "label": "High", "prob": 0.924
    },
    {
        "num": "38", "name": "David Nguyen",
        "ppsi": "14, 68, 68, 68, 68", "pulse": "14",
        "compliance": "8/8", "registry": "2 open, 1 RED",
        "features": {
            "ppsi_current": 14, "ppsi_trend": -54, "ppsi_volatility": 21.6,
            "pulse_current": 14, "pulse_trend": 0,
            "compliance_rate": 1.0, "compliance_misses_30d": 0,
            "survey_completion_rate": 1.0, "consecutive_misses": 0,
            "days_since_last_ppsi": 25, "days_since_last_pulse": 17,
            "meds_flags_30d": 0, "registry_open_count": 2, "registry_red_count": 1,
            "days_enrolled": 19, "ppii_current": 14
        },
        "score": 74, "label": "High", "prob": 0.747
    },
    {
        "num": "39", "name": "Elena Vasquez",
        "ppsi": "3, 19, 34, 34, 102", "pulse": "3, 19",
        "compliance": "6/6", "registry": "2 open, 0 RED",
        "features": {
            "ppsi_current": 3, "ppsi_trend": -99, "ppsi_volatility": 33.8,
            "pulse_current": 3, "pulse_trend": -16,
            "compliance_rate": 1.0, "compliance_misses_30d": 0,
            "survey_completion_rate": 1.0, "consecutive_misses": 0,
            "days_since_last_ppsi": 25, "days_since_last_pulse": 12,
            "meds_flags_30d": 0, "registry_open_count": 2, "registry_red_count": 0,
            "days_enrolled": 19, "ppii_current": 3
        },
        "score": 0, "label": "Minimal", "prob": 0.0
    },
    {
        "num": "40", "name": "Robert Holmberg",
        "ppsi": "7, 13, 19, 85, 85", "pulse": "13",
        "compliance": "4/4", "registry": "2 open, 0 RED",
        "features": {
            "ppsi_current": 7, "ppsi_trend": -78, "ppsi_volatility": 35.5,
            "pulse_current": 13, "pulse_trend": 0,
            "compliance_rate": 1.0, "compliance_misses_30d": 0,
            "survey_completion_rate": 1.0, "consecutive_misses": 0,
            "days_since_last_ppsi": 25, "days_since_last_pulse": 17,
            "meds_flags_30d": 0, "registry_open_count": 2, "registry_red_count": 0,
            "days_enrolled": 19, "ppii_current": 7
        },
        "score": 0, "label": "Minimal", "prob": 0.0
    },
    {
        "num": "41", "name": "Michelle Ostrowski",
        "ppsi": "34, 2, 68, 68", "pulse": "2",
        "compliance": "6/6", "registry": "5 open, 0 RED",
        "features": {
            "ppsi_current": 34, "ppsi_trend": -34, "ppsi_volatility": 27.4,
            "pulse_current": 2, "pulse_trend": 0,
            "compliance_rate": 1.0, "compliance_misses_30d": 0,
            "survey_completion_rate": 1.0, "consecutive_misses": 0,
            "days_since_last_ppsi": 10, "days_since_last_pulse": 12,
            "meds_flags_30d": 0, "registry_open_count": 5, "registry_red_count": 0,
            "days_enrolled": 19, "ppii_current": 34
        },
        "score": 51, "label": "Moderate", "prob": 0.520
    },
    {
        "num": "44", "name": "Bill Jansen (test)",
        "ppsi": "5, 8", "pulse": "none",
        "compliance": "0/6", "registry": "0 open",
        "features": {
            "ppsi_current": 5, "ppsi_trend": -3, "ppsi_volatility": 0,
            "pulse_current": "null", "pulse_trend": 0,
            "compliance_rate": 0, "compliance_misses_30d": 6,
            "survey_completion_rate": 1.0, "consecutive_misses": 0,
            "days_since_last_ppsi": 11, "days_since_last_pulse": "null",
            "meds_flags_30d": 0, "registry_open_count": 0, "registry_red_count": 0,
            "days_enrolled": 11, "ppii_current": 5
        },
        "score": 0, "label": "Minimal", "prob": 0.0
    },
]

# ── Colors ──
GREEN = HexColor("#16a34a")
PRIMADA_BLUE = HexColor("#1e3a5f")
YELLOW_BG = HexColor("#fef9c3")
RED_TEXT = HexColor("#dc2626")
ORANGE_TEXT = HexColor("#f97316")
GRAY = HexColor("#64748b")
LIGHT_GRAY = HexColor("#f1f5f9")
WHITE = HexColor("#ffffff")

# ── Styles ──
styles = getSampleStyleSheet()

title_style = ParagraphStyle('ReportTitle', parent=styles['Title'],
    fontSize=18, textColor=PRIMADA_BLUE, spaceAfter=6)
subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'],
    fontSize=10, textColor=GRAY, spaceAfter=12)
heading_style = ParagraphStyle('SectionHead', parent=styles['Heading2'],
    fontSize=13, textColor=PRIMADA_BLUE, spaceBefore=16, spaceAfter=8)
body_style = ParagraphStyle('Body', parent=styles['Normal'],
    fontSize=9, leading=13, spaceAfter=6)
small_style = ParagraphStyle('Small', parent=styles['Normal'],
    fontSize=8, leading=11, textColor=GRAY)
bold_style = ParagraphStyle('Bold', parent=styles['Normal'],
    fontSize=9, leading=13, spaceAfter=4)
physician_style = ParagraphStyle('PhysName', parent=styles['Heading3'],
    fontSize=12, textColor=PRIMADA_BLUE, spaceBefore=12, spaceAfter=4)
score_high = ParagraphStyle('ScoreHigh', parent=styles['Normal'],
    fontSize=10, textColor=RED_TEXT)
score_mod = ParagraphStyle('ScoreMod', parent=styles['Normal'],
    fontSize=10, textColor=ORANGE_TEXT)
score_min = ParagraphStyle('ScoreMin', parent=styles['Normal'],
    fontSize=10, textColor=GREEN)

def build_pdf():
    output_path = "/Users/billjansen/Projects/Loyalty-Demo/verticals/workforce_monitoring/tenants/wi_php/ML_Predictive_Risk_Report.pdf"
    doc = SimpleDocTemplate(output_path, pagesize=letter,
        topMargin=0.6*inch, bottomMargin=0.6*inch,
        leftMargin=0.7*inch, rightMargin=0.7*inch)
    story = []

    # ── Title Page ──
    story.append(Spacer(1, 1.5*inch))
    story.append(Paragraph("INSIGHT HEALTH SOLUTIONS", title_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph("ML Predictive Risk — Physician Feature Report", ParagraphStyle(
        'BigTitle', parent=styles['Title'], fontSize=22, textColor=PRIMADA_BLUE, spaceAfter=12)))
    story.append(HRFlowable(width="100%", thickness=2, color=PRIMADA_BLUE))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"Generated: {GENERATED}", subtitle_style))
    story.append(Paragraph("INTERNAL TESTING REPORT — SYNTHETIC DATA — NOT FOR CLINICAL USE", ParagraphStyle(
        'Warning', parent=styles['Normal'], fontSize=13, textColor=RED_TEXT, spaceBefore=24, spaceAfter=12)))
    story.append(Paragraph(
        "This is an internal testing tool used to develop and tune the predictive risk model. "
        "All physician records are fictional test entries with synthetic data. The model (Pre-Alpha v0.1) "
        "has not been validated against real clinical outcomes. "
        "This report is designed to let us examine the inputs, calculations, and outputs together so we can "
        "refine the approach before moving toward validation. We are seeking feedback on:", body_style))
    story.append(Spacer(1, 6))
    bullets = [
        "Are the 16 input features clinically appropriate?",
        "Do the feature calculations match clinical intent?",
        "Do the risk scores feel directionally correct given the input data?",
        "What additional data streams or calculations should be considered?",
        "Any concerns about the scoring methodology or feature weighting?",
    ]
    for b in bullets:
        story.append(Paragraph(f"&bull; {b}", ParagraphStyle(
            'Bullet', parent=body_style, leftIndent=20, spaceAfter=3)))

    story.append(Spacer(1, 24))
    story.append(Paragraph("CONFIDENTIAL — Primada / Insight Health Solutions", small_style))

    story.append(PageBreak())

    # ── Feature Definitions ──
    story.append(Paragraph("Feature Definitions", title_style))
    story.append(Paragraph(
        "The ML model receives 16 numeric features for each physician. These are gathered from platform data "
        "each time a prediction is requested. Null values (no data available) are sent to the model as neutral "
        "defaults so the model focuses on available data rather than penalizing missing information.", body_style))
    story.append(Spacer(1, 8))

    feat_data = [["#", "Feature", "Description", "Data Source"]]
    for i, (name, desc, source) in enumerate(FEATURES_DEF, 1):
        feat_data.append([
            str(i),
            Paragraph(f"<b>{name}</b>", small_style),
            Paragraph(desc, small_style),
            Paragraph(source, small_style),
        ])

    feat_table = Table(feat_data, colWidths=[0.3*inch, 1.6*inch, 2.6*inch, 2.5*inch])
    feat_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMADA_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(feat_table)

    story.append(Spacer(1, 12))
    story.append(Paragraph("<b>Known Limitations:</b>", bold_style))
    limitations = [
        "compliance_misses_30d currently counts all-time misses, not just last 30 days",
        "ppii_current currently copies ppsi_current — composite PI-squared calculation not yet implemented",
        "survey_completion_rate is binary (0 or 1), not a true percentage",
        "Null pulse values are sent to the model as neutral defaults (mid-range values)",
    ]
    for lim in limitations:
        story.append(Paragraph(f"&bull; {lim}", ParagraphStyle(
            'LimBullet', parent=small_style, leftIndent=16, spaceAfter=2)))

    story.append(PageBreak())

    # ── Model Information ──
    story.append(Paragraph("Model Information", title_style))
    story.append(Spacer(1, 6))
    model_info = [
        ("Model Version", "Pre-Alpha v0.1"),
        ("Algorithm", "Calibrated Random Forest (100 trees) — combines 100 independent assessments of each physician's data to produce a consensus risk score"),
        ("Training Data", "2,000 synthetic samples across 5 clinical patterns"),
        ("Patterns", "50% stable, 15% gradual decline, 10% spike-recover, 10% sudden crash, 10% registry-driven destabilization"),
        ("Output", "Probability of destabilization (0.0 - 1.0), mapped to 0-100 risk score"),
        ("Confidence Phase", "Pre-validation — model has not been validated against real outcomes"),
    ]
    for label, value in model_info:
        story.append(Paragraph(f"<b>{label}:</b> {value}", body_style))

    story.append(Spacer(1, 12))
    story.append(Paragraph("<b>Top Feature Importances (what the model weighs most):</b>", bold_style))
    imp_data = [
        ("registry_red_count", "78%", "RED/SENTINEL registry items"),
        ("registry_open_count", "14%", "Total open registry items"),
        ("ppii_current", "3%", "Current composite score"),
        ("ppsi_trend", "2%", "PPSI score direction"),
        ("compliance_rate", "1%", "Treatment compliance"),
        ("All others", "2%", "Combined remaining features"),
    ]
    imp_table_data = [["Feature", "Weight", "Description"]]
    for feat, weight, desc in imp_data:
        imp_table_data.append([feat, weight, desc])
    imp_table = Table(imp_table_data, colWidths=[1.8*inch, 0.8*inch, 4.0*inch])
    imp_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMADA_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(imp_table)

    story.append(PageBreak())

    # ── Summary Table ──
    story.append(Paragraph("Physician Risk Summary", title_style))
    story.append(Spacer(1, 8))

    sum_data = [["#", "Physician", "PPSI", "Pulse", "Registry", "Score", "Risk Level"]]
    for p in PHYSICIANS:
        score_str = str(p["score"])
        label = p["label"]
        if label == "High":
            color = RED_TEXT
        elif label == "Moderate":
            color = ORANGE_TEXT
        else:
            color = GREEN
        sum_data.append([
            p["num"], p["name"],
            str(p["features"]["ppsi_current"]),
            str(p["features"]["pulse_current"]),
            p["registry"],
            Paragraph(f'<font color="{color.hexval()}">{score_str}</font>', body_style),
            Paragraph(f'<font color="{color.hexval()}">{label}</font>', body_style),
        ])

    sum_table = Table(sum_data, colWidths=[0.4*inch, 1.5*inch, 0.6*inch, 0.6*inch, 1.6*inch, 0.6*inch, 1.0*inch])
    sum_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMADA_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (2, 0), (3, -1), 'CENTER'),
        ('ALIGN', (5, 0), (5, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(sum_table)

    story.append(PageBreak())

    # ── Individual Physician Detail ──
    story.append(Paragraph("Individual Physician Detail", title_style))
    story.append(Spacer(1, 6))

    for i, p in enumerate(PHYSICIANS):
        if i > 0 and i % 2 == 0:
            story.append(PageBreak())

        # Physician header
        label = p["label"]
        if label == "High":
            score_color = RED_TEXT
        elif label == "Moderate":
            score_color = ORANGE_TEXT
        else:
            score_color = GREEN

        story.append(Paragraph(
            f'#{p["num"]} {p["name"]} — '
            f'<font color="{score_color.hexval()}">{p["score"]} ({label})</font>',
            physician_style))

        story.append(Paragraph(
            f'PPSI: {p["ppsi"]} | Pulse: {p["pulse"]} | '
            f'Compliance: {p["compliance"]} | Registry: {p["registry"]}',
            small_style))
        story.append(Spacer(1, 4))

        # Feature table
        feat_rows = [["Feature", "Value"]]
        for fname, _, _ in FEATURES_DEF:
            val = p["features"].get(fname, "—")
            val_str = str(val)
            if val == "null":
                val_str = "null  (no data)"
            feat_rows.append([fname, val_str])
        feat_rows.append(["PREDICTION", f'{p["score"]} ({label})  prob={p["prob"]}'])

        ptable = Table(feat_rows, colWidths=[2.2*inch, 3.0*inch])
        style_cmds = [
            ('BACKGROUND', (0, 0), (-1, 0), PRIMADA_BLUE),
            ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, HexColor("#cbd5e1")),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [WHITE, LIGHT_GRAY]),
            ('BACKGROUND', (0, -1), (-1, -1), YELLOW_BG),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ]
        # Highlight null values
        for row_idx in range(1, len(feat_rows) - 1):
            if "null" in str(feat_rows[row_idx][1]):
                style_cmds.append(('TEXTCOLOR', (1, row_idx), (1, row_idx), ORANGE_TEXT))

        ptable.setStyle(TableStyle(style_cmds))
        story.append(ptable)
        story.append(Spacer(1, 12))

    # ── Build ──
    doc.build(story)
    print(f"PDF generated: {output_path}")

if __name__ == "__main__":
    build_pdf()
