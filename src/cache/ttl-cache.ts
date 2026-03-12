export class TtlCache<Key, Value> {
  private readonly entries = new Map<Key, CacheEntry<Value>>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  async getOrLoad(key: Key, ttlMs: number, loader: () => Promise<Value>): Promise<Value> {
    const current = this.entries.get(key);
    const currentTime = this.now();

    if (current && current.expiresAt > currentTime && "value" in current) {
      return current.value;
    }

    if (current && "pending" in current) {
      return current.pending;
    }

    const pending = loader()
      .then((value) => {
        this.entries.set(key, {
          value,
          expiresAt: this.now() + ttlMs
        });

        return value;
      })
      .catch((error) => {
        this.entries.delete(key);
        throw error;
      });

    this.entries.set(key, {
      pending,
      expiresAt: currentTime + ttlMs
    });

    return pending;
  }
}

type CacheEntry<Value> =
  | {
      value: Value;
      expiresAt: number;
    }
  | {
      pending: Promise<Value>;
      expiresAt: number;
    };
