/**
 * RONAV TECHNOLOGIES — 100% Self-Hosted PostgreSQL Client Adapter
 * Completely replaces external Supabase cloud with local/EC2 PostgreSQL API backend.
 * Zero external dependence, zero monthly fees, zero latency.
 */

class TableQueryBuilder {
  constructor(table) {
    this.table = table;
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

  async insert(data) {
    try {
      const isArray = Array.isArray(data);
      const items = isArray ? data : [data];
      const results = [];

      for (const item of items) {
        const res = await fetch('/api/db/insert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: this.table, data: item }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Insert failed');
        results.push(json.data);
      }

      return { data: isArray ? results : results[0], error: null };
    } catch (err) {
      console.error(`[DB Insert Error: ${this.table}]`, err.message);
      return { data: null, error: err };
    }
  }

  async update(data) {
    try {
      // Find the filter key
      const filterKeys = Object.keys(this._filters);
      const matchCol = filterKeys[0] || 'id';
      const matchVal = this._filters[matchCol];

      const res = await fetch('/api/db/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: this.table,
          data,
          matchColumn: matchCol,
          matchValue: matchVal,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Update failed');
      return { data: json.data, error: null };
    } catch (err) {
      console.error(`[DB Update Error: ${this.table}]`, err.message);
      return { data: null, error: err };
    }
  }

  // Execute SELECT when awaited or called directly
  async then(resolve, reject) {
    try {
      const res = await fetch('/api/db/select', {
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
        resolve({ data: null, error: json.error || new Error('Query failed') });
        return;
      }

      let data = json.data || [];
      if (this._single) {
        data = data.length > 0 ? data[0] : null;
        if (!data) {
          resolve({ data: null, error: new Error('Row not found') });
          return;
        }
      } else if (this._maybeSingle) {
        data = data.length > 0 ? data[0] : null;
      }

      resolve({ data, error: null });
    } catch (err) {
      console.error(`[DB Select Error: ${this.table}]`, err.message);
      resolve({ data: null, error: err });
    }
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
      const res = await fetch('/api/db/query', {
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
