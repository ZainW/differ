interface DescriptionPanelProps {
  description: string
  open: boolean
  onToggle: () => void
}

export function DescriptionPanel({
  description,
  open,
  onToggle
}: DescriptionPanelProps): React.JSX.Element {
  return (
    <section className={`description-panel ${open ? 'is-open' : ''}`}>
      <button type="button" className="description-toggle" aria-expanded={open} onClick={onToggle}>
        <span>Description</span>
        <span className="description-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="description-body">
          {description.trim() ? (
            <pre className="description-markdown">{description}</pre>
          ) : (
            <p className="description-empty">No description provided.</p>
          )}
        </div>
      )}
    </section>
  )
}
