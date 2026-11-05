import { founderGarageSeed } from '../data/founder-garage';

/** Resolve a local garage label without network. */
export function vehicleLabelForId(vehicleId: string | null | undefined): string | null {
  if (!vehicleId) return null;
  const seed = founderGarageSeed.vehicle;
  const seedKey = `seed:${seed.year}:${seed.make}:${seed.model}`;
  if (vehicleId === seedKey || vehicleId.startsWith('seed:')) {
    return `${seed.year} ${seed.make} ${seed.model}`;
  }
  // Live garage UUID — show generic label offline without fetching.
  return 'Garage vehicle';
}

/** Stable local seed vehicle key for offline recording association. */
export function localSeedVehicleId(): string {
  const v = founderGarageSeed.vehicle;
  return `seed:${v.year}:${v.make}:${v.model}`;
}
