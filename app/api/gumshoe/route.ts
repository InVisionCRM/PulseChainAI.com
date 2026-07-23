import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { TOOL_DECLARATIONS, executeTool, type ToolContext } from '@/lib/gumshoe/agentTools';

// Gumshoe — the ask-anything on-chain analyst for the geicko token pages. It runs
// a Gemini function-calling loop: the model picks which of our data tools to call
// (forensics, holders, liquidity, volume, funding traces, buyer-connection
// clustering, …), we execute them against the endpoints we already ship, and the
// model synthesizes an answer from ONLY that real data.
//
// Auth: the user's own Gemini key (BYOK, `x-user-api-key`) is used when present;
// otherwise the shared server key, which is lightly rate-limited per IP.

export const maxDuration = 120;

const MODEL = 'gemini-2.5-flash';
const MAX_ROUNDS = 5;        // tool-call rounds
const MAX_TOOL_CALLS = 10;   // total tool executions per request

// Best-effort per-IP limit for the shared server key (BYOK users bypass it).
const SERVER_KEY_LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000;
const ipHits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= SERVER_KEY_LIMIT) { ipHits.set(ip, hits); return true; }
  hits.push(now);
  ipHits.set(ip, hits);
  return false;
}

const SYSTEM_INSTRUCTION = `You are Gumshoe, a sharp, plain-spoken on-chain analyst built into a PulseChain / Robinhood token explorer. You help users understand a token's on-chain reality — creators, holders, liquidity, volume, launch integrity, and how wallets connect.

HARD RULES:
- Answer ONLY from the data your tools return. NEVER invent or guess an address, number, name, date, or percentage. If a tool returns nothing useful, say so plainly.
- You are usually looking at one specific token (the page the user is on); the tools already default to it, so you rarely need an address from the user.
- Call the tools you need. Prefer 'analyze_buyer_connections' for "are the buyers connected / is this one person / organic launch" questions, 'get_forensics' for creator/founder behavior, 'get_token_overview' for general facts.
- Some capabilities are PulseChain-only (buyer connections, volume history, funding traces, LP fees). If asked on another chain, say the capability isn't available there rather than making something up.
- Do NOT give price predictions, financial advice, or claim real-world identities. You describe on-chain facts and patterns; you don't tell people to buy or sell.
- When something looks risky (high dev holdings, creator selling, a big shared-funder cluster among first buyers, unlocked liquidity), state it factually with the numbers. When it looks clean, say that too. Be balanced, not alarmist.

STYLE:
- Lead with the direct answer, then the supporting detail.
- Use short paragraphs and bullet points. Keep addresses in the shortened form the tools give you.
- Be concise. No filler, no repeating the question back.`;

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const message: string = typeof body?.message === 'string' ? body.message.slice(0, 2000) : '';
  if (!message.trim()) return NextResponse.json({ error: 'No message provided' }, { status: 400 });

  const userKey = req.headers.get('x-user-api-key')?.trim() || '';
  const apiKey = userKey || process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: 'No Gemini API key configured. Add your own key to use Gumshoe.' }, { status: 503 });
  }

  // Rate-limit only the shared server key.
  if (!userKey) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (rateLimited(ip)) {
      return NextResponse.json(
        { error: 'Gumshoe is busy right now (free-tier limit reached). Add your own Gemini API key to keep going without limits.' },
        { status: 429 },
      );
    }
  }

  const ctx: ToolContext = {
    origin: req.nextUrl.origin,
    token: typeof body?.token === 'string' && /^0x[a-fA-F0-9]{40}$/.test(body.token) ? body.token.toLowerCase() : null,
    network: typeof body?.network === 'string' ? body.network.toLowerCase() : 'pulsechain',
  };

  const history = Array.isArray(body?.history)
    ? body.history.slice(-10).map((m: any) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: String(m.text ?? '').slice(0, 4000) }] }))
    : [];

  // Give the model the current subject so it doesn't have to ask.
  const contextPreamble = ctx.token
    ? `[Context: the user is viewing token ${ctx.token} on ${ctx.network}. Treat that as the default subject unless they name another address.]\n\n`
    : `[Context: no specific token is loaded. Ask the user for a token address if their question needs one.]\n\n`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: MODEL,
      history,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS as any }],
        temperature: 0.3,
      },
    });

    const toolsUsed: string[] = [];
    let resp = await chat.sendMessage({ message: contextPreamble + message });

    let rounds = 0;
    while (resp.functionCalls && resp.functionCalls.length && rounds < MAX_ROUNDS && toolsUsed.length < MAX_TOOL_CALLS) {
      rounds++;
      const calls = resp.functionCalls.slice(0, MAX_TOOL_CALLS - toolsUsed.length);
      const parts = await Promise.all(
        calls.map(async (fc: any) => {
          toolsUsed.push(fc.name);
          let result: any;
          try { result = await executeTool(fc.name, fc.args || {}, ctx); }
          catch (e) { result = { error: e instanceof Error ? e.message : 'tool failed' }; }
          return { functionResponse: { name: fc.name, response: result ?? {} } };
        }),
      );
      resp = await chat.sendMessage({ message: parts as any });
    }

    const answer = (resp.text ?? '').trim() || "I couldn't find enough on-chain data to answer that.";
    return NextResponse.json({ answer, toolsUsed: [...new Set(toolsUsed)] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gumshoe failed';
    // Surface an invalid/over-quota key clearly so the UI can prompt for BYOK.
    const status = /api key|permission|quota|429|invalid/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
