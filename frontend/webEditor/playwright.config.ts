import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests",
    workers: 1,
    use: {
        baseURL: "http://127.0.0.1:5173",
        viewport: { width: 1400, height: 1000 },
        hasTouch: true,
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
            ? {
                  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
                  args: ["--no-zygote"],
              }
            : {},
    },
    webServer: {
        command: "npm run dev -- --host 127.0.0.1",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: !process.env.CI,
    },
});
