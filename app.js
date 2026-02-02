// =====================
// PWA status + service worker
// =====================
const statusEl = document.getElementById("status");
function setStatus(msg) { statusEl.textContent = msg; }

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")
    .then(() => setStatus("Siap. Untuk mode offline penuh, buka via HTTPS lalu install ke Home Screen."))
    .catch(() => setStatus("Service worker gagal. Pastikan dibuka via HTTPS."));
} else {
  setStatus("Browser tidak mendukung service worker.");
}

// =====================
// Konfigurasi dropdown (sesuaikan sesuai kebutuhan)
// =====================
const STATUS_OPTIONS = ["", "Aktif", "Segel", "Segel Permintaan", "Bongkar"];
const CABANG_OPTIONS = ["", "Cabang Sumbawa", "Cabang Utan", "Cabang Alas", "Cabang Alas Barat", "Cabang Empang", "Cabang Plampang"];
const GOLONGAN_OPTIONS = ["",
  "A1 SOSIAL KHUSUS ( PANTI ASUHAN, MASJID, SDN, PUSKESMAS )",
  "2B  RUMAH TANGGA II ( RUMAH TANGGA BANGUNAN PERMANEN)",
  "2C RUMAH TANGGA III ( BERMOBIL / TINGKAT 2 LANTAI )",
  "2D RUMAH TANGGA IV ( RUMAH MEWAH )",
  "3A NIAGA I ( SALON, WARNET, WARUNG )",
  "3B NIAGA II ( restoran, kos, laundry, gudang/ruko/lab, apotek/klinik, dealer, sekolah swasta, cuci mobil/motor)",
  "3C NIAGA III (KOLAM RENANG, HOTEL, DEPO AIR, SPBU, DISTRIBUTOR, BUMN/BUMD)",
  "4A INDRUSTRI I ( TAMBAK, FURNITURE)",
  "4B INDUSTRI II (HULLER/PENGGILINGAN PADI, PAVING BLOK/BATAKO/GENTENG)",
  "5A INSTANSI PEMERINTAH DAERAH DAN PEMERINTAH DAERAH KABUPATEN (KANTOR DAN RUMAH DINAS)",
  "KHUSUS"];
const KONDISI_OPTIONS = ["", "WM BAIK",
"WM RUSAK",
"WM TERTIMBUN",
"WM TERETIMBUN TIDAK BISA TERLIHAT",
"WM BEREMBUN",
"WM BEREMBUN TIDAK BISA TERLIHAT",
"TIDAK ADA WATER METER",
"RUMAH KOSONG",
"RUMAH TERKUNCI",
];

// =====================
// Elemen form
// =====================
const elNama = document.getElementById("nama"); // dipakai sebagai NOMOR PELANGGAN
const elTanggal = document.getElementById("tanggal");
const elLokasi = document.getElementById("lokasi");
const elCatatan = document.getElementById("catatan");

const elStatus = document.getElementById("statusSelect");
const elCabang = document.getElementById("cabangSelect");
const elGolongan = document.getElementById("golonganSelect");
const elKondisi = document.getElementById("kondisiLapangan");


const elNamaList = document.getElementById("namaList");
const elNamaSuggest = document.getElementById("namaSuggest");

const elFoto1 = document.getElementById("foto1");
const elFoto2 = document.getElementById("foto2");
const prev1 = document.getElementById("prev1");
const prev2 = document.getElementById("prev2");

function fillSelect(selectEl, options, placeholder) {
  selectEl.innerHTML = "";
  options.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt === "" ? (placeholder ?? "-- pilih --") : opt;
    selectEl.appendChild(o);
  });
}

