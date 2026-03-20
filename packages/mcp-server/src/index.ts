/**
 * mcp-server 包的公共导出入口。
 */
import { createApp } from "./bootstrap/app.js";

/**
 * 导出应用装配入口，供后续服务启动逻辑复用。
 */
export { createApp };
