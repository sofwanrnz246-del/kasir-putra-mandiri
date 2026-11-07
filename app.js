/* Kasir Putra Mandiri Motor — Web POS prototype
   Modul: CFG, Fmt, Store, UI, Settings, Catalog, Cart, History, Chart, Receipt, Printer */
"use strict";

/* ========== Konfigurasi ========== */
const CFG = {
  shop: {
    name: "Bengkel Putra Mandiri Motor",
    address: "Jl. H. Hasan Arif, Cipicung, Kec. Banyuresmi, Garut, Jawa Barat 44191",
    phone: "+62 831-5726-8873",
    cashier: "Admin",
  },
  keys: { items: "pmm_items", trx: "pmm_trx", shop: "pmm_shop", printer: "pmm_printer", logo: "pmm_logo" },
  receiptWidth: 32, // karakter per baris, kertas 58mm
  seed: [
    { id: "s1", name: "Oli Mpx2", category: "Sparepart", price: 55000, stock: 20, img: "", variants: [] },
    { id: "s2", name: "Busi NGK", category: "Sparepart", price: 25000, stock: 30, img: "", variants: [] },
    { id: "s3", name: "Kampas Rem Front", category: "Sparepart", price: 45000, stock: 15, img: "", variants: [] },
    { id: "p1", name: "Paket Service Ringan", category: "Paket Service", price: 35000, stock: null, img: "",
      variants: [{ label: "Motor Bebek", price: 35000 }, { label: "Motor Matic", price: 45000 }] },
    { id: "p2", name: "Paket Tune Up Injeksi", category: "Paket Service", price: 65000, stock: null, img: "", variants: [] },
    { id: "p3", name: "Paket Service Full / Overhaul", category: "Paket Service", price: 150000, stock: null, img: "", variants: [] },
  ],
};

/* ========== Helper ========== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const Fmt = {
  rp: (n) => "Rp " + Math.round(n || 0).toLocaleString("id-ID"),
  num: (n) => Math.round(n || 0).toLocaleString("id-ID"),
  short(n) { return n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(".", ",") + " jt" : n >= 1e3 ? Math.round(n / 1e3) + " rb" : String(Math.round(n)); },
  digits: (s) => parseInt(String(s).replace(/\D/g, ""), 10) || 0,
  p2: (n) => String(n).padStart(2, "0"),
  esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  ymd(d) { return `${d.getFullYear()}-${Fmt.p2(d.getMonth() + 1)}-${Fmt.p2(d.getDate())}`; },
  now() { const d = new Date(); return { date: Fmt.ymd(d), time: `${Fmt.p2(d.getHours())}:${Fmt.p2(d.getMinutes())}:${Fmt.p2(d.getSeconds())}` }; },
  dateID(iso) { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; },
};

/* ========== Penyimpanan (LocalStorage) ========== */
const Store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch { UI.toast("Penyimpanan penuh. Hapus foto besar atau data lama."); return false; }
  },
};

/* ========== UI umum ========== */
const UI = {
  modal(html) { $("#modalBox").innerHTML = html; $("#modal").hidden = false; },
  close() { $("#modal").hidden = true; $("#modalBox").innerHTML = ""; $("#modalBox").onclick = null; },
  toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(UI._t); UI._t = setTimeout(() => (t.hidden = true), 2600); },
  current: "kasir",
  showView(name) {
    this.current = name;
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    $$("#mainNav .tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
    if (name === "riwayat") History.render();
    if (name === "setelan") { Settings.renderProducts(); Printer.refresh(); }
  },
  init() {
    $("#mainNav").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) UI.showView(b.dataset.view); });
    $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") UI.close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") UI.close(); });
    // sinkron antar tab/jendela browser yang sama (mis. kasir di satu tab, layar omzet di tab lain)
    window.addEventListener("storage", (e) => {
      if (e.key === CFG.keys.trx) { History.list = Store.get(CFG.keys.trx, []); if (UI.current === "riwayat") History.render(); }
      if (e.key === CFG.keys.items) { Catalog.items = Store.get(CFG.keys.items, Catalog.items); Catalog.render(); }
    });
  },
};

/* ========== Setelan: info bengkel & daftar produk ========== */
const Settings = {
  shop: { ...CFG.shop },
  init() {
    this.shop = { ...CFG.shop, ...Store.get(CFG.keys.shop, {}) };
    const f = $("#shopForm");
    this.fill();
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      Object.keys(this.shop).forEach((k) => (this.shop[k] = String(fd.get(k)).trim() || this.shop[k]));
      if (Store.set(CFG.keys.shop, this.shop)) UI.toast("Info bengkel disimpan");
    });
    $("#btnAddItem").addEventListener("click", () => Catalog.openForm());
    $("#prodList").addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      b.dataset.act === "edit" ? Catalog.openForm(b.dataset.id) : Catalog.remove(b.dataset.id);
    });
    $("#btnTestPrint").addEventListener("click", () => {
      const { date, time } = Fmt.now();
      Printer.print({ id: "TRX-TES-000", date, time, total: 100000, pay: 100000, change: 0, cashier: this.shop.cashier,
        items: [{ name: "Tes Cetak Struk", variant: "", category: "Sparepart", price: 100000, qty: 1 }] });
    });
  },
  fill() { const f = $("#shopForm"); Object.keys(this.shop).forEach((k) => { if (f.elements[k]) f.elements[k].value = this.shop[k]; }); },
  renderProducts() {
    $("#prodList").innerHTML = Catalog.items.length ? Catalog.items.map((i) => {
      const svc = i.category === "Paket Service";
      return `<div class="prow"><div class="pthumb">${i.img ? `<img src="${i.img}" alt="">` : svc ? "🔧" : "🔩"}</div>
        <div class="pinfo"><b>${Fmt.esc(i.name)}</b><small>${i.category} · ${i.variants.length ? "mulai " : ""}${Fmt.rp(Catalog.minPrice(i))}${i.stock !== null ? " · stok " + i.stock : ""}</small></div>
        <div class="pbtns"><button class="btn sm" data-act="edit" data-id="${i.id}">Ubah</button><button class="btn sm danger" data-act="del" data-id="${i.id}">Hapus</button></div></div>`;
    }).join("") : `<p class="empty">Belum ada produk. Tekan "Tambah produk".</p>`;
  },
};

