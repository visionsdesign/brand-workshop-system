// Online purchase through Stripe Checkout. Prices come from env (pence), so
// changing a price is a config change, not a code change.
import Stripe from 'stripe';
import { portalStore } from './store';
import type { PortalWorkshop, Tier } from './types';

export const TIER_PRODUCT: Record<Tier, { name: string; description: string }> = {
  guided: {
    name: 'Brand DNA Workshop: Guided',
    description: 'A two-hour live session with the Visions Design creative team, with preparation and a Brand DNA summary.',
  },
  self_serve: {
    name: 'Brand DNA Workshop: Self-serve',
    description: 'The Visions Brand DNA Workshop at your own pace, reviewed by our team, with a Brand DNA summary.',
  },
};

/** Shown with the prices: the workshop fee is credited against a full branding project */
export const CREDIT_LINE =
  'Go on to a branding project with Visions within 60 days and the full workshop fee comes off the project.';

const VAT_PERCENT = 20;
export const includesVat = () => process.env.PRICES_INCLUDE_VAT === 'true';

export function pricePence(tier: Tier): number | null {
  const raw = tier === 'guided' ? process.env.PRICE_GUIDED_PENCE : process.env.PRICE_SELF_SERVE_PENCE;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Online purchase is switched on for a tier when Stripe and its price are configured */
export const canBuy = (tier: Tier) => Boolean(process.env.STRIPE_SECRET_KEY && pricePence(tier));

export function priceLabel(tier: Tier): string | null {
  const p = pricePence(tier);
  if (!p) return null;
  const amount = (p / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: p % 100 ? 2 : 0 });
  return `${amount} ${includesVat() ? 'inc. VAT' : '+ VAT'}`;
}

let client: Stripe | null = null;
export const stripe = () => (client ??= new Stripe(process.env.STRIPE_SECRET_KEY!));

/** UK VAT at 20%, created once in the Stripe account and reused */
async function vatRateId(): Promise<string> {
  const inclusive = includesVat();
  const s = stripe();
  const existing = await s.taxRates.list({ active: true, limit: 100 });
  const match = existing.data.find(
    (r) => r.percentage === VAT_PERCENT && r.inclusive === inclusive && r.display_name === 'VAT' && r.country === 'GB',
  );
  if (match) return match.id;
  const created = await s.taxRates.create({
    display_name: 'VAT',
    description: 'UK VAT',
    percentage: VAT_PERCENT,
    inclusive,
    country: 'GB',
    jurisdiction: 'GB',
  });
  return created.id;
}

export interface CheckoutInput {
  tier: Tier;
  clientName: string;
  contactName: string;
  contactEmail: string;
  origin: string;
}

export async function createCheckout(i: CheckoutInput): Promise<string> {
  const amount = pricePence(i.tier);
  if (!amount) throw new Error('No price set for this workshop');
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer_email: i.contactEmail,
    line_items: [
      {
        quantity: 1,
        tax_rates: [await vatRateId()],
        price_data: {
          currency: 'gbp',
          unit_amount: amount,
          product_data: { name: TIER_PRODUCT[i.tier].name, description: TIER_PRODUCT[i.tier].description },
        },
      },
    ],
    // A VAT invoice is emailed with the receipt
    invoice_creation: { enabled: true, invoice_data: { description: `${TIER_PRODUCT[i.tier].name} for ${i.clientName}` } },
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    metadata: { tier: i.tier, clientName: i.clientName, contactName: i.contactName },
    success_url: `${i.origin}/buy/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${i.origin}/buy/${i.tier === 'guided' ? 'guided' : 'self-serve'}?cancelled=1`,
  });
  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  return session.url;
}

/**
 * Turn a paid Checkout session into a workshop. Called from both the success
 * page and the webhook; whichever runs first creates it, the other finds it.
 */
export async function fulfil(sessionId: string): Promise<PortalWorkshop | null> {
  const store = portalStore();
  const existing = await store.getByStripeSession(sessionId);
  if (existing) return existing;
  const session = await stripe().checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid') return null;
  const tier: Tier = session.metadata?.tier === 'self_serve' ? 'self_serve' : 'guided';
  return store.createFromPurchase({
    tier,
    sessionId,
    amountPaid: session.amount_total ?? 0,
    contact: {
      clientName: session.metadata?.clientName || session.customer_details?.name || 'New client',
      contactName: session.metadata?.contactName || session.customer_details?.name || '',
      contactEmail: session.customer_details?.email || session.customer_email || '',
    },
  });
}
