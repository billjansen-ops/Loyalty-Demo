#!/usr/bin/env python3
"""
retrain_with_weights.py — Regenerate synthetic training data with admin-edited
PPII stream weights and retrain the ML model.

Usage:
    python ml/retrain_with_weights.py --weights '{"pulse":0.35,"ppsi":0.25,"compliance":0.25,"events":0.15}'

Emits progress lines to stdout (line-buffered) so the Node SSE endpoint at
POST /v1/ml/retrain can stream them live to the admin UI. Exits 0 on success,
non-zero on error.

Updates on disk:
- ml/model.pkl        — new classifier + calibrator
- ml/scaler.pkl       — new feature scaler
- ml/model_info.json  — version bump + trained_against_ppii_weights recorded

The running ml_service process (if any) continues serving until it reloads.
The Node retrain endpoint may trigger a reload afterward.
"""
import argparse
import json
import os
import sys
import time

# Make stdout line-buffered so the SSE endpoint sees each line immediately
sys.stdout.reconfigure(line_buffering=True)


def log(msg):
    print(msg, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--weights', required=True, help='JSON {pulse, ppsi, compliance, events} summing to 1.0')
    parser.add_argument('--version', default=None, help='Optional model version string (default: bump patch)')
    args = parser.parse_args()

    try:
        weights = json.loads(args.weights)
    except json.JSONDecodeError as e:
        log(f'❌ Invalid --weights JSON: {e}')
        sys.exit(2)

    required = {'pulse', 'ppsi', 'compliance', 'events'}
    missing = required - set(weights.keys())
    if missing:
        log(f'❌ Missing weight keys: {missing}')
        sys.exit(2)

    total = sum(float(weights[k]) for k in required)
    if abs(total - 1.0) > 0.001:
        log(f'❌ Weights must sum to 1.0 (got {total:.4f})')
        sys.exit(2)

    log('▶ Regenerating training dataset with current PPII weights')
    log(f"  Pulse: {weights['pulse']:.3f}, PPSI: {weights['ppsi']:.3f}, Compliance: {weights['compliance']:.3f}, Events: {weights['events']:.3f}")

    # Import here so argument errors are reported before the heavy imports run
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)

    import ml_service  # noqa — sets up module state + loads model, but we'll overwrite

    # Install admin-edited weights so simulate_trajectory uses them
    ml_service.PPII_WEIGHTS.update({
        'pulse':      float(weights['pulse']),
        'ppsi':       float(weights['ppsi']),
        'compliance': float(weights['compliance']),
        'events':     float(weights['events']),
    })

    t0 = time.time()

    # Bump version (e.g., 0.3.0 -> 0.3.1)
    current_version = ml_service.model_info.get('version', '0.3.0')
    if args.version:
        new_version = args.version
    else:
        try:
            major, minor, patch = [int(x) for x in current_version.split('.')]
            new_version = f'{major}.{minor}.{patch + 1}'
        except (ValueError, AttributeError):
            new_version = '0.3.1'

    log(f'  Generating synthetic member trajectories (7 archetypes, ~3000 samples)...')

    # build_initial_model generates data, trains, calibrates, saves everything
    ml_service.build_initial_model()

    # Record the weights we trained against so the UI can show drift warnings
    ml_service.model_info['version'] = new_version
    ml_service.model_info['trained_against_ppii_weights'] = {
        'pulse':      float(weights['pulse']),
        'ppsi':       float(weights['ppsi']),
        'compliance': float(weights['compliance']),
        'events':     float(weights['events']),
    }
    # Save again with the updated info
    ml_service.save_model()

    elapsed = time.time() - t0
    info = ml_service.model_info
    log('▶ Evaluating')
    log(f"  Version:          {info.get('version', '?')}")
    log(f"  Training samples: {info.get('training_samples', '?')}")
    log(f"  Label policy:     {info.get('label', '?')}")
    log(f"  Trained at:       {info.get('trained_at', '?')}")

    log('▶ Saving model')
    log(f"  ✓ {ml_service.MODEL_PATH}")
    log(f"  ✓ {ml_service.SCALER_PATH}")
    log(f"  ✓ {ml_service.INFO_PATH}")

    log(f'◀ Retrain complete ({elapsed:.1f}s). Model v{info.get("version", "?")} now active.')
    sys.exit(0)


if __name__ == '__main__':
    main()
