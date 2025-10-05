// public/js/labels-service.js
// Static labels service for GitHub Pages (no backend).
// - Reads base labels from /data/labels-<world>.json
// - Stores created labels in localStorage per browser
// - Merges base + local for display
// - Provides a download helper for the merged set

(function () {
  const Labels = {
    storageKey(world) {
      return `labels:${String(world).toLowerCase()}`;
    },

    async getBase(world) {
      const safe = String(world).replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'earth';
      const url = `data/labels-${safe}.json`;
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json) ? json : [];
      } catch {
        return [];
      }
    },

    getLocal(world) {
      try {
        const raw = localStorage.getItem(this.storageKey(world));
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    },

    setLocal(world, arr) {
      try {
        localStorage.setItem(this.storageKey(world), JSON.stringify(arr));
      } catch {
        // best-effort; ignore quota errors, etc.
      }
    },

    async getAll(world) {
      const base = await this.getBase(world);
      const local = this.getLocal(world);
      return [...base, ...local];
    },

    add(world, { lat = 0, lng = 0, title = 'Label', desc = '' }) {
      const local = this.getLocal(world);
      local.push({
        lat: Number(lat) || 0,
        lng: Number(lng) || 0,
        title: String(title).slice(0, 80),
        desc: String(desc).slice(0, 500),
        ts: Math.floor(Date.now() / 1000)
      });
      this.setLocal(world, local);
      return { ok: true, count: local.length };
    },

    async download(world) {
      const items = await this.getAll(world);
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const name = `${String(world).toLowerCase()}-labels-${new Date().toISOString().slice(0, 10)}.json`;
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  };

  // Expose globally
  window.Labels = Labels;
})();
