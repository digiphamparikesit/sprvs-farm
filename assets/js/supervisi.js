import { supabase } from './supabase-client.js';
import { showAlert } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('tbody-checklist');
    const selectRuangan = document.getElementById('ruangan');
    const form = document.getElementById('form-supervisi');

    let semuaPertanyaan = []; // Menyimpan data pertanyaan dari database

    // 1. Load Ruangan
    async function loadRuangan() {
        const { data, error } = await supabase.from('ruangan').select('*').order('nama_ruangan');
        if (error) { console.error(error); return; }
        
        selectRuangan.innerHTML = '<option value="">-- Pilih Ruangan --</option>';
        data.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.nama_ruangan;
            opt.dataset.nama = r.nama_ruangan; // Simpan nama ruangan di atribut data
            selectRuangan.appendChild(opt);
        });
    }

    // 2. Ambil Semua Pertanyaan (Tapi jangan dirender dulu)
    async function loadMasterPertanyaan() {
        const { data, error } = await supabase
            .from('master_pertanyaan')
            .select('*')
            .order('no_urut', { ascending: true })
            .order('id', { ascending: true });

        if (error) {
            showAlert('Gagal memuat pertanyaan: ' + error.message, 'error');
            return;
        }
        semuaPertanyaan = data;
    }

    // 3. Render Tabel berdasarkan ruangan yang dipilih
    function renderPertanyaan(filterRuangan = '') {
        if (!filterRuangan) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">Silakan pilih Unit/Ruangan terlebih dahulu untuk menampilkan pertanyaan.</td></tr>';
            return;
        }

        // Filter pertanyaan: Tampilkan jika kolom default_ruangan mengandung nama ruangan yang dipilih
        const pertanyaanTersaring = semuaPertanyaan.filter(q => {
            if (!q.default_ruangan) return true; // Jika kosong, tampilkan untuk semua
            const ruanganDB = q.default_ruangan.toLowerCase();
            const ruanganDipilih = filterRuangan.toLowerCase();
            return ruanganDB.includes(ruanganDipilih) || ruanganDipilih.includes(ruanganDB);
        });

        if (pertanyaanTersaring.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">Tidak ada pertanyaan spesifik untuk ruangan ini.</td></tr>';
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
                        <label class="radio-label">
                            <input type="radio" name="status_${q.id}" value="S" required> S
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="status_${q.id}" value="TS" required> TS
                        </label>
                    </td>
                    <td>
                        <!-- Diubah menjadi textarea agar muat banyak karakter -->
                        <textarea class="input-catatan" name="catatan_${q.id}" rows="2" placeholder="Wajib diisi jika TS" disabled></textarea>
                    </td>
                    <td class="text-center">${q.kategori}</td>
                    <td class="text-center">${q.default_ruangan}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        attachRadioEvents();
    }

    // 4. Event Listener untuk Radio Button (S/TS)
    function attachRadioEvents() {
        document.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
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
            });
        });
    }

    // 5. Event Listener saat Dropdown Ruangan diubah
    selectRuangan.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const namaRuangan = selectedOption.dataset.nama || '';
        renderPertanyaan(namaRuangan);
    });

    // 6. Handle Submit Form
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = document.getElementById('btn-submit');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Menyimpan...';

        const rows = document.querySelectorAll('.pertanyaan-row');
        
        if (rows.length === 0) {
            showAlert('Tidak ada pertanyaan yang bisa disimpan. Pilih ruangan terlebih dahulu.', 'warning');
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Simpan & Lanjut ke Verifikasi';
            return;
        }

        let isValid = true;
        const jawabanArray = [];

        rows.forEach(row => {
            const qId = row.dataset.id;
            const selectedRadio = row.querySelector(`input[name="status_${qId}"]:checked`);
            const catatanInput = row.querySelector(`input[name="catatan_${qId}"]`);

            if (!selectedRadio) {
                isValid = false;
                row.style.backgroundColor = '#f8d7da';
            } else if (selectedRadio.value === 'TS' && catatanInput.value.trim() === '') {
                isValid = false;
                row.style.backgroundColor = '#f8d7da';
                catatanInput.focus();
            } else {
                row.style.backgroundColor = '';
                jawabanArray.push({
                    pertanyaan_id: qId,
                    status: selectedRadio.value,
                    catatan_temuan: catatanInput.value.trim()
                });
            }
        });

        if (!isValid) {
            showAlert('Harap jawab semua pertanyaan (S/TS) dan isi catatan jika memilih TS.', 'warning');
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Simpan & Lanjut ke Verifikasi';
            return;
        }

        const headerData = {
            tanggal: document.getElementById('tanggal').value,
            jam: document.getElementById('jam').value,
            ruangan_id: document.getElementById('ruangan').value,
            kategori_risiko: document.getElementById('kategori_risiko').value,
            apoteker_supervisor_nama: document.getElementById('supervisor').value,
            penanggung_jawab_nama: document.getElementById('pj').value,
            metode: document.getElementById('metode').value,
            sampel: document.getElementById('sampel').value
        };

        try {
            const { data: headerInserted, error: errHeader } = await supabase
                .from('supervisi')
                .insert([headerData])
                .select()
                .single();

            if (errHeader) throw errHeader;

            const detailData = jawabanArray.map(j => ({
                supervisi_id: headerInserted.id,
                ...j
            }));

            const { error: errDetail } = await supabase
                .from('supervisi_detail')
                .insert(detailData);

            if (errDetail) throw errDetail;

            showAlert('Data supervisi berhasil disimpan!', 'success');
            window.location.href = `verifikasi.html?id=${headerInserted.id}`;

        } catch (error) {
            console.error(error);
            showAlert('Gagal menyimpan data: ' + error.message, 'error');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Simpan & Lanjut ke Verifikasi';
        }
    });

    // Inisialisasi Awal
    await loadRuangan();
    await loadMasterPertanyaan();
    // Tampilkan pesan kosong di awal
    renderPertanyaan('');
});
