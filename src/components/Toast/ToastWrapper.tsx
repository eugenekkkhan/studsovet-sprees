import type { ReactNode } from "react";
import { ToastContainer, toast, type ToastOptions } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const defaultToastOptions: ToastOptions = {
  position: "top-left",
  autoClose: 2500,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: "colored",
};

const showToast = {
  success: (content: ReactNode, options?: ToastOptions) =>
    toast.success(content, { ...defaultToastOptions, ...options }),
  error: (content: ReactNode, options?: ToastOptions) =>
    toast.error(content, { ...defaultToastOptions, ...options }),
  info: (content: ReactNode, options?: ToastOptions) =>
    toast.info(content, { ...defaultToastOptions, ...options }),
  warning: (content: ReactNode, options?: ToastOptions) =>
    toast.warning(content, { ...defaultToastOptions, ...options }),
  message: (content: ReactNode, options?: ToastOptions) =>
    toast(content, { ...defaultToastOptions, ...options }),
};

const ToastWrapper = () => {
  return <ToastContainer newestOnTop {...defaultToastOptions} />;
};

export { showToast };
export default ToastWrapper;
