/**
 * Who may visit a page, and what they then see, is decided in @underground/domain so that the
 * members website follows exactly the same rule.
 */
import { pageIsVisibleTo, projectPageForVisitor, type MemberPageDocument, type PageViewer } from '@underground/domain';

export type Visitor = PageViewer;
export const allowed = pageIsVisibleTo;

// Preview and the on-device beta share this projection. The live RPC enforces the same rule in the database.
export function visitorPage(page: MemberPageDocument, viewer: Visitor) {
  return projectPageForVisitor(page, viewer);
}
