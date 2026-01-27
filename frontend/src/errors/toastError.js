import { toast } from "react-toastify";
import { i18n } from "../translate/i18n";

const toastError = err => {
	const errorMsg = err?.response?.data?.message || err?.response?.data?.error;
	if (errorMsg) {
		if (i18n.exists(`backendErrors.${errorMsg}`)) {
			toast.error(i18n.t(`backendErrors.${errorMsg}`), {
				toastId: errorMsg,
			});
		} else {
			toast.error(errorMsg, {
				toastId: errorMsg,
			});
		}
	} else {
    console.error("An error occurred! Full error object:", err);
    // If err is a string, show it
    if (typeof err === 'string') {
        toast.error(err);
    } else {
        toast.error("An error occurred!");
    }
  }
};

export default toastError;
