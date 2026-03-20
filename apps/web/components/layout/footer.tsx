export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-surface mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          Guessle — jogos diarios de adivinhar
        </p>
        <p className="text-xs text-gray-600">
          {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  )
}
