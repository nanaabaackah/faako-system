import { AuthProvider as SharedAuthProvider } from "@faako/auth";
import { reebsApiResponse } from "../../api/client.js";

export { useAuth } from "@faako/auth";

export default function AuthProvider({ children }) {
  return (
    <SharedAuthProvider apiResponse={reebsApiResponse}>
      {children}
    </SharedAuthProvider>
  );
}
