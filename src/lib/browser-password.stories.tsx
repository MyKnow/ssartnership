import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  copyPasswordToClipboard,
  generateBrowserPassword,
  isBrowserPasswordValid,
  storePasswordCredential,
} from "./browser-password";

type BrowserPasswordSummary = {
  clipboardCalls: string[];
  storedCredentials: Credential[];
  credentialInit: { id: string; password: string; name?: string } | null;
  generated: string;
  validGood: boolean;
  validShort: boolean;
  validNoSymbol: boolean;
  unavailableError: string;
};

async function buildBrowserPasswordSummary(): Promise<BrowserPasswordSummary> {
  const originalNavigator = globalThis.navigator;
  const originalCrypto = globalThis.crypto;
  const clipboardCalls: string[] = [];
  const storedCredentials: Credential[] = [];
  let credentialInit:
    | { id: string; password: string; name?: string }
    | null = null;
  class MockPasswordCredential {
    constructor(init: { id: string; password: string; name?: string }) {
      credentialInit = init;
      return init as unknown as Credential;
    }
  }

  try {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        clipboard: {
          writeText: async (value: string) => {
            clipboardCalls.push(value);
          },
        },
        credentials: {
          store: async (credential: Credential) => {
            storedCredentials.push(credential);
            return credential;
          },
        },
      },
    });
    Object.defineProperty(globalThis, "PasswordCredential", {
      configurable: true,
      value: MockPasswordCredential,
    });
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues: (buffer: Uint32Array) => {
          buffer[0] = 7;
          return buffer;
        },
      },
    });

    await copyPasswordToClipboard("Secret123!");
    await storePasswordCredential({
      loginId: "partner.admin",
      password: "Secret123!",
      displayName: "Partner Admin",
    });
    const generated = generateBrowserPassword(10);
    const unavailableError = await (async () => {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      try {
        await copyPasswordToClipboard("fallback");
        return "none";
      } catch (error) {
        return error instanceof Error ? error.message : "unknown";
      }
    })();

    return {
      clipboardCalls,
      storedCredentials,
      credentialInit,
      generated,
      validGood: isBrowserPasswordValid("Abcd1234!"),
      validShort: isBrowserPasswordValid("Ab1!"),
      validNoSymbol: isBrowserPasswordValid("Abcd1234"),
      unavailableError,
    };
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
    if ("PasswordCredential" in globalThis) {
      delete (globalThis as typeof globalThis & { PasswordCredential?: unknown }).PasswordCredential;
    }
  }
}

function BrowserPasswordPreview({ summary }: { summary: BrowserPasswordSummary }) {
  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>clipboard:{summary.clipboardCalls.join(",")}</div>
      <div>stored:{summary.storedCredentials.length}</div>
      <div>credential-id:{summary.credentialInit?.id ?? "none"}</div>
      <div>credential-name:{summary.credentialInit?.name ?? "none"}</div>
      <div>generated:{summary.generated}</div>
      <div>generated-length:{summary.generated.length}</div>
      <div>generated-valid:{String(isBrowserPasswordValid(summary.generated))}</div>
      <div>valid-good:{String(summary.validGood)}</div>
      <div>valid-short:{String(summary.validShort)}</div>
      <div>valid-no-symbol:{String(summary.validNoSymbol)}</div>
      <div>clipboard-error:{summary.unavailableError}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Lib/BrowserPassword",
  component: BrowserPasswordPreview,
} satisfies Meta<typeof BrowserPasswordPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  args: {
    summary: {
      clipboardCalls: [],
      storedCredentials: [],
      credentialInit: null,
      generated: "",
      validGood: false,
      validShort: false,
      validNoSymbol: false,
      unavailableError: "",
    },
  },
  loaders: [async () => ({ summary: await buildBrowserPasswordSummary() })],
  render: (_, context) => <BrowserPasswordPreview summary={context.loaded.summary} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("clipboard:Secret123!")).toBeInTheDocument();
    await expect(canvas.getByText("stored:1")).toBeInTheDocument();
    await expect(canvas.getByText("credential-id:partner.admin")).toBeInTheDocument();
    await expect(canvas.getByText("credential-name:Partner Admin")).toBeInTheDocument();
    await expect(canvas.getByText("generated-length:10")).toBeInTheDocument();
    await expect(canvas.getByText("generated-valid:true")).toBeInTheDocument();
    await expect(canvas.getByText("valid-good:true")).toBeInTheDocument();
    await expect(canvas.getByText("valid-short:false")).toBeInTheDocument();
    await expect(canvas.getByText("valid-no-symbol:false")).toBeInTheDocument();
    await expect(canvas.getByText("clipboard-error:clipboard_unavailable")).toBeInTheDocument();
  },
};
