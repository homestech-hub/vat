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

// --- BIẾN TOÀN CỤC CHO PHÂN TRANG ---
let currentPage = { muahang: 1, banhang: 1 };
const rowsPerPage = 15; 
let dataStore = { muahang: [], banhang: [] }; // Lưu trữ mảng dữ liệu đã sắp xếp

let availableProducts = [];
let originalInvoicesData = {};
window.originalSalesData = {}; 

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

// --- LOGIC PHÂN TRANG ĐỒNG BỘ SIÊU MƯỢT ---

window.renderPagination = (type, totalItems) => {
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    const container = document.getElementById(`pagination-${type}`);
    const info = document.getElementById(`total-info-${type}`);
    
    if (!container || !info) return;

    if (totalItems === 0) {
        container.innerHTML = "";
        info.innerText = "Trống";
        return;
    }

    let html = "";
    
    // Nút "Trước"
    html += `<button onclick="window.changePage('${type}', ${currentPage[type] - 1})" 
                ${currentPage[type] === 1 ? 'disabled' : ''} 
                class="page-node px-3 w-auto disabled:opacity-20 disabled:cursor-not-allowed hover:bg-slate-100 transition-all">
                <i class="fas fa-chevron-left text-[10px]"></i>
            </button>`;

    // Các nút số trang
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage[type] - 1 && i <= currentPage[type] + 1)) {
            html += `<button onclick="window.changePage('${type}', ${i})" 
                        class="page-node ${currentPage[type] === i ? 'active shadow-sm border-blue-400' : 'hover:bg-slate-100'} transition-all">
                        ${i}
                    </button>`;
        } else if (i === currentPage[type] - 2 || i === currentPage[type] + 2) {
            html += `<span class="px-1 text-slate-300">...</span>`;
        }
    }

    // Nút "Sau"
    html += `<button onclick="window.changePage('${type}', ${currentPage[type] + 1})" 
                ${currentPage[type] >= totalPages ? 'disabled' : ''} 
                class="page-node px-3 w-auto disabled:opacity-20 disabled:cursor-not-allowed hover:bg-slate-100 transition-all">
                <i class="fas fa-chevron-right text-[10px]"></i>
            </button>`;

    container.innerHTML = html;
    
    // Cập nhật thông tin dòng hiển thị
    const start = (currentPage[type] - 1) * rowsPerPage + 1;
    const end = Math.min(currentPage[type] * rowsPerPage, totalItems);
    info.innerHTML = `Hiển thị <span class="font-black text-sky-600">${start}-${end}</span> / <span class="font-black">${totalItems}</span> đơn`;
};

// Hàm chuyển trang dùng chung nhưng xử lý riêng biệt
window.changePage = (type, page) => {
    if (!dataStore[type]) return;
    const totalPages = Math.ceil(dataStore[type].length / rowsPerPage);
    if (page < 1 || page > totalPages) return;

    currentPage[type] = page;

    if (type === 'muahang') {
        window.renderInvoiceTable();
    } else if (type === 'banhang') {
        window.renderSalesTable();
    }

    // Cuộn mượt về đầu bảng để tạo cảm giác App chuyên nghiệp
    const sectionId = type === 'muahang' ? 'section-muahang' : 'section-banhang';
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    } catch (error) { console.error(error); alert("Có lỗi xảy ra!"); }
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

// --- QUẢN LÝ NHÀ CUNG CẤP ---
window.saveNCC = async () => {
    const key = document.getElementById('edit_ncc_key')?.value;
    const name = document.getElementById('ncc_name').value.trim();
    if (!name) return alert("Vui lòng nhập tên!");
    const data = { name, phone: document.getElementById('ncc_phone').value, bank: document.getElementById('ncc_bank').value };
    if (key) await update(ref(db, `vendors/${key}`), data);
    else {
        const snap = await get(ref(db, 'vendors'));
        let nextCode = "NCC001";
        if (snap.exists()) {
            const codes = Object.values(snap.val()).map(v => parseInt(v.code?.replace("NCC", "") || 0));
            nextCode = "NCC" + (Math.max(...codes) + 1).toString().padStart(3, '0');
        }
        data.code = nextCode; data.createdAt = Date.now();
        await push(ref(db, 'vendors'), data);
    }
    alert("Thành công!"); window.toggleModal('modal-ncc');
};

