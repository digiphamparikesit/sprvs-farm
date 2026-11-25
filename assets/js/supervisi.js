import { supabase } from './supabase-client.js';
import { showAlert } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('tbody-checklist');
    const selectKategori = document.getElementById('kategori_pilihan');
    const selectRuangan = document.getElementById('ruangan');
    const form = document.getElementById('form-supervisi');

    let semuaPertanyaan = [];
    let semuaRuanganDB = []; // Menyimpan data asli dari Supabase

    // ==============================================================
    // DATA MANUAL DROPDOWN (Untuk tampilan di form)
    // ==============================================================
    const dataFarmasi = [
        { nama: 'Depo Farmasi / Gudang Farmasi', keyword: 'depo' },
        { nama: 'Farklin', keyword: 'farklin' }
    ];

    const dataUnit = [
        { nama: 'Ruang Rawat Inap', keyword: 'unit' },
        { nama: 'IGD', keyword: 'unit' },
        { nama: 'ICU/NICU/PICU', keyword: 'unit' },
        { nama: 'Kamar Operasi', keyword: 'unit' },
        { nama: 'Poliklinik', keyword: 'unit' },
        { nama: 'Ruang Tindakan', keyword: 'unit' },
        { nama: 'Ambulan', keyword: 'unit' },
        { nama: 'Instalasi Laundry', keyword: 'unit' },
        { nama: 'Instalasi Gizi', keyword: 'unit' },
        { nama: 'Instalasi Pemulasaran', keyword: 'unit' },
        { nama: 'Instalasi CSSD', keyword: 'unit' },
        { nama: 'Laboratorium Mikrobiologi', keyword: 'unit' },
        { nama: 'Laboratorium PK', keyword: 'unit' }
    ];

    // 1. LOAD DATA RUANGAN DARI SUPABASE (UNTUK MENDAPATKAN UUID)
    async function loadDataRuanganDB() {
        const { data, error } = await supabase.from('ruangan').select('id, nama_ruangan');
        if (error) {
            console.error('Gagal memuat ruangan dari DB:', error);
            return;
        }
        semuaRuanganDB = data || [];
    }

    // 2. LOAD SEMUA MASTER PERTANYAAN
    async function loadMasterPertanyaan() {
        const { data, error } = await supabase
            .from('master_pertanyaan')
            .select('*')
            .order('no_urut', { ascending: true })
            .order('id', { ascending: true });

        if (error) {
            console.error('Gagal memuat pertanyaan:', error);
            showAlert('Gagal memuat pertanyaan: ' + error.message, 'error');
            return;
        }
        semuaPertanyaan = data || [];
    }

    // 3. LOGIKA SAAT KELOMPOK DIUBAH
    selectKategori.addEventListener('change', (e) => {
        const kategoriDipilih = e.target.value;
        
        selectRuangan.innerHTML = '<option value="">-- Pilih Ruangan --</option>';
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">Silakan pilih Unit/Ruangan terlebih dahulu.</td></tr>';

        if (!kategoriDipilih) {
            selectRuangan.disabled = true;
            selectRuangan.innerHTML = '<option value="">-- Pilih Kelompok Terlebih Dahulu --</option>';
            return;
        }

        let listRuangan = (kategoriDipilih === 'Farmasi') ? dataFarmasi : dataUnit;

        selectRuangan.disabled = false;
        listRuangan.forEach((r, index) => {
            const opt = document.createElement('option');
            // Value kita isi dengan index sementara, kita ambil UUID aslinya nanti saat submit
            opt.value = index; 
            opt.textContent = r.nama;
            opt.dataset.nama = r.nama; // Simpan nama ruangan
            opt.dataset.keyword = r.keyword; // Simpan keyword untuk filter pertanyaan
            selectRuangan.appendChild(opt);
        });
    });

    // 4. RENDER TABEL PERTANYAAN
    function renderPertanyaan(keywordFilter = '') {
        if (!keywordFilter) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">Silakan pilih Unit/Ruangan terlebih dahulu.</td></tr>';
            return;
        }

        const pertanyaanTersaring = semuaPertanyaan.filter(q => {
            if (!q.default_ruangan) return false; 
            const ruanganDB = q.default_ruangan.toLowerCase();
            return ruanganDB.includes(keywordFilter.toLowerCase());
        });

        if (pertanyaanTersaring.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;">Tidak ada pertanyaan dengan kata kunci "${keywordFilter}" untuk ruangan ini.</td></tr>`;
            return;
        }

        let html = '';
        let lastKelompok = '';

        pertanyaanTersaring.forEach((q) => {
            if (q.kelompok !== lastKelompok) {
                html += `<tr class="kelompok-header"><td colspan="8"><strong>${q.kelompok}</strong></td></tr>`;
                lastKelompok = q.kelompok;
            }

            html += `
                <tr class="pertanyaan-row" data-id="${q.id}">
                    <td class="text-center">${q.no_urut}</td>
                    <td>${q.objek_pemeriksaan}</td>
                    <td class="text-center">${q.acuan}</td>
                    <td>${q.pengamatan_dilapangan}</td>
                    <td class="text-center">
                        <label class="radio-label"><input type="radio" name="status_${q.id}" value="S"> S</label>
                        <label class="radio-label"><input type="radio" name="status_${q.id}" value="TS"> TS</label>
                    </td>
                    <td><textarea class="input-catatan" name="catatan_${q.id}" rows="2" placeholder="Wajib diisi jika TS" disabled></textarea></td>
                    <td class="text-center">${q.kategori}</td>
                    <td class="text-center">${q.default_ruangan}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    // 5. EVENT SAAT DROPDOWN RUANGAN SPESIFIK DIUBAH
    selectRuangan.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const keyword = selectedOption.dataset.keyword || '';
        renderPertanyaan(keyword);
    });

    // 6. EVENT DELEGATION RADIO S/TS
    tbody.addEventListener('change', (e) => {
        if (e.target.type === 'radio' && e.target.name.startsWith('status_')) {
            const row = e.target.closest('tr');
            const catatanInput = row.querySelector('.input-catatan');
            if (e.target.value === 'TS') {
                catatanInput.disabled = false;
                catatanInput.required = true;
                catatanInput.focus();
                row.style.backgroundColor = '#fff3cd';
            } else {
                catatanInput.disabled = true;
                catatanInput.required = false;
                catatanInput.value = '';
                row.style.backgroundColor = '';
            }
        }
    });

    // 7. HANDLE SUBMIT FORM
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = document.getElementById('btn-submit');
        const originalText = btnSubmit.textContent;
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Menyimpan...';

        const rows = document.querySelectorAll('.pertanyaan-row');
        const selectedOption = selectRuangan.options[selectRuangan.selectedIndex];
        const namaRuanganDipilih = selectedOption.dataset.nama;
        
        if (!namaRuanganDipilih || rows.length === 0) {
            showAlert('Pilih Kelompok dan Ruangan terlebih dahulu, lalu pastikan ada pertanyaan.', 'warning');
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText;
            return;
        }

                // CARI UUID ASLI DARI DATABASE BERDASARKAN KATA KUNCI KELOMPOK
        let ruanganDB;
        const kategoriDipilih = selectKategori.value;
        const keyword = selectedOption.dataset.keyword || '';

        if (kategoriDipilih === 'Farmasi') {
            // Jika user pilih Farklin atau Depo, cari di database ruangan yang ada kata depo/farmasi/gudang
            ruanganDB = semuaRuanganDB.find(r => 
                r.nama_ruangan.toLowerCase().includes('depo') || 
                r.nama_ruangan.toLowerCase().includes('gudang') || 
                r.nama_ruangan.toLowerCase().includes('farmasi')
            );
        } else {
            // Jika user pilih Unit (IGD, Laundry, dll), cari di database ruangan yang ada kata unit/igd/rawat/lab/laundry
            ruanganDB = semuaRuanganDB.find(r => 
                r.nama_ruangan.toLowerCase().includes('unit') || 
                r.nama_ruangan.toLowerCase().includes('rawat') ||
                r.nama_ruangan.toLowerCase().includes('laundry') ||
                r.nama_ruangan.toLowerCase().includes('lab') ||
                r.nama_ruangan.toLowerCase().includes('igd')
            );
        }

        // Jika sama sekali tidak ada ruangan farmasi/unit di database, kita fallback ke ruangan pertama (opsional)
        if (!ruanganDB && semuaRuanganDB.length > 0) {
            ruanganDB = semuaRuanganDB[0];
        }

        if (!ruanganDB) {
            showAlert('Database ruangan Anda kosong. Harap isi tabel "ruangan" di Supabase minimal 1 data.', 'error');
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText;
            return;
        }

        const ruanganId = ruanganDB.id; // Ini UUID yang valid!

        let isValid = true;
        let firstInvalidRow = null;
        const jawabanArray = [];

        rows.forEach(row => {
            const qId = row.dataset.id;
            const selectedRadio = row.querySelector(`input[name="status_${qId}"]:checked`);
            const catatanInput = row.querySelector(`textarea[name="catatan_${qId}"]`);

            if (!selectedRadio) {
                isValid = false;
                row.style.backgroundColor = '#f8d7da';
                if (!firstInvalidRow) firstInvalidRow = row;
            } else if (selectedRadio.value === 'TS' && (!catatanInput || catatanInput.value.trim() === '')) {
                isValid = false;
                row.style.backgroundColor = '#f8d7da';
                if (!firstInvalidRow) firstInvalidRow = row;
                if (catatanInput) catatanInput.focus();
            } else {
                row.style.backgroundColor = '';
                jawabanArray.push({
                    pertanyaan_id: qId,
                    status: selectedRadio.value,
                    catatan_temuan: selectedRadio.value === 'TS' ? catatanInput.value.trim() : null
                });
            }
        });

        if (!isValid) {
            showAlert('Harap jawab semua pertanyaan (S/TS) dan isi catatan jika memilih TS.', 'warning');
            if (firstInvalidRow) firstInvalidRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText;
            return;
        }

        const headerData = {
            tanggal: document.getElementById('tanggal').value,
            jam: document.getElementById('jam').value,
            ruangan_id: ruanganId, // UUID Asli
            kategori_risiko: document.getElementById('kategori_risiko').value,
            apoteker_supervisor_nama: document.getElementById('supervisor').value,
            penanggung_jawab_nama: document.getElementById('pj').value,
            metode: document.getElementById('metode').value,
            sampel: document.getElementById('sampel').value
        };

        try {
            const { data: headerInserted, error: errHeader } = await supabase.from('supervisi').insert([headerData]).select().single();
            if (errHeader) throw new Error('Header: ' + errHeader.message);

            const detailData = jawabanArray.map(j => ({ supervisi_id: headerInserted.id, ...j }));
            const { error: errDetail } = await supabase.from('supervisi_detail').insert(detailData);

            if (errDetail) {
                await supabase.from('supervisi').delete().eq('id', headerInserted.id);
                throw new Error('Detail: ' + errDetail.message);
            }

            showAlert('Data supervisi berhasil disimpan!', 'success');
            window.location.href = `verifikasi.html?id=${headerInserted.id}`;

        } catch (error) {
            console.error('DETAIL ERROR:', error);
            showAlert('Gagal menyimpan data: ' + (error.message || 'Terjadi kesalahan'), 'error');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText;
        }
    });

    // 8. INISIALISASI
    await loadDataRuanganDB(); // Load data ruangan untuk UUID
    await loadMasterPertanyaan();
    renderPertanyaan('');
});
