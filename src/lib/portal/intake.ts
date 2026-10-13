import type { Intake } from './types';

/**
 * The pre-workshop intake. Mirrors section 5 of clients/_template/client.md so
 * the team can run Prepare from it the same way as for facilitated clients.
 */
export const INTAKE_FIELDS: { key: Exclude<keyof Intake, 'filesStep'>; label: string; hint?: string; long?: boolean; required?: boolean }[] = [
  { key: 'company', label: 'Company or brand name', required: true },
  { key: 'website', label: 'Website or product link', hint: 'If you have one.' },
  { key: 'sector', label: 'What do you do, and in which sector?', long: true, required: true },
  { key: 'competitors', label: 'Who do you compete with?', long: true },
  { key: 'admired', label: 'Which brands do you admire, and why?', hint: 'From any industry.', long: true },
  { key: 'threeWords', label: 'Three words you want people to use about you' },
  { key: 'existingLines', label: 'Taglines or phrases you already use', long: true },
  { key: 'constraints', label: 'Anything we must work with or around?', hint: 'Existing logo, colours, languages, budgets, deadlines.', long: true },
  { key: 'anythingElse', label: 'Anything else we should know?', long: true },
];

/**
 * Questions that moved from the intake to the workshop's opening slides
 * (O01 to O03). Older workshops may still have answers here, so the team
 * view and the AI facilitator keep reading them.
 */
export const MOVED_INTAKE_FIELDS: { key: 'stage' | 'why' | 'audience'; label: string }[] = [
  { key: 'stage', label: 'Where is the business today?' },
  { key: 'why', label: 'Why a brand workshop now?' },
  { key: 'audience', label: 'Who are your customers?' },
];

export function intakeComplete(i: Intake) {
  return INTAKE_FIELDS.filter((f) => f.required).every((f) => (i[f.key] ?? '').trim().length > 0);
}
