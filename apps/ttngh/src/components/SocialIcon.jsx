import { FaFacebookF, FaInstagram, FaLinkedinIn } from "react-icons/fa6";

const icons = {
  facebook: FaFacebookF,
  instagram: FaInstagram,
  linkedin: FaLinkedinIn,
};

export default function SocialIcon({ name, title = undefined }) {
  const Icon = icons[name];
  if (!Icon) return null;
  return <Icon aria-hidden="true" focusable="false" title={title} />;
}
