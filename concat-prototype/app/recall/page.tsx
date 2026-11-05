"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Check, Clock3, Trash2 } from "lucide-react";

type RecallItem = {
  id: string;
  topic: string;
  note: string;
  savedAt: string;
  nextReviewAt: string;
  reviewCount: number;
};

const storageKey = "concat:spaced-recall:v1";

export default function RecallPage() {
  const [items, setItems] = useState<RecallItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem(storageKey) || "[]") as RecallItem[]);
    } catch {
      setItems([]);
    }
    setReady(true);
  }, []);

  function removeItem(id: string) {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  const now = new Date();
  const due = items.filter((item) => new Date(item.nextReviewAt) <= now);
  const upcoming = items.filter((item) => new Date(item.nextReviewAt) > now);

  return (
    <main className="recall-page">
      <header className="recall-topbar"><Link className="learn-back" href="/learn" aria-label="Back to learning space"><ArrowLeft size={17}/></Link><Link className="wordmark learn-wordmark" href="/"><span className="brand-symbol">c<span>.</span></span> concat</Link><span className="recall-topbar-divider"/><span>Recall queue</span><Link className="recall-return" href="/learn">Back to learning <ArrowUpRight size={14}/></Link></header>
      <section className="recall-dashboard">
        <div className="recall-hero"><span className="recall-eyebrow"><CalendarDays size={14}/> SPACED CONCEPT RECALL</span><h1>Bring an idea<br/><em>back around.</em></h1><p>Revisit what felt tricky with a fresh scenario. A little retrieval now can help the idea stay with you.</p><Link className="button button-dark" href="/learn">Start a learning session <ArrowUpRight size={15}/></Link></div>

        {!ready ? <div className="recall-empty"><span className="loading-spinner"/><p>Loading your recall queue…</p></div> : items.length === 0 ? <div className="recall-empty"><span className="recall-empty-icon"><BookOpen size={23}/></span><h2>Your queue starts with a question.</h2><p>After a learning session, save an idea you want to revisit. CONCAT will bring it back in a new context.</p><Link href="/learn">Go to your learning space <ArrowUpRight size={14}/></Link></div> : <div className="recall-queue">
          {due.length > 0 && <section className="queue-section"><div className="queue-heading"><div><span className="debrief-kicker">READY WHEN YOU ARE</span><h2>Ready to revisit <span>{due.length}</span></h2></div><span className="queue-note"><Clock3 size={13}/> No rush. Pick one.</span></div><div className="recall-cards">{due.map((item) => <RecallCard key={item.id} item={item} onRemove={removeItem}/>)}</div></section>}
          {upcoming.length > 0 && <section className="queue-section upcoming-section"><div className="queue-heading"><div><span className="debrief-kicker">COMING UP</span><h2>Ideas to return to</h2></div><span className="queue-note">{upcoming.length} saved concept{upcoming.length === 1 ? "" : "s"}</span></div><div className="recall-cards">{upcoming.map((item) => <RecallCard key={item.id} item={item} onRemove={removeItem}/>)}</div></section>}
        </div>}
        <p className="recall-storage-note">Your queue is saved in this browser on this device.</p>
      </section>
    </main>
  );
}

function RecallCard({ item, onRemove }: { item: RecallItem; onRemove: (id: string) => void }) {
  const due = new Date(item.nextReviewAt) <= new Date();
  const reviewUrl = `/learn?mode=concept&topic=${encodeURIComponent(item.topic)}`;
  return (
    <article className="recall-card">
      <div className="recall-card-top"><span className={`recall-due${due ? " is-due" : ""}`}>{due ? <><span className="room-live-dot"/> Ready to revisit</> : <><Clock3 size={12}/> {new Date(item.nextReviewAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</>}</span><button aria-label={`Remove ${item.topic} from recall queue`} onClick={() => onRemove(item.id)}><Trash2 size={14}/></button></div>
      <h3>{item.topic}</h3><p className="recall-card-note">{item.note}</p>
      <div className="recall-card-bottom"><span>{item.reviewCount > 0 ? <><Check size={12}/> Revisited {item.reviewCount} time{item.reviewCount === 1 ? "" : "s"}</> : "Saved from your debrief"}</span><Link href={reviewUrl}>Start a fresh recall <ArrowUpRight size={13}/></Link></div>
    </article>
  );
}
