export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <div className="leading-tight tracking-tight">
      <div className={`font-extrabold text-rmai-fg1 ${small ? 'text-[13px]' : 'text-[15px]'}`}>
        imakeheat
      </div>
      <div className={`font-medium text-rmai-purple tracking-wider ${small ? 'text-[9.5px]' : 'text-[11px]'}`}>
        bitcrusher · for tape heads
      </div>
    </div>
  )
}
