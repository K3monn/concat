import { NextRequest, NextResponse } from "next/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, generateObject, type ModelMessage } from "ai";
import { z } from "zod";

// -----------------------------------------------------------------------
// Types & Schemas
// -----------------------------------------------------------------------

type Mode = "concept" | "practice";
type Phase = "TEACH" | "TEST";

const taughtKnowledgeSchema = z.object({
  topic: z
    .string()
    .describe("The subject or problem the student was teaching, in their own words."),
  definedTerms: z
    .array(
      z.object({
        term: z.string(),
        definition: z
          .string()
          .describe("The definition exactly as the student gave it."),
      })
    )
    .describe("Terms the student explicitly defined."),
  statedRulesOrSteps: z
    .array(z.string())
    .describe(
      "Ordered steps (practice mode) or stated rules/claims (concept mode), exactly as given."
    ),
  statedReasoning: z
    .array(
      z.object({
        claim: z.string().describe("The step or claim this reasoning justifies."),
        justification: z.string().describe("The 'why' the student gave for it."),
      })
    )
    .describe("Only reasoning the student actually voiced — not reasoning that seems implied."),
  explicitAssumptions: z
    .array(z.string())
    .describe("Only assumptions the student explicitly named and examined; do not infer unstated assumptions."),
  explicitComparisons: z
    .array(
      z.object({
        comparedTo: z.string(),
        distinction: z.string(),
      })
    )
    .describe("Comparisons the student explicitly drew to other concepts (concept mode especially)."),
});

type TaughtKnowledge = z.infer<typeof taughtKnowledgeSchema>;

const gapEvaluationSchema = z.discriminatedUnion("hasGap", [
  z.object({
    hasGap: z.literal(false),
    summary: z.string().describe("One sentence confirming the attempt succeeded cleanly."),
  }),
  z.object({
    hasGap: z.literal(true),
    gapType: z
      .enum(["missing_reasoning", "unstated_assumption", "self_contradiction"])
      .describe(
        "missing_reasoning: a step/claim was given but never justified. " +
          "unstated_assumption: the attempt needed a fact/rule never taught at all. " +
          "self_contradiction: two taught statements conflict with each other."
      ),
    locationInTranscript: z
      .string()
      .describe("The specific taught statement or step where the gap originates."),
    explanation: z
      .string()
      .describe("Plain-language explanation of the gap, written for the student, not a grader."),
    suggestedReframingQuestion: z
      .string()
      .describe(
        "One guiding question that would help the student find the gap themselves. Never the answer."
      ),
  }),
]);

type GapEvaluation = z.infer<typeof gapEvaluationSchema>;

// -----------------------------------------------------------------------
// Prompts & Instructions
// -----------------------------------------------------------------------

const TEACH_MODE_INSTRUCTIONS: Record<Mode, string> = {
  concept: `
You are being taught a concept, idea, or narrative — not a step-by-step procedure.
- Ask foundational "why" questions: why this happens, why it matters, why it's true.
- Ask the student to compare what they're teaching you to something adjacent ("How is this
  different from X?", "Does this remind you of something else we've covered?"). Comparison
  questions catch surface-level, recognition-only understanding better than direct recall
  questions do.
- Ask "what if" questions that probe the underlying mechanism rather than the description
  ("What would happen if this part were different or missing?").
`.trim(),
  practice: `
You are being taught how to solve a problem, step by step, usually on a shared whiteboard.
- After each step the student gives you, ask why that step was taken — not just what it
  mechanically does, but why it was the right move here and not some alternative.
- Do not let a step pass unexplained. If the student jumps ahead without justifying a step,
  ask them to justify it before you "accept" it as something you've learned.
- Track the order of steps as they're taught. If a step seems to skip logic, name the
  specific gap you notice between the two steps.
`.trim(),
};

const TEST_MODE_INSTRUCTIONS: Record<Mode, string> = {
  concept: `You will be given a new, related conceptual question — e.g. a comparison, an
application to a new example, or a "what if" variant. Answer it the way a student who
genuinely only knew the taught material would.`.trim(),
  practice: `You will be given a new problem that is structurally similar to the one you were
taught. Solve it using only the taught method, in the same step order and style you were shown.`.trim(),
};

function getTeachSystemPrompt(mode: Mode): string {
  return `
You are Concat, playing a curious, attentive, but genuinely uninformed student. For the
purposes of this conversation, set aside anything you might otherwise know about this topic —
you know ONLY what the user explicitly teaches you here.

## Your goal
Learn exclusively from what the user teaches you, by asking the kind of questions a
thoughtful student would ask. Your questions should force the user to produce and defend
real understanding — not just restate something that sounds familiar.

## Absolute rule — never break this
Never supply a fact, definition, rule, formula, or piece of reasoning the user hasn't already
given you, even partially, even "to be helpful." If the user asks you something, or seems to
expect you already know it, say plainly that you don't think they've told you that yet, and
ask them to explain it. Do not validate a claim as correct using knowledge from outside this
conversation — only acknowledge that you now understand what they told you.

## How you ask questions
${TEACH_MODE_INSTRUCTIONS[mode]}

## Style
- Ask one focused question at a time — never a list of questions.
- Be warm and genuinely curious, not interrogative.
- If an explanation is vague or hand-wavy ("it just works because of the formula"), push back
  gently and ask for specifics rather than accepting it and moving on.
- Periodically restate what you believe you've learned so far, in your own words, and ask the
  student to confirm or correct it. This is how gaps surface before the test phase, not after.
- Keep responses short — you are a student asking questions, not a lecturer.
`.trim();
}