/* ========== Katalog (kasir): hanya menampilkan + Keranjang ========== */
const Catalog = {
  items: [], cat: "all", q: "", formImg: "",

  init() {
    this.items = Store.get(CFG.keys.items, null) || CFG.seed.map((i) => ({ ...i }));
    this.save();
    $("#search").addEventListener("input", (e) => { this.q = e.target.value.toLowerCase(); this.render(); });
    $("#filterChips").addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      this.cat = b.dataset.cat;
      $$("#filterChips .chip").forEach((c) => c.classList.toggle("active", c === b));
      this.render();
    });
    $("#catalogGrid").addEventListener("click", (e) => { const b = e.target.closest("[data-add]"); if (b) Cart.addItem(b.dataset.add); });
    this.render();
  },
  save() { return Store.set(CFG.keys.items, this.items); },
  find(id) { return this.items.find((i) => i.id === id); },
  minPrice(it) { return it.variants.length ? Math.min(...it.variants.map((v) => v.price)) : it.price; },

  render() {
    const list = this.items.filter((i) => (this.cat === "all" || i.category === this.cat) && i.name.toLowerCase().includes(this.q));
    $("#catalogGrid").innerHTML = list.length ? list.map((i) => {
      const out = i.stock !== null && i.stock <= 0, svc = i.category === "Paket Service";
      const meta = svc ? (i.variants.length ? i.variants.length + " pilihan tarif" : "Jasa service") : (i.stock === null ? "Sparepart" : out ? "Stok habis" : "Stok " + i.stock);
      return `<div class="card ${out ? "out" : ""}">
        <div class="card-img">${i.img ? `<img src="${i.img}" alt="">` : svc ? "🔧" : "🔩"}</div>
        <div class="card-body"><div class="card-name">${Fmt.esc(i.name)}</div><div class="card-meta">${meta}</div>
          <div class="card-price">${i.variants.length ? "Mulai " : ""}${Fmt.rp(this.minPrice(i))}</div></div>
        <button class="card-add" data-add="${i.id}" ${out ? "disabled" : ""}>${out ? "Stok habis" : "+ Keranjang"}</button>
      </div>`;
    }).join("") : `<p class="empty">Tidak ada item yang cocok. Produk baru bisa ditambahkan di menu Setelan.</p>`;
    Settings.renderProducts();
  },

  openForm(id) {
    const it = id ? this.find(id) : null;
    this.formImg = it ? it.img : "";
    const isSvc = it ? it.category === "Paket Service" : false;
    UI.modal(`<h2>${it ? "Ubah produk" : "Tambah produk"}</h2>
      <form class="form" id="itemForm">
        <label class="field">Nama produk<input name="name" required value="${it ? Fmt.esc(it.name) : ""}"></label>
        <div class="two">
          <label class="field">Kategori<select name="category" id="fCat"><option ${!isSvc ? "selected" : ""}>Sparepart</option><option ${isSvc ? "selected" : ""}>Paket Service</option></select></label>
          <label class="field">Harga jual (Rp)<input name="price" type="number" min="0" inputmode="numeric" required value="${it ? it.price : ""}"></label>
        </div>
        <label class="field">Stok (kosongkan jika tidak dibatasi)<input name="stock" type="number" min="0" inputmode="numeric" value="${it && it.stock !== null ? it.stock : ""}"></label>
        <label class="field" id="fVarWrap" ${isSvc ? "" : "hidden"}>Variasi tarif (opsional, satu per baris: Nama=Harga)
          <textarea name="variants" rows="3" placeholder="Motor Bebek=35000&#10;Motor Matic=45000">${it ? it.variants.map((v) => `${Fmt.esc(v.label)}=${v.price}`).join("\n") : ""}</textarea></label>
        <label class="field">Foto produk<input type="file" accept="image/*" id="fFile"></label>
        <img class="preview-img" id="fPreview" alt="" ${this.formImg ? `src="${this.formImg}"` : "hidden"}>
        <div class="modal-actions"><button type="button" class="btn ghost" id="fCancel">Batal</button><button class="btn primary">Simpan</button></div>
      </form>`);
    $("#fCat").addEventListener("change", (e) => ($("#fVarWrap").hidden = e.target.value !== "Paket Service"));
    $("#fCancel").addEventListener("click", () => UI.close());
    $("#fFile").addEventListener("change", (e) => this.readImage(e.target.files[0]));
    $("#itemForm").addEventListener("submit", (e) => { e.preventDefault(); this.submit(new FormData(e.target), id); });
  },

  // Foto galeri -> FileReader -> diperkecil via canvas -> Base64
  readImage(file) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const r = Math.min(1, 480 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        this.formImg = c.toDataURL("image/jpeg", 0.75);
        const p = $("#fPreview"); p.src = this.formImg; p.hidden = false;
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  },

  submit(fd, id) {
    const category = fd.get("category");
    const variants = category === "Paket Service"
      ? String(fd.get("variants")).split("\n").map((l) => l.split("=")).filter((p) => p.length === 2 && Fmt.digits(p[1]) > 0).map((p) => ({ label: p[0].trim(), price: Fmt.digits(p[1]) })) : [];
    const stockRaw = String(fd.get("stock")).trim();
    const data = { name: String(fd.get("name")).trim(), category, price: Fmt.digits(fd.get("price")), stock: stockRaw === "" ? null : Fmt.digits(stockRaw), img: this.formImg, variants };
    if (!data.name) return UI.toast("Nama produk wajib diisi");
    if (id) Object.assign(this.find(id), data); else this.items.push({ id: Fmt.uid(), ...data });
    if (this.save()) { UI.close(); this.render(); UI.toast(id ? "Produk diperbarui" : "Produk ditambahkan"); }
  },

  remove(id) {
    const it = this.find(id);
    if (!it || !confirm(`Hapus "${it.name}" dari katalog?`)) return;
    this.items = this.items.filter((i) => i.id !== id);
    this.save(); this.render();
  },

  deduct(lines) {
    lines.forEach((l) => { const it = this.find(l.itemId); if (it && it.stock !== null) it.stock = Math.max(0, it.stock - l.qty); });
    this.save(); this.render();
  },
};