fillSelect(elStatus, STATUS_OPTIONS, "-- pilih status --");
fillSelect(elCabang, CABANG_OPTIONS, "-- pilih cabang --");
fillSelect(elGolongan, GOLONGAN_OPTIONS, "-- pilih golongan --");
fillSelect(elKondisi, KONDISI_OPTIONS, "-- pilih kondisi --");
// =====================
// IndexedDB
// =====================
const DB_NAME = "form_offline_db";
const DB_VERSION = 1;
const STORE = "records";
const kondisiLapangan = elKondisi.value ?? "";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putRecord(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllRecords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function deleteRecord(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function clearAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// =====================
// Util
// =====================
function makeId() {
  return (
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}

function nowISO() {
  return new Date().toISOString();
}

function uniqueSorted(values) {
  const set = new Set(
    values
      .map(v => (v ?? "").toString().trim())
      .filter(v => v !== "")
  );
  return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
}

function fillDatalist(datalistEl, items, limit = 1200) {
  datalistEl.innerHTML = "";
  items.slice(0, limit).forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    datalistEl.appendChild(opt);
  });
}

// =====================
// Master nomor pelanggan (1200 data) + Autocomplete "mengandung"
// - Sumber: customers.txt (1 baris = 1 nomor)
// - Tetap digabung dengan nomor yang sudah tersimpan di IndexedDB
// =====================
let MASTER_CUSTOMERS = [];
let masterLoaded = false;
let CUSTOMER_ITEMS_CACHE = [];

function normDigits(s) {
  return (s ?? "").toString().replace(/\D/g, "");
}

async function loadMasterCustomers() {
  if (masterLoaded) return;
  try {
    const res = await fetch("./customers.txt", { cache: "no-store" });
    if (!res.ok) throw new Error("customers.txt not found");
    const text = await res.text();
    const set = new Set(
      text
        .split(/\r?\n/)
        .map(normDigits)
        .filter(Boolean)
    );
    MASTER_CUSTOMERS = Array.from(set).sort();
  } catch (e) {
    // Jika file belum ada / pertama kali belum ke-cache, biarkan kosong.
    MASTER_CUSTOMERS = [];
  } finally {
    masterLoaded = true;
  }
}

function renderNamaSuggest(items, query) {
  if (!elNamaSuggest) return;

  if (!query || query.length < 2) {
    elNamaSuggest.innerHTML = "";
    return;
  }

  // "Mengandung" (includes), bukan "awalan".
  const q = query;
  const matches = items
    .filter((x) => x.includes(q))
    // yang posisinya lebih awal tampil dulu (lebih relevan)
    .sort((a, b) => a.indexOf(q) - b.indexOf(q))
    .slice(0, 10);

  if (!matches.length) {
    elNamaSuggest.innerHTML = `<span class="muted">Tidak ada saran.</span>`;
    return;
  }

  elNamaSuggest.innerHTML =
    `Saran: ` +
    matches
      .map(
        (v) => `
      <button type="button" class="secondary" style="padding:6px 10px; margin:6px 6px 0 0;"
        onclick="document.getElementById('nama').value='${v}'; document.getElementById('nama').focus();">
        ${v}
      </button>`
      )
      .join("");
}

async function refreshNamaAutocomplete() {
  // Pastikan master customer sudah dimuat (kalau ada).
  await loadMasterCustomers();

  const rows = await getAllRecords();
  const fromDb = rows.map((r) => normDigits(r.nama)).filter(Boolean);
  const fromMaster = MASTER_CUSTOMERS;

  CUSTOMER_ITEMS_CACHE = uniqueSorted([...fromMaster, ...fromDb]);
  fillDatalist(elNamaList, CUSTOMER_ITEMS_CACHE, 1200);

  // refresh suggestion sesuai input saat ini
  renderNamaSuggest(CUSTOMER_ITEMS_CACHE, normDigits(elNama.value));
}

// debounce untuk render suggestion (biar ringan di HP)
let _tNamaSuggest = null;
elNama.addEventListener("input", () => {
  clearTimeout(_tNamaSuggest);
  _tNamaSuggest = setTimeout(() => {
    renderNamaSuggest(CUSTOMER_ITEMS_CACHE, normDigits(elNama.value));
  }, 80);
});
elNama.addEventListener("focus", () => {
  renderNamaSuggest(CUSTOMER_ITEMS_CACHE, normDigits(elNama.value));
});

// =====================
// Default tanggal hari ini
// =====================
function setToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  elTanggal.value = `${yyyy}-${mm}-${dd}`;
}
setToday();

