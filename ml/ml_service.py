"""
Pointers ML Service — Clinician-Elicited Prior Model

Flask API that accepts member feature data and returns a destabilization
risk prediction. Initially uses a gradient boosting model trained on
synthetic data generated from clinical expert patterns.

Endpoints:
  POST /predict         — single member prediction
  POST /predict/batch   — batch predictions for multiple members
  POST /train           — retrain model on provided dataset
  GET  /health          — service health check
  GET  /model/info      — current model metadata
"""

import os
import json
import pickle
import logging
from datetime import datetime

import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import CalibratedClassifierCV

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('ml_service')

# --- Model State ---
model = None
scaler = None
model_info = {
    'type': 'clinician_elicited_prior',
    'version': '0.3.0',
    'trained_at': None,
    'training_samples': 0,
    'features': [],
    'phase': 'pre-validation',
    'label': 'Evidence-based clinician-elicited model'
}

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model.pkl')
SCALER_PATH = os.path.join(os.path.dirname(__file__), 'scaler.pkl')
INFO_PATH = os.path.join(os.path.dirname(__file__), 'model_info.json')

# PPII stream weights used by simulate_trajectory when generating synthetic
# training data. Defaults match scorePPII.js (Erica-confirmed March 11 2026).
# retrain_with_weights.py mutates this dict to regenerate the dataset against
# admin-edited weights before calling build_initial_model().
PPII_WEIGHTS = {
    'pulse':      0.35,
    'ppsi':       0.25,
    'compliance': 0.25,
    'events':     0.15,
}

# --- Feature Definitions ---
# These are the features we extract from member data
FEATURE_NAMES = [
    'ppsi_current',           # Most recent PPSI score (0-102)
    'ppsi_trend',             # Score change over last 3 assessments
    'ppsi_volatility',        # Std dev of last 5 scores
    'pulse_current',          # Most recent Provider Pulse (0-42)
    'pulse_trend',            # Pulse change over last 3
    'compliance_rate',        # % of compliance items current (0-1)
    'compliance_misses_30d',  # Number of missed compliance events in 30 days
    'survey_completion_rate', # % of surveys completed on time (0-1)
    'consecutive_misses',     # Current longest streak of consecutive misses
    'days_since_last_ppsi',   # Days since last PPSI completion
    'days_since_last_pulse',  # Days since last Provider Pulse
    'meds_flags_30d',         # MEDS flags in last 30 days
    'registry_open_count',    # Number of open registry items
    'registry_red_count',     # Number of open RED/SENTINEL items
    'days_enrolled',          # Days since enrollment
    'ppii_current',           # Current PPII composite score (0-100)
    'domain_breadth',         # Count of PPSI domains exceeding personal baseline by >1.5 SD (0-8)
    'concordance_gap',        # Signed Pulse-PPSI divergence on 0-100 scale (positive = Silent Slide)
    'chronicity',             # Days at Yellow-tier stability status (Chronic Borderline signal)
]