function getKnowledgeExtractionPrompt(mode: Mode, teachTranscript: string): string {
  return `
Below is a transcript of a tutoring session in which a student taught ${
    mode === "concept" ? "a concept" : "how to solve a problem"
  } to an AI acting as a naive learner.

Extract ONLY what the student explicitly stated. Do not infer, complete, correct, or add
anything the student didn't actually say — even if it seems obviously implied. Do not use
outside knowledge of the subject to fill in or fix anything. If something was left ambiguous
or unstated, leave it out rather than guessing at what the student probably meant.
When identifying assumptions, include only assumptions the student explicitly named and examined.

Mode: ${mode}

Transcript:
"""
${teachTranscript}
"""

This extraction becomes the ONLY knowledge available during the test phase. Anything left out
here cannot be used later; anything added here that the student didn't actually say would let
the test phase "cheat" with knowledge the student never actually demonstrated. Be precise and
conservative.
`.trim();
}

function imageContent(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  return { type: "image" as const, image: Buffer.from(match[2], "base64"), mediaType: match[1] as "image/jpeg" | "image/png" | "image/webp" };
}

function getTestSystemPrompt(mode: Mode, knowledge: TaughtKnowledge): string {
  return `
You are Concat's execution engine. You are not a general-purpose assistant, and you must act
as though you have no knowledge of this subject beyond what is listed below as TAUGHT
KNOWLEDGE. Treat this as total amnesia of your training data on this specific topic — you may
use ordinary language and logic, but not any fact, rule, formula, or reasoning about this
subject that isn't explicitly present below.

## TAUGHT KNOWLEDGE (the only thing you are allowed to use)
${JSON.stringify(knowledge, null, 2)}

## Your task
${TEST_MODE_INSTRUCTIONS[mode]}

## Critical rules
1. If the taught knowledge is sufficient, work through the problem step by step, explicitly
   naming which taught rule, step, or reasoning you're applying at each point.
2. If the taught knowledge is NOT sufficient — a step is missing, a rule was never given, the
   needed reasoning is absent — STOP at the exact point you can no longer proceed, and state
   plainly what specific piece of knowledge you were never taught. Do not guess. Do not pattern-
   match to what the answer is probably supposed to be. Do not reach for outside knowledge.
3. Never apologize for not knowing something outside the taught knowledge — that's the
   intended, useful outcome here, not a failure.
4. Show your work, so the student can see exactly where your reasoning held up and where it
   broke down.
`.trim();
}

function getGapEvaluationPrompt(
  mode: Mode,
  knowledge: TaughtKnowledge,
  testQuestion: string,
  testAttempt: string
): string {
  return `
Evaluate the student's test attempt using only the knowledge they explicitly taught below.
Identify whether the attempt demonstrates the reasoning needed to solve the question. Do not
use outside subject knowledge to mark the answer right or wrong. Look for missing reasoning,
an unstated assumption, or a contradiction between the taught knowledge and the attempt.

## Mode
${mode}

## Taught knowledge
${JSON.stringify(knowledge, null, 2)}

## New question
${testQuestion}

## Student's attempt
${testAttempt}

Return hasGap=false only when the attempt follows from the taught knowledge without a material
gap. If a gap exists, identify where it begins and offer one guiding question. Never supply the
missing answer.
`.trim();
}

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("teach"),
    mode: z.enum(["concept", "practice"]),
    topic: z.string().max(120).optional(),
    boardImage: z.string().max(7_000_000).optional(),
    messages: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().trim().min(1).max(8_000),
    })).min(1).max(30),
  }),
  z.object({
    action: z.literal("board-coach"),
    mode: z.enum(["concept", "practice"]),
    topic: z.string().max(120).optional(),
    transcript: z.string().max(20_000).optional(),
    boardImage: z.string().min(1).max(7_000_000),
  }),
  z.object({
    action: z.literal("extract"),
    mode: z.enum(["concept", "practice"]),
    topic: z.string().max(120).optional(),
    boardImage: z.string().max(7_000_000).optional(),
    transcript: z.string().trim().min(1).max(20_000),
  }),
  z.object({
    action: z.literal("scenario"),
    mode: z.enum(["concept", "practice"]),
    knowledge: taughtKnowledgeSchema,
  }),
  z.object({
    action: z.literal("test"),
    mode: z.enum(["concept", "practice"]),
    knowledge: taughtKnowledgeSchema,
    question: z.string().trim().min(1).max(4_000),
  }),
  z.object({
    action: z.literal("evaluate"),
    mode: z.enum(["concept", "practice"]),
    knowledge: taughtKnowledgeSchema,
    question: z.string().trim().min(1).max(4_000),
    attempt: z.string().trim().min(1).max(8_000),
  }),
]);

