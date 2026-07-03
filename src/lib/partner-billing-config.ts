export type PartnerBankTransferAccount = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  configured: boolean;
};

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function getPartnerBankTransferAccount(): PartnerBankTransferAccount {
  const bankName = readEnv("PARTNER_BILLING_BANK_NAME");
  const accountNumber = readEnv("PARTNER_BILLING_BANK_ACCOUNT");
  const accountHolder = readEnv("PARTNER_BILLING_ACCOUNT_HOLDER");

  return {
    bankName,
    accountNumber,
    accountHolder,
    configured: Boolean(bankName && accountNumber && accountHolder),
  };
}
