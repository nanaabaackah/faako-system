import { IconsaxIcon } from "@faako/ui";
const names = { overview: "Home", enquiries: "Sms", content: "DocumentText", media: "Gallery", staff: "People", system: "ShieldTick", arrow: "ArrowRight4", back: "ArrowLeft4", refresh: "Refresh", check: "TickCircle", plus: "Add", close: "CloseCircle", logout: "Logout", save: "Save2", preview: "Eye" };
export default function NavigationIcon({ name }) { return <IconsaxIcon name={names[name] || "ArrowRight4"} />; }
