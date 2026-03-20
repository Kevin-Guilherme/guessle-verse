'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useDailyChallenge(themeSlug: string, mode: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['daily-challenge', themeSlug, mode],
    queryFn:  async () => {
      const today = new Date().toISOString().split('T')[0]

      const { data: theme } = await supabase
        .from('themes')
        .select('id')
        .eq('slug', themeSlug)
        .single()

      if (!theme) throw new Error('Theme not found')

      const { data, error } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('theme_id', theme.id)
        .eq('mode', mode)
        .eq('date', today)
        .single()

      if (error || !data) throw new Error('No challenge today')
      return data
    },
    staleTime: 1000 * 60 * 60,
    retry:     1,
  })
}
