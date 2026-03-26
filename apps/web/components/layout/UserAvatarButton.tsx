'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  name:      string
  avatarUrl: string | null
}

export function UserAvatarButton({ name, avatarUrl: initialAvatarUrl }: Props) {
  const router      = useRouter()
  const supabase    = createClient()
  const fileRef     = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [open,      setOpen]      = useState(false)
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)

  const initial = name.charAt(0).toUpperCase()

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
      setAvatarUrl(publicUrl)
      router.refresh()
    } catch (err) {
      console.error('Avatar upload error:', err)
    } finally {
      setUploading(false)
      setOpen(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-9 h-9 rounded-full overflow-hidden border-2 border-neon-purple/50 hover:border-neon-purple transition-all duration-200 shadow-neon-sm flex items-center justify-center bg-gradient-to-br from-neon-purple to-neon-pink"
        aria-label="Menu do usuário"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="font-display text-white text-sm font-bold">{initial}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-elevated border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* User info */}
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-white text-sm font-semibold truncate">{name}</p>
          </div>

          {/* Change avatar */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors duration-150 disabled:opacity-50"
          >
            <span className="text-base">🖼️</span>
            {uploading ? 'Enviando...' : 'Mudar foto'}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors duration-150"
          >
            <span className="text-base">🚪</span>
            Sair
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
