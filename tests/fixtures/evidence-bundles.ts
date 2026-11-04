import type { RunEvidenceBundle } from '../../packages/domain/src/evidence';

export const mockProductionEvidence: RunEvidenceBundle = {
  runId: '22222222-2222-4222-8222-222222222301',
  source: 'production',
  startOdometer: {
    photoStoragePath: 'private/evidence/22222222-2222-4222-8222-222222222301/start.jpg',
    readingMiles: 12010,
    capturedAt: '2026-11-04T10:00:00.000Z',
    isPlaceholder: false,
  },
  endOdometer: {
    photoStoragePath: 'private/evidence/22222222-2222-4222-8222-222222222301/end.jpg',
    readingMiles: 12025,
    capturedAt: '2026-11-04T10:40:00.000Z',
    isPlaceholder: false,
  },
  finishLinePhoto: {
    photoStoragePath: 'private/evidence/22222222-2222-4222-8222-222222222301/finish.jpg',
    capturedAt: '2026-11-04T10:41:00.000Z',
    withinFinishZone: true,
    isPlaceholder: false,
  },
};

export const mockRejectedFinishZoneEvidence: RunEvidenceBundle = {
  ...mockProductionEvidence,
  runId: '22222222-2222-4222-8222-222222222302',
  finishLinePhoto: {
    ...mockProductionEvidence.finishLinePhoto,
    withinFinishZone: false,
  },
};

export const mockSimulationEvidence: RunEvidenceBundle = {
  runId: '22222222-2222-4222-8222-222222222303',
  source: 'simulation',
  startOdometer: {
    photoStoragePath: 'fixtures/sim/start-odo.PLACEHOLDER.jpg',
    readingMiles: 1,
    capturedAt: '2026-11-04T10:00:00.000Z',
    isPlaceholder: true,
  },
  endOdometer: {
    photoStoragePath: 'fixtures/sim/finish-odo.PLACEHOLDER.jpg',
    readingMiles: 5,
    capturedAt: '2026-11-04T10:20:00.000Z',
    isPlaceholder: true,
  },
  finishLinePhoto: {
    photoStoragePath: 'fixtures/sim/finish-line.PLACEHOLDER.jpg',
    capturedAt: '2026-11-04T10:21:00.000Z',
    withinFinishZone: true,
    isPlaceholder: true,
  },
};
