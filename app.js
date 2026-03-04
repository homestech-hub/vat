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

// --- QUẢN LÝ NHÀ CUNG CẤP (NCC) ---
async function generateNCCCode() {
    const snapshot = await get(ref(db, 'vendors'));
    if (!snapshot.exists()) return "NCC001";
    const codes = Object.values(snapshot.val()).map(v => parseInt(v.code?.replace("NCC", "") || 0));
    return "NCC" + (Math.max(...codes) + 1).toString().padStart(3, '0');
}

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
        data.code = await generateNCCCode();
        data.createdAt = Date.now();
        await push(ref(db, 'vendors'), data);
    }
    
    alert("Thành công!");
    if(document.getElementById('edit_ncc_key')) document.getElementById('edit_ncc_key').value = '';
    window.toggleModal('modal-ncc');
};

window.editNCC = (key, name, phone, bank, address) => {
    const keyInput = document.getElementById('edit_ncc_key');
    if (keyInput) keyInput.value = key;
    document.getElementById('ncc_name').value = name;
    document.getElementById('ncc_phone').value = phone;
    document.getElementById('ncc_bank').value = bank;
    document.getElementById('ncc_address').value = address;
    window.toggleModal('modal-ncc');
};

window.deleteNCC = async (key, name) => {
    if (confirm(`Xóa nhà cung cấp ${name}?`)) await remove(ref(db, `vendors/${key}`));
};

// --- QUẢN LÝ SẢN PHẨM ---
async function generateProductCode() {
    const snapshot = await get(ref(db, 'products'));
    if (!snapshot.exists()) return "SP001";
    const codes = Object.values(snapshot.val()).map(p => parseInt(p.code?.replace("SP", "") || 0));
    return "SP" + (Math.max(...codes) + 1).toString().padStart(3, '0');
}

window.saveProduct = async () => {
    const name = document.getElementById('p_name').value;
    if (!name) return alert("Nhập tên SP!");
    const code = await generateProductCode();
    await push(ref(db, 'products'), {
        code, name,
        cost: parseInt(document.getElementById('p_cost').value) || 0,
        unit: document.getElementById('p_unit').value,
        stock: parseInt(document.getElementById('p_stock').value) || 0
    });
    window.toggleModal('modal-sanpham');
};

// --- QUẢN LÝ MUA HÀNG ---
window.openInvoiceModal = () => {
    const editKeyInput = document.getElementById('edit_invoice_key');
    if (editKeyInput) editKeyInput.value = ''; 

    const vendorSelect = document.getElementById('vendor');
    if (vendorSelect) vendorSelect.selectedIndex = 0;
    
    const linkInput = document.getElementById('invoiceLink');
    if (linkInput) linkInput.value = '';

    const today = new Date().toISOString().split('T')[0];
    const orderDateInput = document.getElementById('orderDate');
    if (orderDateInput) orderDateInput.value = today;

    const itemsTable = document.getElementById('invoiceItems');
    if (itemsTable) itemsTable.innerHTML = '';

    document.getElementById('subTotalDisplay').innerText = '0';
    document.getElementById('taxTotalDisplay').innerText = '0';
    document.getElementById('totalAmountDisplay').innerText = '0';

    document.getElementById('invoiceStatus').value = 'Chưa nhận HĐ';
    document.getElementById('paymentStatus').value = 'Chưa thanh toán';

    window.toggleModal('modal-muahang');
};

window.addRow = () => {
    const tbody = document.getElementById('invoiceItems');
    if (availableProducts.length === 0) return alert("Hãy thêm sản phẩm ở tab Sản phẩm trước!");

    const rowId = Date.now();
    const options = availableProducts.map(p => `<option value="${p.code}" data-cost="${p.cost}">${p.code} - ${p.name}</option>`).join('');
    
    const row = document.createElement('tr');
    row.id = `row-${rowId}`;
    row.innerHTML = `
        <td class="p-1 border"><select onchange="updateRowPrice(this, ${rowId})" class="w-full p-1 border-none">${options}</select></td>
        <td class="p-1 border"><input type="number" value="1" oninput="calculateRow(${rowId})" class="w-full text-center qty"></td>
        <td class="p-1 border"><input type="text" oninput="handleMoneyInput(this); calculateRow(${rowId})" class="w-full text-right cost"></td>
        <td class="p-1 border"><select onchange="calculateRow(${rowId})" class="w-full text-center tax"><option value="0">0%</option><option value="8">8%</option><option value="10">10%</option></select></td>
        <td class="p-1 border text-right font-bold total-row">0</td>
        <td class="p-1 border text-center text-red-500 cursor-pointer" onclick="this.closest('tr').remove(); calculateTotalInvoice()">✕</td>
    `;
    tbody.appendChild(row);
};

