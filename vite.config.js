import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                login: resolve(__dirname, "pages/login.html"),
                register: resolve(__dirname, "pages/register.html"),
                dashboard: resolve(__dirname, "pages/dashboard.html"),
                resetPassword: resolve(__dirname, "pages/reset-password.html"),
                actionHandler: resolve(__dirname, "pages/action-handler.html")
            }
        }
    }
});