def simulate_trajectory(archetype, rng):
    """
    Simulate a physician's weekly trajectory and sample a point-in-time snapshot.
    Returns a dict of the 16 features at the sampled week.

    Source: PI2_Clinician_Elicited_Prior_Model_Final.docx (Dr. Erica Larson, March 2026)
    Evidence synthesis from 16 PHP outcome studies (1995-2025), peer-reviewed addiction
    medicine research, clinical practice guidelines (FSPHP, AASM, AMA).

    PPSI has 8 domains, each scored 0-3 per item:
      Sleep (5 items, max 15), Burnout (5, max 15), Work Sustainability (5, max 15),
      Isolation (5, max 15), Cognitive Load (5, max 15), Recovery/Routine (4, max 12),
      Meaning/Purpose (4, max 12), Global Stability (1 item, max 3).
    Total PPSI max = 102. Higher = worse.
    """
    # --- Baseline domain scores for stable physicians (Green) ---
    # Low scores = healthy. Erica: stable PPSI total 8-18.
    baseline = {
        'sleep': rng.uniform(0.5, 2.5),
        'burnout': rng.uniform(0.5, 2.0),
        'work': rng.uniform(0.5, 2.0),
        'isolation': rng.uniform(0.5, 2.0),
        'cognitive': rng.uniform(0.3, 1.5),
        'recovery': rng.uniform(0.3, 1.5),
        'meaning': rng.uniform(0.3, 1.5),
        'global_stab': rng.uniform(0.0, 0.5),
    }

    # Duration and sample point depend on archetype
    if archetype == 'stable_green':
        # Erica: 55-65% of population. PPSI total 8-18. Noise ±0-1/domain/week.
        # 5-10% of weeks have transient bad-day spike (+3-5 total, resolves in 1 week).
        n_weeks = rng.integers(8, 40)
        scores = []
        for w in range(n_weeks):
            week_scores = {}
            for d, v in baseline.items():
                noise = rng.uniform(-1, 1)
                week_scores[d] = max(0, v + noise)
            # 7.5% chance of transient bad-day spike
            if rng.random() < 0.075:
                spike_domain = rng.choice(list(baseline.keys()))
                week_scores[spike_domain] += rng.uniform(3, 5)
            scores.append(week_scores)
        destabilized = 0

    elif archetype == 'slow_burn':
        # Erica: 13%. Duration 8-16 weeks (median 10-12). Sigmoidal trajectory.
        # Activation: Sleep → Recovery → Burnout → Cognitive → Isolation → Meaning
        # Sleep +1 to +1.5/wk, Burnout +0.5 to +1.5/wk, others slower.
        # PPSI trajectory: 8-18 → 25-35 (wk 4-6) → 45-60 (wk 8-12) → 65-90 (wk 12-16)
        n_weeks = rng.integers(8, 17)
        rates = {
            'sleep': rng.uniform(1.0, 1.5),
            'recovery': rng.uniform(0.8, 1.2),
            'burnout': rng.uniform(0.5, 1.5),
            'cognitive': rng.uniform(0.5, 1.0),
            'isolation': rng.uniform(1.0, 2.0),
            'meaning': rng.uniform(0.5, 1.0),
            'work': rng.uniform(0.3, 0.8),
            'global_stab': rng.uniform(0.1, 0.3),
        }
        # Activation lag: 1-3 weeks between domains
        activation_order = ['sleep', 'recovery', 'burnout', 'cognitive', 'isolation', 'meaning', 'work', 'global_stab']
        activation_week = {}
        w = 0
        for d in activation_order:
            activation_week[d] = w
            w += rng.integers(1, 4)
        scores = []
        for w in range(n_weeks):
            week_scores = {}
            for d, v in baseline.items():
                if w >= activation_week.get(d, 999):
                    weeks_active = w - activation_week[d]
                    increase = rates[d] * weeks_active
                    noise = rng.uniform(-1, 1)
                    week_scores[d] = min(v + increase + noise, 15 if d not in ('recovery', 'meaning', 'global_stab') else (12 if d != 'global_stab' else 3))
                else:
                    week_scores[d] = max(0, v + rng.uniform(-1, 1))
            scores.append(week_scores)
        destabilized = 1

    elif archetype == 'acute_break':
        # Erica: 7%. Multiple domains spike simultaneously. +20 to +40 PPSI total in 1-2 weeks.
        # Sleep +4 to +6 in single week. Event-triggered.
        n_weeks_before = rng.integers(4, 12)
        n_weeks_after = rng.integers(1, 5)
        scores = []
        # Pre-event: stable
        for w in range(n_weeks_before):
            week_scores = {d: max(0, v + rng.uniform(-1, 1)) for d, v in baseline.items()}
            scores.append(week_scores)
        # Event week(s): massive spike across multiple domains
        for w in range(min(2, n_weeks_after)):
            week_scores = {}
            for d, v in baseline.items():
                if d == 'global_stab':
                    week_scores[d] = min(3, v + rng.uniform(1, 2.5))
                else:
                    spike_amt = rng.uniform(4, 8)
                    week_scores[d] = min(v + spike_amt, 15 if d not in ('recovery', 'meaning') else 12)
            scores.append(week_scores)
        # Post-event: elevated
        for w in range(max(0, n_weeks_after - 2)):
            week_scores = {}
            for d, v in baseline.items():
                if d == 'global_stab':
                    week_scores[d] = min(3, v + rng.uniform(0.5, 2))
                else:
                    week_scores[d] = min(v + rng.uniform(3, 7), 15 if d not in ('recovery', 'meaning') else 12)
            scores.append(week_scores)
        n_weeks = len(scores)
        destabilized = 1

    elif archetype == 'oscillator':
        # Erica: 10%. Period 3-6 weeks per cycle. Amplitude +8 to +20 PPSI total.
        # Stays Yellow-to-Orange range. 55-65% eventually stabilize, 25-35% destabilize.
        n_cycles = rng.integers(2, 5)
        period = rng.integers(3, 7)
        n_weeks = n_cycles * period
        scores = []
        for w in range(n_weeks):
            phase = np.sin(2 * np.pi * w / period)  # -1 to +1
            amplitude = rng.uniform(4, 10)  # per-domain swing
            week_scores = {}
            for d, v in baseline.items():
                if d == 'global_stab':
                    week_scores[d] = min(3, max(0, v + phase * rng.uniform(0.3, 1.0) + rng.uniform(-0.5, 0.5)))
                else:
                    oscillation = (phase + 1) / 2 * amplitude  # 0 to amplitude
                    noise = rng.uniform(-1.5, 1.5)
                    week_scores[d] = min(max(0, v + oscillation + noise), 15 if d not in ('recovery', 'meaning') else 12)
            scores.append(week_scores)
        # Erica: 25-35% of oscillators eventually destabilize
        destabilized = 1 if rng.random() < 0.30 else 0

    elif archetype == 'silent_slide':
        # Erica: 4%. 6-12 weeks from first compliance decline to detection.
        # PPSI stays LOW (physician minimizes self-report). Provider Pulse diverges.
        # 30-40% of SENTINELs show no PPSI changes beforehand.
        n_weeks = rng.integers(6, 13)
        scores = []
        for w in range(n_weeks):
            week_scores = {}
            for d, v in baseline.items():
                # PPSI barely moves — underreporting. Small noise only.
                noise = rng.uniform(-0.5, 0.5)
                week_scores[d] = max(0, v + noise)
            scores.append(week_scores)
        destabilized = 1  # Dangerous despite low PPSI

    elif archetype == 'recovery_arc':
        # Erica: 10%. Overlaps with another pattern — physician who destabilized then recovered.
        # Mild (Yellow peak): 4-8 wk recovery. Moderate (Orange): 8-16 wk.
        # Reverse J-curve: rapid 30-40% drop wk 1-4, plateau wk 4-8, consolidation wk 8-24.
        # Sample during recovery phase — NOT destabilized.
        peak_ppsi = rng.uniform(35, 70)
        n_weeks = rng.integers(4, 16)
        scores = []
        for w in range(n_weeks):
            # Reverse J-curve: rapid initial drop
            if w < 3:
                recovery_pct = 0.35 * (w + 1) / 3  # 0-35% in first 3 weeks
            elif w < 8:
                recovery_pct = 0.35 + 0.15 * (w - 3) / 5  # 35-50% over next 5 weeks
            else:
                recovery_pct = 0.50 + 0.30 * (w - 8) / max(1, n_weeks - 8)  # 50-80%
            current_total = peak_ppsi * (1 - recovery_pct)
            # Distribute across domains with noise
            week_scores = {}
            for d, v in baseline.items():
                max_score = 15 if d not in ('recovery', 'meaning', 'global_stab') else (12 if d != 'global_stab' else 3)
                proportion = max_score / 102  # domain's share of total
                domain_score = current_total * proportion + rng.uniform(-1, 1)
                week_scores[d] = min(max(0, domain_score), max_score)
            scores.append(week_scores)
        destabilized = 0  # Recovering — not destabilized

    elif archetype == 'chronic_borderline':
        # Erica: 6%. Chronic Yellow — stays in 25-35 PPSI range for extended period.
        # Not improving despite intervention. This is what T5 detection catches.
        n_weeks = rng.integers(12, 24)
        chronic_level = rng.uniform(25, 38)
        scores = []
        for w in range(n_weeks):
            week_scores = {}
            for d, v in baseline.items():
                max_score = 15 if d not in ('recovery', 'meaning', 'global_stab') else (12 if d != 'global_stab' else 3)
                proportion = max_score / 102
                domain_score = chronic_level * proportion + rng.uniform(-1.5, 1.5)
                week_scores[d] = min(max(0, domain_score), max_score)
            scores.append(week_scores)
        destabilized = 1  # Chronic borderline IS destabilized (not improving)

    else:
        raise ValueError(f"Unknown archetype: {archetype}")

    # --- Sample a point in time and compute the 16 features ---
    n_weeks = len(scores)
    # Sample from the latter half of the trajectory (more representative)
    sample_week = rng.integers(max(1, n_weeks // 2), n_weeks)

    # PPSI total at sample point
    sample = scores[sample_week - 1]
    ppsi_current = sum(sample.values())
    ppsi_current = min(102, max(0, ppsi_current))

    # PPSI trend: change over last 3-5 assessments
    lookback = min(5, sample_week)
    if lookback >= 2:
        old_total = sum(scores[sample_week - lookback].values())
        ppsi_trend = ppsi_current - old_total
    else:
        ppsi_trend = 0

    # PPSI volatility: std dev of last 5 weekly totals
    if lookback >= 3:
        recent_totals = [sum(scores[w].values()) for w in range(max(0, sample_week - 5), sample_week)]
        ppsi_volatility = float(np.std(recent_totals))
    else:
        ppsi_volatility = rng.uniform(0, 3)

    # Provider Pulse: correlated with PPSI but with Erica's concordance parameters
    # Stable: r=0.70-0.80, within 10-15% of each other on comparable scales
    # PPSI 0-102 maps to Pulse 0-42 (ratio ~0.412)
    ppsi_to_pulse_ratio = 42.0 / 102.0
    if archetype == 'silent_slide':
        # Silent Slide: PPSI low but Pulse high — discordance 15-25 points on comparable scales
        # Provider Pulse sees what the physician won't self-report
        true_severity = rng.uniform(25, 55)  # What Pulse would show
        pulse_current = min(42, max(0, true_severity * ppsi_to_pulse_ratio + rng.uniform(-3, 3)))
    elif archetype == 'recovery_arc':
        # Recovery: Pulse lags PPSI by 2-4 weeks — still elevated even as PPSI drops
        lag_penalty = rng.uniform(3, 8)
        pulse_current = min(42, max(0, ppsi_current * ppsi_to_pulse_ratio + lag_penalty + rng.uniform(-2, 2)))
    else:
        # Normal concordance: r=0.70-0.80 with ±10-15% noise
        concordance_noise = rng.uniform(-0.15, 0.15) * 42
        pulse_current = min(42, max(0, ppsi_current * ppsi_to_pulse_ratio + concordance_noise))
    pulse_current = round(pulse_current, 1)

    # Pulse trend: correlated with PPSI trend but noisier
    pulse_trend = round(ppsi_trend * ppsi_to_pulse_ratio + rng.uniform(-2, 2), 1)

    # Compliance: Erica's parameters
    if archetype == 'stable_green':
        compliance_rate = rng.uniform(0.88, 1.0)
        compliance_misses = rng.choice([0, 0, 0, 0, 0, 1])
        consecutive_misses = 0
    elif archetype == 'silent_slide':
        # Compliance declines first — this is the tell
        compliance_rate = rng.uniform(0.50, 0.80)
        compliance_misses = rng.choice([1, 2, 2, 3, 3, 4])
        consecutive_misses = rng.choice([1, 2, 2, 3])
    elif archetype == 'slow_burn':
        # Compliance erodes gradually
        progression = sample_week / n_weeks
        compliance_rate = max(0.2, rng.uniform(0.90 - 0.40 * progression, 0.95 - 0.30 * progression))
        compliance_misses = rng.choice([0, 0, 1, 1, 2, 3] if progression < 0.5 else [1, 2, 2, 3, 4])
        consecutive_misses = rng.choice([0, 0, 1] if progression < 0.5 else [0, 1, 2, 2, 3])
    elif archetype == 'acute_break':
        compliance_rate = rng.uniform(0.30, 0.70)
        compliance_misses = rng.choice([2, 3, 3, 4, 5])
        consecutive_misses = rng.choice([1, 2, 3, 4])
    elif archetype == 'oscillator':
        compliance_rate = rng.uniform(0.60, 0.90)
        compliance_misses = rng.choice([0, 1, 1, 2, 2, 3])
        consecutive_misses = rng.choice([0, 0, 1, 1, 2])
    elif archetype == 'recovery_arc':
        compliance_rate = rng.uniform(0.75, 0.95)
        compliance_misses = rng.choice([0, 0, 1, 1])
        consecutive_misses = rng.choice([0, 0, 0, 1])
    elif archetype == 'chronic_borderline':
        compliance_rate = rng.uniform(0.65, 0.85)
        compliance_misses = rng.choice([0, 1, 1, 2, 2])
        consecutive_misses = rng.choice([0, 0, 1, 1, 2])
    else:
        compliance_rate = rng.uniform(0.70, 0.95)
        compliance_misses = 0
        consecutive_misses = 0

    # Survey completion: correlated with compliance
    survey_completion = min(1.0, compliance_rate + rng.uniform(-0.10, 0.10))
    survey_completion = max(0.0, survey_completion)

    # Days since last PPSI/Pulse: higher for disengaged physicians
    if archetype in ('stable_green', 'recovery_arc'):
        days_since_ppsi = rng.integers(1, 10)
        days_since_pulse = rng.integers(3, 21)
    elif archetype in ('silent_slide', 'acute_break'):
        days_since_ppsi = rng.integers(7, 28)
        days_since_pulse = rng.integers(14, 45)
    else:
        days_since_ppsi = rng.integers(3, 21)
        days_since_pulse = rng.integers(7, 35)

    # MEDS flags: more flags for less compliant physicians
    if compliance_misses >= 3:
        meds_flags = rng.choice([2, 3, 4, 5, 6])
    elif compliance_misses >= 1:
        meds_flags = rng.choice([0, 1, 1, 2, 3])
    else:
        meds_flags = rng.choice([0, 0, 0, 0, 1])

    # Registry: realistic but NOT used to define the label (signal-streams-first)
    # These are consequences of the trajectory, not causes
    if ppsi_current > 55:
        registry_open = rng.choice([1, 2, 2, 3, 3, 4, 5])
        registry_red = rng.choice([0, 0, 1, 1, 2])
    elif ppsi_current > 35:
        registry_open = rng.choice([0, 0, 1, 1, 2, 2, 3])
        registry_red = rng.choice([0, 0, 0, 0, 1])
    elif archetype == 'silent_slide':
        # Silent slide may have registry items from compliance failures
        registry_open = rng.choice([0, 1, 1, 2])
        registry_red = rng.choice([0, 0, 1])
    else:
        registry_open = rng.choice([0, 0, 0, 0, 0, 1])
        registry_red = 0

    # Days enrolled
    if archetype == 'stable_green':
        days_enrolled = rng.integers(14, 365)
    elif archetype in ('slow_burn', 'chronic_borderline'):
        days_enrolled = rng.integers(60, 365)
    else:
        days_enrolled = rng.integers(30, 365)

    # PPII composite: weighted sum normalized to 0-100.
    # Weights come from PPII_WEIGHTS (module global). v58 (Session 109) makes
    # this tolerant of unknown stream codes — synthetic data only knows how to
    # generate the four pilot streams (pulse/ppsi/compliance/events), so any
    # extra weights passed in (Stream D/E/F when those exist) contribute zero
    # to the composite via .get(code, 0). This avoids KeyError on unknown
    # streams while preserving exact equivalence for the pilot configuration.
    ppsi_pct = ppsi_current / 102.0
    pulse_pct = pulse_current / 42.0
    comp_pct = 1.0 - compliance_rate  # Inverted: low compliance = high risk
    event_pct = min(1.0, meds_flags / 5.0)  # Proxy for event activity
    W = PPII_WEIGHTS
    ppii_current = 100 * (
        ppsi_pct  * W.get('ppsi',       0)
        + pulse_pct * W.get('pulse',      0)
        + comp_pct  * W.get('compliance', 0)
        + event_pct * W.get('events',     0)
    )
    ppii_current = min(100, max(0, ppii_current + rng.uniform(-5, 5)))

    # --- v0.3.0 derived features ---

    # Domain breadth: count of domains exceeding personal baseline by >1.5 SD
    # Computed from the simulated domain scores — uses prior weeks as baseline
    lookback_start = max(0, sample_week - 5)
    if sample_week - lookback_start >= 3:
        prior_weeks = scores[lookback_start:sample_week - 1]
        domain_keys = list(baseline.keys())
        domain_breadth = 0
        for d in domain_keys:
            prior_vals = [w[d] for w in prior_weeks]
            if len(prior_vals) < 2:
                continue
            d_mean = np.mean(prior_vals)
            d_std = np.std(prior_vals)
            if d_std > 0 and sample[d] > d_mean + 1.5 * d_std:
                domain_breadth += 1
    else:
        # Not enough history — estimate from archetype
        if archetype == 'stable_green':
            domain_breadth = 0 if rng.random() < 0.85 else 1
        elif archetype in ('slow_burn', 'chronic_borderline'):
            domain_breadth = int(rng.integers(2, 5))
        elif archetype == 'acute_break':
            domain_breadth = int(rng.integers(5, 9))
        elif archetype == 'oscillator':
            domain_breadth = int(rng.integers(1, 4))
        elif archetype == 'silent_slide':
            domain_breadth = int(rng.integers(0, 2))
        elif archetype == 'recovery_arc':
            domain_breadth = int(rng.integers(1, 4))
        else:
            domain_breadth = 0

    # Concordance gap: signed (Pulse normalized - PPSI normalized) on 0-100 scale
    # Positive = clinician sees more risk than self-report
    ppsi_norm = (ppsi_current / 102.0) * 100
    pulse_norm = (pulse_current / 42.0) * 100
    concordance_gap = round(pulse_norm - ppsi_norm, 1)

    # Chronicity: days at Yellow-tier status (from stability_registry)
    # Correlated with archetype — chronic_borderline has the longest durations
    if archetype == 'stable_green':
        chronicity = 0
    elif archetype == 'chronic_borderline':
        chronicity = int(rng.integers(60, 180))
    elif archetype == 'slow_burn':
        progression = sample_week / n_weeks
        chronicity = int(rng.integers(0, 14)) if progression < 0.4 else int(rng.integers(14, 60))
    elif archetype == 'oscillator':
        chronicity = int(rng.integers(14, 90))
    elif archetype == 'acute_break':
        chronicity = int(rng.integers(0, 14))
    elif archetype == 'silent_slide':
        chronicity = int(rng.integers(0, 30))
    elif archetype == 'recovery_arc':
        chronicity = int(rng.integers(30, 120))
    else:
        chronicity = 0

    return {
        'ppsi_current': round(ppsi_current, 1),
        'ppsi_trend': round(ppsi_trend, 1),
        'ppsi_volatility': round(ppsi_volatility, 1),
        'pulse_current': round(pulse_current, 1),
        'pulse_trend': round(pulse_trend, 1),
        'compliance_rate': round(compliance_rate, 3),
        'compliance_misses_30d': int(compliance_misses),
        'survey_completion_rate': round(survey_completion, 3),
        'consecutive_misses': int(consecutive_misses),
        'days_since_last_ppsi': int(days_since_ppsi),
        'days_since_last_pulse': int(days_since_pulse),
        'meds_flags_30d': int(meds_flags),
        'registry_open_count': int(registry_open),
        'registry_red_count': int(registry_red),
        'days_enrolled': int(days_enrolled),
        'ppii_current': round(ppii_current, 1),
        'domain_breadth': int(domain_breadth),
        'concordance_gap': concordance_gap,
        'chronicity': int(chronicity),
        'destabilized': destabilized,
    }


def build_initial_model():
    """
    Build model v0.3.0 from evidence-based clinical archetypes.

    Source: PI2_Clinician_Elicited_Prior_Model_Final.docx (Dr. Erica Larson, March 2026)
    Literature synthesis from 16 PHP outcome studies (1995-2025), peer-reviewed addiction
    medicine research, clinical practice guidelines (FSPHP, AASM, AMA).

    7 archetypes with evidence-based population distributions:
      Stable Green (58%), Slow Burn (13%), Acute Break (7%), Oscillator (10%),
      Silent Slide (4%), Recovery Arc (10%), Chronic Borderline (6%).
    Total = 108% because Recovery Arc overlaps (physician destabilized then recovered).

    KEY DESIGN CHANGE from v0.1.0: Signal-streams-first training.
    Train on raw PPSI domain trajectories and compliance/pulse signals.
    Registry status is a CONSEQUENCE, not an input for label assignment.
    """
    rng = np.random.default_rng(42)
    n_samples = 3000

    # --- Archetype allocation (Erica's evidence-based percentages) ---
    archetypes = {
        'stable_green':      int(n_samples * 0.58),  # 55-65%, use 58%
        'slow_burn':         int(n_samples * 0.13),  # 10-15%, use 13%
        'acute_break':       int(n_samples * 0.07),  # 5-8%, use 7%
        'oscillator':        int(n_samples * 0.10),  # 8-12%, use 10%
        'silent_slide':      int(n_samples * 0.04),  # 3-5%, use 4%
        'recovery_arc':      int(n_samples * 0.10),  # 8-12%, use 10%
        'chronic_borderline': int(n_samples * 0.06),  # 5-8%, use 6%
    }

    # Generate trajectories
    all_samples = []
    for archetype, count in archetypes.items():
        for _ in range(count):
            sample = simulate_trajectory(archetype, rng)
            sample['archetype'] = archetype
            all_samples.append(sample)

    data = pd.DataFrame(all_samples)

    X = data[FEATURE_NAMES].values
    y = data['destabilized'].values.astype(int)

    # Scale features
    global scaler
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Train gradient boosting with calibration for probability estimates
    # Increased estimators and depth for more nuanced archetype separation
    base_model = GradientBoostingClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        min_samples_leaf=15,
        subsample=0.8,
        random_state=42
    )
    global model
    model = CalibratedClassifierCV(base_model, cv=5, method='isotonic')
    model.fit(X_scaled, y)

    # Update model info
    model_info['version'] = '0.3.0'
    model_info['trained_at'] = datetime.now().isoformat()
    model_info['training_samples'] = len(data)
    model_info['features'] = FEATURE_NAMES
    model_info['label'] = 'Evidence-based clinician-elicited model'
    model_info['archetypes'] = {k: v for k, v in archetypes.items()}
    model_info['source'] = 'PI2_Clinician_Elicited_Prior_Model_Final.docx (Larson, 2026)'

    # Save model artifacts
    save_model()

    # Log archetype breakdown
    archetype_counts = data['archetype'].value_counts().to_dict()
    destab_rate = y.mean()
    logger.info(f"Model v0.3.0 trained on {len(data)} evidence-based samples "
                f"(destabilization rate: {destab_rate:.1%})")
    for arch, cnt in archetype_counts.items():
        arch_destab = data[data['archetype'] == arch]['destabilized'].mean()
        logger.info(f"  {arch}: {cnt} samples ({arch_destab:.0%} destabilized)")

    return model


def save_model():
    """Save model artifacts to disk."""
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    with open(SCALER_PATH, 'wb') as f:
        pickle.dump(scaler, f)
    with open(INFO_PATH, 'w') as f:
        json.dump(model_info, f, indent=2)


def load_model():
    """Load model artifacts from disk if they exist."""
    global model, scaler, model_info
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)
        with open(SCALER_PATH, 'rb') as f:
            scaler = pickle.load(f)
        if os.path.exists(INFO_PATH):
            with open(INFO_PATH, 'r') as f:
                model_info.update(json.load(f))
        logger.info("Model loaded from disk")
        return True
    return False


