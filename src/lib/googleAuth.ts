import type { GoogleTokenClient } from "../types/google";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export function isGoogleSignInConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_ID.trim().length > 0);
}

function waitForGoogleScript(timeoutMs = 6000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error("Google Identity Services script failed to load."));
      }
    }, 100);
  });
}

/**
 * Resolves with a Google OAuth access token. The token is opaque to us —
 * our backend is the one that calls Google to verify it and fetch the
 * profile, so a client can't just fabricate a fake identity.
 */
export async function signInWithGoogle(): Promise<string> {
  if (!isGoogleSignInConfigured()) {
    throw new Error(
      "Google sign-in isn't configured yet. Add VITE_GOOGLE_CLIENT_ID to your .env file and restart the dev server."
    );
  }

  await waitForGoogleScript();
  const google = window.google!;

  return new Promise<string>((resolve, reject) => {
    // Created fresh per call so each promise gets its own resolve/reject closures.
    const client: GoogleTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID!,
      scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: (error) => {
        if (error.type === "popup_closed") {
          reject(new Error("Google sign-in was closed before completing."));
        } else {
          reject(new Error(error.message || "Google sign-in failed."));
        }
      },
    });
    client.requestAccessToken();
  });
}
