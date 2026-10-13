'use client';

import { useActionState } from 'react';
import { enquire } from './actions';

export function EnquiryForm() {
  const [state, action, pending] = useActionState(enquire, undefined);
  const v = state?.values ?? {};
  if (state?.ok) {
    return (
      <div className="pt-enquiry-done" role="status">
        <strong>Thank you, we&apos;ve got your details.</strong>
        <p>Someone from our team will be in touch soon to talk through your options.</p>
      </div>
    );
  }
  return (
    <form className="pt-form" action={action}>
      <div className="pt-form-row">
        <label>
          Your name
          <input name="name" defaultValue={v.name} autoComplete="name" required />
        </label>
        <label>
          Email
          <input name="email" type="email" defaultValue={v.email} autoComplete="email" required />
        </label>
      </div>
      <div className="pt-form-row">
        <label>
          <span>Company or brand <em>(optional)</em></span>
          <input name="company" defaultValue={v.company} autoComplete="organization" />
        </label>
        <label>
          <span>Phone <em>(optional)</em></span>
          <input name="phone" type="tel" defaultValue={v.phone} autoComplete="tel" />
        </label>
      </div>
      <div className="pt-form-row">
        <label>
          I&apos;m interested in
          <select name="interest" defaultValue={v.interest || 'not_sure'}>
            <option value="not_sure">Not sure yet</option>
            <option value="guided">Guided workshop</option>
            <option value="self_serve">Self-serve workshop</option>
          </select>
        </label>
        <label>
          Best way to reach me
          <select name="contactBy" defaultValue={v.contactBy || 'email'}>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
          </select>
        </label>
      </div>
      <label>
        <span>Anything you&apos;d like us to know? <em>(optional)</em></span>
        <textarea name="message" rows={3} defaultValue={v.message} maxLength={2000} placeholder="Where your brand is now, what you're hoping to get from a workshop, a good time to call…" />
      </label>
      {/* Left empty by people; bots tend to fill it in */}
      <label className="pt-hp" aria-hidden>
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {state?.error && <p className="pt-error" role="alert">{state.error}</p>}
      <p className="pt-hint">We&apos;ll only use your details to talk to you about a workshop.</p>
      <button className="pt-btn" disabled={pending}>{pending ? 'Sending…' : 'Ask the team to get in touch'}</button>
    </form>
  );
}
