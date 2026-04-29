import { redirect } from 'next/navigation'

// La racine redirige vers /transactions (route par défaut après login)
export default function RootPage() {
  redirect('/transactions')
}
