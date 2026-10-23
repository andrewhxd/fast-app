// The top bar, like an iPhone app's: a text button on each side and an optional title in the middle.
export default function NavBar({ left, title, subtitle, right }) {
  return (
    <header className="navbar">
      <span>{left}</span>
      {title ? (
        <span className="nav-title">
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
        </span>
      ) : (
        <span />
      )}
      <span>{right}</span>
    </header>
  );
}
