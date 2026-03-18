import React from "react";
import { FaApple, FaFacebookF, FaGoogle, FaWhatsapp } from "react-icons/fa";

const withBrandIcon = (IconComponent) =>
  function BrandIcon({ size = "1em", color = "currentColor", ...rest }) {
    return React.createElement(IconComponent, {
      ...rest,
      size,
      color,
    });
  };

export const faApple = withBrandIcon(FaApple);
export const faFacebookF = withBrandIcon(FaFacebookF);
export const faGoogle = withBrandIcon(FaGoogle);
export const faWhatsapp = withBrandIcon(FaWhatsapp);
