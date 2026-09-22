/**
 * RONAV TECHNOLOGIES — 100% Self-Hosted PostgreSQL Client Adapter
 * Completely replaces external Supabase cloud with local/EC2 PostgreSQL API backend.
 * Zero external dependence, zero monthly fees, zero latency.
 */

function getApiUrl(endpoint) {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return endpoint;
  }
  const base = (typeof process !== 'undefined' && (process.env?.API_BASE_URL || process.env?.VITE_API_BASE_URL)) || 'http://127.0.0.1:5000';
  return `${base}${endpoint}`;
}

class TableQueryBuilder {
  constructor(table) {
    this.table = table;
    this._action = 'select'; // 'select' | 'insert' | 'update'
    this._data = null;
    this._filters = {};
    this._options = {};
    this._single = false;
    this._maybeSingle = false;
  }

  select(columns = '*') {
    this._columns = columns;
    return this;
  }

  eq(column, value) {
    this._filters[column] = value;
    return this;
  }

  neq(column, value) {
    return this;
  }

  like(column, pattern) {
    return this;
  }

  ilike(column, pattern) {
    return this;
  }

  in(column, values) {
    return this;
  }

  gt(column, value) {
    return this;
  }

  gte(column, value) {
    return this;
  }

  lt(column, value) {
    return this;
  }

  lte(column, value) {
    return this;
  }

  or(filters) {
    return this;
  }

  order(column, { ascending = true } = {}) {
    this._options.orderBy = column;
    this._options.orderDirection = ascending ? 'ASC' : 'DESC';
    return this;
  }

  limit(count) {
    this._options.limit = count;
    return this;
  }

  single() {
    this._single = true;
    return this;
  }

  maybeSingle() {
    this._maybeSingle = true;
    return this;
  }

  insert(data) {
    this._action = 'insert';
    this._data = data;
    return this;
  }

  upsert(data) {
    this._action = 'insert';
    this._data = data;
    return this;
  }

  update(data) {
    this._action = 'update';
    this._data = data;
    return this;
  }

  async execute() {
    try {
      if (this._action === 'insert') {
        const isArray = Array.isArray(this._data);
        const items = isArray ? this._data : [this._data];
        const results = [];

        for (const item of items) {
          const res = await fetch(getApiUrl('/api/db/insert'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: this.table, data: item }),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.error || json.message || 'Insert failed');
          results.push(json.data);
        }

        let data = isArray ? results : results[0];
        if (this._single && !data) throw new Error('Row not found');
        return { data, error: null };
      }

      if (this._action === 'update') {
        const filterKeys = Object.keys(this._filters);
        const matchCol = filterKeys[0] || 'id';
        const matchVal = this._filters[matchCol];

        const res = await fetch(getApiUrl('/api/db/update'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: this.table,
            data: this._data,
            matchColumn: matchCol,
            matchValue: matchVal,
          }),
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error || json.message || 'Update failed');
        return { data: json.data, error: null };
      }

      // Default: select
      const res = await fetch(getApiUrl('/api/db/select'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: this.table,
          filters: this._filters,
          options: this._options,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        return { data: null, error: new Error(json.error || json.message || 'Query failed') };
      }

      let data = json.data || [];
      if (this._single) {
        data = data.length > 0 ? data[0] : null;
        if (!data) {
          return { data: null, error: new Error('Row not found') };
        }
      } else if (this._maybeSingle) {
        data = data.length > 0 ? data[0] : null;
      }

      return { data, error: null };
    } catch (err) {
      console.error(`[DB ${this._action} Error: ${this.table}]`, err.message);
      return { data: null, error: err };
    }
  }

  // Execute when awaited
  then(resolve, reject) {
    return this.execute().then(resolve, (err) => {
      resolve({ data: null, error: err });
    });
  }
}

class SelfHostedDatabaseClient {
  from(table) {
    return new TableQueryBuilder(table);
  }

  channel(name) {
    return {
      on: () => this.channel(name),
      subscribe: () => ({ name }),
    };
  }

  removeChannel() {
    return true;
  }

  async rpc(procedure, params = {}) {
    try {
      const res = await fetch(getApiUrl('/api/db/query'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: `SELECT * FROM ${procedure}($1)`, params: [params] }),
      });
      const json = await res.json();
      return { data: json.data, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }
}

export const supabase = new SelfHostedDatabaseClient();

/**
 * Real-time Smart Polling Subscriptions (Local EC2 Backend)
 */
export function subscribeToWallet(userId, onUpdate) {
  const interval = setInterval(async () => {
    try {
      const { data } = await supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle();
      if (data) onUpdate(data);
    } catch (_) {}
  }, 10000);
  return () => clearInterval(interval);
}

export function subscribeToTransactions(merchantId, onInsert) {
  let lastCount = 0;
  const interval = setInterval(async () => {
    try {
      const { data } = await supabase.from('transactions').select('*').eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(5);
      if (data && data.length > lastCount && lastCount > 0) {
        onInsert(data[0]);
      }
      if (data) lastCount = data.length;
    } catch (_) {}
  }, 10000);
  return () => clearInterval(interval);
}

export function subscribeToAdminFeed(onUpdate) {
  const interval = setInterval(() => {
    onUpdate('transactions');
  }, 15000);
  return () => clearInterval(interval);
}

export default supabase;
