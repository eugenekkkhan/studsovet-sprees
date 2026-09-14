import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { defaultToastOptions } from "../../../utils/toast";

const ToastWrapper = () => <ToastContainer newestOnTop {...defaultToastOptions} />;

export default ToastWrapper;
