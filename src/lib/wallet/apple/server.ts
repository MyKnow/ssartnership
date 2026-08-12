import { Buffer } from "node:buffer";

import { PKPass } from "passkit-generator";

import { createAppleWalletIconBuffers } from "./assets";
import { getAppleWalletConfigStatus } from "./config";
import { buildAppleWalletPassPayload } from "./payload";
import type {
  AppleWalletPassErrorCode,
  AppleWalletPassInput,
} from "./types";

export class AppleWalletPassError extends Error {
  code: AppleWalletPassErrorCode;

  constructor(code: AppleWalletPassErrorCode, message: string) {
    super(message);
    this.name = "AppleWalletPassError";
    this.code = code;
  }
}

export async function createAppleWalletPass(input: AppleWalletPassInput) {
  const status = getAppleWalletConfigStatus();

  if (!status.ok) {
    throw new AppleWalletPassError(
      status.code === "disabled" ? "wallet_disabled" : "wallet_config_invalid",
      status.message,
    );
  }

  try {
    const payload = buildAppleWalletPassPayload(input, status.config);
    const iconBuffers = await createAppleWalletIconBuffers();
    const pass = new PKPass(
      {
        ...iconBuffers,
        "pass.json": Buffer.from(JSON.stringify(payload, null, 2)),
      },
      {
        wwdr: status.config.wwdr,
        signerCert: status.config.signerCert,
        signerKey: status.config.signerKey,
        ...(status.config.signerKeyPassphrase
          ? { signerKeyPassphrase: status.config.signerKeyPassphrase }
          : {}),
      },
    );

    return pass.getAsBuffer();
  } catch (error) {
    if (error instanceof AppleWalletPassError) {
      throw error;
    }

    throw new AppleWalletPassError(
      "wallet_pass_build_failed",
      "Apple Wallet 패스를 생성하지 못했습니다.",
    );
  }
}
