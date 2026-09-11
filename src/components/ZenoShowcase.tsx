const CARDS = [
  {
    title: "Invoices that get paid faster.",
    copy: "Quote to invoice in one click, VAT calculated on every line.",
    src: "/docs/screenshots/invoices-list.png",
  },
  {
    title: "Payroll, done in minutes.",
    copy: "PAYE, NSSF, SHIF, AHL — calculated automatically, every run.",
    src: "/docs/screenshots/payroll-runs.png",
  },
  {
    title: "Money in, money out — reconciled.",
    copy: "M-Pesa and bank statements matched against real invoices and bills.",
    src: "/docs/screenshots/banking.png",
  },
  {
    title: "Numbers you can trust.",
    copy: "Reports that reconcile down to the cent, whenever you need them.",
    src: "/docs/screenshots/reports.png",
  },
  {
    title: "Deals that don't fall through.",
    copy: "A pipeline your sales team actually uses, from lead to invoice.",
    src: "/docs/screenshots/deals-pipeline.png",
  },
  {
    title: "Stock, tracked automatically.",
    copy: "Every sale and purchase updates your inventory in real time.",
    src: "/docs/screenshots/items-stock.png",
  },
];

export function ZenoShowcase() {
  return (
    <section data-zeno-showcase>
      <style>{`
        [data-zeno-showcase]{padding:5.5rem 0 4.5rem;background:#fefefe;}
        [data-zeno-showcase-head]{max-width:44rem;margin:0 auto 2.75rem;padding:0 clamp(1.25rem,5vw,3.5rem);text-align:center;}
        [data-zeno-showcase-eyebrow]{margin:0 0 .6rem;font-size:12.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0f766e;}
        [data-zeno-showcase-head] h2{margin:0;color:#0f172a;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:clamp(1.9rem,1.3rem + 2.4vw,3.25rem);font-weight:800;line-height:1.1;letter-spacing:-.01em;text-wrap:balance;}
        [data-zeno-rail]{display:flex;align-items:stretch;gap:1.25rem;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-inline:1.25rem;padding:0 1.25rem .5rem;scrollbar-width:none;}
        [data-zeno-rail]::-webkit-scrollbar{display:none;}
        [data-zeno-card]{scroll-snap-align:center;flex:0 0 clamp(270px,78vw,360px);border-radius:24px;background:#0b332f;overflow:hidden;display:flex;flex-direction:column;}
        [data-zeno-card-copy]{display:flex;flex-direction:column;justify-content:center;min-height:9.5rem;padding:1.5rem 1.75rem;text-align:center;}
        [data-zeno-card-copy] h3{margin:0;color:#fff;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:1.4rem;font-weight:800;line-height:1.2;letter-spacing:-.01em;}
        [data-zeno-card-copy] p{margin:.6rem auto 0;max-width:32ch;color:rgba(251,251,250,.72);font-size:.9rem;line-height:1.5;}
        [data-zeno-card-media]{flex:0 0 auto;margin:0 .8rem;border-radius:14px 14px 0 0;overflow:hidden;background:#fefefe;aspect-ratio:16/10;}
        [data-zeno-card-media] img{display:block;width:100%;height:100%;object-fit:fill;}
        @media(min-width:900px){
          [data-zeno-rail]{gap:2rem;scroll-padding-inline:6vw;padding-inline:6vw;}
          [data-zeno-card]{flex-basis:calc(100vw - 12vw - 4rem);max-width:1100px;}
          [data-zeno-card-copy]{min-height:13rem;padding:2rem 3rem;}
          [data-zeno-card-copy] h3{font-size:clamp(2rem,1.2rem + 2vw,3rem);}
          [data-zeno-card-copy] p{max-width:44ch;font-size:1.05rem;}
          [data-zeno-showcase-head] h2{font-size:clamp(2.5rem,1.5rem + 3vw,4.25rem);}
        }
      `}</style>
      <div data-zeno-showcase-head>
        <p data-zeno-showcase-eyebrow>See it in action</p>
        <h2>Everything, actually working.</h2>
      </div>
      <div data-zeno-rail>
        {CARDS.map((card) => (
          <div data-zeno-card key={card.title}>
            <div data-zeno-card-copy>
              <h3>{card.title}</h3>
              <p>{card.copy}</p>
            </div>
            <div data-zeno-card-media>
              <img src={card.src} alt={card.title} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
