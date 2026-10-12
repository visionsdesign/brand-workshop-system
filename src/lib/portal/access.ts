import { portalStore } from './store';
import { teamMember } from './team';
import type { PortalWorkshop } from './types';

export interface Access {
  workshop: PortalWorkshop;
  by: 'client' | 'team';
  who: string;
}

/**
 * Who is acting on a workshop: the client (holding the private link token) or a
 * signed-in team member (any workshop). Returns null when neither applies.
 */
export async function resolveAccess(opts: { token?: string | null; workshopId?: string | null }): Promise<Access | null> {
  const store = portalStore();
  if (opts.token) {
    const w = await store.getByToken(opts.token);
    if (w && (!opts.workshopId || opts.workshopId === w.id)) return { workshop: w, by: 'client', who: w.contactEmail };
  }
  if (opts.workshopId) {
    const email = await teamMember();
    if (email) {
      const w = await store.getById(opts.workshopId);
      if (w) return { workshop: w, by: 'team', who: email };
    }
  }
  return null;
}
