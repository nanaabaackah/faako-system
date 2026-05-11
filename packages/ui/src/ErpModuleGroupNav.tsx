import type { ErpNavItem } from "@faako/types";
import type { ReactNode } from "react";

interface ErpModuleGroup {
  group: string;
  modules: ErpNavItem[];
}

interface ErpModuleGroupNavProps {
  items?: ErpNavItem[];
  groups?: ErpModuleGroup[];
  groupOrder?: string[];
  groupLabels?: Record<string, string>;
  className?: string;
  renderItem: (item: ErpNavItem) => ReactNode;
}

const DEFAULT_GROUP_ORDER = ["core", "sales", "operations", "finance", "insights", "team", "system"];

const normalizeGroup = (group: string | undefined) => String(group || "system").trim().toLowerCase();

const groupItems = (items: ErpNavItem[] = [], groupOrder = DEFAULT_GROUP_ORDER): ErpModuleGroup[] => {
  const grouped = new Map<string, ErpNavItem[]>();
  items.forEach((item) => {
    const group = normalizeGroup(item.group);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)?.push(item);
  });

  const orderedGroups = [
    ...groupOrder.filter((group) => grouped.has(group)),
    ...[...grouped.keys()].filter((group) => !groupOrder.includes(group)).sort(),
  ];

  return orderedGroups.map((group) => ({ group, modules: grouped.get(group) || [] }));
};

export function ErpModuleGroupNav({
  items = [],
  groups,
  groupOrder = DEFAULT_GROUP_ORDER,
  groupLabels = {},
  className,
  renderItem,
}: ErpModuleGroupNavProps) {
  const resolvedGroups = groups || groupItems(items, groupOrder);

  return (
    <div
      className={["erp-module-group-nav", className].filter(Boolean).join(" ")}
      data-erp-shell-region="module-group"
    >
      {resolvedGroups.map((group) => (
        <section
          key={group.group}
          className={`erp-module-group erp-module-group--${group.group}`}
          data-module-group={group.group}
        >
          <p className="erp-module-group__label">{groupLabels[group.group] || group.group}</p>
          <div className="erp-module-group__items">
            {group.modules.map((item) => renderItem(item))}
          </div>
        </section>
      ))}
    </div>
  );
}
