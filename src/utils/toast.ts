import { toast, type ToastContent, type ToastOptions } from "react-toastify";

export const defaultToastOptions: ToastOptions = {
  position: "top-left",
  autoClose: 2500,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: "colored",
};

export const showToast = {
  success: (content: ToastContent, options?: ToastOptions) =>
    toast.success(content, { ...defaultToastOptions, ...options }),
  error: (content: ToastContent, options?: ToastOptions) =>
    toast.error(content, { ...defaultToastOptions, ...options }),
  info: (content: ToastContent, options?: ToastOptions) =>
    toast.info(content, { ...defaultToastOptions, ...options }),
  warning: (content: ToastContent, options?: ToastOptions) =>
    toast.warning(content, { ...defaultToastOptions, ...options }),
  message: (content: ToastContent, options?: ToastOptions) =>
    toast(content, { ...defaultToastOptions, ...options }),
};
