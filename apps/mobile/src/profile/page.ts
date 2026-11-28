/**
 * The member page, its theme tokens and its rules are defined once in @underground/domain
 * (member-page.ts), so the app and the members website render from the same definition.
 * This file keeps the names the app already uses and adds the lists only the editor needs.
 */
import {
  ACCENT_COLORS,
  SECTION_TITLES,
  PageLookSchema,
  PageSettingsSchema,
  PhotoFrameSchema,
  copyPageLook,
  defaultPageCustomization,
  defaultPageLook,
  defaultPageSettings,
  fillFrame,
  isDirectAudioFile,
  moveItem,
  normalizeProfileLink,
  profileCoverRatio,
  restorePageSettings,
  validatePageSettings,
  wholeFrame,
  type MemberPageDocument,
  type PageAudience,
  type PageConnections,
  type PageFriend,
  type PageIdentity,
  type PageLook,
  type PageSection,
  type PageSettings,
  type PageVehicle,
  type PhotoFrame,
} from '@underground/domain';

export const accents = ACCENT_COLORS;
export const sectionTitles = SECTION_TITLES;
export type Section = PageSection;

export const editorSections = ['Identity', 'Page style', 'Featured car', 'Favorite drive', 'Top 8',
  'My garage', 'Build journal', 'Soundtrack', 'Off the road', 'Section order', 'Who can visit?'] as const;
export type EditorSection = (typeof editorSections)[number] | 'Customize page';
export const sectionEditor: Record<Section, EditorSection> = {
  collection: 'My garage', about: 'Identity', garage: 'Featured car', drive: 'Favorite drive', friends: 'Top 8',
  music: 'Soundtrack', work: 'Off the road', journal: 'Build journal', guestbook: 'Section order',
};

// The names the app used before the rules moved to the shared package.
export const lookSchema = PageLookSchema;
export type Look = PageLook;
export const defaultLook = defaultPageLook;
export const frameSchema = PhotoFrameSchema;
export type Frame = PhotoFrame;
export const whole = wholeFrame;
export const fill = fillFrame;
export type Audience = PageAudience;
export const defaultCustom = defaultPageCustomization;
export const settingsSchema = PageSettingsSchema;
export type Settings = PageSettings;
export type Identity = PageIdentity;
export type Friend = PageFriend;
export type Vehicle = PageVehicle;
export type Page = MemberPageDocument;
export type Connections = PageConnections;
export const defaults = defaultPageSettings;
export const restoreSettings = restorePageSettings;
export const copyLook = copyPageLook;
export const audioFile = isDirectAudioFile;
export const profileLink = normalizeProfileLink;
export const validatePage = validatePageSettings;
export const move = moveItem;
export { profileCoverRatio };
