import Notice from "../Notice/Notice";

interface ErrorMessageProps {
  message?: string | null;
  size?: "sm" | "md";
}

/** Renders nothing when there is no message — safe to leave mounted in forms. */
const ErrorMessage = ({ message, size = "sm" }: ErrorMessageProps) =>
  message ? (
    <Notice tone="error" size={size} role="alert">
      {message}
    </Notice>
  ) : null;

export type { ErrorMessageProps };
export default ErrorMessage;
