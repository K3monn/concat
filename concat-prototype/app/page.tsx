import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Brain, CircleHelp, Compass, Lightbulb, MessageCircle, Sparkles } from "lucide-react";
import { MarketingDemo } from "@/components/marketing-demo";

const steps = [
  { number: "01", title: "Teach", text: "Explain an idea in your own words. Start with what you know.", icon: MessageCircle },
  { number: "02", title: "Question", text: "Follow the why behind each step. Make your thinking visible.", icon: CircleHelp },
  { number: "03", title: "Apply", text: "Try a new scenario and see whether the idea travels with you.", icon: Compass },
  { number: "04", title: "Reflect", text: "Spot what clicked and what you want to revisit next.", icon: Lightbulb },
];

const audiences = [
  { label: "FOR THE OVERWHELMED", quote: "You’ve read the chapter three times. Could you explain it without looking?", detail: "Find the difference between familiar and understood.", tint: "peach" },
  { label: "FOR THE INDEPENDENT", quote: "What if studying meant figuring things out for yourself?", detail: "Build the confidence to think beyond the answer key.", tint: "lavender" },
  { label: "FOR THE CURIOUS", quote: "Knowing the answer is one thing. Understanding why is another.", detail: "Take what you know into unfamiliar territory.", tint: "mint" },
];

