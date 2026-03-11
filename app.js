import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, get, child, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAaAGlSx44A4ZmTjJ1FDkdcmg962Q6ZpF0",
    authDomain: "homestechvat.firebaseapp.com",
    projectId: "homestechvat",
    storageBucket: "homestechvat.firebasestorage.app",
    messagingSenderId: "101376091255",
    appId: "1:101376091255:web:3a6209380585471c0f9272",
    measurementId: "G-EDQVQHYCVG",
    databaseURL: "https://homestechvat-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let availableProducts = [];
let originalInvoicesData = {};

// --- HÀM TRỢ GIÚP ĐỊNH DẠNG ---
window.handleMoneyInput = (input) => {
    let value = input.value.replace(/\D/g, "");
    input.value = value !== "" ? parseInt(value).toLocaleString('vi-VN') : "";
};

function getRawNumber(id) {
    const val = document.getElementById(id).value || "0";
    return parseInt(val.replace(/\./g, "")) || 0;
}

window.toggleModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.classList.toggle('hidden');
};

// --- QUẢN LÝ CHI PHÍ LƯƠNG ---
window.saveSalary = async () => {
    const key = document.getElementById('edit_salary_key').value;
    const staff = document.getElementById('s_staff').value.trim();
    const amount = parseInt(document.getElementById('s_amount').value) || 0;

    if (!staff) return alert("Vui lòng nhập tên nhân viên hoặc bộ phận!");
    if (amount <= 0) return alert("Vui lòng nhập số tiền lương hợp lệ!");

    const data = {
        month: document.getElementById('s_month').value,
        year: document.getElementById('s_year').value,
        staff: staff,
        note: document.getElementById('s_note').value.trim(),
        amount: amount,
        status: document.getElementById('s_status').value,
        updatedAt: Date.now()
    };

    try {
        if (key) {
            await update(ref(db, `salaries/${key}`), data);
            alert("Đã cập nhật thông tin lương!");
        } else {
            data.createdAt = Date.now();
            await push(ref(db, 'salaries'), data);
            alert("Đã lưu phiếu lương mới!");
        }
        window.toggleModal('modal-luong');
    } catch (error) {
        console.error(error);
        alert("Có lỗi xảy ra khi lưu dữ liệu!");
    }
};

window.editSalary = async (key) => {
    const snapshot = await get(ref(db, `salaries/${key}`));
    if (snapshot.exists()) {
        const d = snapshot.val();
        document.getElementById('edit_salary_key').value = key;
        document.getElementById('s_month').value = d.month;
        document.getElementById('s_year').value = d.year;
        document.getElementById('s_staff').value = d.staff;
        document.getElementById('s_note').value = d.note || '';
        document.getElementById('s_amount').value = d.amount;
        document.getElementById('s_status').value = d.status;
        
        document.getElementById('salaryModalTitle').innerText = "Chỉnh sửa phiếu lương";
        window.toggleModal('modal-luong');
    }
};

window.deleteSalary = async (key) => {
    if (confirm("Bạn có chắc chắn muốn xóa bản ghi lương này?")) {
        await remove(ref(db, `salaries/${key}`));
    }
};

// --- QUẢN LÝ NHÀ CUNG CẤP ---
window.saveNCC = async () => {
    const key = document.getElementById('edit_ncc_key')?.value;
    const name = document.getElementById('ncc_name').value.trim();
    if (!name) return alert("Vui lòng nhập tên!");

    const data = {
        name,
        phone: document.getElementById('ncc_phone').value,
        bank: document.getElementById('ncc_bank').value,
        address: document.getElementById('ncc_address').value,
    };

    if (key) {
        await update(ref(db, `vendors/${key}`), data);
    } else {
        const codesnapshot = await get(ref(db, 'vendors'));
        let newCode = "NCC001";
        if (codesnapshot.exists()) {
            const codes = Object.values(codesnapshot.val()).map(v => parseInt(v.code?.replace("NCC", "") || 0));
            newCode = "NCC" + (Math.max(...codes) + 1).toString().padStart(3, '0');
        }
        data.code = newCode;
        data.createdAt = Date.now();
        await push(ref(db, 'vendors'), data);
    }
    alert("Thành công!");
    window.toggleModal('modal-ncc');
};

