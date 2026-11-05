"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowUp, Check, CircleHelp, Copy, MoreHorizontal, PenLine, RotateCcw, Share2, Sparkles, Users } from "lucide-react";
import type { Editor } from "tldraw";
import { WhiteboardCanvas } from "@/components/whiteboard/canvas";

type Mode = "concept" | "practice";
type Phase = "teach" | "apply" | "reflect";
type Message = { role: "user" | "assistant"; content: string };
type Knowledge = {
  topic: string;
  definedTerms: { term: string; definition: string }[];
  statedRulesOrSteps: string[];
  statedReasoning: { claim: string; justification: string }[];
  explicitAssumptions: string[];
  explicitComparisons: { comparedTo: string; distinction: string }[];
};
type Evaluation =
  | { hasGap: false; summary: string }
  | { hasGap: true; gapType: string; locationInTranscript: string; explanation: string; suggestedReframingQuestion: string };
type RecallItem = { id: string; topic: string; note: string; savedAt: string; nextReviewAt: string; reviewCount: number };

const recallStorageKey = "concat:spaced-recall:v1";

async function readStream(payload: Record<string, unknown>, onChunk: (text: string) => void, signal?: AbortSignal) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || "CONCAT could not respond. Try again in a moment.");
  }
  if (!response.body) throw new Error("The response stream was unavailable. Please try again.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onChunk(text);
  }
  text += decoder.decode();
  if (!text.trim()) {
    throw new Error("Meta Muse returned no visible response. Please try again.");
  }
  onChunk(text);
  return text;
}

async function readJson<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "CONCAT could not complete this step. Try again.");
  return result as T;
}

