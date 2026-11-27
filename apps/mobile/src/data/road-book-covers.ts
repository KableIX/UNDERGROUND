export type StateBook = 'CA' | 'FL';

// Each ID points to the photograph and credit on a drive in that book.
export const stateCovers: Record<StateBook, { name: string; id: string }> = {
  CA: { name: 'California', id: 'M01' },
  FL: { name: 'Florida', id: 'FL28' },
};

export const regionCovers: Record<StateBook, Readonly<Record<string, string>>> = {
  CA: {
    'Monterey Bay': 'M02',
    'San Francisco Bay': 'H04',
    'Wine Country & Marin': 'N04',
    'Central Coast': 'CC16',
    'San Diego County': 'SD15',
    'North Coast': 'NC12',
    'Los Angeles & Ventura': 'LA13',
    'Shasta & Cascades': 'SH11',
    'Tahoe & High Sierra': 'KS01',
  },
  FL: {
    Panhandle: 'FL30',
    'Atlantic Coast': 'FL02',
    'Gulf Coast': 'FL34',
    'North Florida': 'FL47',
    'Florida Keys': 'FL05',
    'Central Florida': 'FL17',
    'South Florida': 'FL38',
  },
};