// --- QUẢN LÝ SẢN PHẨM ---
window.saveProduct = async () => {
    const name = document.getElementById('p_name').value;
    if (!name) return alert("Nhập tên SP!");
    const snapshot = await get(ref(db, 'products'));
    let newCode = "SP001";
    if (snapshot.exists()) {
        const codes = Object.values(snapshot.val()).map(p => parseInt(p.code?.replace("SP", "") || 0));
        newCode = "SP" + (Math.max(...codes) + 1).toString().padStart(3, '0');
    }
    await push(ref(db, 'products'), {
        code: newCode, name,
        cost: parseInt(document.getElementById('p_cost').value) || 0,
        unit: document.getElementById('p_unit').value,
        stock: parseInt(document.getElementById('p_stock').value) || 0
    });
    window.toggleModal('modal-sanpham');
};

// --- HÀM CẬP NHẬT BÁO CÁO ---
function updateGeneralReport(invoicesData) {
    originalInvoicesData = invoicesData; 
    
    const vendorSelectFilter = document.getElementById('reportVendorFilter');
    if (vendorSelectFilter) {
        const currentVal = vendorSelectFilter.value;
        const vendors = [...new Set(Object.values(invoicesData).map(d => d.NhaCungCap))].filter(Boolean).sort();
        vendorSelectFilter.innerHTML = '<option value="">-- Tất cả nhà cung cấp --</option>';
        vendors.forEach(v => {
            vendorSelectFilter.innerHTML += `<option value="${v}" ${v === currentVal ? 'selected' : ''}>${v}</option>`;
        });
    }

    applyReportFilter();
}

window.applyReportFilter = () => {
    const fromDate = document.getElementById('reportFromDate')?.value;
    const toDate = document.getElementById('reportToDate')?.value;
    const selectedVendor = document.getElementById('reportVendorFilter')?.value;

    let totalChi = 0, totalDon = 0, totalNo = 0;
    let vendorSummary = {};

    const toIso = (str) => {
        if (!str || !str.includes('/')) return str;
        const p = str.split('/'); return `${p[2]}-${p[1]}-${p[0]}`;
    };

    Object.entries(originalInvoicesData).forEach(([key, d]) => {
        const invoiceDateIso = toIso(d.NgayNhap);
        const matchFrom = !fromDate || invoiceDateIso >= fromDate;
        const matchTo = !toDate || invoiceDateIso <= toDate;
        const matchVendor = !selectedVendor || d.NhaCungCap === selectedVendor;

        if (matchFrom && matchTo && matchVendor) {
            const amount = parseInt(d.ThanhTien) || 0;
            totalChi += amount;
            totalDon++;
            
            // Cập nhật logic lọc công nợ báo cáo
            if (d.HinhThucThanhToan === "Công Nợ" || d.HinhThucThanhToan === "Chưa thanh toán") {
                totalNo += amount;
            }

            const vName = d.NhaCungCap || "Chưa rõ";
            if (!vendorSummary[vName]) {
                vendorSummary[vName] = { qty: 0, sum: 0, hasPendingInvoice: false };
            }
            vendorSummary[vName].qty++;
            vendorSummary[vName].sum += amount;
            if (d.TinhTrangHoaDon === "Chưa Nhận HĐ") {
                vendorSummary[vName].hasPendingInvoice = true;
            }
        }
    });

    if (document.getElementById('report-total-amount')) document.getElementById('report-total-amount').innerText = totalChi.toLocaleString('vi-VN') + "đ";
    if (document.getElementById('report-total-invoices')) document.getElementById('report-total-invoices').innerText = totalDon;
    if (document.getElementById('report-unpaid-amount')) document.getElementById('report-unpaid-amount').innerText = totalNo.toLocaleString('vi-VN') + "đ";

    const reportTbody = document.getElementById('report-vendor-body');
    if (reportTbody) {
        reportTbody.innerHTML = Object.entries(vendorSummary).map(([name, stat]) => `
            <tr class="border-b hover:bg-gray-50 text-sm">
                <td class="p-4 font-bold">${name}</td>
                <td class="p-4 text-center">${stat.qty} đơn</td>
                <td class="p-4 text-right font-bold text-blue-600">${stat.sum.toLocaleString()}đ</td>
                <td class="p-4 text-center">
                    ${stat.hasPendingInvoice ? '<span class="text-red-500 text-xs font-bold">⚠️ Thiếu HĐ</span>' : '<span class="text-green-500 text-xs font-bold">✅ Đủ HĐ</span>'}
                </td>
            </tr>`).join('');
    }
};

