import React, { useMemo } from "react";
import { HiCheckCircle } from "react-icons/hi";
import { getPasswordRequirementStates } from "../../../utils/passwordRequirements";

interface PasswordRequirementListProps {
  id?: string;
  password: string;
}

const PasswordRequirementList: React.FC<PasswordRequirementListProps> = ({ id, password }) => {
  const requirements = useMemo(() => getPasswordRequirementStates(password), [password]);

  return (
    <div className="auth-password-rules" id={id} aria-live="polite">
      <p className="auth-password-rules__title">Password must include</p>
      <ul className="auth-password-rules__list">
        {requirements.map((requirement) => (
          <li
            key={requirement.id}
            className={`auth-password-rules__item${requirement.met ? " is-met" : ""}`}
          >
            <span className="auth-password-rules__icon" aria-hidden="true">
              {requirement.met ? <HiCheckCircle /> : <span className="auth-password-rules__dot" />}
            </span>
            <span>{requirement.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordRequirementList;
