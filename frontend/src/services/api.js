import axios from "axios";
import { getBackendUrl } from "../config";

const backendUrl = getBackendUrl();
const baseURL = backendUrl ? backendUrl + 'api' : '/api'; // Fallback to relative path if null

const api = axios.create({
	baseURL: baseURL,
	withCredentials: true,
});

export default api;
