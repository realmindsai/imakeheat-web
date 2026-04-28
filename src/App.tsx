import { Gallery } from './dev/components-gallery'

export function App() {
  if (typeof window !== 'undefined' && window.location.search.includes('gallery=1')) {
    return <Gallery />
  }
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="leading-tight tracking-tight">
        <div className="font-extrabold text-rmai-fg1 text-2xl">imakeheat</div>
        <div className="font-medium text-rmai-purple text-sm tracking-wider">
          bitcrusher · for tape heads
        </div>
      </div>
    </div>
  )
}
