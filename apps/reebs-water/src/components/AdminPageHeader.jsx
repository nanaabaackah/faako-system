import { PageHeader } from "@faako/ui";

export default function AdminPageHeader(props) {
  return <PageHeader {...props} className={`admin-header ${props.className || ""}`} />;
}