def extract_features(member_data):
    """
    Extract feature vector from raw member data.
    Null means 'no data available' — use neutral midpoints so the model
    treats missing data as uninformative rather than alarming.
    """
    # Neutral defaults: midpoint of what stable physicians look like in training data.
    # These values should produce a ~50 risk score when everything is null.
    NEUTRAL_DEFAULTS = {
        'ppsi_current': 25,           # Low-moderate — not alarming
        'ppsi_trend': 0,              # No change
        'ppsi_volatility': 5,         # Low volatility
        'pulse_current': 10,          # Low-moderate pulse
        'pulse_trend': 0,             # No change
        'compliance_rate': 0.85,      # Reasonable compliance
        'compliance_misses_30d': 0,   # No misses
        'survey_completion_rate': 0.8, # Decent completion
        'consecutive_misses': 0,      # No streak
        'days_since_last_ppsi': 7,    # About a week — normal cadence
        'days_since_last_pulse': 14,  # About two weeks — normal cadence
        'meds_flags_30d': 0,          # No flags
        'registry_open_count': 0,     # No open items
        'registry_red_count': 0,      # No red items
        'days_enrolled': 90,          # 3 months — mid-range
        'ppii_current': 25,           # Low-moderate
        'domain_breadth': 0,          # No domains elevated above baseline
        'concordance_gap': 0,         # No PPSI-Pulse divergence
        'chronicity': 0,              # Not at Yellow tier
    }
    features = []
    for fname in FEATURE_NAMES:
        val = member_data.get(fname)
        if val is None:
            val = NEUTRAL_DEFAULTS.get(fname, 0)
        features.append(float(val))
    return np.array(features).reshape(1, -1)


