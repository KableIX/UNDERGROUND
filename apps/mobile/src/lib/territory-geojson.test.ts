import { describe, expect, it } from 'vitest';
import { siliconValleyDevTerritories } from '../data/silicon-valley-dev';
import { draftMontereyTerritories } from '../data/monterey-draft';
import {
  pickNearestTerritorySlug,
  selectTerritoryBySlug,
  startFinishForTerritory,
  territoriesToFeatureCollection,
} from './territory-geojson';

describe('territory GeoJSON + selection', () => {
  it('builds FeatureCollection with selection flag', () => {
    const slug = siliconValleyDevTerritories[0]!.slug;
    const fc = territoriesToFeatureCollection(siliconValleyDevTerritories, slug);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features.length).toBe(siliconValleyDevTerritories.length);
    expect(fc.features.filter((f) => f.properties.selected)).toHaveLength(1);
    expect(fc.features.every((f) => f.geometry.type === 'LineString')).toBe(true);
    expect(
      fc.features.every(
        (f) =>
          f.properties.geometryLabel.includes('UNVERIFIED') || f.properties.status === 'draft',
      ),
    ).toBe(true);
  });

  it('returns start/finish endpoints for a route', () => {
    const t = siliconValleyDevTerritories[1]!;
    const { start, finish } = startFinishForTerritory(t);
    expect(start).toEqual(t.geometry.coordinates[0]);
    expect(finish).toEqual(t.geometry.coordinates[t.geometry.coordinates.length - 1]);
  });

  it('selects by slug and picks nearest vertex', () => {
    expect(selectTerritoryBySlug(siliconValleyDevTerritories, 'missing')).toBeNull();
    const first = siliconValleyDevTerritories[0]!;
    expect(selectTerritoryBySlug(siliconValleyDevTerritories, first.slug)?.id).toBe(first.id);
    const [lng, lat] = first.geometry.coordinates[0]!;
    expect(pickNearestTerritorySlug(siliconValleyDevTerritories, lng, lat)).toBe(first.slug);
  });

  it('keeps Monterey as draft production candidate geometries', () => {
    expect(draftMontereyTerritories.every((t) => t.status === 'draft')).toBe(true);
    expect(draftMontereyTerritories.every((t) => t.districtSlug === 'monterey')).toBe(true);
  });
});
