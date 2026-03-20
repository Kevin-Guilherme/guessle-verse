export function Footer() {
  return (
    <footer className="border-t border-purple-500/10 bg-void/60 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-slate-600 font-display tracking-widest uppercase">
          GUESSLE — Jogos diarios
        </p>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-neon-purple/60 animate-pulse" />
          <p className="text-xs text-slate-700 font-display">
            {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  )
}
