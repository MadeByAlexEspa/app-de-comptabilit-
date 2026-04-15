/**
 * AI accounting agent service.
 * Supports Anthropic, OpenAI, Mistral.
 */
const db = require('../db/database');

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

function getConfig() {
  return db.get('SELECT * FROM ai_config WHERE id = 1');
}

function saveConfig(data) {
  const existing = getConfig();
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

function getAccountingContext() {
  const totalRevenu   = db.get('SELECT COALESCE(SUM(montant_ttc),0) AS total FROM factures')?.total ?? 0;
  const totalDepenses = db.get('SELECT COALESCE(SUM(montant_ttc),0) AS total FROM depenses')?.total ?? 0;
  const totalTvaColl  = db.get('SELECT COALESCE(SUM(montant_tva),0) AS total FROM factures')?.total ?? 0;
  const totalTvaDed   = db.get('SELECT COALESCE(SUM(montant_tva),0) AS total FROM depenses')?.total ?? 0;
  const nbFactures    = db.get('SELECT COUNT(*) AS cnt FROM factures')?.cnt ?? 0;
  const nbDepenses    = db.get('SELECT COUNT(*) AS cnt FROM depenses')?.cnt ?? 0;
  const nbEnAttente   = db.get("SELECT COUNT(*) AS cnt FROM factures WHERE statut='en_attente'")?.cnt ?? 0;

  const topClients = db.prepare(
    'SELECT client, SUM(montant_ttc) AS total FROM factures GROUP BY client ORDER BY total DESC LIMIT 5'
  ).all();
  const topCats = db.prepare(
    'SELECT categorie, SUM(montant_ttc) AS total FROM depenses GROUP BY categorie ORDER BY total DESC LIMIT 5'
  ).all();

  return { totalRevenu, totalDepenses, totalTvaColl, totalTvaDed, nbFactures, nbDepenses, nbEnAttente, topClients, topCats };
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

async function chat(messages) {
  const config = getConfig();
  if (!config?.api_key) {
    throw new Error('IA non configurée. Ajoutez votre clé API dans Connexions API → IA.');
  }
  const ctx = getAccountingContext();
  const systemPrompt = buildSystemPrompt(config.system_prompt, ctx);
  const provider = config.provider || 'anthropic';
  const model    = config.model    || PROVIDERS[provider]?.defaultModel;

  if (provider === 'anthropic') return callAnthropic(config.api_key, model, systemPrompt, messages);
  if (provider === 'openai')    return callOpenAI(config.api_key, model, systemPrompt, messages);
  if (provider === 'mistral')   return callMistral(config.api_key, model, systemPrompt, messages);
  if (provider === 'gemini')    return callGemini(config.api_key, model, systemPrompt, messages);
  throw new Error(`Fournisseur inconnu : ${provider}`);
}

async function callAnthropic(apiKey, model, systemPrompt, messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 1024, system: systemPrompt, messages }),
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

function deleteConfig() {
  db.run('DELETE FROM ai_config WHERE id = 1');
}

module.exports = { PROVIDERS, getConfig, saveConfig, deleteConfig, chat };
