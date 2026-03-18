import { Danger } from "iconsax-react";

const FA_SIZE_MAP = {
  "2xs": "0.625em",
  xs: "0.75em",
  sm: "0.875em",
  lg: "1.25em",
  xl: "1.5em",
  "2xl": "2em",
};

const resolveSize = (size) => {
  if (size == null) return "1em";
  if (typeof size === "number") return size;
  return FA_SIZE_MAP[size] || size;
};

const resolveVariant = (iconStyle) => {
  if (!iconStyle || typeof iconStyle !== "string") {
    return "Linear";
  }
  const normalized = iconStyle.trim().toLowerCase();
  if (normalized === "bold") return "Bold";
  if (normalized === "bulk") return "Bulk";
  if (normalized === "outline") return "Outline";
  if (normalized === "twotone" || normalized === "two-tone") return "TwoTone";
  if (normalized === "broken") return "Broken";
  return "Linear";
};

export function FontAwesomeIcon({
  icon,
  color,
  size,
  iconStyle,
  className,
  style,
  spin,
  ...rest
}) {
  const isRenderableComponent =
    typeof icon === "function" ||
    (typeof icon === "object" && icon !== null && typeof icon.$$typeof === "symbol");
  const IconComponent = isRenderableComponent ? icon : Danger;
  const resolvedStyle = spin
    ? { ...style, animation: "iconsax-spin 1s linear infinite" }
    : style;

  return (
    <IconComponent
      {...rest}
      className={className}
      style={resolvedStyle}
      color={color || "currentColor"}
      size={resolveSize(size)}
      variant={resolveVariant(iconStyle)}
      aria-hidden={rest["aria-label"] ? undefined : true}
    />
  );
}

export default FontAwesomeIcon;
