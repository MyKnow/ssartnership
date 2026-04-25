import type { Preview } from "@storybook/nextjs-vite";
import React, { useEffect } from "react";
import "../src/app/globals.css";

function PreviewTheme({
  theme,
  children,
}: {
  theme: "light" | "dark";
  children: React.ReactNode;
}) {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", theme === "dark");
    html.dataset.theme = theme;
    return () => {
      html.classList.remove("dark");
      delete html.dataset.theme;
    };
  }, [theme]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="ui-page-shell-wide py-8">{children}</div>
    </div>
  );
}

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        order: ["Foundations", "UI", "Domains"],
      },
    },
    nextjs: {
      appDirectory: true,
      image: {
        unoptimized: true,
      },
    },
    backgrounds: {
      disable: true,
    },
  },
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Global theme mode",
      defaultValue: "light",
      toolbar: {
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => (
      <PreviewTheme theme={context.globals.theme}>
        <Story />
      </PreviewTheme>
    ),
  ],
};

export default preview;
