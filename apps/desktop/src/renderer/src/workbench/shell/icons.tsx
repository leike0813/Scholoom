interface IconProps {
  className?: string;
}

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export function IconPlus() {
  return (
    <Svg>
      <path
        d="M8 3v10M3 8h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconLibrary() {
  return (
    <Svg>
      <path
        d="M3 3.5A1.5 1.5 0 0 1 4.5 2H13v11H4.5A1.5 1.5 0 0 0 3 14.5z M3 12V3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconSettings() {
  return (
    <Svg>
      <circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconChat() {
  return (
    <Svg>
      <path
        d="M2.5 3h11v8h-7l-4 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconFolder() {
  return (
    <Svg>
      <path
        d="M1.5 3.5h4l1.5 2h7.5v7h-13z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconTasks() {
  return (
    <Svg>
      <path
        d="M2.5 4l1 1 2-2M2.5 9l1 1 2-2M2.5 14l1 1 2-2M8 4.5h6M8 9.5h6M8 14.5h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconChevronLeft() {
  return (
    <Svg>
      <path
        d="M10 3 5 8l5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconChevronRight() {
  return (
    <Svg>
      <path
        d="M6 3l5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconChevronDown() {
  return (
    <Svg>
      <path
        d="M3 6l5 5 5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconSplit() {
  return (
    <Svg>
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="11"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M8 2.5v11" stroke="currentColor" strokeWidth="1.2" />
    </Svg>
  );
}

export function IconSend() {
  return (
    <Svg>
      <path
        d="M8 13V3M3.5 7.5 8 3l4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconMore() {
  return (
    <Svg>
      <circle cx="3" cy="8" r="1.2" fill="currentColor" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="13" cy="8" r="1.2" fill="currentColor" />
    </Svg>
  );
}

export function IconClose() {
  return (
    <Svg>
      <path
        d="m4 4 8 8M12 4l-8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconTheme() {
  return (
    <Svg>
      <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
    </Svg>
  );
}

export function IconReader() {
  return (
    <Svg>
      <rect
        x="3"
        y="2"
        width="10"
        height="12"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconEdit() {
  return (
    <Svg>
      <path
        d="M9.8 2.9l3.3 3.3L6 13.3H2.7V10z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M8.5 4.2l3.3 3.3" stroke="currentColor" strokeWidth="1.2" />
    </Svg>
  );
}

export function IconPreview() {
  return (
    <Svg>
      <path
        d="M1.5 8s2.4-4.2 6.5-4.2S14.5 8 14.5 8 12.1 12.2 8 12.2 1.5 8 1.5 8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </Svg>
  );
}

export function IconPaperclip() {
  return (
    <Svg>
      <path
        d="M8.5 14.5l-5-5c-1.1-1.1-1.1-2.9 0-4s2.9-1.1 4 0l6 6c1.9 1.9 1.9 5 0 6.9s-5 1.9-6.9 0l-6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconSearch() {
  return (
    <Svg>
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  );
}

export function IconFolderOpen() {
  return (
    <Svg>
      <path
        d="M1.5 3.5h4l1.5 2h5.5M1.5 5.5v7h12l1.5-5H4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconTune() {
  return (
    <Svg>
      <path
        d="M2 4.5h7M12.5 4.5H14M2 11.5h1.5M7 11.5h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="10.5" cy="4.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5.5" cy="11.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </Svg>
  );
}

export function IconSidebarLeft() {
  return (
    <Svg>
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="11"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M5.5 2.5v11" stroke="currentColor" strokeWidth="1.2" />
    </Svg>
  );
}
