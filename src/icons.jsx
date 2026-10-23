// Small inline icons. They draw in the current text color and are hidden from screen readers,
// so every button that uses one also needs a text label.

function Icon({ children }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function MenuIcon() {
  return (
    <Icon>
      <path d="M4 7h16M4 12h16M4 17h16" {...line} />
    </Icon>
  );
}

export function HomeIcon() {
  return (
    <Icon>
      <path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" {...line} strokeWidth={2} />
    </Icon>
  );
}

export function BackIcon() {
  return (
    <Icon>
      <path d="M15 5l-7 7 7 7" {...line} />
    </Icon>
  );
}

export function ChevronIcon() {
  return (
    <Icon>
      <path d="M9 5l7 7-7 7" {...line} />
    </Icon>
  );
}

export function CheckIcon() {
  return (
    <Icon>
      <path d="M5 12l5 5 9-10" {...line} strokeWidth={3} />
    </Icon>
  );
}

export function MoreIcon() {
  return (
    <Icon>
      <circle cx="5" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="19" cy="12" r="2" fill="currentColor" />
    </Icon>
  );
}

export function ScissorsIcon() {
  return (
    <Icon>
      <circle cx="6" cy="6" r="3" {...line} strokeWidth={2} />
      <circle cx="6" cy="18" r="3" {...line} strokeWidth={2} />
      <path d="M8.1 8.1L20 20M8.1 15.9L20 4" {...line} strokeWidth={2} />
    </Icon>
  );
}

export function RedoIcon() {
  return (
    <Icon>
      <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" {...line} strokeWidth={2} />
    </Icon>
  );
}

export function MicIcon() {
  return (
    <Icon>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" {...line} strokeWidth={2} />
    </Icon>
  );
}

export function LockIcon() {
  return (
    <Icon>
      <rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" {...line} />
    </Icon>
  );
}

export function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5v14M5 12h14" {...line} />
    </Icon>
  );
}

export function ArrangeIcon() {
  return (
    <Icon>
      <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" {...line} />
    </Icon>
  );
}

export function HeadphonesIcon() {
  return (
    <Icon>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H4zM17 15h3v5h-3z" {...line} strokeWidth={2} />
    </Icon>
  );
}

export function PlayIcon() {
  return (
    <Icon>
      <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor" />
    </Icon>
  );
}

export function PauseIcon() {
  return (
    <Icon>
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </Icon>
  );
}

export function StopIcon() {
  return (
    <Icon>
      <rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor" />
    </Icon>
  );
}

export function TrashIcon() {
  return (
    <Icon>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" {...line} strokeWidth={2} />
    </Icon>
  );
}
