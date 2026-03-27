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
    'version': '0.1.0',
    'trained_at': None,
    'training_samples': 0,
    'features': [],
    'phase': 'pre-validation',
    'label': 'Clinician-informed model estimate'
}

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model.pkl')
SCALER_PATH = os.path.join(os.path.dirname(__file__), 'scaler.pkl')
INFO_PATH = os.path.join(os.path.dirname(__file__), 'model_info.json')

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
]


def build_initial_model():
    """
    Build the initial model from synthetic clinical patterns.
    This is the 'guess' — clinically informed but not empirically validated.
    Will be replaced by Erica's structured knowledge elicitation data.
    """
    np.random.seed(42)
    n_samples = 2000

    # --- Generate synthetic data based on clinical intuition ---
    # PPSI scale: 0 = stable, 102 = maximum destabilization
    # Pulse scale: 0 = stable, 42 = maximum destabilization
    # PPII scale: 0 = stable, 100 = maximum destabilization
    # Positive trend = worsening, negative trend = improving
    #
    # KEY DESIGN: Overlapping ranges on ALL features between groups.
    # No single feature should perfectly separate stable from destabilized.
    # The model must learn from the COMBINATION of signals, not shortcuts.

    # Stable physicians (50%) — generally low risk but with realistic noise
    # Registry: stable physicians rarely have open items, almost never RED/SENTINEL
    n_stable = int(n_samples * 0.50)
    stable = pd.DataFrame({
        'ppsi_current': np.random.normal(15, 12, n_stable).clip(0, 45),
        'ppsi_trend': np.random.normal(-1, 6, n_stable),
        'ppsi_volatility': np.random.normal(5, 4, n_stable).clip(0, 20),
        'pulse_current': np.random.normal(10, 6, n_stable).clip(0, 25),
        'pulse_trend': np.random.normal(-1, 3, n_stable),
        'compliance_rate': np.random.normal(0.90, 0.10, n_stable).clip(0.5, 1.0),
        'compliance_misses_30d': np.random.choice([0, 0, 0, 0, 1, 1, 2], n_stable),
        'survey_completion_rate': np.random.normal(0.85, 0.12, n_stable).clip(0.4, 1.0),
        'consecutive_misses': np.random.choice([0, 0, 0, 0, 0, 1, 1, 2], n_stable),
        'days_since_last_ppsi': np.random.randint(1, 18, n_stable),
        'days_since_last_pulse': np.random.randint(3, 40, n_stable),
        'meds_flags_30d': np.random.choice([0, 0, 0, 0, 1, 1, 2, 3], n_stable),
        'registry_open_count': np.random.choice([0, 0, 0, 0, 0, 0, 0, 1], n_stable),
        'registry_red_count': np.zeros(n_stable),
        'days_enrolled': np.random.randint(14, 365, n_stable),
        'ppii_current': np.random.normal(18, 12, n_stable).clip(0, 45),
        'destabilized': np.zeros(n_stable),
    })

    # Gradual decline (15%) — multiple signals worsening together
    # Registry: accumulating open items, some RED/SENTINEL appearing
    n_decline = int(n_samples * 0.15)
    decline = pd.DataFrame({
        'ppsi_current': np.random.normal(52, 15, n_decline).clip(25, 85),
        'ppsi_trend': np.random.normal(8, 6, n_decline),
        'ppsi_volatility': np.random.normal(12, 5, n_decline).clip(2, 30),
        'pulse_current': np.random.normal(24, 8, n_decline).clip(8, 38),
        'pulse_trend': np.random.normal(4, 4, n_decline),
        'compliance_rate': np.random.normal(0.65, 0.15, n_decline).clip(0.2, 0.95),
        'compliance_misses_30d': np.random.choice([0, 1, 1, 2, 2, 3, 4], n_decline),
        'survey_completion_rate': np.random.normal(0.60, 0.18, n_decline).clip(0.1, 0.9),
        'consecutive_misses': np.random.choice([0, 0, 1, 1, 2, 2, 3], n_decline),
        'days_since_last_ppsi': np.random.randint(3, 28, n_decline),
        'days_since_last_pulse': np.random.randint(10, 50, n_decline),
        'meds_flags_30d': np.random.choice([1, 2, 3, 3, 4, 5], n_decline),
        'registry_open_count': np.random.choice([1, 2, 2, 3, 3, 4, 5], n_decline),
        'registry_red_count': np.random.choice([0, 0, 1, 1, 1, 2], n_decline),
        'days_enrolled': np.random.randint(30, 365, n_decline),
        'ppii_current': np.random.normal(52, 14, n_decline).clip(25, 80),
        'destabilized': np.ones(n_decline),
    })

    # Spike and recover (10%) — had a bad period, scores coming back down (NOT destabilized)
    # Registry: may have 1-2 leftover items from the spike, but rarely RED
    n_spike = int(n_samples * 0.1)
    spike = pd.DataFrame({
        'ppsi_current': np.random.normal(30, 12, n_spike).clip(10, 55),
        'ppsi_trend': np.random.normal(-6, 5, n_spike),
        'ppsi_volatility': np.random.normal(14, 6, n_spike).clip(3, 30),
        'pulse_current': np.random.normal(16, 7, n_spike).clip(3, 30),
        'pulse_trend': np.random.normal(-3, 4, n_spike),
        'compliance_rate': np.random.normal(0.82, 0.10, n_spike).clip(0.5, 1.0),
        'compliance_misses_30d': np.random.choice([0, 0, 1, 1, 2, 2, 3], n_spike),
        'survey_completion_rate': np.random.normal(0.75, 0.12, n_spike).clip(0.3, 1.0),
        'consecutive_misses': np.random.choice([0, 0, 0, 1, 1, 2, 3], n_spike),
        'days_since_last_ppsi': np.random.randint(1, 15, n_spike),
        'days_since_last_pulse': np.random.randint(5, 40, n_spike),
        'meds_flags_30d': np.random.choice([0, 1, 1, 2, 3], n_spike),
        'registry_open_count': np.random.choice([0, 0, 0, 1, 1, 2], n_spike),
        'registry_red_count': np.random.choice([0, 0, 0, 0, 1], n_spike),
        'days_enrolled': np.random.randint(60, 365, n_spike),
        'ppii_current': np.random.normal(30, 12, n_spike).clip(10, 55),
        'destabilized': np.zeros(n_spike),
    })

    # Sudden crash (15%) — rapid destabilization, many signals red
    # Registry: multiple open items, RED/SENTINEL common — per Erica's escalation design
    n_crash = int(n_samples * 0.10)
    crash = pd.DataFrame({
        'ppsi_current': np.random.normal(78, 14, n_crash).clip(50, 102),
        'ppsi_trend': np.random.normal(16, 8, n_crash),
        'ppsi_volatility': np.random.normal(18, 6, n_crash).clip(5, 40),
        'pulse_current': np.random.normal(32, 7, n_crash).clip(18, 42),
        'pulse_trend': np.random.normal(8, 5, n_crash),
        'compliance_rate': np.random.normal(0.40, 0.18, n_crash).clip(0.0, 0.75),
        'compliance_misses_30d': np.random.choice([2, 3, 3, 4, 5, 6], n_crash),
        'survey_completion_rate': np.random.normal(0.35, 0.18, n_crash).clip(0.0, 0.7),
        'consecutive_misses': np.random.choice([1, 2, 2, 3, 4, 5], n_crash),
        'days_since_last_ppsi': np.random.randint(7, 35, n_crash),
        'days_since_last_pulse': np.random.randint(15, 55, n_crash),
        'meds_flags_30d': np.random.choice([3, 4, 5, 6, 7, 8], n_crash),
        'registry_open_count': np.random.choice([2, 3, 3, 4, 5, 6, 7], n_crash),
        'registry_red_count': np.random.choice([1, 1, 2, 2, 3, 3], n_crash),
        'days_enrolled': np.random.randint(14, 365, n_crash),
        'ppii_current': np.random.normal(75, 14, n_crash).clip(50, 100),
        'destabilized': np.ones(n_crash),
    })

    # Registry-driven destabilization (10%) — moderate PPSI but RED/SENTINEL items
    # Per Erica: SENTINEL = immediate action, RED = same day. These override PPSI.
    # A physician at PPSI 30 with a SENTINEL is in more danger than one at PPSI 50 with no registry.
    n_registry = int(n_samples * 0.10)
    registry_driven = pd.DataFrame({
        'ppsi_current': np.random.normal(35, 18, n_registry).clip(10, 70),
        'ppsi_trend': np.random.normal(3, 6, n_registry),
        'ppsi_volatility': np.random.normal(10, 5, n_registry).clip(2, 25),
        'pulse_current': np.random.normal(18, 8, n_registry).clip(5, 35),
        'pulse_trend': np.random.normal(2, 4, n_registry),
        'compliance_rate': np.random.normal(0.75, 0.15, n_registry).clip(0.3, 1.0),
        'compliance_misses_30d': np.random.choice([0, 0, 1, 1, 2, 3], n_registry),
        'survey_completion_rate': np.random.normal(0.70, 0.15, n_registry).clip(0.3, 1.0),
        'consecutive_misses': np.random.choice([0, 0, 1, 1, 2], n_registry),
        'days_since_last_ppsi': np.random.randint(3, 20, n_registry),
        'days_since_last_pulse': np.random.randint(7, 45, n_registry),
        'meds_flags_30d': np.random.choice([0, 1, 2, 3, 4], n_registry),
        'registry_open_count': np.random.choice([1, 1, 2, 2, 3], n_registry),
        'registry_red_count': np.random.choice([1, 1, 1, 2, 2, 3], n_registry),
        'days_enrolled': np.random.randint(30, 365, n_registry),
        'ppii_current': np.random.normal(40, 18, n_registry).clip(10, 70),
        'destabilized': np.ones(n_registry),
    })

    # Combine all patterns
    data = pd.concat([stable, decline, spike, crash, registry_driven], ignore_index=True)

    X = data[FEATURE_NAMES].values
    y = data['destabilized'].values.astype(int)

    # Scale features
    global scaler
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Train gradient boosting with calibration for probability estimates
    base_model = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=3,
        learning_rate=0.05,
        min_samples_leaf=20,
        random_state=42
    )
    global model
    model = CalibratedClassifierCV(base_model, cv=5, method='isotonic')
    model.fit(X_scaled, y)

    # Update model info
    model_info['trained_at'] = datetime.now().isoformat()
    model_info['training_samples'] = len(data)
    model_info['features'] = FEATURE_NAMES

    # Save model artifacts
    save_model()

    logger.info(f"Initial model trained on {len(data)} synthetic samples "
                f"({n_stable} stable, {n_decline} gradual decline, "
                f"{n_spike} spike-recover, {n_crash} sudden crash, "
                f"{n_registry} registry-driven)")

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
