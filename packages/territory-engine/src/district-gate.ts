import { allowsProductionOwnership, type DistrictKind } from '@underground/domain';
import { applyCapture } from './capture';
import type { CaptureCommand, OwnershipSlice, TerritorySlice } from './types';

/**
 * Gate captures by district kind. Development districts never write production ownership.
 */
export function applyCaptureForDistrict(input: {
  districtKind: DistrictKind;
  territory: TerritorySlice | undefined;
  current: OwnershipSlice | undefined;
  command: CaptureCommand;
  seenIdempotencyKeys: ReadonlySet<string>;
}) {
  if (!allowsProductionOwnership(input.districtKind)) {
    return { ok: false as const, error: 'development_district' as const };
  }
  return applyCapture({
    territory: input.territory,
    current: input.current,
    command: input.command,
    seenIdempotencyKeys: input.seenIdempotencyKeys,
  });
}
