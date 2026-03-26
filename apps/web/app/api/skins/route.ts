import { NextRequest, NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const themeId = req.nextUrl.searchParams.get('themeId')
  if (!themeId) {
    return NextResponse.json({ error: 'themeId required' }, { status: 400 })
  }

  noStore()
  const service = createServiceClient()
  const { data, error } = await service
    .from('characters')
    .select('extra')
    .eq('theme_id', themeId)
    .eq('active', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const names = new Set<string>()
  for (const row of data ?? []) {
    const skins = (row.extra as Record<string, unknown>)?.skins as Array<{ num: number; name: string }> | undefined
    if (Array.isArray(skins)) {
      for (const skin of skins) {
        if (skin.name && skin.name !== 'default' && !/\bChroma\b/i.test(skin.name)) {
          names.add(skin.name)
        }
      }
    }
  }

  // Guarantee the challenge's own skin is always in the list
  const forcedSkin = req.nextUrl.searchParams.get('include')
  if (forcedSkin && !names.has(forcedSkin)) names.add(forcedSkin)

  return NextResponse.json([...names].sort().map(name => ({ name })))
}
