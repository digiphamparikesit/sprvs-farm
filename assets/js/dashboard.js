import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
    let myChart = null; // Variabel untuk menyimpan instance Chart.js

    // 1. Inisialisasi Filter Tahun
    const filterTahun = document.getElementById('filter-tahun');
    const currentYear = new Date().getFullYear();
    
    // Isi dropdown tahun dari 2 tahun ke belakang sampai tahun depan
    for (let i = currentYear + 1; i >= currentYear - 2; i--) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        filterTahun.appendChild(opt);
    }
    filterTahun.value = currentYear; // Pilih tahun ini secara default

    // 2. Fungsi Mengambil Data dari Supabase
    async function fetchData() {
        const tahun = filterTahun.value;
        const dari = document.getElementById('filter-dari').value;
        const sampai = document.getElementById('filter-sampai').value;

        // Query dasar
        let query = supabase.from('supervisi').select(`
            id, tanggal,
            supervisi_detail (status)
        `);

        // Terapkan Filter Tanggal
        if (dari && sampai) {
            query = query.gte('tanggal', dari).lte('tanggal', sampai);
        } else {
            // Jika tidak ada range tanggal, filter berdasarkan Tahun yang dipilih
            query = query.gte('tanggal', `${tahun}-01-01`).lte('tanggal', `${tahun}-12-31`);
        }

        const { data, error } = await query;
        
        if (error) {
            console.error("Gagal memuat data dashboard:", error);
            return;
        }

        prosesDataDanRender(data, tahun);
    }

    // 3. Proses Data & Render Grafik
    function prosesDataDanRender(data, tahun) {
        let totalSupervisi = data.length;
        let totalS = 0;
        let totalTS = 0;

        // Array untuk menampung data grafik per bulan (Jan - Des)
        const dataBulanan = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'],
            supervisi: Array(12).fill(0),
            temuanTS: Array(12).fill(0)
        };

        data.forEach(item => {
            // Hitung Total S & TS
            if (item.supervisi_detail) {
                item.supervisi_detail.forEach(detail => {
                    if (detail.status === 'S') totalS++;
                    if (detail.status === 'TS') totalTS++;
                });
            }

            // Hitung Grafik per Bulan
            if (item.tanggal) {
                const bulan = new Date(item.tanggal).getMonth(); // 0 = Jan, 11 = Des
                dataBulanan.supervisi[bulan]++;
                
                // Hitung total TS di bulan tersebut
                if (item.supervisi_detail) {
                    const tsBulanIni = item.supervisi_detail.filter(d => d.status === 'TS').length;
                    dataBulanan.temuanTS[bulan] += tsBulanIni;
                }
            }
        });

        // Hitung Persentase Kepatuhan (Rata-rata S)
        let persentase = 0;
        if (totalS + totalTS > 0) {
            persentase = Math.round((totalS / (totalS + totalTS)) * 100);
        }

        // Update Kartu Statistik di HTML
        document.getElementById('stat-total').innerText = totalSupervisi;
        document.getElementById('stat-kepatuhan').innerText = persentase + '%';
        document.getElementById('stat-temuan').innerText = totalTS;

        // Render Grafik
        renderChart(dataBulanan);
    }

    // 4. Fungsi Merender Grafik dengan Chart.js
    function renderChart(dataBulanan) {
        const ctx = document.getElementById('myChart').getContext('2d');

        // Hancurkan grafik lama jika ada (saat filter diubah)
        if (myChart) {
            myChart.destroy();
        }

        myChart = new Chart(ctx, {
            type: 'line', // Grafik Garis
            data: {
                labels: dataBulanan.labels,
                datasets: [
                    {
                        label: 'Jumlah Supervisi',
                        data: dataBulanan.supervisi,
                        borderColor: '#3498db', // Biru
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        borderWidth: 2,
                        tension: 0.3, // Garis melengkung halus
                        fill: true
                    },
                    {
                        label: 'Total Temuan (TS)',
                        data: dataBulanan.temuanTS,
                        borderColor: '#e74c3c', // Merah
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    // 5. Event Listener saat tombol "Terapkan" diklik
    document.getElementById('btn-filter').addEventListener('click', () => {
        fetchData();
    });

    // 6. Load data pertama kali saat halaman dibuka
    fetchData();
});
