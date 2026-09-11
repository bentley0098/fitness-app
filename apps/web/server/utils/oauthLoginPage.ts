function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  resource: string;
}

// Single-user login gate. This — not the DCR endpoint — is what actually
// protects the account: only someone who knows MCP_OAUTH_PASSWORD can turn
// a registered client into a usable authorization code.
export function renderLoginPage(params: AuthorizeParams, error?: string): string {
  const hidden = (name: string, value: string) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`;

  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #eee; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  form { background: #171717; padding: 2rem; border-radius: 12px; width: 100%; max-width: 320px; }
  h1 { font-size: 1rem; margin: 0 0 1rem; }
  input[type="password"] { width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid #333; background: #0a0a0a; color: #eee; box-sizing: border-box; font-size: 1rem; }
  button { width: 100%; margin-top: 1rem; padding: 0.75rem; border-radius: 8px; border: none; background: #10b981; color: white; font-weight: 600; font-size: 1rem; }
  .error { color: #f87171; font-size: 0.875rem; margin-bottom: 1rem; }
</style>
</head>
<body>
  <form method="POST" action="/oauth/authorize">
    <h1>Sign in to authorize this connection</h1>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    <input type="password" name="password" placeholder="Password" autofocus required>
    ${hidden("client_id", params.clientId)}
    ${hidden("redirect_uri", params.redirectUri)}
    ${hidden("code_challenge", params.codeChallenge)}
    ${hidden("code_challenge_method", params.codeChallengeMethod)}
    ${hidden("state", params.state)}
    ${hidden("resource", params.resource)}
    <button type="submit">Sign in</button>
  </form>
</body>
</html>`;
}
