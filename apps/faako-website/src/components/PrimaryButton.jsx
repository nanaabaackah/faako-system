import { Link } from "react-router-dom";

export default function PrimaryButton({ children, to, type = "button", ...props }) {
  if (to) {
    return (
      <Link className="button button-primary" to={to} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button className="button button-primary" type={type} {...props}>
      {children}
    </button>
  );
}
