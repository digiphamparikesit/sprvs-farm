import { supabase } from './supabase-client.js';
import { showAlert } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('tbody-checklist');
    const selectKategori = document.getElementById('kategori_pilihan');
    const selectRuangan = document.getElementById('ruangan');
    const form = document.getElementById('form-supervisi');

    let semuaPertanyaan = [];

    // ==============================================================
    // DATA MANUAL DROPDOWN RUANGAN (Sesuai Permintaan)
    // ==============================================================
    const dataFarmasi = [
        { id: 'depo', nama: 'Depo Farmasi / Gudang Farmasi', keyword: 'depo' },
        { id: 'farklin', nama: 'Farklin', keyword: 'farklin' }
    ];

    const dataUnit = [
        { id: 'rawat', nama: 'Ruang Rawat Inap', keyword: 'unit' },
        { id: 'igd', nama: 'IGD', keyword: 'unit' },
        { id: 'icu', nama: 'ICU/NICU/PICU', keyword: 'unit' },
        { id: 'ok', nama: 'Kamar Operasi', keyword: 'unit' },
        { id: 'poli', nama: 'Poliklinik', keyword: 'unit' },
        { id: 'tindakan', nama: 'Ruang Tindakan', keyword: 'unit' },
        { id: 'ambulan', nama: 'Ambulan', keyword: 'unit' },
        { id: 'laundry', nama: 'Instalasi Laundry', keyword: 'unit' },
        { id: 'gizi', nama: 'Instalasi Gizi', keyword: 'unit' },
        { id: 'pemulasaran', nama: 'Instalasi Pemulasaran', keyword: 'unit' },
        { id: 'cssd', nama: 'Instalasi CSSD', keyword: 'unit' },
        { id: 'lab_mikro', nama: 'Laboratorium Mikrobiologi', keyword: 'unit' },
        { id: 'lab_pk', nama: 'Laboratorium PK', keyword: 'unit' }
    ];

    // 1. LOAD SEMUA MASTER PERTANYAAN SAJA
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

    // 2. LOGIKA SAAT KELOMPOK DIUBAH
    selectKategori.addEventListener('change', (e) => {
        const kategoriDipilih = e.target.value;
        
        // Reset dropdown ruangan
        selectRuangan.innerHTML = '<option value="">-- Pilih Ruangan --</option>';
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">Silakan pilih Unit/Ruangan terlebih dahulu.</td></tr>';

        if (!kategoriDipilih) {
            selectRuangan.disabled = true;
            selectRuangan.innerHTML = '<option value="">-- Pilih Kelompok Terlebih Dahulu --</option>';
            return;
        }

        // Tentukan data mana yang mau dimunculkan
        let listRuangan = (kategoriDipilih === 'Farmasi') ? dataFarmasi : dataUnit;

        selectRuangan.disabled = false;
        listRuangan.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.nama;
            opt.dataset.keyword = r.keyword; // Simpan kata kunci di sini
            selectRuangan.appendChild(opt);
        });
    });

    // 3. RENDER TABEL PERTANYAAN SAAT RUANGAN DIPILIH
    function renderPertanyaan(keywordFilter = '') {
        if (!keywordFilter) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">Silakan pilih Unit/Ruangan terlebih dahulu.</td></tr>';
            return;
        }

        // Filter pertanyaan dari Supabase berdasarkan kata kunci
        const pertanyaanTersaring = semuaPertanyaan.filter(q => {
            // Jika di database kolom default_ruangan kosong, kita anggap muncul di semua tempat (opsional, hapus baris ini jika tidak mau)
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

    // 4. EVENT SAAT DROPDOWN RUANGAN SPESIFIK DIUBAH
    selectRuangan.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const keyword = selectedOption.dataset.keyword || '';
        renderPertanyaan(keyword);
    });

    // 5. EVENT DELEGATION RADIO S/TS
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

    // 6. HANDLE SUBMIT FORM
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = document.getElementById('btn-submit');
        const originalText = btnSubmit.textContent;
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Menyimpan...';

        const rows = document.querySelectorAll('.pertanyaan-row');
        const ruanganId = document.getElementById('ruangan').value;

        if (!ruanganId || rows.length === 0) {
            showAlert('Pilih Kelompok dan Ruangan terlebih dahulu, lalu pastikan ada pertanyaan.', 'warning');
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText;
            return;
        }

        // UBAH ID DROPDOWN MANUAL MENJADI ID DATABASE YANG VALID
        // Karena kita pakai hardcode 'depo', 'farklin', 'unit', kita harus cari ID asli di tabel 'ruangan'
        // ATAU kita simpan saja ke database sebagai teks. 
        // *Solusi teraman: Kita buat kolom 'ruangan_id' ini menerima teks, 
        // ATAU kita insert 'ruangan_id' = null dan simpan nama ruangannya di field lain (jika ada).
        
        // KARENA TERBATAS KOLOM, KITA GUNAKAN ID DROPDOWN MANUAL. 
        // (Pastikan kolom 'ruangan_id' di tabel supervisi Supabase tipenya TEXT, bukan UUID/FK).
        
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
            // Menyimpan ID manual atau nama ruangan langsung
            ruangan_id: ruanganId, 
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

    // 7. INISIALISASI
    await loadMasterPertanyaan();
    renderPertanyaan('');
});
