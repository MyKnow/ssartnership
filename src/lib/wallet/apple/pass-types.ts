type AppleWalletField = { key: string; label: string; value: string };

/** Application-owned payload contract; signing providers do not define it. */
export type AppleWalletPassPayload = {
  formatVersion: 1;
  passTypeIdentifier: string;
  serialNumber: string;
  teamIdentifier: string;
  organizationName: string;
  description: string;
  logoText: string;
  foregroundColor: string;
  labelColor: string;
  backgroundColor: string;
  sharingProhibited: boolean;
  voided: boolean;
  authenticationToken: string;
  webServiceURL: string;
  barcodes: { format: "PKBarcodeFormatQR"; message: string; messageEncoding: string; altText: string }[];
  generic: {
    headerFields: AppleWalletField[];
    primaryFields: AppleWalletField[];
    secondaryFields: AppleWalletField[];
    auxiliaryFields: AppleWalletField[];
    backFields: AppleWalletField[];
  };
  userInfo?: never;
};
