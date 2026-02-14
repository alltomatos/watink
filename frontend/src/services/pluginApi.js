import axios from "axios";

const pluginApi = axios.create({
  baseURL: "/plugins",
  withCredentials: true,
});

export default pluginApi;
