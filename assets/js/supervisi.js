import { supabase } from './supabase-client.js';
import { showAlert } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('tbody-checklist');
    const selectKategori = document.getElementById('kategori_pilihan');
    const selectRuangan = document.getElementById('ruangan');
    const form = document.getElementById('form-supervisi');

    let semuaPertanyaan = [];
    let semuaRuanganDB = []; 

    // DATA RUANGAN FARMASI (Diperbarui)
    const dataFarmasi = [
        { nama: 'DEPO FARMASI CATHLAB', keyword: 'cathlab' },
        { nama: 'DEPO FARMASI IBS', keyword: 'ibs' },
        { nama: 'DEPO FARMASI IGD', keyword: 'igd' },
        { nama: 'DEPO FARMASI IRIN DAN RAWAT INAP MATERNITAS', keyword: 'maternitas' },
        { nama: 'DEPO FARMASI IRNA 1 DAN PAVILIUN', keyword: 'paviliun' },
        { nama: 'DEPO FARMASI ONKOLOGI TERPADU', keyword: 'onkologi' },
        { nama: 'DEPO FARMASI RAWAT JALAN', keyword: 'rawat jalan' },
        { nama: 'DEPO FARMASI RAWAT JALAN MATERNITAS', keyword: 'rawat jalan maternitas' },
        { nama: 'GUDANG FARMASI', keyword: 'gudang' },
        { nama: 'FARMASI KLINIS', keyword: 'klinis' }
    ];

    // DATA RUANGAN UNIT
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

    // 1. Load Data Ruangan dari Database (untuk UUID)
    async function loadDataRuanganDB() {
        const { data, error } = await supabase.from('ruangan').select('id, nama_ruangan');
        if (error) { console.error('Gagal load ruangan:', error); return; }
        semuaRuanganDB = data || [];
    }

    // 2. Load Master Pertanyaan
    async function loadMasterPertanyaan() {
        const { data, error } = await supabase
            .from('master_pertanyaan')
            .select('*')
            .order('no_urut', { ascending: true })
            .order('id', { ascending: true });

        if (error) { showAlert('Gagal memuat pertanyaan: ' + error.message, 'error'); return; }
        semuaPertanyaan = data || [];
    }

    // 3. Dropdown Kategori Diubah
    selectKategori.addEventListener('change', (e) => {
        const kategoriDipilih = e.target.value;
        selectRuangan.innerHTML = '<option value="">-- Pilih Ruangan --</option>';
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;">Silakan pilih Unit/Ruangan terlebih dahulu.</td></tr>';

        if (!kategoriDipilih) {
            selectRuangan.disabled = true;
            selectRuangan.innerHTML = '<option value="">-- Pilih Kelompok Terlebih Dahulu --</option>';
            return;
        }

        let listRuangan = (kategoriDipilih === 'Farmasi') ? dataFarmasi : dataUnit;
        selectRuangan.disabled = false;
        listRuangan.forEach((r, index) => {
            const opt = document.createElement('option');
            opt.value = index; 
            opt.textContent = r.nama;
            opt.dataset.nama = r.nama;
            opt.dataset.keyword = r.keyword;
            selectRuangan.appendChild(opt);
        });
    });

    // 4. Render Tabel Pertanyaan
    function renderPertanyaan(keywordFilter = '') {
        if (!keywordFilter) return;

        const pertanyaanTersaring = semuaPertanyaan.filter(q => {
            if (!q.default_ruangan) return false; 
            
            const ruanganDB = q.default_ruangan.toLowerCase();
            const isFarmasiDipilih = selectKategori.value === 'Farmasi';
            
            if (isFarmasiDipilih) {
                // Logika Farmasi: Cari kata umum (depo/farmasi/farklin) agar semua Depo muncul
                return ruanganDB.includes('depo') || ruanganDB.includes('farmasi') || ruanganDB.includes('farklin');
            } else {
                // Logika Unit: Cari sesuai kata kunci spesifik
                return ruanganDB.includes(keywordFilter.toLowerCase());
            }
        });

        if (pertanyaanTersaring.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">Tidak ada pertanyaan untuk ruangan ini.</td></tr>`;
            return;
        }

        let html = '';
        let lastKelompok = '';

        pertanyaanTersaring.forEach((q) => {
            if (q.kelompok !== lastKelompok) {
                html += `<tr class="kelompok-header"><td colspan="9"><strong>${q.kelompok}</strong></td></tr>`;
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
                    <td>
                        <textarea class="input-catatan" name="catatan_${q.id}" rows="2" placeholder="Wajib diisi jika TS" disabled></textarea>
                    </td>
                    <td>
                        <select class="input-tindak-lanjut" name="tindak_${q.id}" disabled style="width:100%; padding:5px; font-size:12px;">
                            <option value="">-- Pilih --</option>
                            <option value="Selesai">Selesai</option>
                            <option value="Tidak Selesai">Tidak Selesai</option>
                        </select>
                    </td>
                    <td class="text-center">
                        <span class="kategori-value" data-asli="${q.kategori}">${q.kategori}</span>
                    </td>
                </tr>
            `;
        });

        // TAMBAHAN REVISI 3: Baris Khusus Supervisi Kritis
        html += `
            <tr class="kelompok-header">
                <td colspan="9"><strong>Hasil supervisi kritis dengan kategori mengancam keselamatan pasien</strong></td>
            </tr>
            <tr class="pertanyaan-row" id="row-supervisi-kritis">
                <td class="text-center">*</td>
                <td>Supervisi Kritis</td>
                <td class="text-center">-</td>
                <td>Silakan isi temuan kritis jika ada</td>
                <td class="text-center">
                    <label class="radio-label"><input type="radio" name="status_kritis" value="S"> S</label>
                    <label class="radio-label"><input type="radio" name="status_kritis" value="TS"> TS</label>
                </td>
                <td>
                    <textarea class="input-catatan" id="catatan_kritis" rows="2" placeholder="Wajib diisi jika TS" disabled></textarea>
                </td>
                <td>
                    <select class="input-tindak-lanjut" id="tindak_kritis" disabled style="width:100%; padding:5px; font-size:12px;">
                        <option value="">-- Pilih --</option>
                        <option value="Selesai">Selesai</option>
                        <option value="Tidak Selesai">Tidak Selesai</option>
                    </select>
                </td>
                <td class="text-center">
                    <span class="kategori-value" data-asli="5">5</span>
                </td>
            </tr>
        `;

        tbody.innerHTML = html;
    }

    // 5. Event Radio Button (S/TS)
    tbody.addEventListener('change', (e) => {
        if (e.target.type === 'radio' && (e.target.name.startsWith('status_') || e.target.name === 'status_kritis')) {
            const row = e.target.closest('tr');
            const catatanInput = row.querySelector('.input-catatan');
            const tindakInput = row.querySelector('.input-tindak-lanjut');
            const kategoriCell = row.querySelector('.kategori-value');

            if (e.target.value === 'TS') {
                catatanInput.disabled = false;
                catatanInput.required = true;
                catatanInput.focus();
                tindakInput.disabled = false;
                tindakInput.required = true;
                row.style.backgroundColor = '#fff3cd';
                
                if (kategoriCell) kategoriCell.innerText = kategoriCell.dataset.asli;
            } else {
                catatanInput.disabled = true;
                catatanInput.required = false;
                catatanInput.value = '';
                tindakInput.disabled = true;
                tindakInput.required = false;
                tindakInput.value = '';
                row.style.backgroundColor = '';
                
                if (kategoriCell) kategoriCell.innerText = '0';
            }
        }
    });

    // 6. Dropdown Ruangan Diubah
    selectRuangan.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const keyword = selectedOption.dataset.keyword || '';
        renderPertanyaan(keyword);
    });

    // 7. Submit Form
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
            showAlert('Pilih Kelompok dan Ruangan terlebih dahulu.', 'warning');
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText;
            return;
        }

        // Pencarian ID Ruangan di Database (Sesuai Perbaikan Logika Farmasi)
        let ruanganDB;
        const kategoriDipilih = selectKategori.value;
        const namaRuanganLower = namaRuanganDipilih.toLowerCase();

        if (kategoriDipilih === 'Farmasi') {
            ruanganDB = semuaRuanganDB.find(r => 
                r.nama_ruangan.toLowerCase().includes(namaRuanganLower.split(' ')[0]) || 
                r.nama_ruangan.toLowerCase().includes('depo') || 
                r.nama_ruangan.toLowerCase().includes('farmasi')
            );
        } else {
            ruanganDB = semuaRuanganDB.find(r => 
                r.nama_ruangan.toLowerCase().includes(namaRuanganLower.split(' ')[0]) || 
                r.nama_ruangan.toLowerCase().includes('unit') || 
                r.nama_ruangan.toLowerCase().includes('rawat')
            );
        }
        if (!ruanganDB && semuaRuanganDB.length > 0) ruanganDB = semuaRuanganDB[0];
        if (!ruanganDB) { showAlert('Database ruangan kosong.', 'error'); return; }

        const ruanganId = ruanganDB.id; 

        let isValid = true;
        let firstInvalidRow = null;
        const jawabanArray = [];

        // Loop Validasi Pertanyaan Biasa
        rows.forEach(row => {
            // Abaikan baris kritis di sini, akan dihandle terpisah
            if (row.id === 'row-supervisi-kritis') return;

            const qId = row.dataset.id;
            const selectedRadio = row.querySelector(`input[name="status_${qId}"]:checked`);
            const catatanInput = row.querySelector(`textarea[name="catatan_${qId}"]`);
            const tindakInput = row.querySelector(`select[name="tindak_${qId}"]`);

            if (!selectedRadio) {
                isValid = false;
                row.style.backgroundColor = '#f8d7da';
                if (!firstInvalidRow) firstInvalidRow = row;
            } else if (selectedRadio.value === 'TS' && (!catatanInput || catatanInput.value.trim() === '' || !tindakInput.value)) {
                isValid = false;
                row.style.backgroundColor = '#f8d7da';
                if (!firstInvalidRow) firstInvalidRow = row;
            } else {
                row.style.backgroundColor = '';
                jawabanArray.push({
                    pertanyaan_id: qId,
                    status: selectedRadio.value,
                    catatan_temuan: selectedRadio.value === 'TS' ? catatanInput.value.trim() : null,
                    tindak_lanjut: selectedRadio.value === 'TS' ? tindakInput.value : null
                });
            }
        });

        // Ambil Data dari Baris Kritis
        const radioKritis = document.querySelector('input[name="status_kritis"]:checked');
        const catatanKritis = document.getElementById('catatan_kritis');
        const tindakKritis = document.getElementById('tindak_kritis');

        if (radioKritis) {
            if (radioKritis.value === 'TS' && (catatanKritis.value.trim() === '' || !tindakKritis.value)) {
                isValid = false;
                showAlert('Harap isi catatan dan tindak lanjut pada baris Supervisi Kritis.', 'warning');
            } else {
                jawabanArray.push({
                    pertanyaan_id: null, // Pastikan kolom ini nullable di DB, atau isi dengan ID dummy
                    status: radioKritis.value,
                    catatan_temuan: radioKritis.value === 'TS' ? catatanKritis.value.trim() : null,
                    tindak_lanjut: radioKritis.value === 'TS' ? tindakKritis.value : null
                });
            }
        }

        if (!isValid) {
            showAlert('Harap jawab semua, isi catatan & tindak lanjut jika memilih TS.', 'warning');
            if (firstInvalidRow) firstInvalidRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText;
            return;
        }

        const headerData = {
            tanggal: document.getElementById('tanggal').value,
            jam: document.getElementById('jam').value,
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
            console.error(error);
            showAlert('Gagal menyimpan data: ' + error.message, 'error');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText;
        }
    });

    // Inisialisasi Awal
    await loadDataRuanganDB();
    await loadMasterPertanyaan();
});
