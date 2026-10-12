import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canBuy, CREDIT_LINE, priceLabel, TIER_PRODUCT } from '@/lib/portal/payments';
import type { Tier } from '@/lib/portal/types';
import { BuyForm } from './BuyForm';

export const dynamic = 'force-dynamic';

const SLUGS: Record<string, Tier> = { guided: 'guided', 'self-serve': 'self_serve' };

export async function generateMetadata({ params }: { params: Promise<{ tier: string }> }) {
  const tier = SLUGS[(await params).tier];
  return { title: tier ? `${TIER_PRODUCT[tier].name} · Visions Design` : 'Brand workshop' };
}

export default async function Buy({
  params,
  searchParams,
}: {
  params: Promise<{ tier: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const tier = SLUGS[(await params).tier];
  if (!tier) notFound();
  const { cancelled } = await searchParams;
  const price = priceLabel(tier);
  const product = TIER_PRODUCT[tier];

  return (
    <main className="pt">
      <header className="pt-bar pt-bar-solid">
        <Link href="/">Visions Design · Brand workshop</Link>
      </header>
      <div className="pt-wrap pt-buy">
        <p className="pt-eyebrow">{tier === 'guided' ? 'Guided' : 'Self-serve'}</p>
        <h1 className="pt-title">{product.name.replace('Brand DNA Workshop: ', '')} workshop</h1>
        <p className="pt-lede">{product.description}</p>
        {price && <p className="pt-price">{price}</p>}
        <p className="pt-credit pt-credit-left">{CREDIT_LINE}</p>

        {cancelled && <p className="pt-note">Payment cancelled. Nothing has been charged, so you can try again whenever you&apos;re ready.</p>}

        {canBuy(tier) && price ? (
          <section className="pt-buy-form">
            <h2>Your details</h2>
            <BuyForm tier={tier} price={price} />
          </section>
        ) : (
          <p className="pt-note">
            Online purchase opens soon. If you have a workshop code, <Link href="/#code">enter it here</Link>.
          </p>
        )}
      </div>
      <footer className="pt-foot">© Visions Design</footer>
    </main>
  );
}
