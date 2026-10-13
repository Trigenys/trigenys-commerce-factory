import { landingCopy, type LandingLanguage } from "./content";

export default function LandingFAQ({ language }: { language: LandingLanguage }) {
  const t = landingCopy[language];
  return <section className="section landing-faq" id="faq" aria-labelledby="faq-heading">
    <div className="landing-section-heading" data-reveal>
      <span className="overline">{t.faqLabel}</span>
      <h2 id="faq-heading">{t.faqTitle}</h2>
      <p>{t.faqBody}</p>
      <a className="landing-text-link" href="/help">{t.help}<span aria-hidden="true">↗</span></a>
    </div>
    <div className="landing-faq-list" data-reveal>
      {t.questions.map(([question, answer], index) => <details key={index}>
        <summary>{question}<span aria-hidden="true">+</span></summary>
        <p>{answer}</p>
      </details>)}
    </div>
  </section>;
}