export default function LearnPage() {
  const [roomId, setRoomId] = useState("");
  const [mode, setMode] = useState<Mode>("concept");
  const [phase, setPhase] = useState<Phase>("teach");
  const [topic, setTopic] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [knowledge, setKnowledge] = useState<Knowledge | null>(null);
  const [testQuestion, setTestQuestion] = useState("");
  const [testAttempt, setTestAttempt] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedForRecall, setSavedForRecall] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [boardStatus, setBoardStatus] = useState<"idle" | "waiting" | "thinking">("idle");
  const [boardReplyPreview, setBoardReplyPreview] = useState("");
  const [boardEditor, setBoardEditor] = useState<Editor | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const boardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardAbortRef = useRef<AbortController | null>(null);
  const boardRevisionRef = useRef(0);
  const boardReviewHandlerRef = useRef<(revision: number) => void>(() => {});
  const modeRef = useRef(mode);
  const phaseRef = useRef(phase);
  const topicRef = useRef(topic);
  const messagesRef = useRef(messages);
  const isLoadingRef = useRef(isLoading);

  useEffect(() => {
    modeRef.current = mode;
    phaseRef.current = phase;
    topicRef.current = topic;
    messagesRef.current = messages;
    isLoadingRef.current = isLoading;
  }, [mode, phase, topic, messages, isLoading]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const sharedRoom = url.searchParams.get("room");
    const validRoom = sharedRoom && /^[a-zA-Z0-9_-]{8,80}$/.test(sharedRoom);
    const room = validRoom ? sharedRoom : `concat-${crypto.randomUUID()}`;
    const initialMode = url.searchParams.get("mode");
    const initialTopic = url.searchParams.get("topic");
    setRoomId(room);
    if (initialMode === "practice") setMode("practice");
    if (initialTopic) setTopic(initialTopic.slice(0, 120));
    if (!validRoom) {
      url.searchParams.set("room", room);
      window.history.replaceState({}, "", url);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, boardReplyPreview]);

  function cancelBoardReview() {
    boardRevisionRef.current += 1;
    if (boardTimerRef.current) clearTimeout(boardTimerRef.current);
    boardTimerRef.current = null;
    boardAbortRef.current?.abort();
    boardAbortRef.current = null;
    setBoardReplyPreview("");
    setBoardStatus("idle");
  }

  useEffect(() => {
    if (!boardEditor) return;
    const unsubscribe = boardEditor.store.listen(() => {
      if (phaseRef.current !== "teach") return;
      boardRevisionRef.current += 1;
      boardAbortRef.current?.abort();
      boardAbortRef.current = null;
      setBoardReplyPreview("");
      setBoardStatus("waiting");
      if (boardTimerRef.current) clearTimeout(boardTimerRef.current);
      boardTimerRef.current = setTimeout(() => {
        boardTimerRef.current = null;
        boardReviewHandlerRef.current(boardRevisionRef.current);
      }, 7000);
    }, { source: "user", scope: "document" });

    return () => {
      unsubscribe();
      if (boardTimerRef.current) clearTimeout(boardTimerRef.current);
      boardAbortRef.current?.abort();
    };
  }, [boardEditor]);

  useEffect(() => {
    boardReviewHandlerRef.current = async (revision) => {
      if (revision !== boardRevisionRef.current || phaseRef.current !== "teach") return;
      if (isLoadingRef.current) {
        boardTimerRef.current = setTimeout(() => {
          boardTimerRef.current = null;
          boardReviewHandlerRef.current(revision);
        }, 1200);
        return;
      }

      const editor = editorRef.current;
      if (!editor || editor.getCurrentPageShapes().length === 0) {
        setBoardStatus("idle");
        return;
      }

      const controller = new AbortController();
      boardAbortRef.current = controller;
      setBoardStatus("thinking");
      setBoardReplyPreview("");
      try {
        const image = await editor.toImageDataUrl(editor.getCurrentPageShapes(), {
          format: "jpeg", quality: 0.72, pixelRatio: 1, background: true,
        });
        if (revision !== boardRevisionRef.current || controller.signal.aborted) return;

        const transcript = messagesRef.current
          .map((message) => `${message.role === "user" ? "Student" : "CONCAT"}: ${message.content}`)
          .join("\n\n")
          .slice(-20_000);
        let reply = "";
        await readStream({
          action: "board-coach",
          mode: modeRef.current,
          topic: topicRef.current,
          transcript,
          boardImage: image.url,
        }, (text) => {
          reply = text;
          if (revision === boardRevisionRef.current) setBoardReplyPreview(text);
        }, controller.signal);

        if (revision === boardRevisionRef.current && reply.trim()) {
          setMessages((current) => [...current, { role: "assistant", content: reply.trim() }]);
          setBoardReplyPreview("");
          setBoardStatus("idle");
        } else if (revision === boardRevisionRef.current) {
          setBoardReplyPreview("");
          setBoardStatus("idle");
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "CONCAT could not review the whiteboard.");
        setBoardReplyPreview("");
        setBoardStatus("idle");
      } finally {
        if (boardAbortRef.current === controller) boardAbortRef.current = null;
      }
    };
  }, []);

  function changeMode(nextMode: Mode) {
    if (mode === nextMode || isLoading) return;
    cancelBoardReview();
    setMode(nextMode);
    setMessages([]);
    setKnowledge(null);
    setTestQuestion("");
    setTestAttempt("");
    setEvaluation(null);
    setPhase("teach");
    setSavedForRecall(false);
    setSaveMessage("");
    setError("");
    const url = new URL(window.location.href);
    url.searchParams.set("mode", nextMode);
    window.history.replaceState({}, "", url);
  }

  async function beginApplication() {
    const boardHasContent = Boolean(editorRef.current?.getCurrentPageShapes().length);
    if ((messages.length === 0 && !boardHasContent) || isLoading) return;
    cancelBoardReview();
    setIsLoading(true);
    isLoadingRef.current = true;
    setError("");
    setPhase("apply");
    try {
      const transcript = messages
        .filter((message) => message.role === "user")
        .map((message) => `Student: ${message.content}`)
        .join("\n\n")
        .slice(-20_000) || "The student has not provided a typed explanation; use only legible whiteboard content.";
      const boardImage = await getBoardImage();
      const extracted = await readJson<{ knowledge: Knowledge }>({ action: "extract", mode, topic, transcript, boardImage });
      setKnowledge(extracted.knowledge);

      const question = await readStream(
        { action: "scenario", mode, knowledge: extracted.knowledge },
        (text) => setTestQuestion(text),
      );
      setTestQuestion(question);
      setMessages((current) => [...current, { role: "assistant", content: question }]);
    } catch (cause) {
      setPhase("teach");
      setError(cause instanceof Error ? cause.message : "CONCAT could not prepare a fresh scenario.");
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isLoading) return;
    cancelBoardReview();

    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    setError("");
    setIsLoading(true);
    isLoadingRef.current = true;

    try {
      if (phase === "apply") {
        if (!knowledge || !testQuestion) throw new Error("The application question is not ready yet.");
        setTestAttempt(content);
        const result = await readJson<{ evaluation: Evaluation }>({
          action: "evaluate", mode, knowledge, question: testQuestion, attempt: content,
        });
        setEvaluation(result.evaluation);
        const reflection = result.evaluation.hasGap
          ? result.evaluation.explanation
          : result.evaluation.summary;
        setMessages([...nextMessages, { role: "assistant", content: reflection }]);
        setPhase("reflect");
      } else {
        let answer = "";
        const fullMessages = [...nextMessages];
        const boardImage = await getBoardImage();
        await readStream({ action: "teach", mode, topic, messages: fullMessages, boardImage }, (text) => {
          answer = text;
          setMessages([...fullMessages, { role: "assistant", content: text }]);
        });
      }
    } catch (cause) {
      setMessages(messages);
      setDraft(content);
      setError(cause instanceof Error ? cause.message : "CONCAT could not respond. Try again in a moment.");
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }

  async function getBoardImage() {
    const editor = editorRef.current;
    if (!editor || editor.getCurrentPageShapes().length === 0) return undefined;
    try {
      const image = await editor.toImageDataUrl(editor.getCurrentPageShapes(), {
        format: "jpeg",
        quality: 0.72,
        pixelRatio: 1,
        background: true,
      });
      return image.url;
    } catch {
      setError("I couldn’t capture the whiteboard this time. Your written explanation will still be sent.");
      return undefined;
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("Your browser blocked clipboard access. Copy the room URL from the address bar instead.");
    }
  }

  function saveToRecall() {
    if (!knowledge || !evaluation) return;
    const label = topic.trim() || knowledge.topic.trim() || "Concept from this session";
      const now = new Date();
    try {
      const existing = JSON.parse(localStorage.getItem(recallStorageKey) || "[]") as RecallItem[];
      const normalized = label.toLowerCase();
      const previousIndex = existing.findIndex((item) => item.topic.toLowerCase() === normalized);
      const reviewCount = previousIndex >= 0 ? existing[previousIndex].reviewCount + 1 : 0;
      const reviewIntervals = [1, 3, 7, 14, 30];
      const nextReview = new Date(now.getTime() + reviewIntervals[Math.min(reviewCount, reviewIntervals.length - 1)] * 24 * 60 * 60 * 1000);
      const saved: RecallItem = {
        id: previousIndex >= 0 ? existing[previousIndex].id : crypto.randomUUID(),
        topic: label,
        note: evaluation.hasGap ? evaluation.explanation : "Try applying this concept in a different situation.",
        savedAt: now.toISOString(),
        nextReviewAt: nextReview.toISOString(),
        reviewCount,
      };
      if (previousIndex >= 0) existing[previousIndex] = saved;
      else existing.unshift(saved);
      localStorage.setItem(recallStorageKey, JSON.stringify(existing.slice(0, 40)));
      setSavedForRecall(true);
      setSaveMessage("Added to your recall queue. You’ll get a fresh prompt next time.");
    } catch {
      setSaveMessage("This browser couldn’t save the recall item. Check that local storage is enabled.");
    }
  }

  function startAnother() {
    cancelBoardReview();
    setPhase("teach");
    setMessages([]);
    setKnowledge(null);
    setTestQuestion("");
    setTestAttempt("");
    setEvaluation(null);
    setDraft("");
    setError("");
    setSavedForRecall(false);
    setSaveMessage("");
  }

  const prompt = phase === "apply"
    ? "Explain your reasoning in this new scenario…"
    : mode === "concept" ? "Teach me what you know…" : "Explain your first step…";

  return (
    <main className="learn-page">
      <header className="learn-topbar">
        <div className="learn-topbar-left">
          <Link className="learn-back" href="/" aria-label="Back to CONCAT home"><ArrowLeft size={17}/></Link>
          <Link className="wordmark learn-wordmark" href="/"><span className="brand-symbol">c<span>.</span></span> CONCAT</Link>
          <span className="topbar-divider"/>
          <span className="workspace-name">Learning space</span>
        </div>
        <div className="learn-topbar-actions">
          <Link className="recall-nav" href="/recall">Recall queue</Link>
          <div className="room-presence"><span className="room-live-dot"/><Users size={14}/><span>Shared room</span></div>
          <button className={`share-room-button${copied ? " is-copied" : ""}`} onClick={copyInvite}><Share2 size={14}/>{copied ? <><Check size={14}/> Link copied</> : <>Share room <Copy size={13}/></>}</button>
          <button className="learn-more" aria-label="More session options"><MoreHorizontal size={19}/></button>
        </div>
      </header>

      <section className="learn-main">
        <div className="learn-heading-row">
          <div>
            <div className="learn-overline"><span>YOUR LEARNING SPACE</span><span className="overline-dot"/> ROOM {roomId ? roomId.slice(-6).toUpperCase() : "······"}</div>
            <input className="topic-title" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="What are you learning today?" aria-label="Session topic"/>
            <p className="learn-subtitle">A place to think out loud, sketch it through, and follow the why.</p>
          </div>
          <div className="mode-toggle" role="tablist" aria-label="Learning mode">
            <button className={mode === "concept" ? "active" : ""} onClick={() => changeMode("concept")} role="tab" aria-selected={mode === "concept"}><Sparkles size={15}/> Concept</button>
            <button className={mode === "practice" ? "active" : ""} onClick={() => changeMode("practice")} role="tab" aria-selected={mode === "practice"}><PenLine size={15}/> Practice</button>
          </div>
        </div>

        <nav className="learning-steps" aria-label="Session progress">
          {(["teach", "apply", "reflect"] as Phase[]).map((step, index) => {
            const available = step === "teach" || (step === "apply" && Boolean(knowledge && testQuestion)) || (step === "reflect" && Boolean(evaluation));
            const currentIndex = phase === "teach" ? 0 : phase === "apply" ? 1 : 2;
            const done = index < currentIndex;
            return <button className={`learning-step${phase === step ? " current" : ""}${done ? " complete" : ""}`} key={step} disabled={!available || isLoading} onClick={() => available && setPhase(step)}><span>{done ? <Check size={13}/> : index + 1}</span>{step === "teach" ? "Teach" : step === "apply" ? "Apply" : "Reflect"}</button>;
          })}
          {phase === "teach" && (messages.some((message) => message.role === "user") || Boolean(editorRef.current?.getCurrentPageShapes().length)) && <button className="begin-application" onClick={beginApplication} disabled={isLoading}>{isLoading ? "Preparing your question…" : <>Test what you’ve taught <CircleHelp size={14}/></>}</button>}
          {phase === "reflect" && <button className="begin-application" onClick={startAnother}><RotateCcw size={13}/> Teach another idea</button>}
        </nav>

        <div className="learning-workspace">
          <section className="board-panel" aria-label="Shared whiteboard">
            <div className="panel-heading">
              <div className="panel-title-group"><span className="panel-icon board-icon"><PenLine size={16}/></span><div><h2>Shared whiteboard</h2><p>Sketch an idea or work through a step</p></div></div>
              <div className="board-room-pill"><span className="room-live-dot"/> Room link active</div>
            </div>
            <div className="board-stage">
              {roomId ? <WhiteboardCanvas roomId={roomId} onEditorMount={(editor) => { editorRef.current = editor; setBoardEditor(editor); }}/> : <div className="board-loading"><span className="loading-spinner"/> Preparing your room…</div>}
            </div>
            <div className="board-foot"><span><Users size={13}/> Changes sync for everyone with this room link</span><span className={`board-coach-status ${boardStatus}`} aria-live="polite">{boardStatus === "waiting" ? "I’ll review after 7 seconds of quiet" : boardStatus === "thinking" ? "Reading your board…" : "CONCAT reviews your board as you work"}</span></div>
          </section>

          <aside className="coach-panel" aria-label="Learning conversation">
            <div className="coach-panel-header"><div className="coach-panel-brand"><div><h2>CONCAT</h2><span>Your curious study partner</span></div></div></div>
            <div className="coach-mode-note"><span>{phase === "teach" ? mode === "concept" ? "Teach me the big picture in your own words." : "Walk me through each step and why it works." : phase === "apply" ? "Try a new situation using what you taught." : "A short look at the evidence from this session."}</span></div>

            {phase === "reflect" && evaluation && knowledge ? <Debrief evaluation={evaluation} knowledge={knowledge} topic={topic} question={testQuestion} attempt={testAttempt} saved={savedForRecall} saveMessage={saveMessage} onSave={saveToRecall}/> : <div className="conversation" aria-live="polite">
              <div className="conversation-date">{phase === "teach" ? "START WHERE YOU ARE" : "A FRESH APPLICATION"}</div>
              {messages.length === 0 && <div className="coach-message assistant-message"><div className="message-content"><span className="message-author">CONCAT <i>· learning with you</i></span><p>Hey, what are you working on? Start by teaching me what you know so far. I’ll ask questions when I get curious.</p></div></div>}
              {messages.map((message, index) => (
                <div className={`coach-message ${message.role === "user" ? "user-message" : "assistant-message"}`} key={`${index}-${message.role}`}>
                  <div className="message-content"><span className="message-author">{message.role === "user" ? "YOU" : "CONCAT"}{message.role === "assistant" && <i> · curious</i>}</span><p>{message.content || <span className="typing-dots"><i/><i/><i/></span>}</p></div>
                </div>
              ))}
              {boardReplyPreview && <div className="coach-message assistant-message board-reply-preview"><div className="message-content"><span className="message-author">CONCAT <i>· looking at your board</i></span><p>{boardReplyPreview}</p></div></div>}
              {isLoading && phase === "apply" && <div className="workspace-loading"><span className="loading-spinner"/>{testQuestion ? "Looking at the reasoning in your answer…" : "Finding a fresh way to apply your idea…"}</div>}
              <div ref={bottomRef}/>
            </div>}

            {phase !== "reflect" && <form className="composer" onSubmit={sendMessage}>
              {error && <div className="composer-error" role="alert">{error}</div>}
              <label className="sr-only" htmlFor="learning-message">Your explanation</label>
              <textarea id="learning-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={phase === "apply" && !testQuestion ? "Preparing your question…" : prompt} rows={3} disabled={isLoading || (phase === "apply" && !testQuestion)}/>
              <div className="composer-tools"><span>Shift + Enter for a new line</span><button type="submit" aria-label={phase === "apply" ? "Submit application" : "Send explanation"} disabled={!draft.trim() || isLoading || (phase === "apply" && !testQuestion)}>{isLoading ? <span className="send-spinner"/> : "Send"}</button></div>
            </form>}
            <p className="coach-panel-foot">{phase === "reflect" ? "Evidence is a snapshot of this session, not a permanent score." : "Your ideas stay yours. Start with a rough explanation."}</p>
          </aside>
        </div>
        <p className="room-note">Anyone with this room link can edit the board. This prototype room is temporary and clears after about a day.</p>
      </section>
    </main>
  );
}

