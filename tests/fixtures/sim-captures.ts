/**
 * Simulated capture fixtures for tests only.
 * Hard-gated: evidenceSource === 'simulation' must never write production ownership.
 */
import type { EvidenceSource, Run } from '../../packages/domain/src/run';

export const SIM_EVIDENCE_SOURCE: EvidenceSource = 'simulation';

export const simRunFixture: Omit<Run, 'id' | 'createdAt' | 'updatedAt'> & {
  id: string;
  createdAt: string;
  updatedAt: string;
} = {
  id: '22222222-2222-4222-8222-222222222201',
  memberId: '33333333-3333-4333-8333-333333333301',
  territoryDefinitionId: '11111111-1111-4111-8111-111111111101',
  state: 'ACCEPTED',
  evidenceSource: SIM_EVIDENCE_SOURCE,
  createdAt: '2026-11-04T00:00:00.000Z',
  updatedAt: '2026-11-04T00:00:00.000Z',
};

export function assertSimCannotWriteProduction(evidenceSource: EvidenceSource): void {
  if (evidenceSource === 'simulation') {
    throw new Error('HARD_GATE: simulation evidence cannot write production ownership');
  }
}
