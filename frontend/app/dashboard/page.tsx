import Sidebar from '@/components/layout/Sidebar'

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-beatscout-bg">
      <Sidebar isLoggedIn={false} />
      
      <main className="flex-1 ml-20 p-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-beatscout-panel border border-beatscout-border rounded-sm p-6">
            <div className="text-4xl font-bold text-beatscout-mint mb-2 font-mono">42</div>
            <div className="text-beatscout-text-secondary">Tracks Analyzed</div>
          </div>
          <div className="bg-beatscout-panel border border-beatscout-border rounded-sm p-6">
            <div className="text-4xl font-bold text-beatscout-mint mb-2 font-mono">156</div>
            <div className="text-beatscout-text-secondary">Edits Found</div>
          </div>
          <div className="bg-beatscout-panel border border-beatscout-border rounded-sm p-6">
            <div className="text-4xl font-bold text-beatscout-mint mb-2 font-mono">23</div>
            <div className="text-beatscout-text-secondary">In Your Crate</div>
          </div>
        </div>
      </main>
    </div>
  )
}