window.updateRowPrice = (select, rowId) => {
    const opt = select.options[select.selectedIndex];
    const row = document.getElementById(`row-${rowId}`);
    row.querySelector('.cost').value = parseInt(opt.dataset.cost || 0).toLocaleString('vi-VN');
    window.calculateRow(rowId);
};

window.calculateRow = (rowId) => {
    const row = document.getElementById(`row-${rowId}`);
    const qty = parseFloat(row.querySelector('.qty').value) || 0;
    const cost = parseInt(row.querySelector('.cost').value.replace(/\./g, "")) || 0;
    const tax = parseInt(row.querySelector('.tax').value) || 0;
    
    const amount = qty * cost;
    const taxAmount = amount * (tax / 100);
    row.dataset.amount = amount;
    row.dataset.tax = taxAmount;
    row.querySelector('.total-row').innerText = (amount + taxAmount).toLocaleString('vi-VN');
    calculateTotalInvoice();
};

function calculateTotalInvoice() {
    let sub = 0, tax = 0;
    document.querySelectorAll('#invoiceItems tr').forEach(r => {
        sub += parseFloat(r.dataset.amount || 0);
        tax += parseFloat(r.dataset.tax || 0);
    });
    document.getElementById('subTotalDisplay').innerText = sub.toLocaleString('vi-VN');
    document.getElementById('taxTotalDisplay').innerText = tax.toLocaleString('vi-VN');
    document.getElementById('totalAmountDisplay').innerText = (sub + tax).toLocaleString('vi-VN');
}

window.saveInvoice = async () => {
    const key = document.getElementById('edit_invoice_key').value;
    const vendor = document.getElementById('vendor').value;
    const invoiceLink = document.getElementById('invoiceLink').value;
    
    if(!vendor) return alert("Vui lòng chọn Nhà cung cấp!");

    const items = [];
    document.querySelectorAll('#invoiceItems tr').forEach(row => {
        const select = row.querySelector('select');
        const qty = parseFloat(row.querySelector('.qty').value) || 0;
        const cost = parseInt(row.querySelector('.cost').value.replace(/\./g, "")) || 0;
        const tax = parseInt(row.querySelector('.tax').value) || 0;
        const total = parseInt(row.querySelector('.total-row').innerText.replace(/\./g, "")) || 0;

        if (select && select.value) {
            items.push({
                productCode: select.value,
                productName: select.options[select.selectedIndex].text.split(' - ')[1],
                qty, cost, tax, total
            });
        }
    });

    if (items.length === 0) return alert("Vui lòng thêm ít nhất một sản phẩm!");
    
    const amount = parseInt(document.getElementById('totalAmountDisplay').innerText.replace(/\./g, "")) || 0;
    
    const data = {
        vendor,
        orderDate: document.getElementById('orderDate').value,
        amount,
        paymentStatus: document.getElementById('paymentStatus').value,
        invoiceStatus: document.getElementById('invoiceStatus').value,
        invoiceLink: invoiceLink,
        items: items,
        updatedAt: Date.now()
    };

    if (key) {
        await update(ref(db, `invoices/${key}`), data);
        alert("Đã cập nhật đơn hàng thành công!");
    } else {
        data.createdAt = Date.now();
        await push(ref(db, 'invoices'), data);
        alert("Đã lưu đơn hàng mới thành công!");
    }
    
    window.toggleModal('modal-muahang');
};

