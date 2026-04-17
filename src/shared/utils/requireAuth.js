export async function requireUser() {
  const { supabase } = await import('../../lib/supabase.js')
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) throw error
  if (!user) throw new Error('You must be signed in to save a VetRights intake.')

  return user
}
