const images = {
  earbuds: "https://lh3.googleusercontent.com/aida-public/AB6AXuBu7-QWSsNqFHO5asDYkHHmwSfKiQpa7Fk0DdS-Q4nP0Min3mU-7tgbDc6x9woPb6eKBBEzkQ_szaBBBXatEfse3LBJ40gGhCyB620ox8IGhh24u5ydDZUTkCtp4LuF7vhpLfKUTPV7UFQV0Zr3H4GQ6TpGE9lHni9gWpFQygnkIvG0ir8rTKgTJq8HusdHB44OdIiZspBg0u1bkacaSmMCtV2usevYd89_Fsxzhlw",
  headphones: "https://lh3.googleusercontent.com/aida-public/AB6AXuCT94l6x9rOVfDpQG0nqKso-lvpFScITJ3j5MlGr-2dDTFDJRU8LPTnMn6Mza9Hwlmtwk3YjctHE_fu_Nbs75nHlk-S7lqPfumxjOGjDOJNm3fC4W8EAyUIOsRpVxrjgSpy3WG0ieeEO9N7jug0BjFRfqgpndc6JOEEJmkS0dxTyKb_3KsYr1alJXN3M3uoMx3X4mIoPNiUUVzE8K-vN42bs5NK2De_yDM0o5fSxOQ",
  watch: "https://lh3.googleusercontent.com/aida-public/AB6AXuA4-UTk1Lmh4-CEb81vxmXpjlmZgdQruDUUR3ocKzcmHbasgibfns1GMD_Fr71x2QhYg2Atom7zozhoduJQiLnvLl9KdMAWh9jHMs3Dr5M0UxbmTFyx4_QJyLu1igi9eMJv-9f-oiaoB8ixzvbkydhWkP0t-4t3M8e7L-iB94Xb-1BoUQnaHRdhgf56ctO1y5Fhym1ZCO1f-zJwhzGMoAgxnVkYM3blM0EGNv7R9Fo",
  electronics: "https://lh3.googleusercontent.com/aida-public/AB6AXuCwFr-baUT38F9yzf8ulS1MF6s7b85xwatO7Rx43Q-lyCIIe_JWLl7ZLcICiSCE_IeKomFKP3_H4gZFnGi5jQJJHUSL1wOHyz0kEyLP34mO7aF1Lk9EUmlLpiIk8axzmtZaH6s3tAUv_99UkqWj7AjNk0w1QYut9EavtZlNjxkxDZRCZb1T4V39uZ2OgkBYQyyiam4w5NCuSZa1rHbvFjOftZpdJZZo0mjCYlX6eSY",
  fashion: "https://lh3.googleusercontent.com/aida-public/AB6AXuDdvnkKRxXT1QyyYVzCvduUEP9Ek07riekejlf9AoMxUI_nfogHLIQcz4y_YU-NI5qt5INh5H1na61pikVuvSDzoTy_06VatBqOKJDaDEfWVSwhqEAdD1DfHdL4dYraoTpYcVpl17CySZs9qfSUfDIP-_mpu3rqX5e1IY8qCOU7BvzzlPdiWsEcI0qzezN869C3ByG-ZpuViBwjYDd2Ox7ZwgFFOqkT93gSaRb3iN8",
  beauty: "https://lh3.googleusercontent.com/aida-public/AB6AXuABL1fs5cZNR1sm9Jwu8G8eoyEqJQEbUSFqrZw3knfi48ro4PiuWQ3e2OB9ICZhE-f9r12ixWTGIROTlNoaCAtyx3C7sfIgcJXJ8W4zejVHjDBUclWtJUO-boER2AyfMHInf9-jRBBSNeQM2PNKDaiiHmmZV5CWm5YgQLJG_3voGa99LEKHoJZo97TBHH_Hy12FAYmF09caaWCWY8Our7D62QV5jfPp6Ule1swSh2k"
};

const steps = [
  ["01", "Add your business", "Store name, WhatsApp number, location and FCFA currency settings."],
  ["02", "Add your products", "Upload photos, prices, categories and the variants customers actually need."],
  ["03", "Customize storefront", "Apply your logo, brand color and a clean mobile-first storefront theme."],
  ["04", "Publish & sell", "Share one store link and move high-intent product clicks into WhatsApp."]
];

