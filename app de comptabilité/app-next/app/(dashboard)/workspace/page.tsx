import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function WorkspacePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('memberships')
    .select('role, workspaces(id, name, slug, activite_type, structure_type, created_at)')
    .eq('user_id', user.id)
    .single()

  const workspace = Array.isArray(membership?.workspaces)
    ? membership.workspaces[0]
    : membership?.workspaces

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Workspace</h1>
      <p className="text-sm text-gray-500 mb-6">Paramètres de votre espace de travail</p>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <pre className="text-xs text-gray-500">{JSON.stringify(workspace, null, 2)}</pre>
        <p className="mt-4 text-xs text-gray-400">
          UI complète en cours d'implémentation.
        </p>
      </div>
    </div>
  )
}
