import axios from "axios";
import { getBackendUrl } from "../config";

const backendUrl = getBackendUrl();
const baseURL = backendUrl || '/'; // Use backendUrl directly or fallback to root relative path

const api = axios.create({
	baseURL: baseURL,
	withCredentials: true,
});

export default api;