function createMuseModel() {
  const apiKey = process.env.META_MUSE_API_KEY;
  if (!apiKey) return null;

  // The Anthropic provider appends `/messages`, so keep Meta's `/v1` prefix
  // in the base URL to send requests to `/v1/messages`.
  const baseURL = (process.env.META_MUSE_API_URL || "https://api.meta.ai/v1").replace(/\/+$/, "");
  const modelId = process.env.META_MUSE_MODEL_ID || "muse-spark-1.3";
  const meta = createAnthropic({ authToken: apiKey, baseURL });
  return meta(modelId);
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "The request is missing valid session details." }, { status: 400 });
  }

  const model = createMuseModel();
  if (!model) {
    return NextResponse.json({ error: "Meta Muse is not configured. Add META_MUSE_API_KEY to the server environment." }, { status: 503 });
  }

  try {
    const data = parsed.data;

    if (data.action === "teach") {
      const board = data.boardImage ? imageContent(data.boardImage) : null;
      const messages: ModelMessage[] = data.messages.map((message, index) => {
        const isLastUser = index === data.messages.length - 1 && message.role === "user";
        return isLastUser && board
          ? { role: "user", content: [{ type: "text", text: message.content }, board] }
          : message;
      });
      const result = streamText({
        model,
        system: `${getTeachSystemPrompt(data.mode)}${data.topic?.trim() ? `\n\nSession topic: ${data.topic.trim()}` : ""}\n\nWhen a whiteboard image is attached, consider only what is visibly written or drawn as student-taught information. Ask about unclear parts instead of guessing.`,
        messages,
        maxOutputTokens: 2048,
      });
      return result.toTextStreamResponse();
    }

    if (data.action === "board-coach") {
      const board = imageContent(data.boardImage);
      if (!board) return NextResponse.json({ error: "The whiteboard image could not be read." }, { status: 400 });
      const prompt = `Review the student's current whiteboard after a pause in their work.\n\nMode: ${data.mode}\nTopic: ${data.topic?.trim() || "Not specified"}\n\nRecent conversation:\n${data.transcript?.trim() || "No chat messages yet; use only the visible whiteboard."}\n\nLook only at legible writing and visible relationships in the attached image. If a key part is unclear, ask the student to clarify it. Do not assume missing steps or claim that an idea is correct using outside subject knowledge. Do not reveal a solution. Choose one useful next move: ask one focused Socratic question about a visible claim, step, or assumption; or, in practice mode when the method is clear, give one short analogous problem for the student to solve. Keep it brief and conversational. Do not announce that you analyzed an image.`;
      const result = streamText({
        model,
        system: `You are CONCAT, a curious learning partner. Your role is to help the student strengthen understanding, not to lecture or grade. For concept mode, prefer a focused why, connection, or what-if question. For practice mode, ask about the reasoning behind a visible step or offer one structurally similar unsolved problem. ${data.mode === "concept" ? "Concept mode is active." : "Practice mode is active."}`,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, board] }],
        maxOutputTokens: 2048,
      });
      return result.toTextStreamResponse();
    }

    if (data.action === "extract") {
      const prompt = `${getKnowledgeExtractionPrompt(data.mode, data.transcript)}\n\n${data.topic?.trim() ? `Session topic: ${data.topic.trim()}` : ""}\nTreat the attached whiteboard as student-authored evidence. Extract only content that is legible and explicitly represented; do not infer missing steps.`;
      const board = data.boardImage ? imageContent(data.boardImage) : null;
      const result = await generateObject({
        model,
        schema: taughtKnowledgeSchema,
        messages: [{ role: "user", content: board ? [{ type: "text", text: prompt }, board] : prompt }],
      });
      return NextResponse.json({ knowledge: result.object });
    }

    if (data.action === "scenario") {
      const result = streamText({
        model,
        system: `You are CONCAT, creating one short application question for a student. Use only the taught knowledge provided. Ask one fresh, related scenario that requires the student to retrieve and apply the idea. Do not include a hint, explanation, rubric, or answer. Use plain, encouraging language.`,
        prompt: `Mode: ${data.mode}\n\nTaught knowledge:\n${JSON.stringify(data.knowledge, null, 2)}\n\nAsk one new scenario question now.`,
        maxOutputTokens: 2048,
      });
      return result.toTextStreamResponse();
    }

    if (data.action === "test") {
      const result = streamText({
        model,
        system: getTestSystemPrompt(data.mode, data.knowledge),
        prompt: data.question,
        maxOutputTokens: 4096,
      });
      return result.toTextStreamResponse();
    }

    const result = await generateObject({
      model,
      schema: gapEvaluationSchema,
      prompt: getGapEvaluationPrompt(data.mode, data.knowledge, data.question, data.attempt),
    });
    return NextResponse.json({ evaluation: result.object });
  } catch (error) {
    console.error("Meta Muse request failed:", error);
    return NextResponse.json({ error: "Meta Muse could not complete that request. Check the server configuration and try again." }, { status: 502 });
  }
}
