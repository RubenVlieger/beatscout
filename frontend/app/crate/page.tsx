import Sidebar from '@/components/layout/Sidebar'

export default function CratePage() {
  return (
    <div className="flex min-h-screen bg-beatscout-bg">
      <Sidebar isLoggedIn={false} />
      
      <main className="flex-1 ml-20 p-8">
        <h1 className="text-3xl font-bold mb-8">My Crate</h1>
        <div className="bg-beatscout-panel border border-beatscout-border rounded-sm p-12 text-center">
          <p className="text-beatscout-text-secondary mb-4">Your crate is empty</p>
          <a href="/explorer" className="text-beatscout-mint hover:underline">
            Explore tracks to add to your crate
          </a>
        </div>
      </main>
    </div>
  )
}
