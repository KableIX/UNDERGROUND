// Types for the browser copy of the member page rules. The file itself is plain JavaScript so the
// dev site needs no build step; this declaration only lets the parity test in packages/domain import it.
export const PAGE_SECTIONS: readonly string[];
export const SECTION_TITLES: Readonly<Record<string, string>>;
export const WALLPAPER_PRESETS: readonly string[];
export const HEADING_STYLES: readonly string[];
export const PANEL_STYLES: readonly string[];
export const COVER_SIZES: readonly string[];
export const PAGE_ACCENTS: readonly string[];
export const ACCENT_COLORS: Readonly<Record<string, string>>;
export const PAGE_AUDIENCES: readonly string[];
export const SECTION_FORMATS: readonly string[];
export const FRAME_MODES: readonly string[];
export const CAR_CLASSES: readonly string[];
export const CAR_CLASS_LABELS: Readonly<Record<string, string>>;
export const GARAGE_VERIFICATION_STATES: readonly string[];
export const PAGE_PHOTO_MAX_LENGTH: number;

export type Viewer = 'friends' | 'members';
export type GarageViewer = 'owner' | 'friend' | 'member';

export function validSettings(value: unknown): boolean;
export function validPageDocument(value: unknown): boolean;
export function validGarageDocument(value: unknown): boolean;
export function validGarageLook(value: unknown): boolean;
export function defaultSettings(name: string): unknown;
export function restoreSettings(name: string, saved: unknown): unknown;
export function profileCoverRatio(size: string): number;
export function garageLook(settings: unknown): unknown;
export function isDirectAudioFile(value: string): boolean;
export function normalizeProfileLink(value: string, kind: 'linkedin' | 'music'): string;
export function safeProfileLink(value: string, kind: 'linkedin' | 'music'): string;
export function pageIsVisibleTo(audience: string, viewer: Viewer): boolean;
export function projectPageForVisitor(page: unknown, viewer: Viewer): unknown;
export function garageCarIsVisible(car: { visibility: string }, viewer: GarageViewer): boolean;
export function projectGarageForViewer(garage: unknown, viewer: GarageViewer): unknown;
