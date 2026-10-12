// The paid workshop portal: clients redeem a code (or pay, later), fill in an
// intake, upload files, then either book a guided session or work through the
// workshop themselves. The team sees every workshop in /team.

export type Tier = 'guided' | 'self_serve';

export type WorkshopStatus =
  | 'intake' // code redeemed, intake not finished
  | 'ready' // intake done: guided waits for a booking, self-serve can start
  | 'booked' // guided session booked
  | 'in_progress' // self-serve started, or guided session under way
  | 'submitted' // self-serve finished by the client
  | 'complete'; // the team has delivered

export interface Intake {
  company?: string;
  website?: string;
  sector?: string;
  stage?: string;
  why?: string;
  audience?: string;
  competitors?: string;
  admired?: string;
  threeWords?: string;
  existingLines?: string;
  constraints?: string;
  anythingElse?: string;
}

export interface PortalWorkshop {
  id: string;
  /** Secret part of the client's private link: /start/<token> */
  token: string;
  tier: Tier;
  status: WorkshopStatus;
  clientName: string;
  contactName: string;
  contactEmail: string;
  intake: Intake;
  intakeDone: boolean;
  driveFolderUrl: string;
  teamNotes: string;
  /** The code redeemed to create this workshop, if any */
  code: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccessCode {
  code: string;
  tier: Tier;
  /** Who it was issued to, for the team's reference */
  label: string;
  maxUses: number;
  uses: number;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface WorkshopFile {
  id: string;
  workshopId: string;
  name: string;
  size: number;
  type: string;
  /** Storage key: bucket path in Supabase, relative path on disk locally */
  path: string;
  uploadedBy: 'client' | 'team';
  createdAt: string;
}

export const TIER_LABEL: Record<Tier, string> = {
  guided: 'Guided workshop',
  self_serve: 'Self-serve workshop',
};

export const STATUS_LABEL: Record<WorkshopStatus, string> = {
  intake: 'Intake',
  ready: 'Ready',
  booked: 'Booked',
  in_progress: 'In progress',
  submitted: 'Submitted',
  complete: 'Complete',
};
