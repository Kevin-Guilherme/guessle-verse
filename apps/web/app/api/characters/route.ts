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
    .select('name, image_url, attributes, extra')
    .eq('theme_id', themeId)
    .eq('active', true)
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const characters = (data ?? []).map((c: {
    name: string
    image_url: string | null
    attributes: Record<string, unknown>
    extra: Record<string, unknown>
  }) => ({
    name:      c.name,
    image_url: c.image_url,
    positions: String(c.attributes?.positions ?? ''),
  }))

  return NextResponse.json(characters)
}