window.editInvoice = async (key) => {
    const snapshot = await get(ref(db, `invoices/${key}`));
    if (snapshot.exists()) {
        const d = snapshot.val();
        document.getElementById('edit_invoice_key').value = key;
        document.getElementById('vendor').value = d.vendor || '';
        document.getElementById('orderDate').value = d.orderDate || '';
        document.getElementById('invoiceStatus').value = d.invoiceStatus || 'Chưa nhận HĐ';
        document.getElementById('paymentStatus').value = d.paymentStatus || 'Chưa thanh toán';
        document.getElementById('invoiceLink').value = d.invoiceLink || '';
        
        const tbody = document.getElementById('invoiceItems');
        tbody.innerHTML = "";

        if (d.items && Array.isArray(d.items)) {
            d.items.forEach(item => {
                const rowId = Date.now() + Math.random();
                const options = availableProducts.map(p => 
                    `<option value="${p.code}" data-cost="${p.cost}" ${p.code === item.productCode ? 'selected' : ''}>${p.code} - ${p.name}</option>`
                ).join('');

                const row = document.createElement('tr');
                row.id = `row-${rowId}`;
                row.innerHTML = `
                    <td class="p-1 border"><select onchange="updateRowPrice(this, ${rowId})" class="w-full p-1 border-none">${options}</select></td>
                    <td class="p-1 border"><input type="number" value="${item.qty}" oninput="calculateRow(${rowId})" class="w-full text-center qty"></td>
                    <td class="p-1 border"><input type="text" value="${item.cost.toLocaleString('vi-VN')}" oninput="handleMoneyInput(this); calculateRow(${rowId})" class="w-full text-right cost"></td>
                    <td class="p-1 border">
                        <select onchange="calculateRow(${rowId})" class="w-full text-center tax">
                            <option value="0" ${item.tax === 0 ? 'selected' : ''}>0%</option>
                            <option value="8" ${item.tax === 8 ? 'selected' : ''}>8%</option>
                            <option value="10" ${item.tax === 10 ? 'selected' : ''}>10%</option>
                        </select>
                    </td>
                    <td class="p-1 border text-right font-bold total-row">${item.total.toLocaleString('vi-VN')}</td>
                    <td class="p-1 border text-center text-red-500 cursor-pointer" onclick="this.closest('tr').remove(); calculateTotalInvoice()">✕</td>
                `;
                tbody.appendChild(row);
                row.dataset.amount = item.qty * item.cost;
                row.dataset.tax = (item.qty * item.cost) * (item.tax / 100);
            });
        }
        
        calculateTotalInvoice();
        window.toggleModal('modal-muahang');
    }
};

window.deleteInvoice = async (key) => {
    if (confirm("Xóa đơn hàng này?")) await remove(ref(db, `invoices/${key}`));
};

// --- HÀM CẬP NHẬT BÁO CÁO (Đã tối ưu) ---
function updateGeneralReport(invoicesData) {
    let totalChi = 0;
    let totalDon = 0;
    let totalNo = 0;
    let vendorSummary = {};

    Object.entries(invoicesData).forEach(([key, d]) => {
        const amount = parseInt(d.amount) || 0;
        totalChi += amount;
        totalDon++;
        
        if (d.paymentStatus !== "Đã thanh toán") {
            totalNo += amount;
        }

        // Thống kê theo nhà cung cấp
        if (!vendorSummary[d.vendor]) {
            vendorSummary[d.vendor] = { qty: 0, sum: 0, hasPendingInvoice: false };
        }
        vendorSummary[d.vendor].qty++;
        vendorSummary[d.vendor].sum += amount;
        if (d.invoiceStatus === "Chưa nhận HĐ") {
            vendorSummary[d.vendor].hasPendingInvoice = true;
        }
    });

    // Cập nhật các Card
    const reportTotal = document.getElementById('report-total-amount');
    const reportCount = document.getElementById('report-total-invoices');
    const reportUnpaid = document.getElementById('report-unpaid-amount');

    if (reportTotal) reportTotal.innerText = totalChi.toLocaleString('vi-VN') + "đ";
    if (reportCount) reportCount.innerText = totalDon;
    if (reportUnpaid) reportUnpaid.innerText = totalNo.toLocaleString('vi-VN') + "đ";

    // Cập nhật Bảng báo cáo
    const reportTbody = document.getElementById('report-vendor-body');
    if (reportTbody) {
        reportTbody.innerHTML = Object.entries(vendorSummary).map(([name, stat]) => `
            <tr class="border-b hover:bg-gray-50 text-sm">
                <td class="p-4 font-bold">${name}</td>
                <td class="p-4 text-center">${stat.qty} đơn</td>
                <td class="p-4 text-right font-bold text-blue-600">${stat.sum.toLocaleString()}đ</td>
                <td class="p-4 text-center">
                    ${stat.hasPendingInvoice 
                        ? '<span class="text-red-500 text-xs"><i class="fas fa-exclamation-triangle"></i> Thiếu HĐ</span>' 
                        : '<span class="text-green-500 text-xs"><i class="fas fa-check-circle"></i> Đủ HĐ</span>'}
                </td>
            </tr>
        `).join('');
    }
}

