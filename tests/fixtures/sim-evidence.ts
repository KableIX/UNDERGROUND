/**
 * Simulated GPS + camera evidence fixtures for tests only.
 * Must never be treated as production ownership evidence.
 */
import type { EvidenceSource } from '../../packages/domain/src/run';
import type { GpsPoint } from '../../packages/territory-engine/src/gps-recovery';

export const SIM_GPS_TRACK: GpsPoint[] = [
  { t: 1_000, lng: -121.95, lat: 36.55 },
  { t: 4_000, lng: -121.94, lat: 36.54 },
  { t: 7_000, lng: -121.93, lat: 36.53 },
];

export const SIM_CAMERA_EVIDENCE = {
  source: 'simulation' as EvidenceSource,
  startOdometerPhoto: 'fixtures/sim/start-odo.PLACEHOLDER.jpg',
  finishOdometerPhoto: 'fixtures/sim/finish-odo.PLACEHOLDER.jpg',
  isPlaceholder: true as const,
  note: 'SIMULATION FIXTURE — not production evidence',
};

export const PROD_CAMERA_EVIDENCE_SHAPE = {
  source: 'production' as EvidenceSource,
  startOdometerPhoto: 'private/evidence/{runId}/start.jpg',
  finishOdometerPhoto: 'private/evidence/{runId}/finish.jpg',
  isPlaceholder: false as const,
};
