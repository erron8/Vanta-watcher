/* eslint-disable @next/next/no-html-link-for-pages -- Vinext client-side Link navigation fails in this deployment. */
import { ArrowDownRight, ArrowRight, ArrowUpRight, Bookmark, CalendarDays, Check, FileSpreadsheet, Layers3, Search, SlidersHorizontal, Sparkles, TrendingUp } from "lucide-react";

const days = [
  { day: "01", amount: "+$426", tone: "up" },
  { day: "02", amount: "+$182", tone: "up" },
  { day: "03", amount: "−$74", tone: "down" },
  { day: "04", amount: "+$319", tone: "up" },
  { day: "05", amount: "+$508", tone: "up" },
  { day: "06", amount: "−$92", tone: "down" },
  { day: "07", amount: "+$267", tone: "up" },
];

const features = [
  { number: "01", icon: FileSpreadsheet, title: "Import a CSV", description: "Turn DeFi activity exports into a list of unique wallets ready to inspect." },
  { number: "02", icon: SlidersHorizontal, title: "Find your signal", description: "Filter by average invested, active days, daily loss, and monthly profit." },
  { number: "03", icon: Bookmark, title: "Keep the good ones", description: "Bookmark promising wallets, give them names, and return to your shortlist." },
];

export default function LandingPage() {
  return <main className="landing-shell">
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <a className="landing-brand" href="/" aria-label="Vanta home"><span className="landing-brand-mark"><Layers3 size={23} strokeWidth={2.6} /></span><span>Vanta</span></a>
        <a className="landing-header-cta" href="/screener">Open screener <ArrowUpRight size={19} /></a>
      </div>
    </header>

    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-container landing-hero-inner">
        <span className="landing-eyebrow"><span className="landing-eyebrow-dot" /> A clearer view of Meteora wallets <Sparkles size={14} /></span>
        <h1 id="landing-title">Find the wallets<br /><span>worth watching.</span></h1>
        <p className="landing-intro">From a CSV to a shortlist. Explore daily P&amp;L, compare wallet performance, and spot the activity that matters to you.</p>
        <div className="landing-hero-actions"><a className="landing-primary" href="/screener">Open wallet screener <span><ArrowRight size={22} /></span></a><a className="landing-secondary" href="#features">See how it works <span><ArrowDownRight size={20} /></span></a></div>
        <div className="landing-product-stage" id="preview">
          <div className="landing-float landing-float-left"><span className="landing-float-icon"><TrendingUp size={17} /></span><div><small>Performance at a glance</small><strong>Know the trend.</strong></div></div>
          <div className="landing-float landing-float-right"><span className="landing-float-icon"><Bookmark size={17} /></span><div><small>Your own shortlist</small><strong>Save what matters.</strong></div></div>
          <div className="landing-preview-window" aria-label="Illustrative preview of the wallet screener">
            <div className="landing-preview-top"><div className="landing-preview-logo"><span className="landing-preview-logo-mark"><Layers3 size={15} /></span>Vanta</div><div className="landing-preview-tabs"><span>Overview</span><span>Wallets</span><span>Bookmarks</span></div><div className="landing-preview-search"><Search size={13} /> Search wallets</div></div>
            <div className="landing-preview-body">
              <div className="landing-preview-heading"><div><span className="landing-preview-kicker">WALLET SCREENER</span><strong>Know your next move.</strong><small>One place to compare performance, activity, and risk.</small></div><span className="landing-preview-period"><CalendarDays size={13} /> This month</span></div>
              <div className="landing-preview-stats"><div><small>Monthly P&amp;L</small><strong className="landing-demo-green">+$3,284.62</strong><span><ArrowUpRight size={12} /> Positive month</span></div><div><small>Profitable days</small><strong>72.4%</strong><span>21 of 29 active days</span></div><div><small>Average invested</small><strong>$2,410</strong><span>Rolling 30 days</span></div><div><small>Active days</small><strong>29</strong><span>Selected month</span></div></div>
              <div className="landing-preview-lower"><div className="landing-preview-calendar"><div className="landing-preview-section-title"><strong>Daily P&amp;L</strong><span>September</span></div><div className="landing-preview-days">{days.map(day => <div className={`landing-preview-day ${day.tone}`} key={day.day}><small>{day.day}</small><strong>{day.amount}</strong></div>)}</div><div className="landing-preview-chart"><span style={{ height: "29%" }} /><span style={{ height: "56%" }} /><span style={{ height: "39%" }} /><span style={{ height: "76%" }} /><span style={{ height: "44%" }} /><span style={{ height: "93%" }} /><span style={{ height: "67%" }} /><span style={{ height: "82%" }} /><span style={{ height: "53%" }} /><span style={{ height: "100%" }} /><span style={{ height: "73%" }} /><span style={{ height: "89%" }} /></div></div><div className="landing-preview-list"><div className="landing-preview-section-title"><strong>Wallets to watch</strong><span>View all <ArrowUpRight size={12} /></span></div>{["8xi7...Rc2p", "By4k...zQm1", "9hK2...Dpx8"].map((wallet, index) => <div className="landing-preview-wallet" key={wallet}><span className="landing-preview-avatar">{index + 1}</span><span><strong>{wallet}</strong><small>Solana wallet</small></span><b>+{["18.4", "12.7", "9.6"][index]}%</b></div>)}</div></div>
            </div>
          </div>
          <span className="landing-preview-disclaimer">Illustrative interface preview · sample figures</span>
        </div>
      </div>
    </section>

    <section className="landing-features" id="features" aria-labelledby="features-title"><div className="landing-container"><div className="landing-section-heading"><span className="landing-section-tag"><span /> BUILT FOR BETTER RESEARCH</span><h2 id="features-title">Less noise.<br />More conviction.</h2><p>The tools you need to move from a wallet list to a useful view of performance.</p></div><div className="landing-feature-grid">{features.map(feature => <article className="landing-feature" key={feature.number}><div className="landing-feature-top"><span>{feature.number} / 03</span><span className="landing-feature-icon"><feature.icon size={23} strokeWidth={1.8} /></span></div><div><h3>{feature.title}</h3><p>{feature.description}</p></div><Check className="landing-feature-check" size={18} /></article>)}</div></div></section>

    <section className="landing-bottom-cta"><div className="landing-container landing-bottom-inner"><div><span>READY WHEN YOU ARE</span><h2>Make sense of every wallet.</h2><p>Bring your CSV, set your filters, and start exploring.</p></div><a href="/screener">Go to wallet screener <ArrowUpRight size={20} /></a></div></section>
    <footer className="landing-footer"><div className="landing-container"><a className="landing-brand" href="/"><span className="landing-brand-mark"><Layers3 size={20} strokeWidth={2.6} /></span><span>Vanta</span></a><span>Wallet research for Meteora on Solana.</span><div><a href="/screener">Screener</a><a href="/bookmarks">Bookmarks</a></div></div></footer>
  </main>;
}