const categories = [
  {
    title: "Electronics & gadgets",
    copy: "Clean specs, variants, warranty notes and high-ticket product presentation.",
    sample: "Sony WH-1000XM5",
    price: "230,000 FCFA",
    image: images.electronics
  },
  {
    title: "Fashion & apparel",
    copy: "Visual catalogs built around sizes, colors and quick browsing on mobile.",
    sample: "Linen two-piece",
    price: "35,000 FCFA",
    image: images.fashion
  },
  {
    title: "Beauty & personal care",
    copy: "Simple product bundles, routines and product education without a heavy checkout.",
    sample: "Hydration glow kit",
    price: "22,500 FCFA",
    image: images.beauty
  },
  {
    title: "General retail",
    copy: "A flexible storefront for merchants who sell across several everyday categories.",
    sample: "Daily essentials",
    price: "From 5,000 FCFA",
    image: images.earbuds
  }
];

const metaRoadmap = [
  ["Catalog sync", "Publish selected Commerce Factory products to a Meta catalog."],
  ["Pixel & CAPI", "Send storefront and high-intent events without making Meta a core dependency."],
  ["Instagram product surfaces", "Prepare product data for eligible Instagram commerce experiences."],
  ["Promote a product", "Later: launch product campaigns from a deliberately simple merchant flow."]
];

const plans = [
  {
    name: "Starter",
    kicker: "Beta",
    price: "Free",
    description: "Validate your catalog and WhatsApp sales flow.",
    features: ["Up to 25 products", "Commerce Factory store URL", "WhatsApp order handoff", "Basic storefront analytics"],
    cta: "Join beta"
  },
  {
    name: "Pro",
    kicker: "After beta",
    price: "Pricing to validate",
    description: "For merchants who need a stronger branded storefront.",
    features: ["More products & categories", "Custom domain path", "Remove platform branding", "Advanced analytics"],
    cta: "See Pro roadmap",
    featured: true
  },
  {
    name: "Business",
    kicker: "Later",
    price: "Talk to us",
    description: "For teams and higher-volume commerce operations.",
    features: ["Team access", "Multiple stores", "Integration controls", "Meta automation roadmap"],
    cta: "Explore Business"
  }
];

function ProductCard({
  image,
  name,
  price,
  badge
}: {
  image: string;
  name: string;
  price: string;
  badge?: string;
}) {
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <img src={image} alt="" className="product-image" />
        {badge ? <span className="product-badge">{badge}</span> : null}
      </div>
      <div className="product-copy">
        <p>{name}</p>
        <strong>{price}</strong>
      </div>
      <button type="button" className="whatsapp-button" aria-label={"Buy " + name + " on WhatsApp"}>
        <span className="wa-dot">WA</span>
        Buy on WhatsApp
      </button>
    </article>
  );
}

