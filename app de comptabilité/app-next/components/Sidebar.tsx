'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Workspace } from '@/lib/types/database'

const NAV = [
  { href: '/transactions',    label: 'Transactions' },
  { href: '/tva',             label: 'TVA' },
  { href: '/exercice',        label: 'Exercice' },
  { href: '/integrations',    label: 'Intégrations' },
  { href: '/notes-de-frais',  label: 'Notes de frais' },
  { href: '/workspace',       label: 'Workspace' },
]

interface Props {
  workspace: Pick<Workspace, 'name' | 'slug'> | null
  userEmail: string
}

export default function Sidebar({ workspace, userEmail }: Props) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-gray-200 bg-white h-screen">
      {/* Logo / workspace name */}
      <div className="px-5 py-5 border-b border-gray-100">
        <span className="text-base font-bold text-gray-900">
          {workspace?.name ?? 'Comptabilité'}
        </span>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{userEmail}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {NAV.map(({ href, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={[
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              ].join(' ')}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="w-full px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg text-left transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