/* ========== Keranjang & Pembayaran ========== */
const Cart = {
  lines: [], pay: 0,

  init() {
    $("#cartLines").addEventListener("click", (e) => {
      const b = e.target.closest("[data-k]"); if (!b) return;
      this.change(b.dataset.k, b.dataset.d === "+" ? 1 : b.dataset.d === "-" ? -1 : 0);
    });
    $("#btnClearCart").addEventListener("click", () => { this.lines = []; this.pay = 0; $("#payInput").value = ""; this.render(); });
    $("#payInput").addEventListener("input", (e) => { this.pay = Fmt.digits(e.target.value); e.target.value = this.pay ? Fmt.num(this.pay) : ""; this.render(); });
    $("#quickPay").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      this.pay = b.dataset.v === "pas" ? this.total() : Number(b.dataset.v);
      $("#payInput").value = Fmt.num(this.pay); this.render();
    });
    $("#btnCheckout").addEventListener("click", () => this.checkout());
    $("#cartBar").addEventListener("click", () => $("#cartPanel").classList.add("open"));
    $("#btnCloseCart").addEventListener("click", () => $("#cartPanel").classList.remove("open"));
    this.render();
  },
  total() { return this.lines.reduce((s, l) => s + l.price * l.qty, 0); },
  count() { return this.lines.reduce((s, l) => s + l.qty, 0); },
  inCart(itemId) { return this.lines.filter((l) => l.itemId === itemId).reduce((s, l) => s + l.qty, 0); },

  addItem(id) {
    const it = Catalog.find(id); if (!it) return;
    if (!it.variants.length) return this.push(it, "", it.price);
    UI.modal(`<h2>${Fmt.esc(it.name)}</h2><p class="hint" style="margin-bottom:10px">Pilih tarif service</p>
      ${it.variants.map((v, i) => `<button class="variant-btn" data-vi="${i}"><span>${Fmt.esc(v.label)}</span><span>${Fmt.rp(v.price)}</span></button>`).join("")}
      <div class="modal-actions"><button class="btn ghost" id="vCancel">Batal</button></div>`);
    $("#vCancel").onclick = () => UI.close();
    $("#modalBox").onclick = (e) => {
      const b = e.target.closest("[data-vi]"); if (!b) return;
      const v = it.variants[b.dataset.vi]; UI.close(); this.push(it, v.label, v.price);
    };
  },

  push(it, variant, price) {
    if (it.stock !== null && this.inCart(it.id) + 1 > it.stock) return UI.toast("Stok " + it.name + " tidak cukup");
    const key = it.id + "|" + variant, ex = this.lines.find((l) => l.key === key);
    if (ex) ex.qty++; else this.lines.push({ key, itemId: it.id, name: it.name, variant, category: it.category, price, qty: 1 });
    this.render(); UI.toast("+ " + it.name);
  },

  change(key, d) {
    const l = this.lines.find((x) => x.key === key); if (!l) return;
    const it = Catalog.find(l.itemId);
    if (d > 0 && it && it.stock !== null && this.inCart(l.itemId) + 1 > it.stock) return UI.toast("Stok tidak cukup");
    l.qty += d;
    if (l.qty <= 0 || d === 0) this.lines = this.lines.filter((x) => x.key !== key);
    this.render();
  },

  render() {
    const t = this.total(), change = this.pay - t;
    $("#cartLines").innerHTML = this.lines.length ? this.lines.map((l) => `<div class="line">
      <div class="line-top"><div><div class="line-name">${Fmt.esc(l.name)}</div><div class="line-sub">${l.variant ? Fmt.esc(l.variant) + " · " : ""}${Fmt.rp(l.price)}</div></div><strong>${Fmt.rp(l.price * l.qty)}</strong></div>
      <div class="line-bot"><div class="qty"><button data-k="${l.key}" data-d="-">−</button><span>${l.qty}</span><button data-k="${l.key}" data-d="+">+</button></div>
        <button class="btn ghost sm danger" data-k="${l.key}" data-d="0">Hapus</button></div></div>`).join("")
      : `<p class="empty">Keranjang kosong. Tekan "+ Keranjang" pada produk.</p>`;
    $("#cartTotal").textContent = Fmt.rp(t);
    const ch = $("#cartChange"); ch.textContent = this.pay ? (change >= 0 ? Fmt.rp(change) : "Kurang " + Fmt.rp(-change)) : Fmt.rp(0);
    ch.classList.toggle("neg", this.pay > 0 && change < 0);
    $("#btnCheckout").disabled = !this.lines.length || this.pay < t;
    $("#cartBarCount").textContent = this.count() + " item";
    $("#cartBarTotal").textContent = Fmt.rp(t);
    $("#quickPay").innerHTML = this.lines.length ? `<button data-v="pas">Uang pas</button>` + [20000, 50000, 100000, 200000].filter((v) => v >= t).slice(0, 3).map((v) => `<button data-v="${v}">${Fmt.num(v)}</button>`).join("") : "";
  },

  checkout() {
    const total = this.total(); if (!this.lines.length || this.pay < total) return;
    const { date, time } = Fmt.now();
    const trx = { id: History.nextId(date), date, time, total, pay: this.pay, change: this.pay - total, cashier: Settings.shop.cashier,
      items: this.lines.map((l) => ({ name: l.name, variant: l.variant, category: l.category, price: l.price, qty: l.qty })) };
    History.add(trx); Catalog.deduct(this.lines);
    this.lines = []; this.pay = 0; $("#payInput").value = ""; this.render();
    $("#cartPanel").classList.remove("open");
    Receipt.open(trx, "Transaksi berhasil");
  },
};

