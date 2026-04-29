/**
 * Script de migration des données Railway (SQLite) → Supabase (Postgres)
 *
 * Usage :
 *   1. Copier les fichiers SQLite depuis Railway : data/master.db + data/{id}.db
 *   2. Renseigner les variables d'env dans .env.local
 *   3. Créer les users Supabase Auth manuellement (ou via Supabase Dashboard import)
 *   4. npx tsx scripts/migrate-from-sqlite.ts
 *
 * Le script est idempotent : il utilise upsert et ne duplique pas les données.
 */

import { createClient } from '@supabase/supabase-js'
import Database from 'better-sqlite3'
import path from 'path'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role pour contourner RLS pendant la migration
)

// Adapter les chemins selon votre environnement local
const MASTER_DB_PATH = path.join(process.cwd(), '../data/master.db')
const DATA_DIR       = path.join(process.cwd(), '../data')

// ─────────────────────────────────────────────────────────────────────────────

async function migrateWorkspace(workspaceId: number, supabaseWorkspaceId: string) {
  const dbPath = workspaceId === 1
    ? path.join(DATA_DIR, 'compta.db')
    : path.join(DATA_DIR, `${workspaceId}.db`)

  console.log(`\n[workspace ${workspaceId}] Ouverture de ${dbPath}`)
  const db = new Database(dbPath, { readonly: true })

  // ── Factures ──────────────────────────────────────────────────────────────
  const factures = db.prepare('SELECT * FROM factures').all() as any[]
  console.log(`  → ${factures.length} factures`)

  if (factures.length > 0) {
    const rows = factures.map(f => ({
      workspace_id: supabaseWorkspaceId,
      numero:       f.numero,
      date:         f.date,
      client:       f.client,
      description:  f.description ?? null,
      montant_ht:   f.montant_ht,
      taux_tva:     f.taux_tva,
      montant_tva:  f.montant_tva,
      montant_ttc:  f.montant_ttc,
      tva_lines:    f.tva_lines ? JSON.parse(f.tva_lines) : null,
      categorie:    f.categorie,
      statut:       f.statut,
      created_at:   f.created_at,
    }))

    const { error } = await supabase.from('factures').upsert(rows, { onConflict: 'id' })
    if (error) console.error('  ✗ factures:', error.message)
    else console.log('  ✓ factures migrées')
  }

  // ── Dépenses ──────────────────────────────────────────────────────────────
  const depenses = db.prepare('SELECT * FROM depenses').all() as any[]
  console.log(`  → ${depenses.length} dépenses`)

  if (depenses.length > 0) {
    const rows = depenses.map(d => ({
      workspace_id: supabaseWorkspaceId,
      date:         d.date,
      fournisseur:  d.fournisseur,
      description:  d.description ?? null,
      montant_ht:   d.montant_ht,
      taux_tva:     d.taux_tva,
      montant_tva:  d.montant_tva,
      montant_ttc:  d.montant_ttc,
      tva_lines:    d.tva_lines ? JSON.parse(d.tva_lines) : null,
      categorie:    d.categorie,
      statut:       d.statut,
      created_at:   d.created_at,
    }))

    const { error } = await supabase.from('depenses').upsert(rows, { onConflict: 'id' })
    if (error) console.error('  ✗ dépenses:', error.message)
    else console.log('  ✓ dépenses migrées')
  }

  // ── AI config ─────────────────────────────────────────────────────────────
  const aiConfig = db.prepare('SELECT * FROM ai_config WHERE id = 1').get() as any
  if (aiConfig) {
    const { error } = await supabase.from('ai_config').upsert({
      workspace_id:  supabaseWorkspaceId,
      provider:      aiConfig.provider,
      api_key:       aiConfig.api_key ?? null,   // toujours chiffré
      model:         aiConfig.model ?? null,
      system_prompt: aiConfig.system_prompt ?? null,
    }, { onConflict: 'workspace_id' })
    if (error) console.error('  ✗ ai_config:', error.message)
    else console.log('  ✓ ai_config migré')
  }

  db.close()
}

async function main() {
  console.log('=== Migration SQLite → Supabase ===')
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

  const master = new Database(MASTER_DB_PATH, { readonly: true })
  const workspaces = master.prepare('SELECT * FROM workspaces').all() as any[]
  console.log(`\n${workspaces.length} workspace(s) trouvé(s) dans master.db`)

  for (const ws of workspaces) {
    console.log(`\n▶ Workspace "${ws.name}" (id: ${ws.id}, slug: ${ws.slug})`)

    // 1. Créer ou retrouver le workspace dans Supabase
    const { data: existing } = await supabase
      .from('workspaces')
      .select('id')
      .eq('slug', ws.slug)
      .single()

    let supabaseWsId: string

    if (existing) {
      supabaseWsId = existing.id
      console.log(`  workspace déjà présent (id: ${supabaseWsId})`)
    } else {
      const { data: created, error } = await supabase
        .from('workspaces')
        .insert({
          name:           ws.name,
          slug:           ws.slug,
          activite_type:  ws.activite_type ?? null,
          structure_type: ws.structure_type ?? null,
        })
        .select('id')
        .single()

      if (error || !created) {
        console.error(`  ✗ Impossible de créer le workspace: ${error?.message}`)
        continue
      }
      supabaseWsId = created.id
      console.log(`  ✓ workspace créé (id: ${supabaseWsId})`)
    }

    // 2. Migrer les données métier
    await migrateWorkspace(ws.id, supabaseWsId)

    // Note : les users/memberships sont à créer manuellement via Supabase Auth
    // (import d'emails + invitation) car les mots de passe bcrypt ne sont pas
    // directement transférables dans Supabase Auth.
    const users = master
      .prepare('SELECT email, role FROM users WHERE workspace_id = ?')
      .all(ws.id) as any[]
    console.log(`\n  ℹ  ${users.length} user(s) à créer manuellement dans Supabase Auth :`)
    users.forEach(u => console.log(`     - ${u.email} (${u.role})`))
  }

  master.close()
  console.log('\n=== Migration terminée ===')
}

main().catch(err => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
