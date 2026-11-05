"use client";

import { useState, type FormEvent } from "react";

const prompts = {
  concept: {
    topic: "How do plants turn sunlight into food?",
    student: "Plants take in sunlight and use it to turn water and carbon dioxide into sugar. The leaves are where most of it happens.",
    question: "Nice start. You mentioned the ingredients. What role do you think sunlight plays in changing them into sugar?",
    prompt: "Teach me the big picture in your own words.",
    placeholder: "Try explaining the “why” in your own words…",
  },
  practice: {
    topic: "Solve 3x + 7 = 22",
    student: "I subtract 7 from both sides, so 3x equals 15. Then I divide by 3, which means x is 5.",
    question: "You found x. Why does subtracting 7 from both sides keep the equation balanced?",
    prompt: "Walk me through each step and why it works.",
    placeholder: "Explain why that step works…",
  },
};

export function MarketingDemo() {
  const [mode, setMode] = useState<"concept" | "practice">("concept");
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [applied, setApplied] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "user", content: prompts.concept.student },
    { role: "assistant", content: prompts.concept.question },
  ]);
  const active = prompts[mode];

  function switchMode(nextMode: "concept" | "practice") {
    setMode(nextMode);
    setAnswer("");
    setSubmitted(false);
    setApplied(false);
    setReply("");
    setError("");
    setMessages([
      { role: "user", content: prompts[nextMode].student },
      { role: "assistant", content: prompts[nextMode].question },
    ]);
  }

  async function askMuse(nextMessages: { role: "user" | "assistant"; content: string }[]) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "teach", mode, messages: nextMessages }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error || "Meta Muse could not answer. Please try again.");
    }

    if (!response.body) throw new Error("The response stream was unavailable. Please try again.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
      setReply(result);
    }
    result += decoder.decode();
    setReply(result);
    return result;
  }

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim() || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content: answer.trim() }];
    setMessages(nextMessages);
    setSubmitted(true);
    setReply("");
    setError("");
    setLoading(true);
    try {
      const nextReply = await askMuse(nextMessages);
      setMessages([...nextMessages, { role: "assistant", content: nextReply }]);
    } catch (cause) {
      setMessages(messages);
      setError(cause instanceof Error ? cause.message : "Meta Muse could not answer. Please try again.");
      setSubmitted(false);
    } finally {
      setLoading(false);
    }
  }

  async function askForScenario() {
    if (loading) return;
    const nextMessages = [...messages, {
      role: "user" as const,
      content: "Ask me one concise, new what-if scenario that checks whether I can apply the idea I have been teaching. Ask only the question; do not answer it.",
    }];
    setReply("");
    setError("");
    setLoading(true);
    try {
      const nextReply = await askMuse(nextMessages);
      setMessages([...nextMessages, { role: "assistant", content: nextReply }]);
      setApplied(true);
      setSubmitted(false);
      setAnswer("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Meta Muse could not answer. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="demo-card" id="demo-card">
      <div className="demo-bar"><div className="demo-brand"><strong>CONCAT</strong><span>Your curious study partner</span></div><label><span className="sr-only">Choose a learning mode</span><select aria-label="Choose a learning mode" value={mode} onChange={(event) => switchMode(event.target.value as "concept" | "practice")}><option value="concept">Concept mode</option><option value="practice">Practice mode</option></select></label></div>
      <div className="demo-topic"><span>SESSION TOPIC</span><h3>{active.topic}</h3></div>
      <div className="demo-mode-note">{active.prompt}</div>
      <div className="demo-conversation" aria-live="polite">
        {messages.filter((message) => !message.content.startsWith("Ask me one concise, new what-if scenario")).map((message, index) => (
          <div className={`demo-chat ${message.role === "assistant" ? "coach-chat" : ""}`} key={`${index}-${message.role}`}>
            <div className={`chat-bubble ${message.role === "user" ? "student-bubble" : "ai-bubble"}`}><span>{message.role === "user" ? index === 0 ? "YOU · TEACHING" : "YOU · THINKING IT THROUGH" : `CONCAT · ${applied ? "APPLY" : "CURIOUS"}`}</span><p>{message.content}</p></div>
          </div>
        ))}
        {loading && reply && <div className="demo-chat coach-chat"><div className="chat-bubble ai-bubble"><span>CONCAT · CURIOUS</span><p>{reply}</p></div></div>}
        {loading && !reply && <div className="demo-thinking">CONCAT is thinking…</div>}
      </div>
      {error && <p className="demo-error" role="alert">{error}</p>}
      {!submitted ? <form className="demo-prompt" onSubmit={submitAnswer}><label htmlFor="demo-answer">YOUR TURN</label><div><textarea id="demo-answer" rows={2} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={applied ? "Explain your reasoning in this scenario…" : active.placeholder} disabled={loading}/><button type="submit" disabled={loading || !answer.trim()}>{loading ? "Thinking…" : "Send"}</button></div></form> : <button className="demo-apply" onClick={askForScenario} disabled={loading}>{loading ? "Thinking…" : "Try a new scenario ↗"}</button>}
      <div className="demo-progress"><span>TEACH</span><i/><span className={submitted ? "is-done" : ""}>QUESTION</span><i/><span className={applied ? "is-done" : ""}>APPLY</span><i/><span className={applied && submitted ? "is-done" : ""}>REFLECT</span></div>
    </div>
  );
}