/* ========== Riwayat & grafik live ========== */
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const History = {
  list: [], range: "day", open: new Set(),

  init() {
    this.list = Store.get(CFG.keys.trx, []);
    $("#rangeChips").addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      this.range = b.dataset.range; Chart.cur = null;
      $$("#rangeChips .chip").forEach((c) => c.classList.toggle("active", c === b));
      this.render();
    });
    $("#historyList").addEventListener("click", (e) => {
      const re = e.target.closest("[data-reprint]");
      if (re) return Receipt.open(this.list.find((t) => t.id === re.dataset.reprint), "Cetak ulang struk");
      const h = e.target.closest("[data-id]"); if (!h) return;
      this.open.has(h.dataset.id) ? this.open.delete(h.dataset.id) : this.open.add(h.dataset.id);
      this.renderList();
    });
    Chart.bind();
    setInterval(() => { // jam live; segarkan grafik tiap 30 detik
      if (UI.current !== "riwayat") return;
      const d = new Date();
      $("#liveClock").textContent = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + " · " + d.toLocaleTimeString("id-ID");
      if (d.getSeconds() % 30 === 0) this.render();
    }, 1000);
  },
  nextId(date) { return `TRX-${date.replace(/-/g, "")}-${String(this.list.filter((t) => t.date === date).length + 1).padStart(3, "0")}`; },
  add(trx) { this.list.push(trx); Store.set(CFG.keys.trx, this.list); if (UI.current === "riwayat") this.render(); },

  inRange(t, range = this.range) {
    const today = Fmt.now().date;
    return t.date.startsWith({ day: today, month: today.slice(0, 7), year: today.slice(0, 4) }[range]);
  },

  // Data titik grafik: per jam (hari ini), per tanggal (bulan ini), per bulan (tahun ini). Waktu depan = null.
  buckets() {
    const now = new Date(), Y = now.getFullYear(), M = now.getMonth(), D = now.getDate(), H = now.getHours(), p = Fmt.p2;
    let vals, labels, tips;
    if (this.range === "day") {
      const today = Fmt.ymd(now);
      vals = Array.from({ length: 24 }, (_, i) => (i <= H ? 0 : null)); labels = vals.map((_, i) => p(i));
      tips = vals.map((_, i) => `${Fmt.dateID(today)} · ${p(i)}.00`);
      this.list.forEach((t) => { if (t.date === today) vals[+t.time.slice(0, 2)] += t.total; });
    } else if (this.range === "month") {
      const n = new Date(Y, M + 1, 0).getDate(), pre = `${Y}-${p(M + 1)}-`;
      vals = Array.from({ length: n }, (_, i) => (i < D ? 0 : null)); labels = vals.map((_, i) => String(i + 1));
      tips = vals.map((_, i) => `${p(i + 1)}/${p(M + 1)}/${Y}`);
      this.list.forEach((t) => { if (t.date.startsWith(pre)) vals[+t.date.slice(8, 10) - 1] += t.total; });
    } else {
      vals = Array.from({ length: 12 }, (_, i) => (i <= M ? 0 : null)); labels = MONTHS.map((m) => m.slice(0, 3));
      tips = MONTHS.map((m) => `${m} ${Y}`);
      this.list.forEach((t) => { if (t.date.startsWith(Y + "-")) vals[+t.date.slice(5, 7) - 1] += t.total; });
    }
    return { vals, labels, tips };
  },

  prevTotal() {
    const n = new Date(), Y = n.getFullYear(), M = n.getMonth(), D = n.getDate();
    const pre = { day: Fmt.ymd(new Date(Y, M, D - 1)), month: Fmt.ymd(new Date(Y, M - 1, 1)).slice(0, 7), year: String(Y - 1) }[this.range];
    return this.list.filter((t) => t.date.startsWith(pre)).reduce((s, t) => s + t.total, 0);
  },

  render() {
    const rows = this.list.filter((t) => this.inRange(t)), omzet = rows.reduce((s, t) => s + t.total, 0), prev = this.prevTotal();
    const cmp = { day: "kemarin", month: "bulan lalu", year: "tahun lalu" }[this.range];
    $("#tkLabel").textContent = { day: "Omzet hari ini", month: "Omzet bulan ini", year: "Omzet tahun ini" }[this.range];
    $("#sumOmzet").textContent = Fmt.rp(omzet);
    const dl = $("#sumDelta");
    if (prev > 0) { const pc = ((omzet - prev) / prev) * 100; dl.className = "delta " + (pc >= 0 ? "up" : "down"); dl.innerHTML = `${pc >= 0 ? "▲" : "▼"} ${Math.abs(pc).toFixed(1).replace(".", ",")}% <small>vs ${cmp}</small>`; }
    else { dl.className = "delta"; dl.innerHTML = omzet > 0 ? `<small>belum ada data ${cmp}</small>` : ""; }
    $("#sumCount").textContent = rows.length;
    $("#sumAvg").textContent = Fmt.rp(rows.length ? omzet / rows.length : 0);
    $("#sumItems").textContent = rows.reduce((s, t) => s + t.items.reduce((a, i) => a + i.qty, 0), 0);
    const b = this.buckets(); Chart.set(b.labels, b.vals, b.tips);
    this.renderList();
  },

  renderList() {
    const rows = this.list.filter((t) => this.inRange(t)).reverse();
    $("#historyList").innerHTML = rows.length ? rows.map((t) => {
      const open = this.open.has(t.id);
      return `<div class="trx"><button class="trx-head" data-id="${t.id}">
        <div><div class="trx-id">${t.id}</div><div class="trx-time">${Fmt.dateID(t.date)} ${t.time} · ${t.items.reduce((s, i) => s + i.qty, 0)} item</div></div><strong>${Fmt.rp(t.total)}</strong></button>
        ${open ? `<div class="trx-body">${t.items.map((i) => `<div class="row"><span>${i.qty}× ${Fmt.esc(i.name)}${i.variant ? " (" + Fmt.esc(i.variant) + ")" : ""}</span><span>${Fmt.rp(i.price * i.qty)}</span></div>`).join("")}
        <div class="row"><span>Bayar</span><span>${Fmt.rp(t.pay)}</span></div><div class="row"><span>Kembalian</span><span>${Fmt.rp(t.change)}</span></div>
        <button class="btn sm" data-reprint="${t.id}">Cetak ulang struk</button></div>` : ""}</div>`;
    }).join("") : `<p class="empty">Belum ada transaksi pada periode ini.</p>`;
  },
};

