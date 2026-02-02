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
// Konfigurasi dropdown
// =====================
const STATUS_OPTIONS = ["Aktif", "Nonaktif", "Dalam Proses", "Tidak Ditemukan"];
const CABANG_OPTIONS = ["Cabang Makassar", "Cabang Gowa", "Cabang Maros"]; // ganti sesuai kebutuhan
const GOLONGAN_OPTIONS = ["A", "B", "C", "D"]; // ganti sesuai kebutuhan

const elNama = document.getElementById("nama");
const elTanggal = document.getElementById("tanggal");
const elLokasi = document.getElementById("lokasi");
const elCatatan = document.getElementById("catatan");

const elStatus = document.getElementById("statusSelect");
const elCabang = document.getElementById("cabangSelect");
const elGolongan = document.getElementById("golonganSelect");

const elNamaList = document.getElementById("namaList");

const elFoto1 = document.getElementById("foto1");
const elFoto2 = document.getElementById("foto2");
const prev1 = document.getElementById("prev1");
const prev2 = document.getElementById("prev2");

function fillSelect(selectEl, options, placeholder) {
  selectEl.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = placeholder;
  selectEl.appendChild(opt0);

  options.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

fillSelect(elStatus, STATUS_OPTIONS, "Pilih status");
fillSelect(elCabang, CABANG_OPTIONS, "Pilih cabang");
fillSelect(elGolongan, GOLONGAN_OPTIONS, "Pilih golongan");

// =====================
// IndexedDB
// =====================
const DB_NAME = "form_offline_db";
const DB_VERSION = 1;
const STORE = "records";

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

async function putRecord(rec) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
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

// =====================
// Util: ID, CSV, download
// =====================
function pad2(n) { return String(n).padStart(2, "0"); }

function makeId() {
  const d = new Date();
  const stamp = [
    d.getFullYear(),
    pad2(d.getMonth() + 1),
    pad2(d.getDate()),
    pad2(d.getHours()),
    pad2(d.getMinutes()),
    pad2(d.getSeconds())
  ].join("");
  const rnd = Math.random().toString(16).slice(2, 8);
  return `${stamp}_${rnd}`;
}

function csvEscape(value) {
  const s = (value ?? "").toString();
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// =====================
// Foto: kompres JPEG
// =====================
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

async function compressImageToJpeg(file, maxSide = 1280, quality = 0.72) {
  if (!file) return null;
  const img = new Image();
  const dataUrl = await fileToDataURL(file);

  return new Promise((resolve) => {
    img.onload = () => {
      let { width, height } = img;
      const maxDim = Math.max(width, height);
      if (maxDim > maxSide) {
        const scale = maxSide / maxDim;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        resolve(blob || null);
      }, "image/jpeg", quality);
    };

    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function previewInput(fileInput, prevEl) {
  const f = fileInput.files?.[0];
  if (!f) { prevEl.textContent = ""; return; }
  prevEl.textContent = "Memproses preview...";
  const smallBlob = await compressImageToJpeg(f, 900, 0.65);
  if (!smallBlob) { prevEl.textContent = "Gagal baca foto."; return; }
  const url = await blobToDataURL(smallBlob);
  prevEl.innerHTML = `<img src="${url}" alt="preview" />`;
}

elFoto1.addEventListener("change", () => previewInput(elFoto1, prev1));
elFoto2.addEventListener("change", () => previewInput(elFoto2, prev2));

// =====================
// Autocomplete Nama dari data tersimpan
// =====================
function uniqueSorted(values) {
  const set = new Set(
    values
      .map(v => (v ?? "").toString().trim())
      .filter(v => v !== "")
  );
  return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
}

function fillDatalist(datalistEl, items, limit = 200) {
  datalistEl.innerHTML = "";
  items.slice(0, limit).forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    datalistEl.appendChild(opt);
  });
}

async function refreshNamaAutocomplete() {
  const rows = await getAllRecords();
  const namaItems = uniqueSorted(rows.map(r => r.nama));
  fillDatalist(elNamaList, namaItems);
}

// =====================
// Default tanggal hari ini
// =====================
function setToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  elTanggal.value = `${yyyy}-${mm}-${dd}`;
}
setToday();

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

  elFoto1.value = "";
  elFoto2.value = "";
  prev1.textContent = "";
  prev2.textContent = "";
});