export default function Home() {
  return (
    <main className="home-page">
      <nav className="nav shell">
        <a className="wordmark" href="#top" aria-label="Concat home"><span className="brand-symbol">c<span>.</span></span> concat</a>
        <div className="nav-links"><a href="#approach">The approach</a><a href="#modes">Explore modes</a><a href="#educators">For educators</a></div>
        <Link className="nav-cta" href="/learn">Open your learning space <ArrowUpRight size={15}/></Link>
      </nav>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot"/> A different way to study</div>
          <h1>Think for<br/><em>yourself.</em></h1>
          <p className="hero-text">Studying isn’t just about finding the right answer. It’s about understanding why it’s right. Teach what you’ve learned, challenge your thinking, and discover what you really understand.</p>
          <div className="hero-actions"><Link className="button button-dark" href="/learn?mode=concept">Start learning <ArrowRight size={16}/></Link><a className="text-link" href="#approach"><span className="play-icon">↓</span> See how it works</a></div>
          <div className="hero-note"><span className="avatar-stack"><i>J</i><i>M</i><i>A</i></span><span>Made for the moments when<br/>you want it to really <strong>click.</strong></span></div>
        </div>
        <div className="hero-art" aria-label="A student teaching mitosis on a digital whiteboard">
          <div className="art-topline"><span><span className="live-dot"/> YOUR LEARNING SPACE</span><span>01 / 04</span></div>
          <div className="chalk-note note-one">the cell is getting ready<br/>to divide ✳</div>
          <div className="cell-stage">
            <div className="cell cell-large"><div className="nucleus"><span className="chromosome">X</span><span className="chromosome second">X</span></div><i className="orbit o1"/><i className="orbit o2"/></div>
            <div className="cell-arrow">→</div>
            <div className="cell split-cell"><div className="nucleus small-nuc"/><div className="nucleus small-nuc right-nuc"/></div>
            <div className="diagram-label label-a">parent cell</div><div className="diagram-label label-b">two new cells</div>
            <svg className="scribble" viewBox="0 0 100 42" aria-hidden="true"><path d="M3 35 C27 8, 42 5, 58 17 S83 32, 96 4"/><path d="M85 7 L96 4 L94 15"/></svg>
          </div>
          <div className="sticky-note"><span className="sticky-pin"/><span className="tiny-label">YOUR EXPLANATION</span><p>“The cell makes a copy of its DNA so both new cells get the instructions…”</p><span className="note-time">just now · keep going</span></div>
          <div className="coach-card"><div className="coach-head"><span className="coach-avatar"><Sparkles size={14}/></span><span>Curious question</span><span className="coach-dots">•••</span></div><p>Why does the DNA need to copy itself before the cell divides?</p><div className="coach-hint">Take a moment to think it through <span>↗</span></div></div>
          <span className="hero-hand-scribble" aria-hidden="true">hmm… ∿ why?</span>
          <div className="art-caption"><span>EXPLAIN IT. SEE WHAT YOU KNOW.</span><span className="caption-line"/></div>
          <span className="art-sun">✳</span>
        </div>
        <div className="hero-bottom"><span>LEARNING THAT STAYS WITH YOU</span><span className="bottom-stroke"/><span>01 — A LITTLE MORE UNDERSTANDING</span></div>
      </section>

      <section className="problem section-pad" id="why">
        <div className="shell problem-inner"><div className="section-kicker"><span>THE STUDYING PARADOX</span><span>02 — 05</span></div><div className="problem-grid"><h2>Recognizing an answer<br/>isn’t the same as <em>understanding it.</em></h2><p className="problem-intro">It’s easy to feel like you know something when the notes are open. The real test is what happens when they’re not.</p></div>
          <div className="moments"><article><span className="moment-num">01</span><div className="moment-icon icon-coral"><BookOpen size={21}/></div><p>You read the explanation and think, <em>“That makes sense.”</em></p><span className="moment-foot">UNTIL YOU TRY TO SAY IT YOURSELF</span></article><article><span className="moment-num">02</span><div className="moment-icon icon-blue"><ArrowDown size={21}/></div><p>You follow every step, then get stuck on a new problem.</p><span className="moment-foot">FAMILIAR ISN’T THE SAME AS FLUENT</span></article><article><span className="moment-num">03</span><div className="moment-icon icon-yellow"><Sparkles size={21}/></div><p>You memorize it for Friday. By Monday, it’s already fuzzy.</p><span className="moment-foot">LEARNING DESERVES TO LAST</span></article></div>
          <div className="kind-note"><span>↳</span> This isn’t a test of what you don’t know. It’s a way to notice what you’re ready to learn next.</div>
        </div>
      </section>

      <section className="approach section-pad" id="approach"><div className="shell"><div className="section-kicker light"><span>A SMALL SHIFT, A BIG DIFFERENCE</span><span>03 — 05</span></div><div className="approach-head"><h2>What if <em>you</em><br/>were the teacher?</h2><p>When you explain an idea, you find out what’s really there. CONCAT gives your thinking room to grow—with questions that help you get there yourself.</p></div><div className="steps">{steps.map(({number,title,text,icon:Icon})=><article className="step" key={title}><div className="step-top"><span>{number}</span><Icon size={20}/></div><h3>{title}</h3><p>{text}</p></article>)}</div><div className="approach-foot"><span className="loop-mark">↗</span><span>A learning loop that starts with what you know<br/>and takes you somewhere new.</span><a href="#experience">See it in action <ArrowRight size={15}/></a></div></div></section>

      <section className="modes section-pad" id="modes"><div className="shell"><div className="section-kicker"><span>FIND YOUR WAY IN</span><span>04 — 05</span></div><div className="modes-head"><h2>Two ways to learn.<br/><em>One deeper understanding.</em></h2><p>Choose the kind of thinking that fits what you’re working on today.</p></div><div className="mode-cards"><article className="mode-card concept"><div className="mode-meta"><span>01 / CONCEPT MODE</span><span className="mode-star">✳</span></div><div className="concept-graphic"><div className="bubble bubble-a">the big<br/>picture</div><div className="bubble bubble-b">your<br/>words</div><div className="bubble bubble-c">new<br/>connections</div><span className="bubble-center">ideas<br/>connect</span></div><h3>Understand<br/>the bigger picture.</h3><p>Teach a concept in your own words. Connect ideas across biology, history, literature, economics, and more.</p><Link href="/learn?mode=concept">Explore Concept Mode <ArrowRight size={15}/></Link></article><article className="mode-card practice"><div className="mode-meta"><span>02 / PRACTICE MODE</span><span className="mode-star">↗</span></div><div className="practice-graphic"><span className="equation">3x + 7 = 22</span><span className="equation-line"/><span className="equation-step">3x = 15</span><span className="why-tag">why subtract 7?</span><span className="equation-line short"/><span className="equation-step answer">x = 5 <i>because…</i></span><span className="practice-scribble">show your<br/>thinking ↗</span></div><h3>Understand<br/>every step.</h3><p>Walk through a problem while you explain the why. Build confidence in math, physics, chemistry, and more.</p><Link href="/learn?mode=practice">Explore Practice Mode <ArrowRight size={15}/></Link></article></div></div></section>

      <section className="demo section-pad" id="experience"><div className="shell demo-shell"><div className="demo-copy"><div className="section-kicker"><span>A MOMENT WITH CONCAT</span><span>05 — 05</span></div><span className="demo-label"><span className="live-dot"/> A CONCEPT MODE SESSION</span><h2>Understanding<br/>starts with <em>a why.</em></h2><p>Try a little teach-back. See how one thoughtful question can help you find the next piece of your understanding.</p><a className="demo-entry-link" href="#demo-card">Try the interactive demo <ArrowRight size={17}/></a><span className="demo-disclaimer">A preview of the learning experience</span></div><MarketingDemo/><div className="demo-sparkle">✳</div></div></section>

      <section className="recall"><div className="shell recall-inner"><div className="recall-copy"><span className="tiny-label">YOUR RECALL QUEUE</span><h2>Pick up where a previous chat left off.</h2><p>Save a topic from any chat to your Recall queue. Come back later to replay the idea with a fresh prompt and see what you remember.</p><Link className="recall-link" href="/recall">Explore your Recall queue <ArrowUpRight size={16}/></Link></div><ol className="recall-flow" aria-label="How to revisit a previous chat topic"><li><span>01</span><strong>Previous chat</strong><small>Save an idea</small></li><li className="recall-flow-arrow" aria-hidden="true">→</li><li><span>02</span><strong>Recall queue</strong><small>Pick it back up</small></li><li className="recall-flow-arrow" aria-hidden="true">→</li><li><span>03</span><strong>Fresh prompt</strong><small>Try it in a new way</small></li></ol></div></section>

      <section className="audience section-pad"><div className="shell"><div className="section-kicker"><span>MADE FOR THE WAY YOU LEARN</span><span>FOR EVERY KIND OF CURIOUS</span></div><div className="audience-head"><h2>Wherever you are,<br/><em>start from there.</em></h2><p>You don’t have to have it all figured out. Just bring what you know.</p></div><div className="audience-cards">{audiences.map(a=><article className={`audience-card ${a.tint}`} key={a.label}><span>{a.label}</span><h3>{a.quote}</h3><p>{a.detail}</p><span className="card-arrow">↗</span></article>)}</div><div className="educator-strip" id="educators"><div className="educator-icon" aria-hidden="true"><Brain size={27}/><svg className="educator-circuit" viewBox="0 0 54 54"><path d="M35 12h8v7h7M38 27h12M35 41h8v-7h7"/><circle cx="50" cy="19" r="1.6"/><circle cx="50" cy="27" r="1.6"/><circle cx="50" cy="34" r="1.6"/></svg></div><div><span>FOR EDUCATORS</span><h3>Make room for students to show their thinking.</h3><p>Bring teach-back exercises and structured oral exam practice into the learning experience.</p></div><a href="mailto:hello@concat.study?subject=Educator%20pilot">Explore an educator pilot <ArrowUpRight size={15}/></a></div></div></section>

      <section className="final-cta"><div className="shell final-inner"><span className="final-spark">✳</span><span className="eyebrow">YOUR NEXT STUDY SESSION</span><h2>Could feel<br/><em>a little different.</em></h2><p>Stop measuring how much you’ve read.<br/>Start discovering how much you understand.</p><Link className="button button-light" href="/learn">Start learning with CONCAT <ArrowRight size={16}/></Link><span className="final-foot">No perfect answers required. Just your own words.</span></div></section>

      <footer className="footer"><div className="shell footer-inner"><a className="wordmark" href="#top"><span className="brand-symbol">c<span>.</span></span> concat</a><span>Not another answer. A better understanding.</span><div><a href="#approach">Our approach</a><a href="#educators">For educators</a><a href="mailto:hello@concat.study">Say hello ↗</a></div><span className="copyright">© 2026 CONCAT</span></div></footer>
    </main>
  );
}
