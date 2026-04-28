// ABOUTME: RenderModal — fullscreen overlay shown during offline rendering.
// ABOUTME: Renders nothing when idle; shows spinner text or error with dismiss action.

import { useSessionStore } from '../store/session'

export function RenderModal() {
  const render = useSessionStore((s) => s.render)
  if (render.phase === 'idle') return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="rounded-2xl bg-white px-8 py-6 text-center shadow-2xl">
        {render.phase === 'rendering' && (
          <>
            <div className="text-[14px] font-semibold">rendering…</div>
            <div className="mt-1 font-mono text-[11px] text-rmai-mut">offline · no upload</div>
          </>
        )}
        {render.phase === 'error' && (
          <>
            <div className="text-[14px] font-semibold text-rmai-orange">render failed</div>
            <div className="mt-1 max-w-[260px] text-[12px] text-rmai-fg2">{render.message}</div>
            <button onClick={() => useSessionStore.getState().finishRender()}
              className="mt-3 text-[12px] font-semibold text-rmai-purple">
              dismiss
            </button>
          </>
        )}
      </div>
    </div>
  )
}