/* ========== Grafik garis (SVG) bergaya saham, beranimasi saat data berubah ========== */
const Chart = {
  W: 640, H: 260, L: 50, R: 16, T: 16, B: 30, cur: null, data: null, raf: 0,
  nice(m) { const p = Math.pow(10, Math.floor(Math.log10(m))); for (const s of [1, 2, 2.5, 5, 10]) if (m <= s * p) return s * p; return 10 * p; },

  set(labels, target, tips) {
    this.data = { labels, target, tips };
    const from = this.cur && this.cur.length === target.length ? this.cur.slice() : target.map((v) => (v === null ? null : 0));
    const t0 = performance.now(), D = 550; cancelAnimationFrame(this.raf);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
      this.cur = target.map((v, i) => (v === null ? null : (from[i] || 0) + (v - (from[i] || 0)) * e));
      this.draw(); if (k < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  },

  x(i, n) { return this.L + (i * (this.W - this.L - this.R)) / Math.max(1, n - 1); },

  draw() {
    const { W, H, L, R, T, B } = this, v = this.cur, n = v.length, labels = this.data.labels;
    const max = this.nice(Math.max(50000, ...v.filter((a) => a !== null))), base = H - B;
    const y = (a) => T + (base - T) * (1 - a / max);
    let g = "";
    for (let k = 0; k <= 4; k++) { const gy = T + ((base - T) * k) / 4; g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${gy}" y2="${gy}"/><text class="gt" x="${L - 6}" y="${gy + 4}" text-anchor="end">${Fmt.short(max * (1 - k / 4))}</text>`; }
    const step = n <= 12 ? 1 : n <= 24 ? 3 : 5;
    labels.forEach((l, i) => { if (i % step === 0) g += `<text class="xt" x="${this.x(i, n)}" y="${H - 8}" text-anchor="middle">${l}</text>`; });
    const pts = []; v.forEach((a, i) => { if (a !== null) pts.push([this.x(i, n), y(a)]); });
    const line = "M" + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L");
    const last = pts[pts.length - 1], first = pts[0];
    const area = `${line} L${last[0].toFixed(1)} ${base} L${first[0].toFixed(1)} ${base}Z`;
    $("#chart").innerHTML = `<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E53935" stop-opacity=".45"/><stop offset="1" stop-color="#E53935" stop-opacity="0"/></linearGradient></defs>${g}
      <path d="${area}" fill="url(#ag)"/><path class="ln" d="${line}"/><circle class="pulse" cx="${last[0]}" cy="${last[1]}" r="5"/><circle cx="${last[0]}" cy="${last[1]}" r="4" fill="#fff" stroke="#E53935" stroke-width="2"/>`;
  },

  bind() { // tooltip tanggal & nominal saat disentuh / diarahkan
    const wrap = $("#chartWrap"), tip = $("#chartTip"), guide = $("#chartGuide");
    const move = (e) => {
      if (!this.data) return;
      const r = $("#chart").getBoundingClientRect(), n = this.data.target.length;
      const xr = ((e.clientX - r.left) / r.width) * this.W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((xr - this.L) / (this.W - this.L - this.R)) * (n - 1))));
      const val = this.data.target[i], pct = (this.x(i, n) / this.W) * 100;
      tip.innerHTML = `<b>${this.data.tips[i]}</b><br>${val === null ? "—" : Fmt.rp(val)}`;
      tip.style.left = Math.min(82, Math.max(18, pct)) + "%"; guide.style.left = pct + "%";
      tip.hidden = guide.hidden = false;
    };
    wrap.addEventListener("pointermove", move); wrap.addEventListener("pointerdown", move);
    wrap.addEventListener("pointerleave", () => (tip.hidden = guide.hidden = true));
  },
};

