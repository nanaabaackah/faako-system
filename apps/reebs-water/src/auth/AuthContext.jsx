import { AuthProvider as SharedAuthProvider, useAuth } from "@faako/auth";
import { reebsApiResponse } from "../api/client.js";

export { useAuth };

export function AuthProvider({ children }) {
  return (
    <SharedAuthProvider apiResponse={reebsApiResponse}>
      {children}
    </SharedAuthProvider>
  );
}
