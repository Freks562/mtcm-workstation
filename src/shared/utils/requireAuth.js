export async function requireUser(supabase) {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw new Error(error.message || 'Failed to verify authentication.')
  }

  if (!data?.user) {
    throw new Error('User not authenticated.')
  }

  return data.user
}