import Link from 'next/link';
import { canBuy, CREDIT_LINE, priceLabel } from '@/lib/portal/payments';
import { REGISTRY } from '@/lib/registry';
import { aboutTime, SLIDE_IDS, totalMinutes } from '@/lib/portal/selfserve';
import type { Tier } from '@/lib/portal/types';
import { RedeemForm } from './redeem/RedeemForm';
import { EnquiryForm } from './enquire/EnquiryForm';
import { ViviBubble } from '@/components/portal/ViviBubble';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Brand DNA Workshop · Visions Design',
  description: 'Find the strategic DNA of your brand with Visions Design, guided by our team or at your own pace.',
  robots: { index: true, follow: true },
};

const STATS = [
  { value: '127', label: 'Workshops completed' },
  { value: '100%', label: 'Happy customers' },
  { value: '87%', label: 'Continue to work with us' },
  { value: '10 years', label: 'Branding experience' },
];

const TIERS = [
  {
    id: 'guided' as Tier,
    slug: 'guided',
    name: 'Guided workshop',
    lead: 'A two-hour live session with our creative team.',
    points: [
      'Book a time that suits you',
      'We prepare with your brief and files beforehand',
      'Live, facilitated session on a video call',
      'Your Brand DNA summary afterwards',
    ],
  },
  {
    id: 'self_serve' as Tier,
    slug: 'self-serve',
    name: 'Self-serve workshop',
    lead: 'Work through the same workshop at your own pace.',
    points: [
      'Type each answer, or talk it through with our AI facilitator',
      `Allow at least ${aboutTime(totalMinutes(REGISTRY.filter((s) => SLIDE_IDS.has(s.id)))).replace('about ', '')}, over as many sittings as you like`,
      'Our team reviews every answer',
      'Your Brand DNA summary afterwards',
    ],
  },
];

export default function Home() {
  return (
    <main className="pt">
      <section className="pt-hero">
        {/* Two gradients that slowly drift and fade into each other (still for reduced motion) */}
        <img className="pt-hero-bg pt-bg-drift" src="/img/web/bg-title.jpg" alt="" />
        <img className="pt-hero-bg pt-bg-drift pt-bg-fade" src="/img/web/bg-voice.jpg" alt="" />
        <header className="pt-bar">
          <span>Visions Design</span>
          <Link href="/team">Team sign in</Link>
        </header>
        <div className="pt-hero-copy">
          <p className="pt-eyebrow">Brand workshop</p>
          <h1>Find the DNA of <br className="pt-br-wide" />your&nbsp;brand.</h1>
          <p className="pt-lede">
            The same workshop we run with every Visions client: your story, your audience, your voice, and where the brand
            goes next. Run it with our team, or on your own.
          </p>
        </div>
      </section>

      <section className="pt-tiers" aria-label="Workshop options">
        {TIERS.map((t) => (
          <article className="pt-tier" key={t.id}>
            <h2>{t.name}</h2>
            <p className="pt-tier-lead">{t.lead}</p>
            <ul>{t.points.map((p) => <li key={p}>{p}</li>)}</ul>
            {priceLabel(t.id) && <p className="pt-price">{priceLabel(t.id)}</p>}
            {canBuy(t.id) ? (
              <Link className="pt-btn" href={`/buy/${t.slug}`}>Buy now</Link>
            ) : (
              <button className="pt-btn pt-btn-ghost" disabled title="Online purchase opens soon">
                Buy online (coming soon)
              </button>
            )}
          </article>
        ))}
      </section>
      <p className="pt-credit">{CREDIT_LINE}</p>

      <section className="pt-redeem" id="talk">
        <div>
          <h2>Not sure which is right for you?</h2>
          <p>
            Leave your details and someone from our team will get in touch to talk through your options, with no obligation.
            We&apos;ll help you choose between Guided and Self-serve, or shape something around you.
          </p>
        </div>
        <EnquiryForm />
      </section>

      <section className="pt-stats" aria-label="Visions in numbers">
        <img className="pt-stats-bg pt-bg-drift" src="/img/web/bg-core.jpg" alt="" loading="lazy" />
        <img className="pt-stats-bg pt-bg-drift pt-bg-fade" src="/img/web/bg-align.jpg" alt="" loading="lazy" />
        <dl>
          {STATS.map((st) => (
            <div key={st.label}>
              <dt>{st.label}</dt>
              <dd>{st.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="pt-redeem" id="code">
        <div>
          <h2>Have a workshop code?</h2>
          <p>Enter it here with your details. We&apos;ll set up your workshop and give you a private link to come back to.</p>
        </div>
        <RedeemForm />
      </section>

      <footer className="pt-foot">© Visions Design</footer>
      <ViviBubble />
    </main>
  );
}
