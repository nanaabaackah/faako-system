import { useUiSystem } from "./SystemProvider";

const FAAKO_WEBSITE_URL = "https://faako.nanaabaackah.com";

function FaakoMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 375 375"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M74.934 144.785c20.738 0 37.878-16.629 37.878-37.309 0-20.664-17.14-37.758-37.878-37.758-20.727 0-37.419 17.094-37.419 37.758 0 20.68 16.692 37.309 37.419 37.309Zm226.308 0c20.738 0 37.414-16.629 37.414-37.309 0-20.664-16.676-37.758-37.414-37.758-20.727 0-37.407 17.094-37.407 37.758 0 20.68 16.68 37.309 37.407 37.309Zm0-18.43c10.824 0 18.938-8.531 18.938-18.879 0-10.332-8.114-18.879-18.938-18.879-10.364 0-18.926 8.547-18.926 18.879 0 10.348 8.56 18.879 18.926 18.879Zm-113.148-49.43c21.187 0 37.863-17.09 37.863-37.758 0-20.23-16.676-37.292-37.863-37.292-20.742 0-37.418 17.062-37.418 37.292 0 20.668 16.676 37.758 37.418 37.758Zm0-18.879c10.824 0 19.386-8.097 19.386-18.879 0-10.347-8.562-18.875-19.386-18.875-10.363 0-18.926 8.532-18.926 18.875 0 10.782 8.563 18.879 18.926 18.879ZM56.453 225.227v-25.161c0-10.332 8.562-18.879 18.941-18.879 10.363 0 18.477 8.547 18.477 18.879v31.457h18.941v-31.457c0-20.68-17.14-37.313-37.418-37.313-20.742.004-37.879 16.633-37.879 37.313v34.152c0 15.739 12.625 28.321 28.41 28.321H93.87v73.246c0 20.234 17.125 37.312 37.879 37.312 20.727 0 37.418-17.078 37.418-37.312v-61.114h-18.492v61.114c0 9.886-8.562 18.433-18.925 18.433-10.375 0-18.938-8.547-18.938-18.433V262.54h94.223v73.246c0 20.234 17.121 37.312 37.863 37.312 20.277 0 37.418-17.078 37.418-37.312v-61.114h-18.941v61.114c0 9.886-8.114 18.433-18.477 18.433s-18.941-8.547-18.941-18.433V262.54h84.754c15.336 0 27.946-12.582 27.946-28.321v-34.152c0-20.68-16.676-37.313-37.414-37.313-20.727 0-37.867 16.633-37.867 37.313v43.59h-94.208v-111.45c0-10.348 8.563-18.879 18.926-18.879 10.824 0 18.942 8.531 18.942 18.879v99.316h18.922v-99.316c0-20.68-17.122-37.758-37.864-37.758-20.742 0-37.418 17.078-37.418 37.758v111.453H65.926c-5.406 0-9.473-4.5-9.473-9.442Zm225.863 18.433v-43.594c0-10.332 8.562-18.879 18.926-18.879 10.375 0 18.938 8.547 18.938 18.879v34.152c0 4.946-4.512 9.442-9.469 9.442Zm-207.382-117.305c10.824 0 18.937-8.531 18.937-18.879 0-10.332-8.113-18.879-18.937-18.879-10.364 0-18.926 8.547-18.926 18.879 0 10.348 8.562 18.879 18.926 18.879Z"
      />
    </svg>
  );
}

export function AppBottomBar({
  businessName,
  className,
  variant = "standalone",
}: {
  businessName?: string;
  className?: string;
  variant?: "standalone" | "footer";
}) {
  const year = new Date().getFullYear();
  const { appSystem } = useUiSystem();
  const resolvedBusinessName =
    businessName?.trim()
    || appSystem?.brand?.businessName?.trim()
    || appSystem?.brand?.name
    || "Faako";

  const bottomBarClassName = [
    "ui-app-bottom-bar",
    `ui-app-bottom-bar--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={bottomBarClassName}>
      <span className="ui-app-bottom-bar__copy">
        &copy; {year} {resolvedBusinessName}. All rights reserved.
      </span>
      <a
        className="ui-app-bottom-bar__powered"
        href={FAAKO_WEBSITE_URL}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Visit the Faako website"
      >
        <span>Powered by</span>
        <span className="ui-app-bottom-bar__mark" aria-hidden="true">
          <FaakoMark />
        </span>
        <span>Faako</span>
      </a>
      <span className="ui-app-bottom-bar__copy">Made to matter. Made by Nana.</span>
    </div>
  );
}
