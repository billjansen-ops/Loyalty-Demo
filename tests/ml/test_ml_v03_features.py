"""
Test ML v0.3.0 — Verify 3 new features in synthetic data generation and model training.

Tests:
  1. FEATURE_NAMES has 19 entries (16 original + 3 new)
  2. simulate_trajectory returns all 19 features for every archetype
  3. New features have correct ranges per archetype
  4. Model trains successfully with 19 features
  5. extract_features handles missing/null new features with neutral defaults
  6. Concordance gap is mathematically consistent with ppsi/pulse values
  7. Domain breadth is consistent with trajectory data
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'ml'))

import numpy as np
import ml_service
from ml_service import FEATURE_NAMES, simulate_trajectory, extract_features


def test_feature_names_count():
    """19 features total: 16 original + 3 new."""
    assert len(FEATURE_NAMES) == 19, f"Expected 19 features, got {len(FEATURE_NAMES)}"
    assert 'domain_breadth' in FEATURE_NAMES
    assert 'concordance_gap' in FEATURE_NAMES
    assert 'chronicity' in FEATURE_NAMES
    print("PASS: FEATURE_NAMES has 19 entries including 3 new features")


def test_simulate_all_archetypes():
    """Every archetype returns all 19 features with valid types."""
    rng = np.random.default_rng(123)
    archetypes = [
        'stable_green', 'slow_burn', 'acute_break', 'oscillator',
        'silent_slide', 'recovery_arc', 'chronic_borderline'
    ]
    for arch in archetypes:
        sample = simulate_trajectory(arch, rng)
        for fname in FEATURE_NAMES:
            assert fname in sample, f"{arch}: missing feature '{fname}'"
            assert sample[fname] is not None, f"{arch}: '{fname}' is None"
        # Check new feature types
        assert isinstance(sample['domain_breadth'], (int, np.integer)), \
            f"{arch}: domain_breadth not int: {type(sample['domain_breadth'])}"
        assert isinstance(sample['concordance_gap'], (int, float, np.floating)), \
            f"{arch}: concordance_gap not numeric: {type(sample['concordance_gap'])}"
        assert isinstance(sample['chronicity'], (int, np.integer)), \
            f"{arch}: chronicity not int: {type(sample['chronicity'])}"
    print(f"PASS: All {len(archetypes)} archetypes return valid 19-feature samples")


def test_feature_ranges():
    """New features fall within expected ranges per archetype."""
    rng = np.random.default_rng(456)
    n_samples = 200

    results = {}
    archetypes = [
        'stable_green', 'slow_burn', 'acute_break', 'oscillator',
        'silent_slide', 'recovery_arc', 'chronic_borderline'
    ]
    for arch in archetypes:
        samples = [simulate_trajectory(arch, rng) for _ in range(n_samples)]
        results[arch] = {
            'domain_breadth': [s['domain_breadth'] for s in samples],
            'concordance_gap': [s['concordance_gap'] for s in samples],
            'chronicity': [s['chronicity'] for s in samples],
        }

    # domain_breadth: 0-8 for all
    for arch in archetypes:
        vals = results[arch]['domain_breadth']
        assert all(0 <= v <= 8 for v in vals), f"{arch}: domain_breadth out of 0-8"

    # stable_green should have low domain_breadth (mostly 0-2)
    # With 8 domains and small SDs, some normal noise exceeds 1.5*SD threshold
    sg_mean = np.mean(results['stable_green']['domain_breadth'])
    assert sg_mean < 2.5, f"stable_green domain_breadth mean too high: {sg_mean:.2f}"

    # acute_break should have high domain_breadth
    ab_mean = np.mean(results['acute_break']['domain_breadth'])
    assert ab_mean > 2.0, f"acute_break domain_breadth mean too low: {ab_mean:.2f}"

    # concordance_gap: Silent Slide should be strongly positive (Pulse >> PPSI normalized)
    ss_gaps = results['silent_slide']['concordance_gap']
    ss_mean = np.mean(ss_gaps)
    assert ss_mean > 10, f"silent_slide concordance_gap mean too low: {ss_mean:.1f} (expected >10)"

    # stable_green concordance_gap should be near zero
    sg_gaps = results['stable_green']['concordance_gap']
    sg_gap_mean = np.mean(sg_gaps)
    assert abs(sg_gap_mean) < 10, f"stable_green concordance_gap mean too far from 0: {sg_gap_mean:.1f}"

    # chronicity: chronic_borderline should have longest duration
    cb_chron = results['chronic_borderline']['chronicity']
    cb_mean = np.mean(cb_chron)
    assert cb_mean > 50, f"chronic_borderline chronicity mean too low: {cb_mean:.1f} (expected >50)"

    # stable_green should have zero chronicity
    sg_chron = results['stable_green']['chronicity']
    assert all(v == 0 for v in sg_chron), "stable_green should always have chronicity=0"

    print("PASS: Feature ranges correct per archetype")
    print(f"  stable_green:      breadth={sg_mean:.1f}, gap={sg_gap_mean:.1f}, chronicity=0")
    print(f"  silent_slide:      gap_mean={ss_mean:.1f} (Silent Slide detector)")
    print(f"  chronic_borderline: chronicity_mean={cb_mean:.1f} (Chronic Borderline detector)")
    print(f"  acute_break:       breadth_mean={ab_mean:.1f} (multi-domain spike)")


def test_concordance_gap_consistency():
    """Concordance gap must equal (pulse_norm - ppsi_norm)."""
    rng = np.random.default_rng(789)
    for arch in ['stable_green', 'silent_slide', 'slow_burn', 'chronic_borderline']:
        for _ in range(50):
            s = simulate_trajectory(arch, rng)
            ppsi_norm = (s['ppsi_current'] / 102.0) * 100
            pulse_norm = (s['pulse_current'] / 42.0) * 100
            expected = round(pulse_norm - ppsi_norm, 1)
            assert abs(s['concordance_gap'] - expected) < 0.2, \
                f"{arch}: concordance_gap {s['concordance_gap']} != expected {expected}"
    print("PASS: Concordance gap mathematically consistent with ppsi/pulse values")


def test_model_trains_with_19_features():
    """Model builds successfully with 19 features."""
    ml_service.build_initial_model()
    assert ml_service.model is not None, "Model should be trained"
    assert ml_service.scaler is not None, "Scaler should be fitted"
    assert ml_service.model_info['version'] == '0.3.0', f"Version should be 0.3.0, got {ml_service.model_info['version']}"
    assert len(ml_service.model_info['features']) == 19, f"Model should have 19 features, got {len(ml_service.model_info['features'])}"
    print(f"PASS: Model v{ml_service.model_info['version']} trained with {ml_service.model_info['training_samples']} samples, {len(ml_service.model_info['features'])} features")


def test_extract_features_defaults():
    """extract_features handles missing new features with neutral defaults."""
    # Completely empty input
    features = extract_features({})
    assert features.shape == (1, 19), f"Expected shape (1,19), got {features.shape}"

    # domain_breadth default = 0 (index 16)
    assert features[0][16] == 0, f"domain_breadth default should be 0, got {features[0][16]}"
    # concordance_gap default = 0 (index 17)
    assert features[0][17] == 0, f"concordance_gap default should be 0, got {features[0][17]}"
    # chronicity default = 0 (index 18)
    assert features[0][18] == 0, f"chronicity default should be 0, got {features[0][18]}"
    print("PASS: extract_features returns correct defaults for missing new features")


def test_prediction_with_new_features():
    """Model produces valid predictions with all 19 features."""
    if ml_service.model is None:
        ml_service.build_initial_model()

    # Silent Slide profile: low PPSI, high Pulse, positive concordance gap
    silent_slide = {
        'ppsi_current': 15, 'ppsi_trend': -2, 'ppsi_volatility': 3,
        'pulse_current': 25, 'pulse_trend': 5,
        'compliance_rate': 0.60, 'compliance_misses_30d': 3,
        'survey_completion_rate': 0.7, 'consecutive_misses': 2,
        'days_since_last_ppsi': 14, 'days_since_last_pulse': 21,
        'meds_flags_30d': 2, 'registry_open_count': 1, 'registry_red_count': 0,
        'days_enrolled': 120, 'ppii_current': 40,
        'domain_breadth': 1, 'concordance_gap': 45.0, 'chronicity': 0
    }

    # Chronic Borderline profile: moderate PPSI, long Yellow duration
    chronic = {
        'ppsi_current': 30, 'ppsi_trend': 1, 'ppsi_volatility': 4,
        'pulse_current': 14, 'pulse_trend': 0,
        'compliance_rate': 0.75, 'compliance_misses_30d': 1,
        'survey_completion_rate': 0.85, 'consecutive_misses': 0,
        'days_since_last_ppsi': 7, 'days_since_last_pulse': 14,
        'meds_flags_30d': 0, 'registry_open_count': 2, 'registry_red_count': 0,
        'days_enrolled': 200, 'ppii_current': 35,
        'domain_breadth': 3, 'concordance_gap': 4.0, 'chronicity': 120
    }

    # Stable Green: everything fine
    stable = {
        'ppsi_current': 12, 'ppsi_trend': 0, 'ppsi_volatility': 2,
        'pulse_current': 5, 'pulse_trend': 0,
        'compliance_rate': 0.95, 'compliance_misses_30d': 0,
        'survey_completion_rate': 1.0, 'consecutive_misses': 0,
        'days_since_last_ppsi': 5, 'days_since_last_pulse': 10,
        'meds_flags_30d': 0, 'registry_open_count': 0, 'registry_red_count': 0,
        'days_enrolled': 180, 'ppii_current': 10,
        'domain_breadth': 0, 'concordance_gap': 0.2, 'chronicity': 0
    }

    for name, profile in [('silent_slide', silent_slide), ('chronic', chronic), ('stable', stable)]:
        features = extract_features(profile)
        features_scaled = ml_service.scaler.transform(features)
        prob = ml_service.model.predict_proba(features_scaled)[0][1]
        score = int(prob * 100)
        assert 0 <= score <= 100, f"{name}: score out of range: {score}"
        print(f"  {name}: risk_score={score} (prob={prob:.3f})")

    print("PASS: Model produces valid predictions with all 19 features")


if __name__ == '__main__':
    tests = [
        test_feature_names_count,
        test_simulate_all_archetypes,
        test_feature_ranges,
        test_concordance_gap_consistency,
        test_model_trains_with_19_features,
        test_extract_features_defaults,
        test_prediction_with_new_features,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            print(f"\n{'='*60}")
            print(f"Running: {test.__name__}")
            print(f"{'='*60}")
            test()
            passed += 1
        except Exception as e:
            print(f"FAIL: {test.__name__} — {e}")
            failed += 1

    print(f"\n{'='*60}")
    print(f"Results: {passed} passed, {failed} failed, {passed + failed} total")
    print(f"{'='*60}")
    sys.exit(1 if failed > 0 else 0)
