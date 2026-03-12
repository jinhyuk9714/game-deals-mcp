export function bindFetchImplementation(customFetch?: typeof fetch): typeof fetch {
  if (customFetch) {
    return customFetch;
  }

  return (input: URL | Request | string, init?: RequestInit) => globalThis.fetch(input, init);
}
