import { createClient } from '@/lib/supabase/server'

export default async function TransactionsPage() {
  const supabase = await createClient()

  // TODO : implémenter la pagination, les filtres, l'édition inline
  const { data: factures } = await supabase
    .from('factures')
    .select('*')
    .order('date', { ascending: false })
    .limit(20)

  const { data: depenses } = await supabase
    .from('depenses')
    .select('*')
    .order('date', { ascending: false })
    .limit(20)

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <p className="text-sm text-gray-500 mt-1">Factures et dépenses</p>
      </div>

      {/* Placeholder — à remplacer par le DataTable complet */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">
        {factures?.length ?? 0} factures · {depenses?.length ?? 0} dépenses
        <p className="mt-2 text-xs text-gray-400">
          Page en cours d'implémentation — migration depuis Railway en attente.
        </p>
      </div>
    </div>
  )
}
