export type PublicEnv = {
  apiBaseUrl: string;
};

export function getPublicEnv(): PublicEnv {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!apiBaseUrl) {
    throw new Error(
      "Missing public environment configuration: VITE_API_BASE_URL. " +
        "Use .env.example as the local template."
    );
  }

  return { apiBaseUrl };
}
