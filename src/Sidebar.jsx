// On a computer: the app's name and its places down the left side, always in view, with the
// current care team and the signed-in account at the bottom.
// Phones use the Menu button instead (the sidebar is hidden there by the stylesheet).
// `locked` while recording or editing a story, or playing a set, so a click can't throw the work away.
// It's the hint that says how to leave (e.g. "Finish or cancel this story to leave."), or false.
export default function Sidebar({ items, current, locked, onGo, groupName, account, onTeams, onSignOut }) {
  return (
    <aside className="sidebar">
      <span className="wordmark">
        FAST<span>app</span>
      </span>
      <p className="sidebar-tagline">Familiar Auditory Sensory Training</p>
      <nav className="side-nav" aria-label="Main">
        {items.map(({ label, sidebarLabel, screen, icon }) => (
          <button
            key={label}
            className={screen.name === current ? 'current' : ''}
            aria-current={screen.name === current ? 'page' : undefined}
            disabled={Boolean(locked)}
            onClick={() => onGo(screen)}
          >
            {icon}
            {sidebarLabel ?? label}
          </button>
        ))}
      </nav>
      {locked && <p className="hint sidebar-hint">{locked}</p>}

      <div className="sidebar-footer">
        {groupName && (
          <button className="sidebar-team" onClick={onTeams} disabled={Boolean(locked)}>
            <span>Care team</span>
            <strong>{groupName}</strong>
            <span className="sidebar-switch">Switch</span>
          </button>
        )}
        <div className="sidebar-account">
          <strong>{account.name}</strong>
          <span>{account.email}</span>
        </div>
        <button className="pill-small pill-white" onClick={onSignOut} disabled={Boolean(locked)}>Sign out</button>
      </div>
    </aside>
  );
}
