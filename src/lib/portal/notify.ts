// Passing new enquiries on: a contact (and a note) in HubSpot, and a message
// in Slack. Each is optional and runs after the visitor has had their reply.
//
//   HUBSPOT_ACCESS_TOKEN  a HubSpot private app token with
//                         crm.objects.contacts.read and crm.objects.contacts.write
//   SLACK_WEBHOOK_URL     a Slack incoming webhook for the channel to post in
import { after } from 'next/server';
import { INTEREST_LABEL, type NewEnquiry } from './enquiries';

const SITE = process.env.URL || 'https://brand.visionsdesign.co.uk';
const HUBSPOT = 'https://api.hubapi.com';

export const hubspotConfigured = () => Boolean(process.env.HUBSPOT_ACCESS_TOKEN);
export const slackConfigured = () => Boolean(process.env.SLACK_WEBHOOK_URL);

async function hubspot(path: string, body: unknown) {
  const res = await fetch(`${HUBSPOT}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HubSpot ${path} returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Create or update the contact by email, then attach a note with what they told us */
async function toHubspot(e: NewEnquiry) {
  const [firstname, ...rest] = e.name.split(/\s+/);
  const properties: Record<string, string> = { email: e.email, firstname, lastname: rest.join(' ') };
  if (e.phone) properties.phone = e.phone;
  if (e.company) properties.company = e.company;
  const upsert = await hubspot('/crm/v3/objects/contacts/batch/upsert', {
    inputs: [{ idProperty: 'email', id: e.email, properties }],
  });
  const contactId = upsert.results?.[0]?.id;
  if (!contactId) return;
  const lines = [
    '<p><strong>Brand workshop enquiry</strong> (brand.visionsdesign.co.uk)</p>',
    `<p>Interested in: ${INTEREST_LABEL[e.interest]}<br>Prefers: ${e.contactBy === 'phone' ? 'a call' : 'email'}${e.phone ? `<br>Phone: ${escape(e.phone)}` : ''}</p>`,
    e.message ? `<p>${escape(e.message).replace(/\n/g, '<br>')}</p>` : '',
  ];
  await hubspot('/crm/v3/objects/notes', {
    properties: { hs_timestamp: new Date().toISOString(), hs_note_body: lines.join('') },
    // 202: note to contact
    associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }],
  });
}

// For HubSpot's HTML notes and Slack's mrkdwn alike: visitors' text can't become tags, links or mentions
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = escape;

async function toSlack(e: NewEnquiry) {
  const who = `*${plain(e.name)}*${e.company ? ` from ${plain(e.company)}` : ''}`;
  const contact = [plain(e.email), e.phone ? plain(e.phone) : ''].filter(Boolean).join(' · ');
  const text = `New brand workshop enquiry: ${who}`;
  const res = await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `:wave: ${text}` } },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Interested in*\n${INTEREST_LABEL[e.interest]}` },
            { type: 'mrkdwn', text: `*Prefers*\n${e.contactBy === 'phone' ? 'A call' : 'Email'}` },
            { type: 'mrkdwn', text: `*Contact*\n${contact}` },
          ],
        },
        ...(e.message ? [{ type: 'section', text: { type: 'mrkdwn', text: `>${plain(e.message).slice(0, 1500).replace(/\n/g, '\n>')}` } }] : []),
        { type: 'context', elements: [{ type: 'mrkdwn', text: `<${SITE}/team/enquiries|Open Enquiries in the team area>` }] },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Slack webhook returned ${res.status}`);
}

/** Send the enquiry to HubSpot and Slack after the response; failures are logged, never shown to the visitor */
export function notifyEnquiry(e: NewEnquiry) {
  if (!hubspotConfigured() && !slackConfigured()) return;
  after(async () => {
    await Promise.all([
      hubspotConfigured() ? toHubspot(e).catch((err) => console.error('HubSpot sync failed', err)) : null,
      slackConfigured() ? toSlack(e).catch((err) => console.error('Slack notification failed', err)) : null,
    ]);
  });
}
