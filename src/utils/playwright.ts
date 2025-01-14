export function convertProxyToPlaywrightFormat(proxyUrl: string) {
  const url = new URL(proxyUrl);
  return {
    server: `${url.protocol}//${url.host}`,
    username: url.username,
    password: url.password,
  };
}
