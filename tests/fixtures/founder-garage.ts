/**
 * Founder garage seed stubs — 2010 Audi R8 V10.
 * Media paths are placeholders clearly marked until licensed assets exist.
 */
export const founderGarageSeed = {
  memberNumber: '000001',
  displayName: 'STARK',
  isFounder: true,
  role: 'member' as const,
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
      description: 'Installed wheel set',
    },
    {
      title: 'Red ceramic brakes',
      status: 'installed' as const,
      description: 'Red-finished ceramics',
    },
    {
      title: 'Exhaust tune (pending)',
      status: 'pending' as const,
      description: 'Awaiting install',
    },
  ],
  media: [
    {
      storagePath: 'placeholders/garage/r8-front.PLACEHOLDER.jpg',
      isPlaceholder: true,
      caption: 'PLACEHOLDER — licensed R8 photography needed',
      sortOrder: 0,
    },
    {
      storagePath: 'placeholders/garage/r8-rear.PLACEHOLDER.jpg',
      isPlaceholder: true,
      caption: 'PLACEHOLDER — licensed R8 photography needed',
      sortOrder: 1,
    },
  ],
} as const;