// =====================
// Simpan
// =====================
document.getElementById("btnSimpan").addEventListener("click", async () => {
  const nama = elNama.value.trim();
  const tanggal = elTanggal.value;
  const lokasi = elLokasi.value.trim();
  const catatan = elCatatan.value.trim();

  const status = elStatus.value.trim();
  const cabang = elCabang.value.trim();
  const golongan = elGolongan.value.trim();

  if (!nama) { alert("Nama wajib diisi."); return; }
  if (!tanggal) { alert("Tanggal wajib diisi."); return; }
  if (!status) { alert("Status wajib dipilih."); return; }
  if (!cabang) { alert("Cabang wajib dipilih."); return; }
  if (!golongan) { alert("Golongan wajib dipilih."); return; }

  const f1 = elFoto1.files?.[0];
  const f2 = elFoto2.files?.[0];
  if (!f1 || !f2) { alert("Wajib 2 foto untuk 1 data."); return; }

  setStatus("Menyimpan...");

  const id = makeId();

  const foto1Blob = await compressImageToJpeg(f1, 1280, 0.72);
  const foto2Blob = await compressImageToJpeg(f2, 1280, 0.72);
  if (!foto1Blob || !foto2Blob) {
    setStatus("Gagal memproses foto.");
    alert("Gagal memproses foto. Coba ulangi.");
    return;
  }

  const rec = {
    id,
    nama,
    status,
    cabang,
    golongan,
    tanggal,
    lokasi,
    catatan,
    created_at: new Date().toISOString(),
    foto1: foto1Blob,
    foto2: foto2Blob
  };

  try {
    await putRecord(rec);
    setStatus(`Tersimpan lokal. ID: ${id}`);
    document.getElementById("btnReset").click();
    await renderTable();
  } catch (e) {
    console.error(e);
    setStatus("Gagal menyimpan.");
    alert("Gagal menyimpan. Kemungkinan storage penuh atau izin browser bermasalah.");
  }
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
    tdNama.textContent = r.nama;

    const tdStatus = document.createElement("td");
    tdStatus.textContent = r.status || "";

    const tdCabang = document.createElement("td");
    tdCabang.textContent = r.cabang || "";

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
    btnDel.onclick = async () => {
      const ok = confirm(`Hapus data ID ${r.id}?`);
      if (!ok) return;
      await deleteRecord(r.id);
      await renderTable();
    };
    tdAksi.appendChild(btnDel);

    tr.append(tdId, tdNama, tdStatus, tdCabang, tdGol, tdTgl, tdLok, tdCat, tdFoto, tdAksi);
    tbody.appendChild(tr);
  }

  await refreshNamaAutocomplete();
}

document.getElementById("btnRefresh").addEventListener("click", renderTable);
renderTable();

// =====================
// Export CSV (Excel)
// =====================
document.getElementById("btnExportCsvOnly").addEventListener("click", async () => {
  const rows = await getAllRecords();
  if (!rows.length) { alert("Belum ada data."); return; }

  const header = ["id","nama","status","cabang","golongan","tanggal","lokasi","catatan","created_at"];
  const lines = [header.join(",")];

  for (const r of rows) {
    const line = [
      csvEscape(r.id),
      csvEscape(r.nama),
      csvEscape(r.status),
      csvEscape(r.cabang),
      csvEscape(r.golongan),
      csvEscape(r.tanggal),
      csvEscape(r.lokasi),
      csvEscape(r.catatan),
      csvEscape(r.created_at)
    ].join(",");
    lines.push(line);
  }

  const csvText = "\uFEFF" + lines.join("\n");
  downloadBlob(
    new Blob([csvText], { type: "text/csv;charset=utf-8" }),
    `data_${makeId()}.csv`
  );
});

// =====================
// Export ZIP (CSV + foto)
// =====================
document.getElementById("btnExportZip").addEventListener("click", async () => {
  const rows = await getAllRecords();
  if (!rows.length) { alert("Belum ada data."); return; }

  if (!window.JSZip) {
    alert("JSZip tidak ditemukan. Pastikan jszip.min.js termuat sebelum app.js dan cache sudah dibersihkan.");
    return;
  }

  setStatus("Menyiapkan ZIP...");

  const zip = new window.JSZip();

  const header = ["id","nama","status","cabang","golongan","tanggal","lokasi","catatan","created_at","foto1_file","foto2_file"];
  const lines = [header.join(",")];

  const photoFolder = zip.folder("photos");

  for (const r of rows) {
    console.log('Nama:', r.nama);  // Pastikan ini berisi nama yang sesuai
const foto1Name = `${r.nama.replace(/\s+/g, '_')}_foto1.jpg`;
const foto2Name = `${r.nama.replace(/\s+/g, '_')}_foto2.jpg`;
console.log('Foto 1 Name:', foto1Name);  // Cek apakah nama file sudah berubah



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