/* ========== Struk (sumber tunggal untuk preview, print browser, dan ESC/POS) ========== */
const Receipt = {
  W: CFG.receiptWidth,
  wrap(s) {
    const out = []; let cur = "";
    s.split(" ").forEach((w) => { if ((cur + " " + w).trim().length > this.W) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); });
    if (cur) out.push(cur); return out;
  },
  center(s) { return " ".repeat(Math.max(0, Math.floor((this.W - s.length) / 2))) + s; },
  lr(l, r) { return l + " ".repeat(Math.max(1, this.W - l.length - r.length)) + r; },

  lines(t) {
    const L = [], add = (x, b = false) => L.push({ t: x, b }), S = Settings.shop, sep = "-".repeat(this.W);
    this.wrap(S.name.toUpperCase()).forEach((x) => add(this.center(x), true));
    this.wrap(S.address).forEach((x) => add(this.center(x)));
    add(this.center("WA/Telp " + S.phone)); add(sep);
    add(this.lr("No. Transaksi", t.id.replace("TRX-", ""))); add(this.lr("Tanggal", `${Fmt.dateID(t.date)} ${t.time.slice(0, 5)}`)); add(this.lr("Kasir", t.cashier || "Admin")); add(sep);
    ["Sparepart", "Paket Service"].forEach((cat) => {
      const its = t.items.filter((i) => i.category === cat); if (!its.length) return;
      add(cat.toUpperCase(), true);
      its.forEach((i) => { this.wrap(i.name + (i.variant ? " (" + i.variant + ")" : "")).forEach((x) => add(x)); add(this.lr(`  ${i.qty} x ${Fmt.num(i.price)}`, Fmt.num(i.price * i.qty))); });
    });
    add(sep); add(this.lr("Total Item", String(t.items.reduce((s, i) => s + i.qty, 0)))); add(this.lr("Subtotal", Fmt.num(t.total)));
    add(this.lr("TOTAL PEMBAYARAN", Fmt.num(t.total)), true); add(sep);
    add(this.lr("Metode Pembayaran", "Cash")); add(this.lr("Bayar", Fmt.num(t.pay))); add(this.lr("Kembalian", Fmt.num(t.change))); add(sep);
    add(this.center("Terima Kasih"), true);
    this.wrap("Sudah berbelanja di " + S.name.replace(/^Bengkel\s+/i, "")).forEach((x) => add(this.center(x)));
    this.wrap("Semoga motor Anda selalu dalam kondisi prima").forEach((x) => add(this.center(x)));
    return L;
  },
  text(t) { return this.lines(t).map((l) => l.t).join("\n"); },

  open(trx, title) {
    UI.modal(`<h2>${title}</h2>
      <div class="receipt-preview"><img src="${Brand.src()}" alt="Logo"><pre>${Fmt.esc(this.text(trx))}</pre></div>
      <p class="hint lbl">Cetak lewat</p><div data-ptiles></div>
      <div class="modal-actions"><button class="btn ghost" id="rClose">Tutup</button><button class="btn primary" id="rPrint">Cetak struk</button></div>`);
    Printer.refresh();
    $("#rClose").onclick = () => UI.close();
    $("#rPrint").onclick = () => Printer.print(trx);
  },
};