// --- QUẢN LÝ SẢN PHẨM ---
window.saveProduct = async () => {
    const name = document.getElementById('p_name').value;
    if (!name) return alert("Nhập tên SP!");
    const snap = await get(ref(db, 'products'));
    let nextCode = "SP001";
    if (snap.exists()) {
        const codes = Object.values(snap.val()).map(p => parseInt(p.code?.replace("SP", "") || 0));
        nextCode = "SP" + (Math.max(...codes) + 1).toString().padStart(3, '0');
    }
    await push(ref(db, 'products'), {
        code: nextCode, name, cost: parseInt(document.getElementById('p_cost').value) || 0,
        unit: document.getElementById('p_unit').value, stock: 0
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

window.applyReportFilter = async () => {
    if (!window.originalSalesData || Object.keys(window.originalSalesData).length === 0) {
        const salesSnapshot = await get(ref(db, 'sales'));
        if (salesSnapshot.exists()) window.originalSalesData = salesSnapshot.val();
    }
    const invoices = originalInvoicesData || {};
    const sales = window.originalSalesData || {};
    const fromDate = document.getElementById('reportFromDate')?.value;
    const toDate = document.getElementById('reportToDate')?.value;
    const selectedVendor = document.getElementById('reportVendorFilter')?.value;
    const searchQuery = document.getElementById('reportCustomerSearch')?.value?.toLowerCase()?.trim() || "";

    let totalChi = 0, totalDon = 0, totalNo = 0;
    let vendorSummary = {};
    let ddRevenue = 0, ddDebt = 0, ddUnpaidCount = 0;
    let ddRowsHtml = "";

    const toIso = (str) => {
        if (!str || !str.includes('/')) return str;
        const p = str.split('/'); return `${p[2]}-${p[1]}-${p[0]}`;
    };

    Object.values(invoices).forEach(d => {
        const dateIso = toIso(d.NgayNhap);
        if ((!fromDate || dateIso >= fromDate) && (!toDate || dateIso <= toDate) && (!selectedVendor || d.NhaCungCap === selectedVendor)) {
            const amount = parseInt(d.ThanhTien) || 0;
            totalChi += amount; totalDon++;
            if (d.HinhThucThanhToan === "Công Nợ" || d.HinhThucThanhToan === "Chưa thanh toán") totalNo += amount;
            const vName = d.NhaCungCap || "Chưa rõ";
            if (!vendorSummary[vName]) vendorSummary[vName] = { qty: 0, sum: 0, bad: false };
            vendorSummary[vName].qty++; vendorSummary[vName].sum += amount;
            if (d.TinhTrangHoaDon === "Chưa Nhận HĐ") vendorSummary[vName].bad = true;
        }
    });

    Object.values(sales).forEach(s => {
        const khachHang = s.KhachHang || "";
        const chiNhanh = s.ChiNhanh || "";
        const dateIso = toIso(s.NgayBan);
        const displayKH = (khachHang.trim().toUpperCase() === "ĐÔI DÉP" && chiNhanh) ? chiNhanh : khachHang;
        const matchSearch = !searchQuery || displayKH.toLowerCase().includes(searchQuery);

        if (khachHang.toLowerCase().includes("đôi dép") && (!fromDate || dateIso >= fromDate) && (!toDate || dateIso <= toDate) && matchSearch) {
            const amount = parseInt(s.ThanhTien) || 0;
            ddRevenue += amount;
            const isNo = (s.HinhThucThanhToan === "Công Nợ" || s.HinhThucThanhToan === "Chưa thanh toán");
            if (isNo) { ddDebt += amount; ddUnpaidCount++; }
            ddRowsHtml += `<tr class="border-b text-sm"><td class="p-4">${s.NgayBan || ''}</td><td class="p-4"><div class="font-bold">${displayKH}</div></td><td class="p-4 text-right font-bold text-blue-600">${amount.toLocaleString()}đ</td><td class="p-4 text-center"><span class="px-2 py-1 rounded text-[10px] font-bold ${isNo ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}">${s.HinhThucThanhToan}</span></td></tr>`;
        }
    });

    const setInner = (id, val) => { if (document.getElementById(id)) document.getElementById(id).innerText = val; };
    setInner('report-total-amount', totalChi.toLocaleString('vi-VN') + "đ");
    setInner('report-total-invoices', totalDon);
    setInner('report-unpaid-amount', totalNo.toLocaleString('vi-VN') + "đ");
    setInner('dd-total-revenue', ddRevenue.toLocaleString('vi-VN') + "đ");
    setInner('dd-total-debt', ddDebt.toLocaleString('vi-VN') + "đ");
    setInner('dd-unpaid-count', `${ddUnpaidCount} đơn chưa thanh toán`);
    if (document.getElementById('report-vendor-body')) document.getElementById('report-vendor-body').innerHTML = Object.entries(vendorSummary).map(([name, stat]) => `<tr class="border-b text-sm"><td class="p-4 font-bold">${name}</td><td class="p-4 text-center">${stat.qty}</td><td class="p-4 text-right font-bold text-blue-600">${stat.sum.toLocaleString()}đ</td><td class="p-4 text-center">${stat.bad ? '⚠️ Thiếu HĐ' : '✅ Đủ'}</td></tr>`).join('');
    if (document.getElementById('dd-detail-body')) document.getElementById('dd-detail-body').innerHTML = ddRowsHtml || '<tr><td colspan="4" class="p-4 text-center text-gray-400 italic">Không có dữ liệu phù hợp</td></tr>';
};

// --- HÀM RENDER BẢNG CHÍNH ---
window.renderInvoiceTable = () => {
    const invTbody = document.getElementById('invoiceTableBody');
    if (!invTbody) return;
    const start = (currentPage.muahang - 1) * rowsPerPage;
    const paginated = dataStore.muahang.slice(start, start + rowsPerPage);

    invTbody.innerHTML = paginated.map(([key, d]) => {
        const rawStatus = d.HinhThucThanhToan || "";
        const isPaid = (rawStatus !== "Chưa thanh toán" && rawStatus !== "Công Nợ");
        const payLabel = isPaid ? "Đã thanh toán" : "Chưa thanh toán";
        const badgeClass = isPaid ? 'badge-paid' : 'badge-unpaid';
        const dotClass = isPaid ? 'dot-success' : 'dot-danger';
        
        let driveLink = (d.LinkHoaDon && typeof d.LinkHoaDon === 'object') ? d.LinkHoaDon.Url : d.LinkHoaDon;
        const driveIcon = driveLink ? `<a href="${driveLink}" target="_blank" class="text-green-500 hover:text-green-700 transition"><i class="fab fa-google-drive"></i></a>` : "";
        
        return `
        <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="p-4 text-slate-500 font-medium align-top">${d.NgayNhap || ''}</td>
            <td class="p-4 align-top">
                <div class="font-bold text-slate-800 flex items-center gap-2">${d.NhaCungCap || ''} ${driveIcon}</div>
                <div class="text-[10px] text-blue-600 mt-1 font-bold bg-blue-50 px-2 py-0.5 rounded-md w-fit border border-blue-100">
                    ID: ${d.SoPhieuNhap || 'N/A'}
                </div>
            </td>
            <td class="p-4 align-top">
                <div class="flex flex-col gap-2">
                    ${(d.ChiTiet || []).map((i, idx) => {
                        const gia = Number(i.GiaNhap || 0);
                        return `
                        <div class="text-[12px] text-slate-600 border-l-2 border-slate-200 pl-3 py-0.5">
                            <div class="font-semibold text-slate-800">${i.MaSP}</div>
                            <div class="flex gap-3 text-[10px] mt-0.5 font-bold">
                                <span class="text-blue-600">x${i.SoLuong}</span>
                                <span class="text-slate-400 italic">Giá: ${gia.toLocaleString()}đ</span>
                                <span class="text-slate-500">T.Tiền: ${(gia * i.SoLuong).toLocaleString()}đ</span>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </td>
            <td class="p-4 text-right align-top amount-highlight">
                ${(Number(d.ThanhTien) || 0).toLocaleString()}đ
            </td>
            <td class="p-4 text-center align-top">
                <span class="px-2 py-1 rounded-lg text-[10px] font-bold border ${d.TinhTrangHoaDon === 'Đã Nhận HĐ' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-slate-400 bg-slate-50 border-slate-200'}">
                    ${d.TinhTrangHoaDon || 'Chưa nhận'}
                </span>
            </td>
            <td class="p-4 text-center align-top">
                <button onclick="toggleInvoicePayment('${key}', '${rawStatus}')" class="status-badge ${badgeClass} transition-transform active:scale-95">
                    <span class="dot ${dotClass}"></span>
                    ${payLabel}
                </button>
            </td>
            <td class="p-4 text-center align-top">
                <button onclick="deleteInvoice('${key}')" class="w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                    <i class="fas fa-trash-alt text-sm"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
    renderPagination('muahang', dataStore.muahang.length);
};

window.renderSalesTable = () => {
    const salesTbody = document.getElementById('salesTableBody');
    if (!salesTbody) return;

    const start = (currentPage.banhang - 1) * rowsPerPage;
    const paginated = dataStore.banhang.slice(start, start + rowsPerPage);

    if (paginated.length === 0) {
        salesTbody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-slate-400 font-bold uppercase text-[10px]">Trống dữ liệu</td></tr>`;
        window.renderPagination('banhang', dataStore.banhang.length);
        return;
    }

    salesTbody.innerHTML = paginated.map(([key, d]) => {
        const rawStatus = d.HinhThucThanhToan || "";
        const isPaid = !(rawStatus === "Công Nợ" || rawStatus === "Chưa thanh toán");
        const payLabel = isPaid ? "Đã thanh toán" : "Chưa thanh toán";
        const badgeClass = isPaid ? 'badge-paid' : 'badge-unpaid';
        const dotClass = isPaid ? 'dot-success' : 'dot-danger';
        
        // --- XỬ LÝ AN TOÀN KÝ TỰ ĐẶC BIỆT (FIX LỖI LIỆT TRANG) ---
        // Thay thế dấu nháy đơn ' thành \' để không làm gãy HTML onclick
        const safeKH = (d.KhachHang || "").replace(/'/g, "\\'");
        const safeCN = (d.ChiNhanh || "").replace(/'/g, "\\'");
        const safeVAT = (d.SoHDVAT || "Chưa có").replace(/'/g, "\\'");
        
        const kh = d.KhachHang || '', cn = d.ChiNhanh || '', shd = d.SoHoaDon || 'N/A';
        const isStrictDoiDep = kh.trim().toUpperCase() === "ĐÔI DÉP";
        const disp = (isStrictDoiDep && cn) ? cn : kh;

        // Xử lý Google Drive Link
        let driveIcon = "";
        try {
            let dd = d.LinkHoaDon;
            if (typeof dd === 'string' && dd.startsWith('{')) dd = JSON.parse(dd);
            const url = (dd && typeof dd === 'object') ? dd.Url : dd;
            if (url) driveIcon = `<a href="${url}" target="_blank" class="text-blue-500 hover:text-blue-700 transition"><i class="fab fa-google-drive"></i></a>`;
        } catch (e) { driveIcon = ""; }

        return `
        <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="p-4 text-slate-500 font-medium align-top">${d.NgayBan || d.Ngayban || '---'}</td>
            <td class="p-4 align-top">
                <div class="font-bold text-slate-800 flex items-center gap-2">${disp} ${driveIcon}</div>
                <div class="flex flex-col gap-1 mt-2">
                    ${isStrictDoiDep && cn ? `<div class="text-[10px] text-slate-400 italic font-medium">Hệ thống: ${kh}</div>` : ''}
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono">Đơn: ${shd}</span>
                        ${kh.toLowerCase().includes("đôi dép") ? `
                            <div class="flex items-center gap-1.5">
                                <span class="text-[10px] text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">VAT: ${d.SoHDVAT || 'Chưa có'}</span>
                                <button onclick="window.updateVatInvoice('${key}', '${safeVAT}')" class="text-[10px] text-blue-600 hover:underline font-bold">Sửa</button>
                            </div>` : ''}
                    </div>
                </div>
            </td>
            <td class="p-4 align-top">
                <div class="flex flex-col gap-1.5">
                    ${(Array.isArray(d.ChiTiet) ? d.ChiTiet : []).map(i => `
                        <div class="text-[12px] text-slate-600 border-l-2 border-slate-200 pl-2 py-0.5">
                            <span class="font-medium text-slate-800">${i.MaSP}</span>
                            <div class="flex gap-2 text-[10px] font-bold">
                                <span class="text-blue-600">x${i.SoLuong}</span>
                                <span class="text-slate-400 italic">${(Number(i.DonGia || i.GiaNhap) || 0).toLocaleString()}đ</span>
                            </div>
                        </div>`).join('')}
                </div>
            </td>
            <td class="p-4 text-right align-top amount-highlight text-blue-600">
                ${(Number(d.ThanhTien) || 0).toLocaleString()}đ
            </td>
            <td class="p-4 text-center align-top">
                <span class="status-badge ${(d.TinhTrangHoaDon || '').includes('Đã') ? 'badge-paid' : 'badge-unpaid'} shadow-sm">
                    <i class="fas ${(d.TinhTrangHoaDon || '').includes('Đã') ? 'fa-check-double' : 'fa-history'} mr-1.5"></i>
                    ${d.TinhTrangHoaDon || 'Chưa xuất HĐ'}
                </span>
            </td>
            <td class="p-4 text-center align-top">
                <button onclick="window.toggleSalePayment('${key}', '${rawStatus}')" class="status-badge ${badgeClass} transition-transform active:scale-95">
                    <span class="dot ${dotClass}"></span>
                    ${payLabel}
                </button>
            </td>
            <td class="p-4 text-center align-top">
                <button onclick="window.deleteSale('${key}')" class="w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                    <i class="fas fa-trash-alt text-sm"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
    
    // Gọi hàm phân trang đồng bộ
    window.renderPagination('banhang', dataStore.banhang.length);
};

// --- KHỞI TẠO ỨNG DỤNG ---
function initApp() {
    const parseDateLocal = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return 0;
        if (dateStr.includes('/')) {
            const p = dateStr.split('/');
            return parseInt(p[2] + p[1].padStart(2, '0') + p[0].padStart(2, '0'));
        }
        return new Date(dateStr).getTime() || 0;
    };

    onValue(ref(db, 'invoices'), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            updateGeneralReport(data);
            dataStore.muahang = Object.entries(data).sort((a, b) => parseDateLocal(b[1].NgayNhap) - parseDateLocal(a[1].NgayNhap));
            renderInvoiceTable();
        }
    });

    onValue(ref(db, 'sales'), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            window.originalSalesData = data; 
            dataStore.banhang = Object.entries(data).sort((a, b) => {
                const dateA = a[1].NgayBan || a[1].Ngayban || "";
                const dateB = b[1].NgayBan || b[1].Ngayban || "";
                return parseDateLocal(dateB) - parseDateLocal(dateA);
            });
            renderSalesTable();
            applyReportFilter();
        }
    });

    onValue(ref(db, 'products'), (snapshot) => {
        const prodTbody = document.getElementById('productTableBody');
        if (!prodTbody) return;
        prodTbody.innerHTML = "";
        if (snapshot.exists()) {
            Object.entries(snapshot.val()).forEach(([key, p]) => {
                prodTbody.innerHTML += `<tr class="border-b text-sm"><td class="p-4 font-bold text-blue-600">${p.code || ''}</td><td class="p-4">${p.name}</td><td class="p-4 text-right">${(p.cost || 0).toLocaleString()}đ</td><td class="p-4 text-center">${p.unit}</td><td class="p-4 text-center font-bold">${p.stock}</td><td class="p-4 text-center"><button class="text-red-600" onclick="deleteProduct('${key}')"><i class="fas fa-trash"></i></button></td></tr>`;
            });
        }
    });

    onValue(ref(db, 'vendors'), (snapshot) => {
        const nccTbody = document.getElementById('nccTableBody');
        if (nccTbody && snapshot.exists()) {
            nccTbody.innerHTML = Object.entries(snapshot.val()).map(([key, v]) => `<tr class="border-b hover:bg-gray-50 text-sm"><td class="p-4 font-bold">${v.code || ''}</td><td class="p-4"><b>${v.name}</b></td><td class="p-4">${v.phone || '-'}</td><td class="p-4 font-mono text-xs">${v.bank || '-'}</td><td class="p-4 text-center"><button onclick="remove(ref(db, 'vendors/${key}'))" class="text-red-500"><i class="fas fa-trash"></i></button></td></tr>`).join('');
        }
    });

    onValue(ref(db, 'salaries'), (snapshot) => {
        const salaryTbody = document.getElementById('salaryTableBody');
        if (salaryTbody && snapshot.exists()) {
            salaryTbody.innerHTML = Object.entries(snapshot.val()).reverse().map(([key, s]) => {
                const statusColor = s.status === "Đã thanh toán" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
                return `<tr class="border-b text-sm hover:bg-gray-50"><td class="p-4 font-medium">${s.month}/${s.year}</td><td class="p-4 font-bold text-gray-800">${s.staff}</td><td class="p-4 text-xs text-gray-500 max-w-[200px] truncate">${s.note || ''}</td><td class="p-4 text-right font-mono font-bold text-blue-600">${(s.amount || 0).toLocaleString()}đ</td><td class="p-4 text-center"><span class="${statusColor} px-2 py-1 rounded text-xs font-bold">${s.status}</span></td><td class="p-4 text-center"><button onclick="editSalary('${key}')" class="text-blue-600 mr-2"><i class="fas fa-edit"></i></button><button onclick="deleteSalary('${key}')" class="text-red-600"><i class="fas fa-trash"></i></button></td></tr>`;
            }).join('');
        }
    });
}

initApp();

// --- ĐĂNG KÝ HÀM TOÀN CỤC ---
window.deleteInvoice = (key) => { if (confirm("Xóa đơn mua hàng này?")) remove(ref(db, `invoices/${key}`)); };
window.deleteSale = (key) => { if (confirm("Xóa đơn bán hàng này?")) remove(ref(db, `sales/${key}`)); };
window.deleteSalary = (key) => { if (confirm("Xóa phiếu lương này?")) remove(ref(db, `salaries/${key}`)); };
window.deleteProduct = (key) => { if (confirm("Xóa sản phẩm này?")) remove(ref(db, `products/${key}`)); };

window.toggleInvoicePayment = (key, cur) => {
    const next = (cur === "Chưa thanh toán" || cur === "Công Nợ") ? "Đã thanh toán" : "Chưa thanh toán";
    if (confirm(`Chuyển trạng thái sang: ${next.toUpperCase()}?`)) update(ref(db, `invoices/${key}`), { HinhThucThanhToan: next });
};

window.toggleSalePayment = (key, cur) => {
    const next = (cur === "Chưa thanh toán" || cur === "Công Nợ") ? "Đã thanh toán" : "Chưa thanh toán";
    if (confirm(`Chuyển trạng thái sang: ${next.toUpperCase()}?`)) update(ref(db, `sales/${key}`), { HinhThucThanhToan: next });
};

window.updateVatInvoice = (key, currentVat) => {
    const newVat = prompt("Nhập Số Hóa Đơn VAT:", currentVat === 'Chưa có' ? "" : currentVat);
    if (newVat !== null) update(ref(db, `sales/${key}`), { SoHDVAT: newVat }).then(() => alert("Thành công!"));
};

// --- LOGIC LỌC TÌM KIẾM (Cập nhật để hoạt động với phân trang) ---
window.filterInvoices = () => {
    const q = document.getElementById('searchInput').value.toLowerCase();
    const fromDate = document.getElementById('filterFromDate').value; // Định dạng YYYY-MM-DD
    const toDate = document.getElementById('filterToDate').value;     // Định dạng YYYY-MM-DD

    get(ref(db, 'invoices')).then(snap => {
        if (snap.exists()) {
            const all = Object.entries(snap.val());
            
            dataStore.muahang = all.filter(([k, val]) => {
                // 1. Lọc theo văn bản (Tìm kiếm nhanh)
                const txt = JSON.stringify(val).toLowerCase();
                const matchText = txt.includes(q);

                // 2. Lọc theo khoảng ngày
                const dc = val.NgayNhap || "";
                let isoDate = "";
                if (dc.includes('/')) {
                    const p = dc.split('/');
                    // Chuyển DD/MM/YYYY thành YYYY-MM-DD để so sánh chuẩn
                    isoDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                }

                const matchFrom = !fromDate || isoDate >= fromDate;
                const matchTo = !toDate || isoDate <= toDate;

                return matchText && matchFrom && matchTo;
            }).sort((a, b) => {
                const parse = (s) => {
                    if (!s || !s.includes('/')) return 0;
                    const p = s.split('/');
                    return parseInt(p[2] + p[1].padStart(2, '0') + p[0].padStart(2, '0'));
                };
                return parse(b[1].NgayNhap) - parse(a[1].NgayNhap);
            });

            currentPage.muahang = 1;
            renderInvoiceTable();
        }
    });
};

// Đừng quên cập nhật hàm Reset để xóa cả 2 ô ngày
window.resetFilter = () => {
    document.getElementById('searchInput').value = "";
    document.getElementById('filterFromDate').value = "";
    document.getElementById('filterToDate').value = "";
    filterInvoices();
};

window.filterSales = () => {
    const q = document.getElementById('searchBanHang').value.toLowerCase();
    const fromDate = document.getElementById('filterFromDateSale').value; // YYYY-MM-DD
    const toDate = document.getElementById('filterToDateSale').value;     // YYYY-MM-DD

    get(ref(db, 'sales')).then(snap => {
        if (snap.exists()) {
            const all = Object.entries(snap.val());
            
            dataStore.banhang = all.filter(([k, val]) => {
                // 1. Lọc theo văn bản (Tìm kiếm nhanh)
                const txt = JSON.stringify(val).toLowerCase();
                const matchText = txt.includes(q);

                // 2. Xử lý ngày tháng linh hoạt (NgayBan hoặc Ngayban)
                const dateRaw = val.NgayBan || val.Ngayban || "";
                let isoDate = "";
                
                if (dateRaw.includes('/')) {
                    const p = dateRaw.split('/');
                    // Chuyển DD/MM/YYYY thành YYYY-MM-DD để so sánh chuẩn
                    isoDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                }

                // 3. Logic so sánh khoảng ngày
                const matchFrom = !fromDate || isoDate >= fromDate;
                const matchTo = !toDate || isoDate <= toDate;

                return matchText && matchFrom && matchTo;
            }).sort((a, b) => {
                const parse = (s) => {
                    if (!s || !s.includes('/')) return 0;
                    const p = s.split('/');
                    return parseInt(p[2] + p[1].padStart(2, '0') + p[0].padStart(2, '0'));
                };
                const dateA = a[1].NgayBan || a[1].Ngayban || "";
                const dateB = b[1].NgayBan || b[1].Ngayban || "";
                return parse(dateB) - parse(dateA);
            });

            currentPage.banhang = 1;
            renderSalesTable();
        }
    });
};

// Hàm Reset cho phần Bán hàng
window.resetFilterSale = () => {
    document.getElementById('searchBanHang').value = "";
    document.getElementById('filterFromDateSale').value = "";
    document.getElementById('filterToDateSale').value = "";
    filterSales();
};
