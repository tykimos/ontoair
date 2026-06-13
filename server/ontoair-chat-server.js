#!/usr/bin/env node
// OntoAir chat backend — a tiny, dependency-free proxy to Azure OpenAI.
//
// Uses the SAME Azure resource/model as the nfs (autopsy) service
// (gpt-5.2-chat, api-version 2024-10-21) — config comes from ../.env.
// The browser is static and cannot hold the API key, so this server holds it
// and exposes a single POST /chat that the OntoAir web client calls (proxied
// by nginx at /ontoair/api/chat).
//
// Request  : { messages:[{role,content}], ontology:"<turtle text>", filename }
// Response : { action:"answer"|"edit", message:"<korean text>", ttl?:"<new turtle>" }

'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

// ---- load ../.env (KEY=VALUE lines) ----
function loadEnv(p) {
  try {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch (e) { /* env may come from the systemd unit instead */ }
}
loadEnv(path.join(__dirname, '..', '.env'));

const ENDPOINT = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/+$/, '');
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-5.2-chat';
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';
const API_KEY = process.env.AZURE_OPENAI_API_KEY || '';
const PORT = +(process.env.ONTOAIR_CHAT_PORT || 8790);
const MAX_ONTOLOGY_CHARS = 120000; // keep prompts bounded

const SYSTEM_PROMPT = `너는 OntoAir의 온톨로지 어시스턴트다. 사용자가 현재 보고 있는 RDF/OWL 온톨로지(Turtle 형식)를 바탕으로 대화한다.

너에게는 사용자가 지금 로드한 온톨로지 전체 텍스트가 제공된다. 사용자의 발화 의도에 따라 정확히 하나의 도구(tool)를 호출한다.

- 질문/조회/요약/검색(예: "Knight는 무슨 색이야?", "클래스 몇 개야?", "Fork 패턴 설명해줘") → search_answer 호출.
- 수정/추가/삭제 요청(예: "Knight에 hasColor white 추가해", "Pawn 클래스 지워", "라벨을 한글로 바꿔") → edit_ontology 호출. 반드시 전체 갱신된 Turtle을 updated_ttl로 반환한다(부분 조각이 아니라 파일 전체). 기존 @prefix 선언과 무관한 트리플은 그대로 보존한다.

규칙:
- 답변과 summary는 항상 한국어, 간결하게.
- 온톨로지에 없는 사실을 지어내지 말 것. 모르면 모른다고 답한다.
- edit 시 문법적으로 유효한 Turtle을 생성하고, 기존 prefix/네임스페이스를 재사용한다.
- 사용자가 모호하면 수정하지 말고 search_answer로 짧게 되묻는다.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_answer',
      description: '현재 온톨로지에 대한 사용자의 질문에 한국어로 답한다. 수정이 아닌 모든 조회/검색/요약/설명에 사용.',
      parameters: {
        type: 'object',
        properties: { answer: { type: 'string', description: '한국어 답변' } },
        required: ['answer'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_ontology',
      description: '사용자 요청대로 온톨로지를 수정한 뒤, 갱신된 Turtle 파일 전체를 반환한다.',
      parameters: {
        type: 'object',
        properties: {
          updated_ttl: { type: 'string', description: '갱신된 Turtle 파일 전체 텍스트' },
          summary: { type: 'string', description: '무엇을 바꿨는지 한국어 1~2줄 요약' },
        },
        required: ['updated_ttl', 'summary'],
      },
    },
  },
];

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

async function callAzure(messages) {
  const url = `${ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': API_KEY },
    body: JSON.stringify({
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      max_completion_tokens: 16000, // gpt-5.2-chat is a reasoning model — needs headroom for reasoning + full TTL output
    }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Azure ${r.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

function parseResult(data) {
  const choice = data && data.choices && data.choices[0];
  const msg = choice && choice.message;
  const calls = (msg && msg.tool_calls) || [];
  for (const tc of calls) {
    if (!tc.function) continue;
    let args = {};
    try { args = JSON.parse(tc.function.arguments || '{}'); } catch { args = {}; }
    if (tc.function.name === 'edit_ontology' && args.updated_ttl) {
      return { action: 'edit', message: args.summary || '온톨로지를 수정했습니다.', ttl: args.updated_ttl };
    }
    if (tc.function.name === 'search_answer' && args.answer) {
      return { action: 'answer', message: args.answer };
    }
  }
  // No tool call — fall back to any plain text the model returned.
  const plain = (msg && msg.content) || '';
  return { action: 'answer', message: plain || '응답을 생성하지 못했습니다. 다시 시도해 주세요.' };
}

const server = http.createServer((req, res) => {
  // health check
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/chat')) {
    return send(res, 200, { ok: true, deployment: DEPLOYMENT, configured: !!(ENDPOINT && API_KEY) });
  }
  if (req.method !== 'POST' || !req.url.startsWith('/chat')) {
    return send(res, 404, { error: 'not found' });
  }
  if (!ENDPOINT || !API_KEY) {
    return send(res, 500, { error: 'Azure OpenAI is not configured (.env).' });
  }
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 4_000_000) req.destroy(); });
  req.on('end', async () => {
    let body;
    try { body = JSON.parse(raw || '{}'); } catch { return send(res, 400, { error: 'invalid JSON' }); }
    const userMessages = Array.isArray(body.messages) ? body.messages : [];
    let ontology = String(body.ontology || '');
    let truncated = false;
    if (ontology.length > MAX_ONTOLOGY_CHARS) { ontology = ontology.slice(0, MAX_ONTOLOGY_CHARS); truncated = true; }
    const ctxBlock = ontology
      ? `[현재 로드된 온톨로지: ${body.filename || 'ontology'}${truncated ? ' (앞부분만 발췌)' : ''}]\n\`\`\`turtle\n${ontology}\n\`\`\``
      : '[현재 로드된 온톨로지 없음]';
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: ctxBlock },
      ...userMessages.filter((m) => m && m.role && m.content).map((m) => ({ role: m.role, content: String(m.content) })),
    ];
    try {
      const data = await callAzure(messages);
      return send(res, 200, parseResult(data));
    } catch (err) {
      return send(res, 502, { error: String((err && err.message) || err) });
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[ontoair-chat] listening on 127.0.0.1:${PORT} → ${ENDPOINT}/.../${DEPLOYMENT} (configured=${!!(ENDPOINT && API_KEY)})`);
});
