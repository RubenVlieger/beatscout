export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-beatscout-bg">
      <aside className="w-64 bg-beatscout-panel border-r border-beatscout-border flex flex-col h-screen fixed left-0 top-0">
        <div className="p-6 border-b border-beatscout-border">
          <a href="/" className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-1 h-6 bg-beatscout-mint rounded-full" />
              <div className="w-1 h-4 bg-beatscout-mint rounded-full" />
              <div className="w-1 h-8 bg-beatscout-mint rounded-full" />
            </div>
            <span className="text-xl font-bold text-white">BeatScout</span>
          </a>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {['Dashboard', 'Request New Track', 'My Crate', 'Recommended', 'Analytics', 'Settings'].map((item) => (
            <a
              key={item}
              href={`/${item.toLowerCase().replace(/ /g, '-')}`}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-beatscout-text-secondary hover:bg-beatscout-border hover:text-white transition-colors"
            >
              <span className="font-medium">{item}</span>
            </a>
          ))}
        </nav>
      </aside>
      
      <main className="flex-1 ml-64 p-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-beatscout-panel border border-beatscout-border rounded-xl p-6">
            <div className="text-4xl font-bold text-beatscout-mint mb-2">42</div>
            <div className="text-beatscout-text-secondary">Tracks Analyzed</div>
          </div>
          <div className="bg-beatscout-panel border border-beatscout-border rounded-xl p-6">
            <div className="text-4xl font-bold text-beatscout-mint mb-2">156</div>
            <div className="text-beatscout-text-secondary">Edits Found</div>
          </div>
          <div className="bg-beatscout-panel border border-beatscout-border rounded-xl p-6">
            <div className="text-4xl font-bold text-beatscout-mint mb-2">23</div>
            <div className="text-beatscout-text-secondary">In Your Crate</div>
          </div>
        </div>
      </main>
    </div>
  )
}
