export type MetaProvider = "facebook" | "instagram";

export type MetaConnection = {
  id?: string;
  organization_id: string;
  provider: MetaProvider;
  display_name: string | null;
  page_id: string | null;
  instagram_business_account_id: string | null;
  ad_account_id: string | null;
  verify_token: string | null;
  access_token_encrypted: string | null;
  is_connected: boolean;
};

export function resolveMetaAccessToken(accessTokenEncrypted: string | null) {
  // TODO: Decrypt with a KMS-backed key before storing production tokens encrypted.
  return accessTokenEncrypted;
}

export function metaProviderText(provider: string) {
  switch (provider) {
    case "facebook":
      return "Facebook";
    case "instagram":
      return "Instagram";
    default:
      return provider;
  }
}
