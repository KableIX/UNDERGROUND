/**
 * Founder garage seed stubs — 2010 Audi R8 V10.
 * Media paths are placeholders clearly marked until licensed assets exist.
 * No proprietary binary assets are committed.
 */
export const founderGarageSeed = {
  memberNumber: '000001',
  displayName: 'STARK',
  isFounder: true,
  role: 'member' as const,
  profile: {
    bio: 'Founder. Ownership is the entry.',
    mediaNote:
      'Gallery uses marked PLACEHOLDER paths only — licensed R8 photography is still required before production media.',
  },
  vehicle: {
    year: 2010,
    make: 'Audi',
    model: 'R8',
    trim: 'V10 5.2 Quattro',
    color: 'black',
    transmission: 'R-Tronic',
    wheels: 'Vossen HF-5',
    brakes: 'red ceramics',
    verificationStatus: 'verified' as const,
    visibility: 'friends' as const,
  },
  mods: [
    {
      title: 'Vossen HF-5 wheels',
      status: 'installed' as const,
      description: 'Installed wheel set — black hardware',
    },
    {
      title: 'Red ceramic brakes',
      status: 'installed' as const,
      description: 'Red-finished ceramics',
    },
    {
      title: 'Carbon mirror caps',
      status: 'installed' as const,
      description: 'Exterior accent set',
    },
    {
      title: 'Exhaust tune',
      status: 'pending' as const,
      description: 'Awaiting install / verification photos',
    },
    {
      title: 'Front lip (track)',
      status: 'pending' as const,
      description: 'Queued — not yet fitted',
    },
  ],
  media: [
    {
      storagePath: 'placeholders/garage/r8-front.PLACEHOLDER.jpg',
      isPlaceholder: true,
      caption: 'PLACEHOLDER — front three-quarter (licensed photography needed)',
      sortOrder: 0,
    },
    {
      storagePath: 'placeholders/garage/r8-rear.PLACEHOLDER.jpg',
      isPlaceholder: true,
      caption: 'PLACEHOLDER — rear detail (licensed photography needed)',
      sortOrder: 1,
    },
    {
      storagePath: 'placeholders/garage/r8-interior.PLACEHOLDER.jpg',
      isPlaceholder: true,
      caption: 'PLACEHOLDER — cabin (licensed photography needed)',
      sortOrder: 2,
    },
  ],
} as const;