/* ========== Printer: Bluetooth, Kabel USB (OTG), atau Cetak browser ========== */
const Printer = {
  method: Store.get(CFG.keys.printer, "bt"),
  bt: { device: null, char: null }, usb: { device: null, ep: null, iface: null }, _logo: null,
  METHODS: [
    { id: "bt", icon: "📶", name: "Bluetooth" },
    { id: "usb", icon: "🔌", name: "Kabel USB ke HP (OTG)" },
    { id: "browser", icon: "🖨️", name: "Cetak lewat browser / aplikasi printer" },
  ],

  statusText(id) {
    if (id === "bt") return !navigator.bluetooth ? "Browser ini tidak mendukung. Gunakan Chrome." : this.bt.char ? "Terhubung: " + (this.bt.device.name || "printer") : "Belum terhubung. Tekan untuk memilih printer.";
    if (id === "usb") return !navigator.usb ? "Browser ini tidak mendukung. Gunakan Chrome di Android/desktop." : this.usb.ep !== null ? "Terhubung: " + (this.usb.device.productName || "printer USB") : "Belum terhubung. Colok kabel OTG, lalu tekan.";
    return "Memakai printer bawaan HP, PDF, atau aplikasi seperti RawBT.";
  },
  isConnected(id) { return id === "bt" ? !!(this.bt.char && this.bt.device.gatt.connected) : id === "usb" ? this.usb.ep !== null : true; },

  refresh() {
    const html = `<div class="ptiles">${this.METHODS.map((m) => `<button type="button" class="ptile ${this.method === m.id ? "sel" : ""} ${this.isConnected(m.id) && m.id !== "browser" ? "ok" : ""}" data-pm="${m.id}"><b>${m.icon} ${m.name}</b><small data-ps="${m.id}">${this.statusText(m.id)}</small></button>`).join("")}</div>`;
    $$("[data-ptiles]").forEach((el) => (el.innerHTML = html));
    if (navigator.bluetooth && navigator.bluetooth.getAvailability && !this.bt.char) {
      navigator.bluetooth.getAvailability().then((ok) => { if (!ok) $$('[data-ps="bt"]').forEach((s) => (s.textContent = "Bluetooth HP belum menyala. Nyalakan di Pengaturan HP, lalu tekan di sini.")); }).catch(() => {});
    }
  },

  async pick(id) {
    this.method = id; Store.set(CFG.keys.printer, id); this.refresh();
    if (id === "browser") return;
    try { await this.connect(id); UI.toast("Printer terhubung"); } catch (e) { this.fail(e); }
    this.refresh();
  },
  fail(e) { if (e && e.name !== "NotFoundError") alert((e && e.message) || "Gagal terhubung ke printer"); },

  async connect(id) {
    if (this.isConnected(id)) return;
    if (id === "bt") {
      if (!navigator.bluetooth) throw new Error("Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome, atau pilih cetak lewat browser.");
      if (!this.bt.device) {
        this.bt.device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true,
          optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb", "e7810a71-73ae-499d-8c15-faa9aef0c3f2", "49535343-fe7d-4ae5-8fa9-9fafd205e455", "0000ff00-0000-1000-8000-00805f9b34fb"] });
        this.bt.device.addEventListener("gattserverdisconnected", () => { this.bt.char = null; this.refresh(); });
      }
      const server = await this.bt.device.gatt.connect();
      for (const s of await server.getPrimaryServices()) for (const c of await s.getCharacteristics()) if (c.properties.write || c.properties.writeWithoutResponse) { this.bt.char = c; return; }
      throw new Error("Printer terhubung, tetapi tidak ditemukan jalur kirim data. Coba cetak lewat browser.");
    }
    if (!navigator.usb) throw new Error("Browser ini tidak mendukung WebUSB. Gunakan Chrome, atau pilih cetak lewat browser.");
    const dev = this.usb.device || (await navigator.usb.requestDevice({ filters: [] }));
    if (!dev.opened) await dev.open();
    if (!dev.configuration) await dev.selectConfiguration(1);
    for (const itf of dev.configuration.interfaces) for (const alt of itf.alternates) for (const ep of alt.endpoints) {
      if (ep.direction === "out" && ep.type === "bulk") { await dev.claimInterface(itf.interfaceNumber); this.usb = { device: dev, ep: ep.endpointNumber, iface: itf.interfaceNumber }; return; }
    }
    throw new Error("Perangkat USB ini tidak punya jalur cetak yang dikenali.");
  },

  async write(bytes) {
    if (this.method === "bt") {
      const c = this.bt.char;
      for (let i = 0; i < bytes.length; i += 100) {
        const part = bytes.slice(i, i + 100);
        c.properties.writeWithoutResponse ? await c.writeValueWithoutResponse(part) : await c.writeValue(part);
        await new Promise((r) => setTimeout(r, 30));
      }
    } else await this.usb.device.transferOut(this.usb.ep, bytes);
  },

  // Logo -> bitmap hitam-putih (perintah raster ESC/POS GS v 0), lebar 288 titik
  async logoRaster() {
    if (this._logo) return this._logo;
    const img = new Image(); img.src = Brand.src(); await img.decode();
    const W = 288, H = Math.round((W * img.height) / img.width), c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data, wb = W / 8, out = [0x1b, 0x61, 1, 0x1d, 0x76, 0x30, 0, wb & 255, wb >> 8, H & 255, H >> 8];
    for (let yy = 0; yy < H; yy++) for (let xb = 0; xb < wb; xb++) {
      let b = 0;
      for (let bit = 0; bit < 8; bit++) { const i = (yy * W + xb * 8 + bit) * 4; if (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] < 150) b |= 0x80 >> bit; }
      out.push(b);
    }
    out.push(0x1b, 0x61, 0, 0x0a);
    return (this._logo = out);
  },

  async build(trx) {
    const enc = new TextEncoder(), out = [0x1b, 0x40]; // ESC @ reset
    try { out.push(...(await this.logoRaster())); } catch { /* lanjut tanpa logo */ }
    Receipt.lines(trx).forEach((l) => { out.push(0x1b, 0x45, l.b ? 1 : 0, ...enc.encode(l.t.replace(/[^\x20-\x7E]/g, "?") + "\n")); });
    out.push(0x1b, 0x45, 0, 0x0a, 0x0a, 0x0a);
    return new Uint8Array(out);
  },

  browserPrint(trx) {
    const rows = Receipt.lines(trx).map((l) => `<div class="${l.b ? "b" : ""}">${Fmt.esc(l.t)}</div>`).join("");
    $("#printArea").style.whiteSpace = "pre";
    $("#printArea").innerHTML = `<img src="${Brand.src()}" alt="">${rows}`;
    window.print();
  },

  async print(trx) {
    try {
      if (this.method === "browser") return this.browserPrint(trx);
      await this.connect(this.method);
      await this.write(await this.build(trx));
      UI.toast("Struk dikirim ke printer"); this.refresh();
    } catch (e) { this.fail(e); this.refresh(); }
  },
};
document.addEventListener("click", (e) => { const t = e.target.closest("[data-pm]"); if (t) Printer.pick(t.dataset.pm); });

/* ========== Logo bengkel (bawaan atau unggahan sendiri) ========== */
const Brand = {
  custom: "",
  init() {
    this.custom = Store.get(CFG.keys.logo, "");
    this.apply();
    $("#logoFile").addEventListener("change", (e) => { this.upload(e.target.files[0]); e.target.value = ""; });
    $("#logoReset").addEventListener("click", () => { this.set(""); UI.toast("Logo bawaan dipakai"); });
  },
  src() { return this.custom || LOGO_DATA; },
  set(data) {
    if (data) { if (!Store.set(CFG.keys.logo, data)) return false; } else { try { localStorage.removeItem(CFG.keys.logo); } catch { /* abaikan */ } }
    this.custom = data; Printer._logo = null; this.apply(); return true;
  },
  apply() { $$("[data-logo]").forEach((i) => (i.src = this.src())); },
  upload(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) return UI.toast("File harus berupa gambar");
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const r = Math.min(1, 420 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        if (this.set(c.toDataURL("image/png"))) UI.toast("Logo diganti");
      };
      img.onerror = () => UI.toast("Gambar tidak bisa dibaca");
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  },
};

