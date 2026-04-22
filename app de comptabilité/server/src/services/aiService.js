const { decryptRows, FACTURE_FIELDS, DEPENSE_FIELDS } = require('./cryptoService');

const PROVIDERS = {
  anthropic: {
    name: 'Anthropic',
    color: '#d97706',
    models: [
      { id: 'claude-opus-4-6',           label: 'Claude Opus 4.6' },
      { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
    defaultModel: 'claude-sonnet-4-6',
  },
  openai: {
    name: 'OpenAI',
    color: '#10a37f',
    models: [
      { id: 'gpt-4o',      label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    ],
    defaultModel: 'gpt-4o',
  },
  mistral: {
    name: 'Mistral',
    color: '#ff7000',
    models: [
      { id: 'mistral-large-latest',  label: 'Mistral Large' },
      { id: 'mistral-medium-latest', label: 'Mistral Medium' },
      { id: 'mistral-small-latest',  label: 'Mistral Small' },
    ],
    defaultModel: 'mistral-large-latest',
  },
  gemini: {
    name: 'Gemini',
    color: '#1a73e8',
    models: [
      { id: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
      { id: 'gemini-1.5-pro',        label: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash',      label: 'Gemini 1.5 Flash' },
    ],
    defaultModel: 'gemini-2.0-flash',
  },
};

function getConfig(db) {
  return db.get('SELECT * FROM ai_config WHERE id = 1');
}

function saveConfig(db, data) {
  const existing = getConfig(db);
  if (existing) {
    const newKey = data.api_key?.startsWith('\u2022') ? existing.api_key : data.api_key;
    db.run(
      "UPDATE ai_config SET provider=?, api_key=?, model=?, system_prompt=?, updated_at=datetime('now') WHERE id=1",
      [
        data.provider      ?? existing.provider,
        newKey             ?? existing.api_key,
        data.model         ?? existing.model,
        data.system_prompt ?? existing.system_prompt,
      ]
    );
  } else {
    db.run(
      'INSERT INTO ai_config (id, provider, api_key, model, system_prompt) VALUES (1,?,?,?,?)',
      [data.provider, data.api_key, data.model, data.system_prompt ?? null]
    );
  }
}

function getAccountingContext(db, workspaceId) {
  const allFactures = decryptRows(db.prepare('SELECT * FROM factures').all(), FACTURE_FIELDS, workspaceId);
  const allDepenses = decryptRows(db.prepare('SELECT * FROM depenses').all(), DEPENSE_FIELDS, workspaceId);

  let totalRevenu = 0, totalDepenses = 0, totalTvaColl = 0, totalTvaDed = 0, nbEnAttente = 0;
  const clientMap = {}, catMap = {};

  for (const r of allFactures) {
    totalRevenu  += r.montant_ttc || 0;
    totalTvaColl += r.montant_tva || 0;
    if (r.statut === 'en_attente') nbEnAttente++;
    if (r.client) clientMap[r.client] = (clientMap[r.client] || 0) + (r.montant_ttc || 0);
  }
  for (const r of allDepenses) {
    totalDepenses += r.montant_ttc || 0;
    totalTvaDed   += r.montant_tva || 0;
    if (r.categorie) catMap[r.categorie] = (catMap[r.categorie] || 0) + (r.montant_ttc || 0);
  }

  const topClients = Object.entries(clientMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([client, total]) => ({ client, total }));
  const topCats = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([categorie, total]) => ({ categorie, total }));

  return {
    totalRevenu, totalDepenses, totalTvaColl, totalTvaDed,
    nbFactures: allFactures.length, nbDepenses: allDepenses.length,
    nbEnAttente, topClients, topCats,
  };
}

function buildSystemPrompt(customPrompt, ctx) {
  const fmt = n => Number(n).toFixed(2);
  const net    = ctx.totalRevenu - ctx.totalDepenses;
  const tvaNet = ctx.totalTvaColl - ctx.totalTvaDed;

  const dataBlock = `
=== DONNÉES COMPTABLES ===
CA TTC         : ${fmt(ctx.totalRevenu)} €
Dépenses TTC   : ${fmt(ctx.totalDepenses)} €
Résultat net   : ${fmt(net)} € (${net >= 0 ? 'bénéfice' : 'perte'})
TVA collectée  : ${fmt(ctx.totalTvaColl)} €
TVA déductible : ${fmt(ctx.totalTvaDed)} €
TVA nette      : ${fmt(tvaNet)} € (${tvaNet > 0 ? 'à reverser' : 'crédit TVA'})
Entrées        : ${ctx.nbFactures} (dont ${ctx.nbEnAttente} en attente de paiement)
Sorties        : ${ctx.nbDepenses}
Top clients    : ${ctx.topClients.map(c => `${c.client} ${fmt(c.total)}€`).join(', ') || 'aucun'}
Top dépenses   : ${ctx.topCats.map(c => `${c.categorie} ${fmt(c.total)}€`).join(', ') || 'aucune'}
==========================`;

  return `Tu es un agent comptable IA expert en comptabilité française (PCG — Plan Comptable Général, ANC 2025, CGI).
Tu aides l'utilisateur à comprendre sa comptabilité, interpréter ses données, et répondre à ses questions fiscales et comptables.
Réponds toujours en français. Sois précis et pratique. Cite les articles du CGI ou les comptes PCG quand c'est pertinent.
${dataBlock}${customPrompt ? `\n\nInstructions supplémentaires : ${customPrompt}` : ''}`;
}

async function chat(db, messages, workspaceId) {
  const config = getConfig(db);
  if (!config?.api_key) {
    throw new Error('IA non configurée. Ajoutez votre clé API dans Connexions API → IA.');
  }
  const ctx = getAccountingContext(db, workspaceId);
  const systemPrompt = buildSystemPrompt(config.system_prompt, ctx);
  const provider = config.provider || 'anthropic';
  const model    = config.model    || PROVIDERS[provider]?.defaultModel;

  // Keep last 10 turns to cap token usage while preserving enough context
  const trimmed = messages.slice(-10);

  if (provider === 'anthropic') return callAnthropic(config.api_key, model, systemPrompt, trimmed);
  if (provider === 'openai')    return callOpenAI(config.api_key, model, systemPrompt, trimmed);
  if (provider === 'mistral')   return callMistral(config.api_key, model, systemPrompt, trimmed);
  if (provider === 'gemini')    return callGemini(config.api_key, model, systemPrompt, trimmed);
  throw new Error(`Fournisseur inconnu : ${provider}`);
}

async function callAnthropic(apiKey, model, systemPrompt, messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic API : HTTP ${res.status}`);
  }
  return (await res.json()).content[0].text;
}

async function callOpenAI(apiKey, model, systemPrompt, messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API : HTTP ${res.status}`);
  }
  return (await res.json()).choices[0].message.content;
}

async function callMistral(apiKey, model, systemPrompt, messages) {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Mistral API : HTTP ${res.status}`);
  }
  return (await res.json()).choices[0].message.content;
}

async function callGemini(apiKey, model, systemPrompt, messages) {
  // Gemini uses its own format: system instruction + user/model turns
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 1024 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API : HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function deleteConfig(db) {
  db.run('DELETE FROM ai_config WHERE id = 1');
}

module.exports = { PROVIDERS, getConfig, saveConfig, deleteConfig, chat };