// =====================
// Preview foto
// =====================
function previewInput(inputEl, containerEl) {
  const file = inputEl.files?.[0];
  if (!file) {
    containerEl.innerHTML = `<span class="muted">Belum ada.</span>`;
    return;
  }
  const url = URL.createObjectURL(file);
  containerEl.innerHTML = `<img src="${url}" alt="preview" />`;
}
elFoto1.addEventListener("change", () => previewInput(elFoto1, prev1));
elFoto2.addEventListener("change", () => previewInput(elFoto2, prev2));

// =====================
// Kompres foto
// =====================
async function compressImageFile(file, maxW = 1600, quality = 0.75) {
  const img = new Image();
  const url = URL.createObjectURL(file);

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });

  let { width, height } = img;
  const scale = Math.min(1, maxW / width);
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  URL.revokeObjectURL(url);

  return await new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      "image/jpeg",
      quality
    );
  });
}

// =====================
// Simpan
// =====================
document.getElementById("btnSimpan").addEventListener("click", async () => {
  const nomorPelanggan = normDigits(elNama.value);
  const tanggal = elTanggal.value?.trim() ?? "";
  const lokasi = (elLokasi.value ?? "").toString().trim();
  const catatan = (elCatatan.value ?? "").toString().trim();
  const status = elStatus.value ?? "";
  const cabang = elCabang.value ?? "";
  const golongan = elGolongan.value ?? "";

  if (!nomorPelanggan) {
    alert("Nomor pelanggan wajib diisi.");
    return;
  }

  const f1 = elFoto1.files?.[0];
  const f2 = elFoto2.files?.[0];

  if (!f1 || !f2) {
    alert("Wajib upload 2 foto.");
    return;
  }

  setStatus("Mengompres foto...");
  const foto1Blob = await compressImageFile(f1, 1600, 0.75);
  const foto2Blob = await compressImageFile(f2, 1600, 0.75);

  const rec = {
    id: makeId(),
    nama: nomorPelanggan, // disimpan tetap di field "nama" agar kompatibel
    tanggal,
    lokasi,
    
    catatan,
    status,
    cabang,
    golongan,
    foto1: foto1Blob,
    foto2: foto2Blob,
    created_at: nowISO(),
  };

  setStatus("Menyimpan ke HP (IndexedDB)...");
  await putRecord(rec);

  setStatus("Tersimpan (offline).");
  alert("Data tersimpan (offline).");

  // refresh tabel + autocomplete cache
  await renderTable();

  // reset input foto (opsional)
  elFoto1.value = "";
  elFoto2.value = "";
  prev1.innerHTML = `<span class="muted">Belum ada.</span>`;
  prev2.innerHTML = `<span class="muted">Belum ada.</span>`;
});

// =====================
// Reset
// =====================
document.getElementById("btnReset").addEventListener("click", () => {
  elNama.value = "";
  elLokasi.value = "";
  elCatatan.value = "";
  setToday();

  elStatus.value = "";
  elCabang.value = "";
  elGolongan.value = "";
  elKondisi.value = "";
  elFoto1.value = "";
  elFoto2.value = "";
  prev1.innerHTML = `<span class="muted">Belum ada.</span>`;
  prev2.innerHTML = `<span class="muted">Belum ada.</span>`;
  if (elNamaSuggest) elNamaSuggest.innerHTML = "";
});

// =====================
// Tabel data
// =====================
const tbody = document.getElementById("tbody");

