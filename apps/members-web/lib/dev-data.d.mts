// Types for the dev site's data layer. The file itself is plain JavaScript so the site needs no
// build step; this declaration only lets the test in packages/domain import it.
export interface DevMember {
  id: string;
  number: string;
  name: string;
  founder: boolean;
}

export interface DevReply {
  status: number;
  body: unknown;
}

export interface DevData {
  publicMember(member: DevMember): DevMember;
  memberByNumber(number: string): DevMember | null;
  directory(): DevMember[];
  session(cookieHeader: string | undefined): { signedIn: boolean; member: DevMember | null };
  directoryFor(cookieHeader: string | undefined): DevReply;
  page(memberId: string, cookieHeader: string | undefined): Promise<DevReply>;
  garage(memberId: string, cookieHeader: string | undefined): Promise<DevReply>;
}

export const SESSION_COOKIE: string;
export function parseCookies(header: string | undefined): Record<string, string>;
export function readJsonBody(req: unknown, limit?: number): Promise<unknown>;
export function createDevData(root: string): Promise<DevData>;