def compute_confidence(member_data):
    """
    Compute confidence level based on data completeness and enrollment duration.
    Returns: 'pre-validation' always during synthetic phase.
    Also returns a numeric confidence score (0-100) based on data richness.
    """
    days_enrolled = member_data.get('days_enrolled', 0) or 0
    survey_rate = member_data.get('survey_completion_rate', 0) or 0

    # More data = higher confidence in the prediction
    enrollment_factor = min(days_enrolled / 180, 1.0)  # Maxes at 6 months
    completion_factor = survey_rate
    confidence_score = int((enrollment_factor * 0.6 + completion_factor * 0.4) * 100)

    return {
        'phase': 'pre-validation',
        'score': confidence_score,
        'label': 'Clinician-informed model estimate',
        'note': f'Based on {days_enrolled} days enrolled, {int(survey_rate * 100)}% survey completion'
    }


# --- API Endpoints ---

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'version': model_info['version']
    })


@app.route('/model/info', methods=['GET'])
def get_model_info():
    return jsonify(model_info)


@app.route('/predict', methods=['POST'])
def predict():
    """
    Single member prediction.

    Request body:
    {
        "membership_number": "XXXXX",
        "ppsi_current": 45,
        "ppsi_trend": -8,
        ... (all feature fields)
    }

    Response:
    {
        "membership_number": "XXXXX",
        "risk_score": 72,
        "risk_label": "High",
        "probability": 0.72,
        "confidence": { ... },
        "model_version": "0.1.0",
        "label": "Clinician-informed model estimate"
    }
    """
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 503

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    membership_number = data.get('membership_number', 'unknown')

    try:
        features = extract_features(data)
        features_scaled = scaler.transform(features)

        # Get probability of destabilization
        prob = model.predict_proba(features_scaled)[0][1]
        risk_score = int(prob * 100)

        # Classify risk level
        if risk_score >= 70:
            risk_label = 'High'
        elif risk_score >= 40:
            risk_label = 'Moderate'
        elif risk_score >= 20:
            risk_label = 'Low'
        else:
            risk_label = 'Minimal'

        confidence = compute_confidence(data)

        return jsonify({
            'membership_number': membership_number,
            'risk_score': risk_score,
            'risk_label': risk_label,
            'probability': round(prob, 4),
            'confidence': confidence,
            'model_version': model_info['version'],
            'label': model_info['label']
        })

    except Exception as e:
        logger.error(f"Prediction error for {membership_number}: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """
    Batch predictions for multiple members.

    Request body:
    {
        "members": [
            { "membership_number": "XXXXX", "ppsi_current": 45, ... },
            { "membership_number": "YYYYY", "ppsi_current": 72, ... }
        ]
    }
    """
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 503

    data = request.get_json()
    members = data.get('members', [])
    if not members:
        return jsonify({'error': 'No members provided'}), 400

    results = []
    for member_data in members:
        membership_number = member_data.get('membership_number', 'unknown')
        try:
            features = extract_features(member_data)
            features_scaled = scaler.transform(features)
            prob = model.predict_proba(features_scaled)[0][1]
            risk_score = int(prob * 100)

            if risk_score >= 70:
                risk_label = 'High'
            elif risk_score >= 40:
                risk_label = 'Moderate'
            elif risk_score >= 20:
                risk_label = 'Low'
            else:
                risk_label = 'Minimal'

            results.append({
                'membership_number': membership_number,
                'risk_score': risk_score,
                'risk_label': risk_label,
                'probability': round(prob, 4),
                'confidence': compute_confidence(member_data),
            })
        except Exception as e:
            results.append({
                'membership_number': membership_number,
                'error': str(e)
            })

    return jsonify({
        'predictions': results,
        'model_version': model_info['version'],
        'label': model_info['label']
    })


@app.route('/train', methods=['POST'])
def train():
    """
    Retrain model on provided dataset.

    Request body:
    {
        "data": [
            { "ppsi_current": 45, ..., "destabilized": 1 },
            { "ppsi_current": 72, ..., "destabilized": 0 }
        ],
        "version": "0.2.0"  // optional version bump
    }
    """
    data = request.get_json()
    training_data = data.get('data', [])
    if len(training_data) < 20:
        return jsonify({'error': 'Minimum 20 training samples required'}), 400

    try:
        df = pd.DataFrame(training_data)

        # Validate required columns
        missing = [f for f in FEATURE_NAMES + ['destabilized'] if f not in df.columns]
        if missing:
            return jsonify({'error': f'Missing columns: {missing}'}), 400

        X = df[FEATURE_NAMES].values
        y = df['destabilized'].values.astype(int)

        global model, scaler
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        base_model = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.1,
            random_state=42
        )
        model = CalibratedClassifierCV(base_model, cv=5, method='isotonic')
        model.fit(X_scaled, y)

        # Update model info
        new_version = data.get('version', model_info['version'])
        model_info['version'] = new_version
        model_info['trained_at'] = datetime.now().isoformat()
        model_info['training_samples'] = len(training_data)

        save_model()

        logger.info(f"Model retrained on {len(training_data)} samples, version {new_version}")

        return jsonify({
            'status': 'trained',
            'samples': len(training_data),
            'version': new_version,
            'positive_rate': float(y.mean()),
        })

    except Exception as e:
        logger.error(f"Training error: {e}")
        return jsonify({'error': str(e)}), 500


# --- Startup ---
if __name__ == '__main__':
    if not load_model():
        logger.info("No saved model found, building initial synthetic model...")
        build_initial_model()

    port = int(os.environ.get('ML_PORT', 5050))
    app.run(host='0.0.0.0', port=port, debug=False)
