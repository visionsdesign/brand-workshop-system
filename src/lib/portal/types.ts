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
  /** Step 2 on the client page: 'done' after Continue, 'skipped' if they had nothing to share */
  filesStep?: 'done' | 'skipped';
}

/** A self-serve answer for one slide. Voice notes live in portal_files (slideId set). */
export interface SlideAnswer {
  /** Main typed answer */
  text?: string;
  /** Sub-answers for slides with several parts (cards, pyramid tiers, word lists), keyed by part name */
  parts?: Record<string, string>;
  /** Tapped answers on interactive slides, same keys as the live session (e.g. S20.scale.0, S21.q2) */
  values?: Record<string, number | null>;
  /** AI-guided conversation for this question, saved by the server */
  chat?: ChatTurn[];
  updatedAt?: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type SelfServeAnswers = Record<string, SlideAnswer>;

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
  /** Set when bought online: the Stripe Checkout session and what was paid, in pence */
  stripeSessionId: string | null;
  amountPaid: number | null;
  /** Guided session booked through Cal.com */
  booking: Booking | null;
  /** Self-serve answers by slide ID */
  answers: SelfServeAnswers;
  submittedAt: string | null;
  /** The code redeemed to create this workshop, if any */
  code: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  uid: string | null;
  start: string | null;
  end: string | null;
  /** 'confirmed' once Cal.com's webhook arrives; 'pending' when only the browser reported it */
  status: 'pending' | 'confirmed' | 'cancelled';
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
  /** Set for voice notes recorded against a workshop slide */
  slideId: string | null;
  /** Browser speech-to-text transcript of a voice note, when available */
  transcript: string | null;
  /** Length of a voice note in seconds */
  seconds: number | null;
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
