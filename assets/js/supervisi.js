import { supabase } from './supabase-client.js';
import { showAlert } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('tbody-checklist');
    const selectRuangan = document.getElementById('ruangan');
    const form = document.getElementById('form-supervisi');

    // 1. Load Ruangan
    async function loadRuangan() {
        const { data, error } = await supabase.from('ruangan').select('*').order('nama_ruangan');
        if (error) { console.error(error); return; }
        data.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.nama_ruangan;
            selectRuangan.appendChild(opt);
        });
    }

    // 2. Load Pertanyaan & Render Tabel (Format 8 Kolom)
    async function loadPertanyaan() {
        // Ambil data, urutkan berdasarkan kelompok dan no_urut
        const { data, error } = await supabase
            .from('master_pertanyaan')
            .select('*')
            .order('no_urut', { ascending: true }) // <--- Urutkan berdasarkan nomor dulu
            .order('id', { ascending: true });     // <--- Lalu berdasarkan ID

        if (error) {
            showAlert('Gagal memuat pertanyaan: ' + error.message, 'error');
            return;
        }

        let html = '';
        let lastKelompok = '';

        data.forEach((q, index) => {
            // Header Kelompok (jika kelompok berubah)
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
                        <input type="text" class="input-catatan" name="catatan_${q.id}" placeholder="Wajib diisi jika TS" disabled>
                    </td>
                    <td class="text-center">${q.kategori}</td>
                    <td class="text-center">${q.default_ruangan}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

        // 3. Event Listener: Aktifkan input catatan jika TS dipilih
        document.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const row = e.target.closest('tr');
                const catatanInput = row.querySelector('.input-catatan');
                if (e.target.value === 'TS') {
                    catatanInput.disabled = false;
                    catatanInput.required = true;
                    catatanInput.focus();
                    row.style.backgroundColor = '#fff3cd'; // Highlight peringatan
                } else {
                    catatanInput.disabled = true;
                    catatanInput.required = false;
                    catatanInput.value = ''; // Reset jika berubah ke S
                    row.style.backgroundColor = '';
                }
            });
        });
    }

    // 4. Handle Submit Form
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = document.getElementById('btn-submit');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Menyimpan...';

        const rows = document.querySelectorAll('.pertanyaan-row');
        let isValid = true;
        const jawabanArray = [];

        // Validasi semua radio terisi dan catatan terisi jika TS
        rows.forEach(row => {
            const qId = row.dataset.id;
            const selectedRadio = row.querySelector(`input[name="status_${qId}"]:checked`);
            const catatanInput = row.querySelector(`input[name="catatan_${qId}"]`);

            if (!selectedRadio) {
                isValid = false;
                row.style.backgroundColor = '#f8d7da'; // Merah jika kosong
            } else if (selectedRadio.value === 'TS' && catatanInput.value.trim() === '') {
                isValid = false;
                row.style.backgroundColor = '#f8d7da'; // Merah jika TS tapi catatan kosong
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

        // Siapkan data header
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
            // Insert Header
            const { data: headerInserted, error: errHeader } = await supabase
                .from('supervisi')
                .insert([headerData])
                .select()
                .single();

            if (errHeader) throw errHeader;

            // Siapkan data detail
            const detailData = jawabanArray.map(j => ({
                supervisi_id: headerInserted.id,
                ...j
            }));

            // Insert Detail
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

    // Jalankan fungsi load
    await loadRuangan();
    await loadPertanyaan();
});
