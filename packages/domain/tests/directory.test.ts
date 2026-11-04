import { describe, expect, it } from 'vitest';
import { isVisibleInDirectory, listDirectoryMembers } from '../src/directory';
import { directoryFixtures } from '../../../tests/fixtures/clubs-social';

describe('local opt-in member directory', () => {
  it('lists only opted-in members for California', () => {
    const listed = listDirectoryMembers(directoryFixtures, 'california');
    expect(listed.map((e) => e.visibleDisplayName)).toEqual(['STARK']);
  });

  it('lists only opted-in members for Miami', () => {
    const listed = listDirectoryMembers(directoryFixtures, 'miami');
    expect(listed.map((e) => e.visibleDisplayName)).toEqual(['BISCAYNE']);
  });

  it('gates visibility when not opted in', () => {
    const pacific = directoryFixtures.find((e) => e.visibleDisplayName === 'PACIFIC');
    expect(isVisibleInDirectory(pacific, 'california')).toBe(false);
  });
});
