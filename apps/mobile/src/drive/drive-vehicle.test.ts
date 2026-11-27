import { describe, expect, it } from 'vitest';
import { driveVehicleKey, resolveDriveVehicle } from './drive-vehicle';

describe('restoring a drive vehicle', () => {
  const cars = [{ id: 'r8' }, { id: 'sto' }];
  it('retains the chosen car when the garage order changes', () => {
    expect(resolveDriveVehicle([...cars].reverse(), 'r8')).toBe('r8');
  });
  it('handles a removed vehicle and garages without an explicit selection', () => {
    expect(resolveDriveVehicle(cars, 'removed')).toBeNull();
    expect(resolveDriveVehicle(cars, null)).toBeNull();
    expect(resolveDriveVehicle([], 'r8')).toBeNull();
    expect(resolveDriveVehicle([cars[0]], 'removed')).toBe('r8');
  });
  it('keeps preferences separate for accounts and preview mode', () => {
    expect(new Set([driveVehicleKey('a', true), driveVehicleKey('a', false),
      driveVehicleKey('b', true)]).size).toBe(3);
  });
});