async function renderTable() {
  const rows = await getAllRecords();
  rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="muted">Belum ada data.</td></tr>`;
    await refreshNamaAutocomplete();
    return;
  }

  tbody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.textContent = r.id;

    const tdNama = document.createElement("td");
    tdNama.textContent = r.nama || "";

    const tdStatus = document.createElement("td");
    tdStatus.innerHTML = r.status ? `<span class="badge">${r.status}</span>` : "";

    const tdCabang = document.createElement("td");
    tdCabang.textContent = r.cabang || "";
    
    const tdKondisi = document.createElement("td");
    tdKondisi.textContent = r.kondisiLapangan || "";

    const tdGol = document.createElement("td");
    tdGol.textContent = r.golongan || "";

    const tdTgl = document.createElement("td");
    tdTgl.textContent = r.tanggal || "";

    const tdLok = document.createElement("td");
    tdLok.textContent = r.lokasi || "";

    const tdCat = document.createElement("td");
    tdCat.textContent = r.catatan || "";

    const tdFoto = document.createElement("td");
    tdFoto.innerHTML = `<div class="muted">2 foto tersimpan</div>`;

    const tdAksi = document.createElement("td");
    const btnDel = document.createElement("button");
    btnDel.className = "danger";
    btnDel.textContent = "Hapus";
    btnDel.addEventListener("click", async () => {
      if (!confirm("Hapus data ini?")) return;
      await deleteRecord(r.id);
      await renderTable();
      setStatus("Data dihapus.");
    });
    tdAksi.appendChild(btnDel);

    tr.append(tdId, tdNama, tdStatus, tdCabang, tdGol, tdTgl, tdLok, tdCat, tdFoto, tdAksi);
    tbody.appendChild(tr);
  }

  await refreshNamaAutocomplete();
}

document.getElementById("btnRefresh").addEventListener("click", renderTable);
renderTable();

// =====================
// Export CSV / ZIP
// =====================
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(v) {
  const s = (v ?? "").toString();
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

document.getElementById("btnExportCSV").addEventListener("click", async () => {
  const rows = await getAllRecords();
  if (!rows.length) { alert("Belum ada data."); return; }

  const header = ["id","no_pelanggan","status","cabang","golongan","kondisi_lapangan","tanggal","lokasi","catatan","created_at"];
  const lines = [header.join(",")];

  for (const r of rows) {
    const line = [
      csvEscape(r.id),
      csvEscape(r.nama),
      csvEscape(r.status),
      csvEscape(r.cabang),
      csvEscape(r.golongan),
      csvEscape(r.tanggal),
      csvEscape(r.kondisiLapangan),
      csvEscape(r.lokasi),
      csvEscape(r.catatan),
      csvEscape(r.created_at),
    ].join(",");
    lines.push(line);
  }

  const csvText = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `export_${makeId()}.csv`);
  setStatus("Export CSV selesai. File tersimpan di Downloads.");
});

document.getElementById("btnHapusSemua").addEventListener("click", async () => {
  if (!confirm("Hapus SEMUA data lokal?")) return;
  await clearAll();
  await renderTable();
  setStatus("Semua data dihapus.");
});

// ZIP: CSV + foto
document.getElementById("btnExportZIP").addEventListener("click", async () => {
  const rows = await getAllRecords();
  if (!rows.length) { alert("Belum ada data."); return; }

  if (typeof JSZip === "undefined") {
    alert("JSZip tidak terload. Pastikan jszip.min.js ada dan berhasil di-load.");
    return;
  }

  const zip = new JSZip();
  const photoFolder = zip.folder("photos");

  const header = ["id","no_pelanggan","status","cabang","golongan","tanggal","lokasi","catatan","created_at","foto1","foto2"];
  const lines = [header.join(",")];

  for (const r of rows) {
    const safeNama = (r.nama || "").toString().replace(/[^\w\-]+/g, "_");
    const foto1Name = `${r.id}_${safeNama}_foto1.jpg`;
    const foto2Name = `${r.id}_${safeNama}_foto2.jpg`;

    lines.push([
      csvEscape(r.id),
      csvEscape(r.nama),
      csvEscape(r.status),
      csvEscape(r.cabang),
      csvEscape(r.golongan),
      csvEscape(r.tanggal),
      csvEscape(r.lokasi),
      csvEscape(r.catatan),
      csvEscape(r.created_at),
      csvEscape(`photos/${foto1Name}`),
      csvEscape(`photos/${foto2Name}`)
    ].join(","));

    photoFolder.file(foto1Name, r.foto1);
    photoFolder.file(foto2Name, r.foto2);
  }

  const csvText = "\uFEFF" + lines.join("\n");
  zip.file("data.csv", csvText);

  try {
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `export_${makeId()}.zip`);
    setStatus("Export selesai. File tersimpan di Downloads.");
  } catch (e) {
    console.error(e);
    setStatus("Gagal export ZIP.");
    alert("Gagal export ZIP. Cek kapasitas memori atau coba export CSV saja.");
  }
});
