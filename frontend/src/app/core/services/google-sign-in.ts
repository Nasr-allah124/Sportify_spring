export const GOOGLE_CLIENT_ID ='768644512415-q9qadlcja2gpb7jt7qtau1fq4cc0b69g.apps.googleusercontent.com';





interface GoogleIdentityApi {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }): void;

  renderButton(element: HTMLElement, options: {
    theme: 'outline' | 'filled_black';
    size: 'large';
    text: 'continue_with';
    shape: 'pill';
    locale: 'fr';
    width: string;
  }): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentityApi } };
  }
}

let pending: Promise<GoogleIdentityApi> | undefined;

export function loadGoogleSignIn(): Promise<GoogleIdentityApi> {
  if (window.google?.accounts.id) {
    return Promise.resolve(window.google.accounts.id);
  }

  if (pending) return pending;

  pending = new Promise<GoogleIdentityApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;

    const fail = () => {
      script.remove();
      pending = undefined;
      reject(new Error('Chargement de Google impossible.'));
    };

    script.onload = () => {
      const api = window.google?.accounts.id;
      if (api) resolve(api);
      else fail();
    };

    script.onerror = fail;
    document.head.appendChild(script);
  });


  return pending;

}
let initialized = false;
let activeCallback: ((credential: string) => void) | undefined;

export function connectGoogleButton(
  api: GoogleIdentityApi,
  callback: (credential: string) => void
): () => void {
  if (!initialized) {
    api.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: response => activeCallback?.(response.credential)
    });
    initialized = true;
  }

  activeCallback = callback;

  return () => {
    if (activeCallback === callback) {
      activeCallback = undefined;
    }
  };
}