/* ========== Cadangkan & pulihkan data ========== */
const Backup = {
  init() {
    $("#btnBackup").addEventListener("click", () => this.download());
    $("#restoreFile").addEventListener("change", (e) => { this.restore(e.target.files[0]); e.target.value = ""; });
  },
  download() {
    const data = { app: "kasir-pmm", version: 1, exportedAt: new Date().toISOString(), items: Catalog.items, trx: History.list, shop: Settings.shop, logo: Brand.custom };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    a.download = `kasir-pmm-cadangan-${Fmt.ymd(new Date())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    UI.toast("Cadangan diunduh");
  },
  // Validasi ketat: file cadangan dianggap tidak tepercaya (bisa diedit orang lain)
  clean(d) {
    if (!d || d.app !== "kasir-pmm" || !Array.isArray(d.items) || !Array.isArray(d.trx)) throw new Error("Ini bukan file cadangan aplikasi kasir.");
    const num = (v) => (Number.isFinite(+v) && +v >= 0 ? Math.round(+v) : 0), str = (v, m = 200) => String(v == null ? "" : v).slice(0, m);
    const img = (v) => (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v || "") ? v : "");
    const cat = (v) => (v === "Paket Service" ? "Paket Service" : "Sparepart");
    const items = d.items.filter((i) => i && str(i.name).trim()).map((i) => ({
      id: str(i.id, 40) || Fmt.uid(), name: str(i.name, 120), category: cat(i.category), price: num(i.price),
      stock: i.stock === null || i.stock === undefined ? null : num(i.stock), img: img(i.img),
      variants: (Array.isArray(i.variants) ? i.variants : []).filter((v) => v && str(v.label).trim()).map((v) => ({ label: str(v.label, 60), price: num(v.price) })),
    }));
    const trx = d.trx.filter((t) => t && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && Array.isArray(t.items)).map((t) => ({
      id: str(t.id, 40), date: t.date, time: /^\d{2}:\d{2}:\d{2}$/.test(t.time) ? t.time : "00:00:00", total: num(t.total), pay: num(t.pay), change: num(t.change), cashier: str(t.cashier, 60) || "Admin",
      items: t.items.filter(Boolean).map((i) => ({ name: str(i.name, 120), variant: str(i.variant, 60), category: cat(i.category), price: num(i.price), qty: Math.max(1, num(i.qty)) })),
    }));
    const shop = {}; Object.keys(CFG.shop).forEach((k) => (shop[k] = str(d.shop && d.shop[k], 200).trim() || CFG.shop[k]));
    return { items, trx, shop, logo: img(d.logo) };
  },
  restore(file) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return alert("File terlalu besar untuk file cadangan.");
    const fr = new FileReader();
    fr.onload = () => {
      let c; try { c = this.clean(JSON.parse(fr.result)); } catch (e) { return alert(e instanceof SyntaxError ? "File rusak atau bukan file cadangan." : e.message); }
      if (!confirm(`Ganti SEMUA data saat ini dengan cadangan ini?\n\n${c.items.length} produk, ${c.trx.length} transaksi.`)) return;
      Catalog.items = c.items; History.list = c.trx; Settings.shop = c.shop; Cart.lines = []; Cart.pay = 0; $("#payInput").value = "";
      const ok = Store.set(CFG.keys.items, c.items) && Store.set(CFG.keys.trx, c.trx) && Store.set(CFG.keys.shop, c.shop);
      Brand.set(c.logo); Settings.fill(); Catalog.render(); Cart.render(); History.render();
      UI.toast(ok ? "Data berhasil dipulihkan" : "Sebagian data gagal disimpan");
    };
    fr.readAsText(file);
  },
};

/* ========== Pasang sebagai aplikasi (PWA) & penyimpanan permanen ========== */
const Install = {
  evt: null,
  init() {
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); this.evt = e; this.ui(); });
    window.addEventListener("appinstalled", () => { this.evt = null; this.ui(); UI.toast("Aplikasi terpasang"); });
    $("#btnInstall").addEventListener("click", async () => { if (!this.evt) return; this.evt.prompt(); await this.evt.userChoice; this.evt = null; this.ui(); });
    this.ui();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); // minta browser tidak menghapus data kasir
    if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
  },
  ui() {
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone, ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    $("#installHint").textContent = standalone ? "Aplikasi sudah berjalan sebagai aplikasi terpasang."
      : this.evt ? "Tekan tombol di bawah untuk memasang ikon aplikasi di layar utama HP."
      : ios ? "Di iPhone: buka lewat Safari, tekan tombol Bagikan, lalu pilih \"Tambah ke Layar Utama\"."
      : "Di Chrome Android: buka menu ⋮, lalu pilih \"Instal aplikasi\" atau \"Tambahkan ke layar utama\". Pastikan dibuka lewat alamat https.";
    $("#btnInstall").hidden = !this.evt;
  },
};

/* ========== Start ========== */
document.addEventListener("DOMContentLoaded", () => {
  UI.init(); Settings.init(); History.init(); Catalog.init(); Cart.init(); Printer.refresh(); Brand.init(); Backup.init(); Install.init();
});
