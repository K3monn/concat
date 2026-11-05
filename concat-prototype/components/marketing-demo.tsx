"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, ChevronDown, Sparkles } from "lucide-react";

const prompts = {
  concept: {
    topic: "How do plants turn sunlight into food?",
    student: "Plants take in sunlight and use it to turn water and carbon dioxide into sugar. The leaves are where most of it happens.",
    question: "Nice start. You mentioned the ingredients. What role do you think sunlight plays in changing them into sugar?",
    placeholder: "Try explaining the “why” in your own words…",
  },
  practice: {
    topic: "Solve 3x + 7 = 22",
    student: "I subtract 7 from both sides, so 3x equals 15. Then I divide by 3, which means x is 5.",
    question: "You found x. Why does subtracting 7 from both sides keep the equation balanced?",
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
      <div className="demo-bar"><span><span className="demo-dot"/> YOUR SESSION</span><label> <select aria-label="Choose a learning mode" value={mode} onChange={(event) => switchMode(event.target.value as "concept" | "practice")}><option value="concept">CONCEPT MODE</option><option value="practice">PRACTICE MODE</option></select><ChevronDown size={13}/></label></div>
      <div className="demo-topic"><span>LET’S EXPLORE</span><h3>{active.topic}</h3></div>
      <div className="demo-chat"><div className="chat-avatar student-avatar">Y</div><div className="chat-bubble student-bubble"><span>YOU · TEACHING</span><p>{active.student}</p></div></div>
      {!submitted && <div className="demo-chat coach-chat"><div className="chat-avatar ai-avatar"><Sparkles size={14}/></div><div className="chat-bubble ai-bubble"><span>{applied ? "CONCAT · APPLY" : "CONCAT · CURIOUS"}</span><p>{applied ? reply : active.question}</p></div></div>}
      {submitted && <>
        <div className="demo-chat"><div className="chat-avatar student-avatar">Y</div><div className="chat-bubble student-bubble"><span>YOU · THINKING IT THROUGH</span><p>{answer}</p></div></div>
        <div className="demo-chat coach-chat"><div className="chat-avatar ai-avatar"><Sparkles size={14}/></div><div className="chat-bubble ai-bubble"><span>CONCAT · {applied ? "APPLY" : "CURIOUS"}</span><p>{loading ? (reply || "Thinking through your explanation…") : error || reply}</p></div></div>
      </>}
      {!submitted ? <form className="demo-prompt" onSubmit={submitAnswer}><label htmlFor="demo-answer">{applied ? "YOUR TURN · APPLY" : "YOUR TURN"}</label><div><input id="demo-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={applied ? "Explain your reasoning in this scenario…" : active.placeholder} disabled={loading}/><button aria-label="Send your explanation" type="submit" disabled={loading || !answer.trim()}><ArrowUpRight size={15}/></button></div>{error && <span className="demo-error">{error}</span>}</form> : <button className="demo-apply" onClick={askForScenario} disabled={loading}><ArrowRight size={14}/>{loading ? "Thinking…" : "Try a new scenario"}</button>}
      <div className="demo-progress"><span>TEACH</span><i/><span className={submitted ? "is-done" : ""}>QUESTION</span><i/><span className={applied ? "is-done" : ""}>APPLY</span><i/><span className={applied && submitted ? "is-done" : ""}>REFLECT</span></div>
    </div>
  );
}