window.resetReportFilter = () => {
    if (document.getElementById('reportFromDate')) document.getElementById('reportFromDate').value = "";
    if (document.getElementById('reportToDate')) document.getElementById('reportToDate').value = "";
    if (document.getElementById('reportVendorFilter')) document.getElementById('reportVendorFilter').value = "";
    window.applyReportFilter();
};

// --- KHỞI TẠO ỨNG DỤNG ---
function initApp() {
    onValue(ref(db, 'products'), (snapshot) => {
        const prodTbody = document.getElementById('productTableBody');
        if (!prodTbody) return;
        prodTbody.innerHTML = ""; availableProducts = [];
        if (snapshot.exists()) {
            Object.entries(snapshot.val()).forEach(([key, p]) => {
                availableProducts.push({ key, ...p });
                prodTbody.innerHTML += `<tr class="border-b text-sm"><td class="p-4 font-bold text-blue-600">${p.code || ''}</td><td class="p-4">${p.name}</td><td class="p-4 text-right">${(p.cost || 0).toLocaleString()}đ</td><td class="p-4 text-center">${p.unit}</td><td class="p-4 text-center font-bold">${p.stock}</td><td class="p-4 text-center"><button class="text-red-600" onclick="remove(ref(db, 'products/${key}'))"><i class="fas fa-trash"></i></button></td></tr>`;
            });
        }
    });

    onValue(ref(db, 'vendors'), (snapshot) => {
        const nccTbody = document.getElementById('nccTableBody');
        if (!nccTbody) return;
        nccTbody.innerHTML = "";
        if (snapshot.exists()) {
            Object.entries(snapshot.val()).forEach(([key, v]) => {
                nccTbody.innerHTML += `<tr class="border-b hover:bg-gray-50 text-sm"><td class="p-4 font-bold">${v.code || ''}</td><td class="p-4"><b>${v.name}</b></td><td class="p-4">${v.phone || '-'}</td><td class="p-4 font-mono text-xs">${v.bank || '-'}</td><td class="p-4 text-center"><button onclick="remove(ref(db, 'vendors/${key}'))" class="text-red-500"><i class="fas fa-trash"></i></button></td></tr>`;
            });
        }
    });

    const parseDate = (dateStr) => {
        if (!dateStr) return 0;
        const parts = dateStr.split('/');
        if (parts.length === 3) return parseInt(parts[2] + parts[1] + parts[0]); 
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    // 3. LẮNG NGHE HÓA ĐƠN NHẬP
    onValue(ref(db, 'invoices'), (snapshot) => {
        const invTbody = document.getElementById('invoiceTableBody'); 
        if (!invTbody) return;
        invTbody.innerHTML = "";
        if (snapshot.exists()) {
            const data = snapshot.val(); 
            updateGeneralReport(data);
            const invoiceArray = Object.entries(data);
            invoiceArray.sort((a, b) => parseDate(b[1].NgayNhap) - parseDate(a[1].NgayNhap));
            invoiceArray.forEach(([key, d]) => {
                // SỬA LOGIC THANH TOÁN KHỚP FIREBASE
                let rawStatus = d.HinhThucThanhToan || "";
                let payLabel = "";
                let payColor = "";
                
                if (rawStatus === "Công Nợ" || rawStatus === "Chưa thanh toán") {
                    payLabel = "Chưa thanh toán"; payColor = "bg-red-100 text-red-700";
                } else if (rawStatus === "Tiền Mặt" || rawStatus === "Chuyển Khoản" || rawStatus === "Đã thanh toán") {
                    payLabel = "Đã thanh toán"; payColor = "bg-green-100 text-green-700";
                } else {
                    payLabel = rawStatus || "N/A"; payColor = "bg-gray-100 text-gray-700";
                }

                let driveLink = (d.LinkHoaDon && typeof d.LinkHoaDon === 'object') ? d.LinkHoaDon.Url : d.LinkHoaDon;
                const driveIcon = driveLink ? `<a href="${driveLink}" target="_blank" class="text-blue-500 ml-1"><i class="fab fa-google-drive"></i></a>` : "";
                
                invTbody.innerHTML += `<tr class="border-b text-sm hover:bg-gray-50"><td class="p-4 text-gray-600 align-top">${d.NgayNhap || ''}</td><td class="p-4 align-top"><div class="font-bold text-gray-800 flex items-center gap-1">${d.NhaCungCap || ''} ${driveIcon}</div><div class="text-[11px] text-blue-600 mt-1 font-medium bg-blue-50 px-1.5 py-0.5 rounded w-fit"><i class="fas fa-hashtag text-[9px]"></i> ${d.SoPhieuNhap || 'N/A'}</div></td><td class="p-4 text-xs text-gray-600 align-top"><div class="flex flex-col gap-1.5">${(d.ChiTiet || []).map((i, idx) => `<div class="flex items-start gap-2 border-l-2 border-gray-100 pl-2"><span class="text-gray-300 font-mono text-[10px] mt-0.5">${idx + 1}</span><div class="flex flex-col"><span class="font-medium">${i.MaSP}</span><span class="text-[10px] text-blue-500 font-bold text-left">SL: ${i.SoLuong}</span></div></div>`).join('')}</div></td><td class="p-4 font-mono font-bold text-red-600 text-right align-top">${(Number(d.ThanhTien) || 0).toLocaleString()}đ</td><td class="p-4 text-center align-top"><span class="px-2 py-1 rounded text-[10px] font-bold ${d.TinhTrangHoaDon === 'Đã Nhận HĐ' ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50'}">${d.TinhTrangHoaDon || 'Chưa nhận'}</span></td><td class="p-4 text-center align-top"><span class="${payColor} px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">${payLabel}</span></td><td class="p-4 text-center align-top"><button onclick="remove(ref(db, 'invoices/${key}'))" class="text-red-300 hover:text-red-600 transition"><i class="fas fa-trash"></i></button></td></tr>`;
            });
            if (typeof window.filterInvoices === 'function') window.filterInvoices();
        }
    });

    // --- LẮNG NGHE DỮ LIỆU BÁN HÀNG (FIXED LOGIC THANH TOÁN & LINK DRIVE) ---
    onValue(ref(db, 'sales'), (snapshot) => {
        const salesTbody = document.getElementById('salesTableBody');
        if (!salesTbody) return;
        salesTbody.innerHTML = "";
        if (snapshot.exists()) {
            const data = snapshot.val();
            const salesArray = Object.entries(data);
            salesArray.sort((a, b) => parseDate(b[1].NgayBan) - parseDate(a[1].NgayBan));
            
            salesArray.forEach(([key, d]) => {
                // SỬA LOGIC THANH TOÁN KHỚP FIREBASE
                let rawStatus = d.HinhThucThanhToan || "";
                let payLabel = "";
                let payColor = "";
                
                if (rawStatus === "Công Nợ" || rawStatus === "Chưa thanh toán") {
                    payLabel = "Chưa thanh toán"; payColor = "bg-red-100 text-red-700";
                } else {
                    payLabel = "Đã thanh toán"; payColor = "bg-green-100 text-green-700";
                }

                // XỬ LÝ LINK HOA DON DANG JSON {"Url":"","LinkText":""}
                let driveIcon = "";
                try {
                    let driveData = d.LinkHoaDon;
                    if (typeof driveData === 'string' && driveData.startsWith('{')) driveData = JSON.parse(driveData);
                    if (driveData && driveData.Url) {
                        driveIcon = `<a href="${driveData.Url}" target="_blank" class="text-blue-500 ml-1"><i class="fab fa-google-drive text-[10px]"></i></a>`;
                    } else if (typeof driveData === 'string' && driveData.startsWith('http')) {
                        driveIcon = `<a href="${driveData}" target="_blank" class="text-blue-500 ml-1"><i class="fab fa-google-drive text-[10px]"></i></a>`;
                    }
                } catch (e) { driveIcon = ""; }

                salesTbody.innerHTML += `
                    <tr class="border-b text-sm hover:bg-gray-50">
                        <td class="p-4 text-gray-600 align-top">${d.NgayBan || ''}</td>
                        <td class="p-4 align-top">
                            <div class="font-bold text-gray-800 flex items-center gap-1">${d.KhachHang || ''} ${driveIcon}</div>
                            <div class="text-[11px] text-green-600 mt-1 font-medium bg-green-50 px-1.5 py-0.5 rounded w-fit"><i class="fas fa-file-invoice text-[9px]"></i> ${d.SoHoaDon || 'N/A'}</div>
                        </td>
                        <td class="p-4 text-xs text-gray-600 align-top">
                            <div class="flex flex-col gap-1.5">
                                ${(d.ChiTiet || []).map((i, idx) => `<div class="flex items-start gap-2 border-l-2 border-gray-100 pl-2"><span class="text-gray-300 font-mono text-[10px] mt-0.5">${idx + 1}</span><div class="flex flex-col"><span class="font-medium">${i.MaSP}</span><span class="text-[10px] text-blue-500 font-bold">SL: ${i.SoLuong}</span></div></div>`).join('')}
                            </div>
                        </td>
                        <td class="p-4 font-mono font-bold text-blue-600 text-right align-top">${(Number(d.ThanhTien) || 0).toLocaleString()}đ</td>
                        <td class="p-4 text-center align-top">
                            <span class="px-2 py-1 rounded text-[10px] font-bold ${d.TinhTrangHoaDon === 'Đã nhận HĐ' ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50'}">${d.TinhTrangHoaDon || 'N/A'}</span>
                        </td>
                        <td class="p-4 text-center align-top">
                            <span class="${payColor} px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">${payLabel}</span>
                        </td>
                        <td class="p-4 text-center align-top">
                            <button onclick="remove(ref(db, 'sales/${key}'))" class="text-red-300 hover:text-red-600 transition"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`;
            });
            if (typeof window.filterSales === 'function') window.filterSales();
        }
    });

    onValue(ref(db, 'salaries'), (snapshot) => {
        const salaryTbody = document.getElementById('salaryTableBody');
        if (!salaryTbody) return;
        salaryTbody.innerHTML = "";
        if (snapshot.exists()) {
            Object.entries(snapshot.val()).reverse().forEach(([key, s]) => {
                const statusColor = s.status === "Đã thanh toán" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
                salaryTbody.innerHTML += `<tr class="border-b text-sm hover:bg-gray-50"><td class="p-4 font-medium">${s.month}/${s.year}</td><td class="p-4 font-bold text-gray-800">${s.staff}</td><td class="p-4 text-xs text-gray-500 max-w-[200px] truncate">${s.note || ''}</td><td class="p-4 text-right font-mono font-bold text-blue-600">${(s.amount || 0).toLocaleString()}đ</td><td class="p-4 text-center"><span class="${statusColor} px-2 py-1 rounded text-xs font-bold">${s.status}</span></td><td class="p-4 text-center"><button onclick="editSalary('${key}')" class="text-blue-600 mr-2"><i class="fas fa-edit"></i></button><button onclick="remove(ref(db, 'salaries/${key}'))" class="text-red-600"><i class="fas fa-trash"></i></button></td></tr>`;
            });
        }
    });
}

initApp();

// --- LOGIC LỌC TÌM KIẾM ĐA NĂNG (MUA HÀNG) ---
window.filterInvoices = () => {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filterDate = document.getElementById('filterDate').value; 
    const rows = document.querySelectorAll('#invoiceTableBody tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        const dateCell = row.querySelector('td:first-child').innerText; 
        let rowDateIso = "";
        if (dateCell.includes('/')) {
            const parts = dateCell.split('/');
            rowDateIso = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        const matchesSearch = text.includes(searchTerm);
        const matchesDate = !filterDate || rowDateIso === filterDate;
        row.style.display = (matchesSearch && matchesDate) ? "" : "none";
    });
};

window.resetFilter = () => {
    document.getElementById('searchInput').value = "";
    document.getElementById('filterDate').value = "";
    window.filterInvoices();
};

// --- LOGIC LỌC TÌM KIẾM ĐA NĂNG (BÁN HÀNG) ---
window.filterSales = () => {
    const searchTerm = document.getElementById('searchBanHang').value.toLowerCase();
    const filterDate = document.getElementById('filterDateSale').value;
    const rows = document.querySelectorAll('#salesTableBody tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        const dateCell = row.querySelector('td:first-child').innerText;
        let rowDateIso = "";
        if (dateCell.includes('/')) {
            const parts = dateCell.split('/');
            rowDateIso = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        const matchesSearch = text.includes(searchTerm);
        const matchesDate = !filterDate || rowDateIso === filterDate;
        row.style.display = (matchesSearch && matchesDate) ? "" : "none";
    });
};

window.resetFilterSale = () => {
    document.getElementById('searchBanHang').value = "";
    document.getElementById('filterDateSale').value = "";
    window.filterSales();
};