export default function App() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Commerce Factory home">
          <img
            className="brand-logo"
            src="/commerce-factory-logo.png"
            alt="Commerce Factory by Trigenys"
          />
        </a>

        <nav className="desktop-nav" aria-label="Primary">
          <a href="#how">How it works</a>
          <a href="#showcase">Showcase</a>
          <a href="#whatsapp">WhatsApp</a>
          <a href="#dashboard">Dashboard</a>
          <a href="#pricing">Pricing</a>
        </nav>

        <a className="button button-primary button-compact" href="#launch">
          Create my store
        </a>
      </header>

      <main id="top">
        <section className="hero-section section">
          <div className="hero-aura hero-aura-one" />
          <div className="hero-aura hero-aura-two" />

          <div className="hero-copy">
            <span className="eyebrow"><i /> Commerce infrastructure for modern businesses</span>
            <h1>
              Your store.
              <span>Online in minutes.</span>
            </h1>
            <p className="hero-lede">
              Turn your products into a clean online catalog and send high-intent customers
              directly into WhatsApp with the product context already filled in.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#launch">Create my store <span>→</span></a>
              <a className="button button-soft" href="#showcase">See a demo store</a>
            </div>
            <div className="trust-row" aria-label="Product principles">
              <span>✓ No code</span>
              <span>✓ FCFA-ready</span>
              <span>✓ Mobile-first</span>
              <span>✓ WhatsApp-native</span>
            </div>
            <div className="proof-card">
              <span className="proof-icon">✓</span>
              <div>
                <strong>Built around the sales flow merchants already use</strong>
                <p>Catalog → product interest → WhatsApp conversation. No fake payment layer in the MVP.</p>
              </div>
            </div>
          </div>

          <div className="hero-visual" aria-label="Example Commerce Factory storefront">
            <div className="browser-card">
              <div className="browser-bar">
                <span className="browser-dots"><i /><i /><i /></span>
                <span className="address-pill">commercefactory.shop/techpulse</span>
                <span>↗</span>
              </div>
              <div className="store-preview">
                <div className="store-preview-header">
                  <div className="merchant-name">
                    <span className="merchant-avatar">TP</span>
                    <span><strong>TechPulse</strong><small>Douala • Demo storefront</small></span>
                  </div>
                  <span className="currency-pill">XAF</span>
                </div>
                <div className="category-pills">
                  <span className="active">Audio</span><span>Phones</span><span>Laptops</span>
                </div>
                <div className="product-grid">
                  <ProductCard image={images.earbuds} name="Wireless Earbuds Pro" price="145,000 FCFA" badge="Popular" />
                  <ProductCard image={images.headphones} name="Sony WH-1000XM5" price="230,000 FCFA" badge="New" />
                </div>
              </div>
            </div>

            <div className="phone-card">
              <div className="phone-notch" />
              <span className="phone-store-name">TechPulse Mobile</span>
              <img src={images.watch} alt="" className="phone-product-image" />
              <span className="phone-product-name">Smart Watch Ultra</span>
              <strong>65,000 FCFA</strong>
              <span className="phone-status">Ready for WhatsApp</span>
              <button type="button" className="whatsapp-button phone-button">
                <span className="wa-dot">WA</span> Buy on WhatsApp
              </button>
            </div>
          </div>
        </section>

        <section className="section section-tint" id="how">
          <div className="section-heading centered">
            <span className="overline">Fast onboarding</span>
            <h2>From social seller to published store in four clear steps.</h2>
            <p>No developer dashboard maze. The setup follows the way a merchant thinks about the business.</p>
          </div>
          <div className="steps-grid">
            {steps.map(([number, title, copy]) => (
              <article className="step-card" key={number}>
                <div className="step-top"><strong>{number}</strong><span>Quick setup</span></div>
                <div className="step-icon">{number === "04" ? "↗" : "•"}</div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="showcase">
          <div className="section-heading">
            <span className="overline">Storefront showcase</span>
            <h2>One strong storefront system, adapted to what you sell.</h2>
            <p>
              The MVP starts with one excellent visual system. Category differences come from product data,
              variants and presentation—not four separate page builders.
            </p>
          </div>
          <div className="showcase-grid">
            {categories.map((item) => (
              <article className="showcase-card" key={item.title}>
                <img src={item.image} alt="" />
                <div className="showcase-body">
                  <span className="mini-tag">Demo category</span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                  <div className="sample-row">
                    <span>{item.sample}</span>
                    <strong>{item.price}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section section-tint whatsapp-section" id="whatsapp">
          <div className="whatsapp-copy">
            <span className="overline">WhatsApp handoff</span>
            <h2>Your customers already use WhatsApp. Sell where they already are.</h2>
            <p>
              Commerce Factory does not pretend a WhatsApp click is a completed sale. The MVP tracks customer
              intent, preserves product context and hands the conversation to the merchant.
            </p>
            <ol className="flow-list">
              <li><span>1</span><div><strong>Customer opens a product</strong><small>Price, product details and variants are clear before the chat starts.</small></div></li>
              <li><span>2</span><div><strong>They tap Buy on WhatsApp</strong><small>The product context is encoded into the message safely.</small></div></li>
              <li><span>3</span><div><strong>WhatsApp opens</strong><small>The merchant receives a useful inquiry instead of “hello, price?”</small></div></li>
              <li><span>4</span><div><strong>The merchant closes the sale</strong><small>Payment and delivery stay in the merchant’s existing process for MVP.</small></div></li>
            </ol>
          </div>

          <div className="chat-card" aria-label="Example WhatsApp handoff">
            <div className="chat-header">
              <span className="chat-avatar">TP</span>
              <span><strong>TechPulse</strong><small>WhatsApp Business</small></span>
              <span className="chat-online">online</span>
            </div>
            <div className="chat-body">
              <span className="chat-date">TODAY</span>
              <div className="message outgoing">
                <strong>Product inquiry</strong>
                <p>
                  Bonjour 👋 Je souhaite commander <b>Sony WH-1000XM5 (Black)</b> — <b>230,000 FCFA</b>.
                </p>
                <small>Product: commercefactory.shop/techpulse/sony-xm5</small>
              </div>
              <div className="message incoming">
                <p>Bonjour ! Bien reçu. Je vous confirme la disponibilité, le paiement et la livraison ici.</p>
                <small>14:33</small>
              </div>
            </div>
            <div className="chat-input"><span>Type a message…</span><b>➤</b></div>
          </div>
        </section>

        <section className="section" id="social">
          <div className="roadmap-card">
            <div className="section-heading">
              <span className="overline purple">Roadmap • post-MVP</span>
              <h2>Connect the catalog to Meta after the core store earns the right to grow.</h2>
              <p>
                Social commerce is the differentiator, but it should not block the first usable storefront.
                These integrations are designed as adapters around the core catalog.
              </p>
            </div>
            <div className="sync-line" aria-hidden="true">
              <span>Commerce Factory</span><b>→</b><span>Meta Catalog</span><b>→</b><span>Instagram / Facebook</span>
            </div>
            <div className="roadmap-grid">
              {metaRoadmap.map(([title, copy]) => (
                <article key={title}>
                  <span className="roadmap-icon">↗</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-tint" id="dashboard">
          <div className="section-heading centered">
            <span className="overline">Merchant dashboard</span>
            <h2>A compact mission control for product interest.</h2>
            <p>Demo data below shows the metrics the MVP can genuinely observe.</p>
          </div>
          <div className="dashboard-shell">
            <aside className="dashboard-sidebar">
              <div className="dashboard-brand"><span>CF</span><div><strong>Aura Store</strong><small>Demo account</small></div></div>
              <nav>
                <a className="active" href="#dashboard">Overview</a>
                <a href="#showcase">Products</a>
                <a href="#whatsapp">WhatsApp clicks</a>
                <a href="#social">Social roadmap</a>
              </nav>
              <small className="demo-note">Demo data • not live merchant results</small>
            </aside>
            <div className="dashboard-main">
              <div className="metrics-grid">
                <div><small>Store views</small><strong>18,420</strong><span>Demo</span></div>
                <div><small>Product views</small><strong>41,290</strong><span>Demo</span></div>
                <div><small>WhatsApp clicks</small><strong>1,842</strong><span>High intent</span></div>
                <div><small>View → WhatsApp</small><strong>10.0%</strong><span>Derived metric</span></div>
              </div>
              <div className="insight-table">
                <div className="table-head">
                  <span><strong>Top product interest</strong><small>What customers are clicking into WhatsApp for</small></span>
                  <span className="demo-pill">Demo data</span>
                </div>
                <div className="table-row table-labels"><span>Product</span><span>Views</span><span>WA clicks</span><span>Rate</span></div>
                <div className="table-row"><span>Sony WH-1000XM5</span><span>2,840</span><span>312</span><strong>11.0%</strong></div>
                <div className="table-row"><span>Wireless Earbuds Pro</span><span>2,110</span><span>221</span><strong>10.5%</strong></div>
                <div className="table-row"><span>Smart Watch Ultra</span><span>1,760</span><span>162</span><strong>9.2%</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="pricing">
          <div className="section-heading centered">
            <span className="overline">Pricing hypothesis</span>
            <h2>Simple plans, without inventing the final numbers before merchants validate them.</h2>
            <p>Beta pricing will be set from merchant interviews and real usage—not from a landing-page guess.</p>
          </div>
          <div className="pricing-grid">
            {plans.map((plan) => (
              <article className={plan.featured ? "price-card featured" : "price-card"} key={plan.name}>
                <span className="price-kicker">{plan.kicker}</span>
                <h3>{plan.name}</h3>
                <strong className="price-value">{plan.price}</strong>
                <p>{plan.description}</p>
                <ul>
                  {plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
                </ul>
                <a href={plan.name === "Starter" ? "#launch" : "#social"} className={plan.featured ? "button button-primary" : "button button-soft"}>
                  {plan.cta}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="launch">
          <div className="launch-card">
            <span className="launch-icon">↗</span>
            <span className="overline inverse">Private beta direction</span>
            <h2>Your customers are online. Your store should be too.</h2>
            <p>
              The next milestone is one real merchant creating a store, publishing products and receiving a
              useful WhatsApp inquiry without developer help.
            </p>
            <a className="button button-primary launch-button" href="#how">See how the beta works</a>
            <small>No fake checkout • No fake revenue claims • Built by Trigenys</small>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <a className="brand footer-brand" href="#top" aria-label="Commerce Factory home">
            <img
              className="brand-logo"
              src="/commerce-factory-logo.png"
              alt="Commerce Factory by Trigenys"
            />
          </a>
          <p>Lightweight storefront infrastructure for WhatsApp-first commerce.</p>
        </div>
        <div className="footer-links">
          <a href="#how">How it works</a>
          <a href="#showcase">Showcase</a>
          <a href="#dashboard">Dashboard</a>
          <a href="#pricing">Pricing</a>
        </div>
        <small>Commerce Factory is currently an MVP in development.</small>
      </footer>
    </div>
  );
}
