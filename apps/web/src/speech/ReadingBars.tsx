export const ReadingBars = ({ mode }: { mode: 'loading' | 'playing' }) => (
  <span className="read-bars" data-mode={mode} data-testid="reading-bars" aria-hidden="true">
    <i className="read-bar" />
    <i className="read-bar" />
    <i className="read-bar" />
    <i className="read-bar" />
  </span>
)