function Debrief({ evaluation, knowledge, topic, question, attempt, saved, saveMessage, onSave }: {
  evaluation: Evaluation;
  knowledge: Knowledge;
  topic: string;
  question: string;
  attempt: string;
  saved: boolean;
  saveMessage: string;
  onSave: () => void;
}) {
  const depthSignals = [
    { label: "Assumption checks", detail: `${knowledge.explicitAssumptions.length} explicitly examined`, status: knowledge.explicitAssumptions.length ? "Evidence heard" : "Not yet heard" },
    { label: "Concept connections", detail: `${knowledge.explicitComparisons.length} comparison${knowledge.explicitComparisons.length === 1 ? "" : "s"} captured`, status: knowledge.explicitComparisons.length ? "Evidence heard" : "Try making a connection" },
    { label: "Application", detail: evaluation.hasGap ? "A new scenario surfaced a useful next step." : "Your taught idea held up in this scenario.", status: evaluation.hasGap ? "Next to practise" : "Evidence heard" },
  ];
  const matrix = [
    { label: "Recognition", status: "Not checked here" },
    { label: "Recall", status: knowledge.definedTerms.length || knowledge.statedRulesOrSteps.length ? "Evidence in your explanation" : "Not yet heard" },
    { label: "Explanation", status: knowledge.statedReasoning.length ? "Evidence in your explanation" : "Try explaining a why" },
    { label: "Connection", status: knowledge.explicitComparisons.length ? "Evidence in your explanation" : "Try linking two ideas" },
    { label: "Application", status: evaluation.hasGap ? "Next to practise" : "Evidence in this scenario" },
  ];
  return (
    <div className="debrief-content">
      <div className="debrief-attempt"><span className="debrief-kicker">THE FRESH SCENARIO</span><p>{question}</p><span className="debrief-kicker attempt-kicker">YOUR EXPLANATION</span><p className="attempt-text">{attempt}</p></div>
      <div className={`debrief-result${evaluation.hasGap ? " has-next-step" : " has-strength"}`}><span className="debrief-result-icon">{evaluation.hasGap ? <CircleHelp size={16}/> : <Check size={16}/>}</span><div><span className="debrief-kicker">SESSION REFLECTION</span><p>{evaluation.hasGap ? evaluation.explanation : evaluation.summary}</p></div></div>
      {evaluation.hasGap && <div className="guiding-question"><span>ONE QUESTION TO TAKE WITH YOU</span><p>{evaluation.suggestedReframingQuestion}</p></div>}
      <section className="debrief-section"><div className="debrief-section-heading"><div><span className="debrief-kicker">DEPTH SIGNALS</span><h3>What your explanation showed</h3></div><span className="evidence-tag">From this session</span></div><div className="depth-signal-list">{depthSignals.map((signal) => <article className="depth-signal" key={signal.label}><span className="signal-mark"/><div><strong>{signal.label}</strong><p>{signal.detail}</p></div><span className={`signal-state${signal.status === "Evidence heard" ? " heard" : " revisit"}`}>{signal.status}</span></article>)}</div></section>
      <section className="debrief-section fluency-section"><div className="debrief-section-heading"><div><span className="debrief-kicker">FLUENCY GAP MATRIX</span><h3>Five ways understanding grows</h3></div></div><p className="matrix-intro">This is evidence we heard, not a grade. “Not yet heard” simply points to a useful next question.</p><div className="fluency-matrix">{matrix.map((item, index) => <article className="fluency-cell" key={item.label}><span className="fluency-index">0{index + 1}</span><strong>{item.label}</strong><span className={`fluency-status${item.status.includes("Evidence") ? " heard" : item.status === "Not checked here" ? " neutral" : " revisit"}`}>{item.status}</span></article>)}</div></section>
      <div className="recall-save-card"><div><span className="debrief-kicker">KEEP IT IN REACH</span><h3>Revisit {topic.trim() || knowledge.topic || "this idea"} later</h3><p>We’ll bring it back with a fresh question, not the same flashcard.</p></div><button className="save-recall-button" onClick={onSave} disabled={saved}>{saved ? <><Check size={14}/> Saved for later</> : <>Add to recall queue <ArrowUp size={14}/></>}</button></div>
      {saveMessage && <p className="save-feedback" role="status">{saveMessage} {saved && <Link href="/recall">Open recall queue</Link>}</p>}
    </div>
  );
}
