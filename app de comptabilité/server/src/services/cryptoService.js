const crypto = require('crypto')

const _rawKey = process.env.ENCRYPTION_MASTER_KEY || '';
if (_rawKey && _rawKey.length < 64) {
  console.warn('[crypto] ENCRYPTION_MASTER_KEY trop courte — chiffrement désactivé.');
}
const MASTER_KEY = (_rawKey && _rawKey.length >= 64) ? Buffer.from(_rawKey, 'hex') : null

function deriveKey(workspaceId) {
  if (!MASTER_KEY) throw new Error('Encryption non configurée (ENCRYPTION_MASTER_KEY manquante)');
  return crypto.hkdfSync('sha256', MASTER_KEY, Buffer.from(String(workspaceId)), Buffer.from('compta-v1'), 32)
}

function encrypt(plaintext, workspaceId) {
  const key = deriveKey(workspaceId)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

function decrypt(ciphertext, workspaceId) {
  if (typeof ciphertext !== 'string' || !ciphertext.startsWith('enc:')) return ciphertext
  const [, ivHex, tagHex, encHex] = ciphertext.split(':')
  const key = deriveKey(workspaceId)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  const dec = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()])
  return dec.toString('utf8')
}

const FACTURE_FIELDS  = ['client', 'description', 'montant_ht', 'montant_tva', 'montant_ttc']
const DEPENSE_FIELDS  = ['fournisseur', 'description', 'montant_ht', 'montant_tva', 'montant_ttc']
const NUMERIC_FIELDS  = new Set(['montant_ht', 'montant_tva', 'montant_ttc'])

function encryptRow(row, fields, workspaceId) {
  const out = { ...row }
  for (const f of fields) {
    if (out[f] !== undefined && out[f] !== null) {
      out[f] = encrypt(String(out[f]), workspaceId)
    }
  }
  return out
}

function decryptRow(row, fields, workspaceId) {
  const out = { ...row }
  for (const f of fields) {
    if (out[f] !== undefined && out[f] !== null) {
      const plain = decrypt(out[f], workspaceId)
      out[f] = NUMERIC_FIELDS.has(f) ? parseFloat(plain) : plain
    }
  }
  return out
}

function decryptRows(rows, fields, workspaceId) {
  return rows.map(r => decryptRow(r, fields, workspaceId))
}

module.exports = { encrypt, decrypt, encryptRow, decryptRow, decryptRows, FACTURE_FIELDS, DEPENSE_FIELDS }
