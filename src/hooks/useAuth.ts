import { useContext } from "react";
import AuthContext, { type AuthContextType } from "../context/AuthContext";

/** Кто вошёл в приложение. Работает только внутри AuthProvider. */
export const useAuth = (): AuthContextType => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth используется вне AuthProvider");
  }
  return value;
};