// --- KHỞI TẠO ỨNG DỤNG ---
function initApp() {
    // 1. Lắng nghe Sản phẩm
    onValue(ref(db, 'products'), (snapshot) => {
        const prodTbody = document.getElementById('productTableBody');
        if (!prodTbody) return;
        prodTbody.innerHTML = ""; availableProducts = [];
        if (snapshot.exists()) {
            Object.entries(snapshot.val()).forEach(([key, p]) => {
                availableProducts.push({ key, ...p });
                prodTbody.innerHTML += `<tr class="border-b text-sm">
                    <td class="p-4 font-bold text-blue-600">${p.code}</td>
                    <td class="p-4">${p.name}</td>
                    <td class="p-4 text-right">${(p.cost || 0).toLocaleString()}đ</td>
                    <td class="p-4 text-center">${p.unit}</td>
                    <td class="p-4 text-center font-bold">${p.stock}</td>
                    <td class="p-4 text-center">
                         <button class="text-red-600" onclick="remove(ref(db, 'products/${key}'))"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            });
        }
    });

    // 2. Lắng nghe Nhà cung cấp
    onValue(ref(db, 'vendors'), (snapshot) => {
        const nccTbody = document.getElementById('nccTableBody');
        const vendorSelect = document.getElementById('vendor');
        if (!nccTbody) return;
        nccTbody.innerHTML = "";
        if (vendorSelect) vendorSelect.innerHTML = '<option value="">-- Chọn nhà cung cấp --</option>';

        if (snapshot.exists()) {
            Object.entries(snapshot.val()).forEach(([key, v]) => {
                nccTbody.innerHTML += `
                    <tr class="border-b hover:bg-gray-50 text-sm">
                        <td class="p-4 font-bold">${v.code}</td>
                        <td class="p-4"><b>${v.name}</b><br><small>${v.address || ''}</small></td>
                        <td class="p-4">${v.phone || '-'}</td>
                        <td class="p-4 font-mono text-xs">${v.bank || '-'}</td>
                        <td class="p-4 text-center">
                            <button onclick="editNCC('${key}', '${v.name}', '${v.phone||''}', '${v.bank||''}', '${v.address||''}')" class="text-blue-600 mr-3"><i class="fas fa-edit"></i></button>
                            <button onclick="deleteNCC('${key}', '${v.name}')" class="text-red-500"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`;
                if (vendorSelect) {
                    const opt = document.createElement('option');
                    opt.value = v.name;
                    opt.textContent = `${v.code} - ${v.name}`;
                    vendorSelect.appendChild(opt);
                }
            });
        }
    });

    // 3. Lắng nghe Hóa đơn (Kết hợp hiển thị bảng và báo cáo)
    onValue(ref(db, 'invoices'), (snapshot) => {
        const invTbody = document.getElementById('invoiceTableBody');
        if (!invTbody) return;
        invTbody.innerHTML = "";

        if (snapshot.exists()) {
            const data = snapshot.val();
            // Cập nhật Báo cáo
            updateGeneralReport(data);

            // Cập nhật Bảng danh sách
            Object.entries(data).reverse().forEach(([key, d]) => {
                const payColor = d.paymentStatus === "Đã thanh toán" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700";
                const driveIcon = d.invoiceLink ? `<a href="${d.invoiceLink}" target="_blank" class="text-blue-500 ml-1"><i class="fab fa-google-drive"></i></a>` : "";

                invTbody.innerHTML += `
                    <tr class="border-b text-sm hover:bg-gray-50">
                        <td class="p-4">${d.orderDate}</td>
                        <td class="p-4 font-bold">${d.vendor} ${driveIcon}</td>
                        <td class="p-4 text-xs text-gray-500">${(d.items || []).map(i => i.productName).join(', ').substring(0, 30)}...</td>
                        <td class="p-4 font-mono font-bold text-red-600">${(d.amount || 0).toLocaleString()}đ</td>
                        <td class="p-4 text-center"><span class="${payColor} p-1 rounded text-xs font-bold">${d.paymentStatus}</span></td>
                        <td class="p-4 text-center text-gray-500">${d.invoiceStatus}</td>
                        <td class="p-4 text-center">
                            <button onclick="editInvoice('${key}')" class="text-blue-600 mr-2"><i class="fas fa-edit"></i></button>
                            <button onclick="deleteInvoice('${key}')" class="text-red-600"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`;
            });
        } else {
            // Reset báo cáo về 0 nếu không có hóa đơn
            updateGeneralReport({});
        }
    });
}

initApp();