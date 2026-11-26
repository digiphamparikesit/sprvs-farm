import { supabase } from './supabase-client.js';
import { showAlert } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('tbody-checklist');
    const selectKategori = document.getElementById('kategori_pilihan');
    const selectRuangan = document.getElementById('ruangan');
    const form = document.getElementById('form-supervisi');

    let semuaPertanyaan = [];
    let semuaRuanganDB = []; 

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

    async function loadDataRuanganDB() {
        const { data, error } = await supabase.from('ruangan').select('id, nama_ruangan');
        if (error) { console.error(error); return; }
        semuaRuanganDB = data || [];
    }

    async function loadMasterPertanyaan() {
        const { data, error } = await supabase
            .from('master_pertanyaan')
            .select('*')
            .order('no_urut', { ascending: true })
            .order('id', { ascending: true });

        if (error) { showAlert('Gagal memuat pertanyaan: ' + error.message, 'error'); return; }
        semuaPertanyaan = data || [];
    }

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

    function renderPertanyaan(keywordFilter = '') {
        if (!keywordFilter) return;

        const pertanyaanTersaring = semuaPertanyaan.filter(q => {
            if (!q.default_ruangan) return false; 
            return q.default_ruangan.toLowerCase().includes(keywordFilter.toLowerCase());
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
                    <!-- KOLOM BARU: Tindak Lanjut -->
                    <td>
                        <select class="input-tindak-lanjut" name="tindak_${q.id}" disabled style="width:100%; padding:5px; font-size:12px;">
                            <option value="">-- Pilih --</option>
                            <option value="Selesai">Selesai</option>
                            <option value="Tidak Selesai">Tidak Selesai</option>
                        </select>
                    </td>
                    <!-- KOLOM KATEGORI (DINAMIS) - HANYA SATU -->
                    <td class="text-center">
                        <span class="kategori-value" data-asli="${q.kategori}">${q.kategori}</span>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    tbody.addEventListener('change', (e) => {
        if (e.target.type === 'radio' && e.target.name.startsWith('status_')) {
            const row = e.target.closest('tr');
            const catatanInput = row.querySelector('.input-catatan');
            const tindakInput = row.querySelector('.input-tindak-lanjut');
            const kategoriCell = row.querySelector('.kategori-value'); // Ambil elemen span kategori

            if (e.target.value === 'TS') {
                // Jika memilih TS
                catatanInput.disabled = false;
                catatanInput.required = true;
                catatanInput.focus();
                tindakInput.disabled = false;
                tindakInput.required = true;
                row.style.backgroundColor = '#fff3cd';
                
                // Kembalikan angka asli
                if (kategoriCell) kategoriCell.innerText = kategoriCell.dataset.asli;
            } else {
                // Jika memilih S
                catatanInput.disabled = true;
                catatanInput.required = false;
                catatanInput.value = '';
                tindakInput.disabled = true;
                tindakInput.required = false;
                tindakInput.value = '';
                row.style.backgroundColor = '';
                
                // Ubah angka menjadi 0
                if (kategoriCell) kategoriCell.innerText = '0';
            }
        }
    });

    selectRuangan.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const keyword = selectedOption.dataset.keyword || '';
        renderPertanyaan(keyword);
    });

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

        let ruanganDB;
        const kategoriDipilih = selectKategori.value;
        if (kategoriDipilih === 'Farmasi') {
            ruanganDB = semuaRuanganDB.find(r => r.nama_ruangan.toLowerCase().includes('depo') || r.nama_ruangan.toLowerCase().includes('gudang'));
        } else {
            ruanganDB = semuaRuanganDB.find(r => r.nama_ruangan.toLowerCase().includes('unit') || r.nama_ruangan.toLowerCase().includes('rawat'));
        }
        if (!ruanganDB && semuaRuanganDB.length > 0) ruanganDB = semuaRuanganDB[0];
        if (!ruanganDB) { showAlert('Database ruangan kosong.', 'error'); return; }

        const ruanganId = ruanganDB.id; 

        let isValid = true;
        let firstInvalidRow = null;
        const jawabanArray = [];

        rows.forEach(row => {
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

    await loadDataRuanganDB();
    await loadMasterPertanyaan();
});
