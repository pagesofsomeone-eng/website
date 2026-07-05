// 1. حماية وتنفيذ تهيئة مكتبة الإرسال لعدم إيقاف السكربت نهائياً
(function() {
    try {
        const pubKey = "YOUR_PUBLIC_KEY"; 
        if (pubKey !== "YOUR_PUBLIC_KEY" && pubKey.trim() !== "") {
            emailjs.init(pubKey);
        }
    } catch(e) {
        console.log("EmailJS init safely skipped.");
    }
})();

// 2. تعريف المتغير الأساسي لتتبع حركة الصور (هذا ما كان يسبب المشكلة)
let imageTrackers = {};

// 3. البيانات الأساسية للمتجر (التصنيفات والمنتجات)
let defaultCategories = [
    { id: 'all', nameAr: 'الكل', nameEn: 'All' },
    { id: 'electronics', nameAr: 'إلكترونيات', nameEn: 'Electronics' },
    { id: 'fashion', nameAr: 'أزياء', nameEn: 'Fashion' }
];
let categories = JSON.parse(localStorage.getItem('rw_categories')) || defaultCategories;

let defaultProducts = [
    { id: 1, nameAr: 'ساعة ذكية فاخرة', price: 75000, oldPrice: 90000, category: 'electronics', imgs: ['photo/watch.jpg'], colors: ['أسود', 'فضي'], sizes: ['42مم', '44مم'], specs: 'الحجم: 44 مم\nالبطارية: تدوم 5 أيام.\nشاشة أموليد عالية الدقة ومقاومة للماء بالكامل.' },
    { id: 2, nameAr: 'حقيبة ظهر عصرية', price: 35000, oldPrice: 35000, category: 'fashion', imgs: ['photo/backpack.jpg'], colors: ['رمادي', 'أسود'], sizes: ['M', 'L'], specs: 'القياس: 15*18 سم\nالمنفذ: USB مدمج.\nعملية تناسب العمل والدراسة والرحلات ومقاومة للسوائل والأمطار.' }
];
localStorage.setItem('rw_products', JSON.stringify(products));

// 4. متغيرات الحالة العامة للسلة والعمليات
let cart = []; 
let orders = JSON.parse(localStorage.getItem('rw_orders')) || [];
let currentLang = 'ar';
const shippingCost = 5000;
let totalSales = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

const ADMIN_EMAIL = "pagesofsomeone@gmail.com";
const ADMIN_PASS = "Asd098765";
let currentUser = localStorage.getItem('rw_logged_user') || null;

let selectedColorForProduct = null;
let selectedSizeForProduct = null;
let toastTimeout = null;

// دالة إظهار التنبيهات الذكية المخصصة
function showToast(message) {
    const toast = document.getElementById('toast-container');
    if(!toast) return;
    
    toast.innerText = message;
    toast.style.display = 'block';
    
    if(toastTimeout) clearTimeout(toastTimeout);
    
    toastTimeout = setTimeout(() => {
        toast.style.display = 'none';
    }, 2000);
}

function dismissToast() {
    const toast = document.getElementById('toast-container');
    if(toast) toast.style.display = 'none';
}

// التحكم بالنوافذ العائمة والسلة الجانبية
function openLoginModal() { const m = document.getElementById('login-modal'); if(m) m.style.display = 'flex'; }
function closeLoginModal() { const m = document.getElementById('login-modal'); if(m) m.style.display = 'none'; }
function openSuccessModal() { const m = document.getElementById('success-modal'); if(m) m.style.display = 'flex'; }
function closeSuccessModal() { const m = document.getElementById('success-modal'); if(m) m.style.display = 'none'; }
function openCart() { const d = document.getElementById('cart-drawer'); if(d) d.classList.add('open'); }
function closeCart() { const d = document.getElementById('cart-drawer'); if(d) d.classList.remove('open'); }
function openCheckout() { const m = document.getElementById('checkout-modal'); if(m) m.style.display = 'flex'; }
function closeCheckout() { const m = document.getElementById('checkout-modal'); if(m) m.style.display = 'none'; }

// مراقبة الضغط الخارجي لإغلاق العناصر
window.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
    const cartDrawer = document.getElementById('cart-drawer');
    if (cartDrawer && cartDrawer.classList.contains('open')) {
        if (!e.target.closest('#cart-drawer') && !e.target.closest('.icon-btn') && !e.target.closest('.btn') && !e.target.closest('button')) {
            closeCart();
        }
    }
});

// تهيئة مراقب الأحرف للمواصفات فور تحميل الصفحة
document.addEventListener("DOMContentLoaded", () => {
    const specsTextarea = document.getElementById("admin-p-specs");
    if(specsTextarea) {
        specsTextarea.addEventListener("input", function() {
            const counter = document.getElementById("specs-char-counter");
            if(counter) counter.innerText = `${this.value.length} / 1000 حرف`;
        });
    }
});

// فتح وتجهيز تفاصيل المنتج
function openDetailsModal(pId) {
    const product = products.find(p => p.id === pId);
    if(!product) return;

    selectedColorForProduct = null;
    selectedSizeForProduct = null;

    const modal = document.getElementById('product-details-modal');
    if(modal) modal.style.display = 'flex';
    
    const titleEl = document.getElementById('detail-modal-title');
    if(titleEl) titleEl.innerText = product.nameAr;
    
    const priceEl = document.getElementById('detail-modal-price');
    if(priceEl) priceEl.innerText = product.price.toLocaleString() + " د.ع";
    
    const oldPriceEl = document.getElementById('detail-modal-old-price');
    if(oldPriceEl) {
        if(product.oldPrice > product.price) {
            oldPriceEl.innerText = product.oldPrice.toLocaleString();
            oldPriceEl.style.display = 'inline';
        } else {
            oldPriceEl.style.display = 'none';
        }
    }

    const colorsContainer = document.getElementById('detail-modal-colors-container');
    const colorsGrid = document.getElementById('detail-modal-colors');
    if(colorsGrid && colorsContainer) {
        colorsGrid.innerHTML = '';
        if(product.colors && product.colors.length > 0 && product.colors[0] !== "") {
            colorsContainer.style.display = 'block';
            product.colors.forEach(col => {
                const cleanColor = col.trim();
                colorsGrid.innerHTML += `<span class="selectable-badge" id="color-badge-${cleanColor}" onclick="selectProductColor('${cleanColor}')">${cleanColor}</span>`;
            });
        } else {
            colorsContainer.style.display = 'none';
        }
    }

    const sizesContainer = document.getElementById('detail-modal-sizes-container');
    const sizesGrid = document.getElementById('detail-modal-sizes');
    if(sizesGrid && sizesContainer) {
        sizesGrid.innerHTML = '';
        if(product.sizes && product.sizes.length > 0 && product.sizes[0] !== "") {
            sizesContainer.style.display = 'block';
            product.sizes.forEach(sz => {
                const cleanSize = sz.trim();
                sizesGrid.innerHTML += `<span class="selectable-badge" id="size-badge-${cleanSize}" onclick="selectProductSize('${cleanSize}')">${cleanSize}</span>`;
            });
        } else {
            sizesContainer.style.display = 'none';
        }
    }

    const specsContainer = document.getElementById('detail-modal-specs-container');
    const specsText = document.getElementById('detail-modal-specs');
    if(specsText && specsContainer) {
        if(product.specs && product.specs.trim() !== "") {
            specsContainer.style.display = 'block';
            specsText.innerText = product.specs;
        } else {
            specsContainer.style.display = 'none';
        }
    }

    if(!imageTrackers[product.id]) imageTrackers[product.id] = 0;
    const imgEl = document.getElementById('detail-modal-img');
    if(imgEl && product.imgs && product.imgs.length > 0) {
        imgEl.src = product.imgs[imageTrackers[product.id]];
    }
    
    const navZone = document.getElementById('detail-modal-nav');
    if(navZone) {
        navZone.innerHTML = '';
        if(product.imgs && product.imgs.length > 1) {
            navZone.innerHTML = `
                <button class="img-nav-btn prev" onclick="navigateProductImage(${product.id}, -1, event); syncModalImg(${product.id});"><i class="fas fa-chevron-right"></i></button>
                <button class="img-nav-btn next" onclick="navigateProductImage(${product.id}, 1, event); syncModalImg(${product.id});"><i class="fas fa-chevron-left"></i></button>
            `;
        }
    }

    const addBtn = document.getElementById('detail-modal-add-btn');
    if(addBtn) addBtn.onclick = () => { addToCart(product.id); closeDetailsModal(); };
}

function selectProductColor(color) {
    selectedColorForProduct = color;
    document.querySelectorAll('#detail-modal-colors .selectable-badge').forEach(el => el.classList.remove('selected'));
    const activeBadge = document.getElementById(`color-badge-${color}`);
    if(activeBadge) activeBadge.classList.add('selected');
}

function selectProductSize(size) {
    selectedSizeForProduct = size;
    document.querySelectorAll('#detail-modal-sizes .selectable-badge').forEach(el => el.classList.remove('selected'));
    const activeBadge = document.getElementById(`size-badge-${size}`);
    if(activeBadge) activeBadge.classList.add('selected');
}

function syncModalImg(pId) {
    const product = products.find(p => p.id === pId);
    const imgEl = document.getElementById('detail-modal-img');
    if(imgEl && product) imgEl.src = product.imgs[imageTrackers[pId]];
}

function closeDetailsModal() { 
    const modal = document.getElementById('product-details-modal');
    if(modal) modal.style.display = 'none'; 
}

function switchAdminTab(tabId, $e) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('style-hidden'));
    document.querySelectorAll('.tab-nav-btn').forEach(el => el.classList.remove('active'));
    
    const targetTab = document.getElementById(`admin-tab-${tabId}`);
    if(targetTab) targetTab.classList.remove('style-hidden');
    
    if ($e && $e.currentTarget) $e.currentTarget.classList.add('active');
}

// نظام تسجيل الدخول الموحد
function handleUnifiedLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;

    if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
        const panel = document.getElementById('admin-dashboard');
        if(panel) panel.classList.remove('style-hidden');
        closeLoginModal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast("أهلاً بك يا مشرف رواسي!");
        updateAdminOrdersUI();
        renderAdminProductsTable();
    } else {
        closeLoginModal();
        currentUser = email;
        localStorage.setItem('rw_logged_user', email);
        cart = JSON.parse(localStorage.getItem('rw_cart_' + currentUser)) || [];
        updateAuthUI();
        updateCartUI();
        renderUserHistory();
        showToast("تم تسجيل الدخول بنجاح");
    }
}

function updateAuthUI() {
    const btn = document.getElementById('auth-btn');
    if(!btn) return;
    if(currentUser) {
        btn.innerHTML = `<i class="fas fa-sign-out-alt"></i> خروج (${currentUser.split('@')[0]})`;
        btn.onclick = logoutUser;
    } else {
        btn.innerHTML = `<i class="fas fa-user"></i> تسجيل الدخول`;
        btn.onclick = openLoginModal;
    }
}

function logoutUser() {
    currentUser = null;
    localStorage.removeItem('rw_logged_user');
    cart = []; 
    updateAuthUI();
    updateCartUI();
    const historySection = document.getElementById('user-history-section');
    if(historySection) historySection.classList.add('style-hidden');
    showToast("تم تسجيل الخروج");
}

function viewAsUser() { 
    const panel = document.getElementById('admin-dashboard');
    if(panel) panel.classList.add('style-hidden'); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
}
function logoutAdmin() { 
    const panel = document.getElementById('admin-dashboard');
    if(panel) panel.classList.add('style-hidden'); 
    const form = document.getElementById('login-form');
    if(form) form.reset(); 
}

function updateCategorySelects() {
    document.querySelectorAll('.dynamic-cat-select').forEach(select => {
        const isFilter = select.id === 'filter-category';
        select.innerHTML = '';
        categories.forEach(cat => {
            if(!isFilter && cat.id === 'all') return;
            const name = currentLang === 'ar' ? cat.nameAr : cat.nameEn;
            select.innerHTML += `<option value="${cat.id}">${name}</option>`;
        });
    });
}

function handleAdminCategory(e) {
    e.preventDefault();
    const cId = document.getElementById('admin-c-id').value.trim().toLowerCase();
    const nameAr = document.getElementById('admin-c-name-ar').value.trim();
    const nameEn = document.getElementById('admin-c-name-en').value.trim();

    if(categories.some(c => c.id === cId)) { showToast("هذا الكود مستخدم بالفعل!"); return; }

    categories.push({ id: cId, nameAr, nameEn });
    localStorage.setItem('rw_categories', JSON.stringify(categories));
    document.getElementById('admin-cat-form').reset();
    updateCategorySelects();
    renderAdminCats();
    showToast("تم إضافة التصنيف");
}

function deleteCategory(cId) {
    if(cId === 'all' || cId === 'electronics' || cId === 'fashion') { showToast("لا يمكن حذف التصنيفات الأساس!"); return; }
    if(confirm("هل أنت متأكد من حذف هذا التصنيف؟")) {
        categories = categories.filter(c => c.id !== cId);
        localStorage.setItem('rw_categories', JSON.stringify(categories));
        updateCategorySelects();
        renderAdminCats();
        showToast("تم حذف التصنيف");
    }
}

function renderAdminCats() {
    const list = document.getElementById('admin-cats-list');
    if(!list) return;
    list.innerHTML = '';
    categories.forEach(cat => {
        if(cat.id === 'all') return;
        list.innerHTML += `
            <div class="cat-item-flex">
                <span><strong>${cat.nameAr}</strong> (${cat.id})</span>
                <button onclick="deleteCategory('${cat.id}')" style="background:none; border:none; color:#dc3545; cursor:pointer;"><i class="fas fa-trash"></i></button>
            </div>
        `;
    });
}

// عرض المنتجات في واجهة الزبون
function renderProducts(productsToRender = products) {
    const grid = document.getElementById('products-grid');
    if(!grid) return; 
    grid.innerHTML = '';
    
    productsToRender.forEach(product => {
        const name = product.nameAr;
        const hasDiscount = product.oldPrice > product.price;
        let discountSpan = hasDiscount ? `<span class="old-price">${product.oldPrice.toLocaleString()}</span>` : '';
        
        if(!imageTrackers[product.id]) imageTrackers[product.id] = 0;
        const currentImg = product.imgs[imageTrackers[product.id]] || 'photo/watch.jpg';

        let navButtons = '';
        if(product.imgs && product.imgs.length > 1) {
            navButtons = `
                <button class="img-nav-btn prev" onclick="navigateProductImage(${product.id}, -1, event);"><i class="fas fa-chevron-right"></i></button>
                <button class="img-nav-btn next" onclick="navigateProductImage(${product.id}, 1, event);"><i class="fas fa-chevron-left"></i></button>
            `;
        }
        
        grid.innerHTML += `
            <div class="product-card" onclick="openDetailsModal(${product.id})">
                <div class="product-img-wrapper">
                    <img id="p-img-${product.id}" src="${currentImg}" alt="${name}">
                    ${navButtons}
                </div>
                <h3 style="margin-top:10px;">${name}</h3>
                <div class="price-box">
                    <span class="current-price">${product.price.toLocaleString()} د.ع</span>
                    ${discountSpan}
                </div>
                <button class="btn btn-block" onclick="event.stopPropagation(); addToCart(${product.id})">إضافة للسلة</button>
            </div>
        `;
    });
    const statsProductsCountEl = document.getElementById('stat-products-count');
    if (statsProductsCountEl) statsProductsCountEl.innerText = products.length;
}

function navigateProductImage(pId, direction, $e) {
    if ($e && $e.stopPropagation) $e.stopPropagation();
    const product = products.find(p => p.id === pId);
    if(!product) return;
    
    if(!imageTrackers[pId]) imageTrackers[pId] = 0;
    let index = imageTrackers[pId] + direction;
    if(index >= product.imgs.length) index = 0;
    if(index < 0) index = product.imgs.length - 1;
    
    imageTrackers[pId] = index;
    const imgEl = document.getElementById(`p-img-${pId}`);
    if(imgEl) imgEl.src = product.imgs[index];
}

function addToCart(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    if(product.colors && product.colors.length > 0 && product.colors[0] !== "" && !selectedColorForProduct) {
        showToast("يرجى اختيار اللون المفضل أولاً!"); 
        openDetailsModal(id);
        return;
    }
    if(product.sizes && product.sizes.length > 0 && product.sizes[0] !== "" && !selectedSizeForProduct) {
        showToast("يرجى اختيار المقاس أو الحجم أولاً!"); 
        openDetailsModal(id);
        return;
    }

    const colorLabel = selectedColorForProduct || "افتراضي";
    const sizeLabel = selectedSizeForProduct || "افتراضي";

    const itemInCart = cart.find(item => item.id === id && item.chosenColor === colorLabel && item.chosenSize === sizeLabel);
    
    if (itemInCart) { 
        itemInCart.quantity++; 
    } else { 
        cart.push({ ...product, quantity: 1, chosenColor: colorLabel, chosenSize: sizeLabel }); 
    }
    updateCartUI(); 
    openCart();
    showToast("تمت إضافة المنتج إلى السلة");
}

function updateCartUI() {
    const cartCountEl = document.getElementById('cart-count');
    if(cartCountEl) cartCountEl.innerText = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    const container = document.getElementById('cart-items'); 
    if(!container) return;
    container.innerHTML = '';
    let subtotal = 0;
    
    cart.forEach((item) => {
        subtotal += item.price * item.quantity;
        container.innerHTML += `
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
                <div>
                    <h4 style="font-size:0.8rem; font-weight:700;">${item.nameAr}</h4>
                    <small style="color:#777; display:block; font-size:0.75rem;">${item.chosenColor} | ${item.chosenSize}</small>
                    <small>${item.quantity} x ${item.price.toLocaleString()} د.ع</small>
                </div>
                <button onclick="removeFromCart(${item.id}, '${item.chosenColor}', '${item.chosenSize}')" style="background:none; border:none; color:#dc3545; cursor:pointer; padding:5px;"><i class="fas fa-trash"></i></button>
            </div>
        `;
    });
    
    const totalEl = document.getElementById('cart-total-price');
    if(totalEl) totalEl.innerText = subtotal.toLocaleString();
    if(currentUser) { localStorage.setItem('rw_cart_' + currentUser, JSON.stringify(cart)); }
}

function removeFromCart(id, color, size) { 
    cart = cart.filter(item => !(item.id === id && item.chosenColor === color && item.chosenSize === size)); 
    updateCartUI(); 
    showToast("تم إزالة المنتج");
}

function renderUserHistory() {
    const section = document.getElementById('user-history-section');
    const container = document.getElementById('user-orders-history');
    if(!container || !currentUser) return;

    const userOrders = orders.filter(o => o.userEmail === currentUser);
    if(userOrders.length === 0) { if(section) section.classList.add('style-hidden'); return; }

    if(section) section.classList.remove('style-hidden');
    container.innerHTML = '';
    userOrders.forEach(order => {
        container.innerHTML += `
            <div class="history-card">
                <strong>رقم العملية:</strong> ${order.orderId}<br>
                <strong>التاريخ:</strong> ${order.dateStr}<br>
                <strong>المنتجات:</strong> ${order.itemsSummary}<br>
                <strong>المجموع:</strong> <span style="color:var(--primary-color); font-weight:bold;">${order.totalAmount.toLocaleString()} د.ع</span>
            </div>
        `;
    });
}

// معالجة تأكيد الطلب والشحن الداخلي للموقع
function handleCheckout(e) {
    e.preventDefault();
    const phoneInput = document.getElementById('checkout-phone').value;
    const province = document.getElementById('checkout-province').value;
    const name = document.getElementById('checkout-name').value;
    const address = document.getElementById('checkout-address').value;

    const iraqiPhoneRegex = /^07[0-9]{9}$/;
    if (!iraqiPhoneRegex.test(phoneInput)) { showToast('ادخل رقم الهاتف بشكل صحيح "07XXXXXXXXX"'); return; }

    let subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let total = subtotal + shippingCost;
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-IQ') + ' ' + now.toLocaleTimeString('ar-IQ');

    const newOrder = {
        orderId: Date.now(),
        userEmail: currentUser || "guest@rawasy.store",
        customerName: name,
        phone: phoneInput,
        province: province,
        address: address,
        itemsSummary: cart.map(i => `${i.nameAr} [${i.chosenColor}, ${i.chosenSize}] (${i.quantity})`).join(', '),
        totalAmount: total,
        dateStr: dateStr,
        adminNotes: ""
    };

    orders.push(newOrder);
    totalSales += total;
    localStorage.setItem('rw_orders', JSON.stringify(orders));

    updateAdminOrdersUI();
    renderUserHistory();
    closeCheckout();
    closeCart();
    
    cart = [];
    if(currentUser) { localStorage.removeItem('rw_cart_' + currentUser); }
    updateCartUI();
    
    document.getElementById('checkout-form').reset();
    openSuccessModal(); 
}

// إدارة المنتجات من طرف لوحة المشرف
function handleAdminProduct(e) {
    e.preventDefault();
    const id = document.getElementById('admin-p-id').value;
    const nameAr = document.getElementById('admin-p-name').value;
    const price = parseInt(document.getElementById('admin-p-price').value);
    const oldPrice = parseInt(document.getElementById('admin-p-old-price').value) || price;
    const category = document.getElementById('admin-p-category').value;
    const colorsText = document.getElementById('admin-p-colors').value;
    const sizesText = document.getElementById('admin-p-sizes').value;
    const specsText = document.getElementById('admin-p-specs').value;
    
    const colorsArray = colorsText ? colorsText.split(',').map(c => c.trim()) : [];
    const sizesArray = sizesText ? sizesText.split(',').map(s => s.trim()) : [];
    
    const imgInput = document.getElementById('admin-p-img');
    let imgPaths = [];

    if (imgInput && imgInput.files && imgInput.files.length > 0) {
        for (let i = 0; i < imgInput.files.length; i++) { imgPaths.push('photo/' + imgInput.files[i].name); }
    }

    if (id) {
        const index = products.findIndex(p => p.id == id);
        if(index !== -1) {
            const finalImgs = imgPaths.length > 0 ? imgPaths : products[index].imgs;
            products[index] = { id: parseInt(id), nameAr, price, oldPrice, category, imgs: finalImgs, colors: colorsArray, sizes: sizesArray, specs: specsText };
            showToast("تم تحديث المنتج بنجاح!");
        }
    } else {
        if(imgPaths.length === 0) imgPaths.push('photo/watch.jpg');
        products.push({ id: Date.now(), nameAr, price, oldPrice, category, imgs: imgPaths, colors: colorsArray, sizes: sizesArray, specs: specsText });
        showToast("تم إضافة المنتج بنجاح!");
    }

    localStorage.setItem('rw_products', JSON.stringify(products));
    cancelProductEdit(); 
    renderProducts();
    renderAdminProductsTable();
}

function startProductEdit(pId) {
    const product = products.find(p => p.id === pId);
    if(!product) return;

    document.getElementById('admin-p-id').value = product.id;
    document.getElementById('admin-p-name').value = product.nameAr;
    document.getElementById('admin-p-price').value = product.price;
    document.getElementById('admin-p-old-price').value = product.oldPrice || '';
    document.getElementById('admin-p-category').value = product.category;
    document.getElementById('admin-p-colors').value = product.colors ? product.colors.join(', ') : '';
    document.getElementById('admin-p-sizes').value = product.sizes ? product.sizes.join(', ') : '';
    document.getElementById('admin-p-specs').value = product.specs || '';

    const titleForm = document.getElementById('admin-form-title');
    if(titleForm) titleForm.innerHTML = `<i class="fas fa-edit"></i> تعديل المنتج: ${product.nameAr}`;
    
    const submitBtn = document.getElementById('admin-submit-btn');
    if(submitBtn) submitBtn.innerText = 'تحديث المنتج الآن';
    
    const fileInput = document.getElementById('admin-p-img');
    if(fileInput) fileInput.required = false; 
    
    const cancelBtn = document.getElementById('admin-cancel-edit-btn');
    if(cancelBtn) cancelBtn.classList.remove('style-hidden');
    
    const form = document.getElementById('admin-product-form');
    if(form) form.scrollIntoView({ behavior: 'smooth' });
    
    const counter = document.getElementById("specs-char-counter");
    if(counter && product.specs) counter.innerText = `${product.specs.length} / 1000 حرف`;
}

function cancelProductEdit() {
    const form = document.getElementById('admin-product-form');
    if(form) form.reset();
    document.getElementById('admin-p-id').value = '';
    
    const titleForm = document.getElementById('admin-form-title');
    if(titleForm) titleForm.innerHTML = `<i class="fas fa-plus-circle"></i> إضافة منتج جديد`;
    
    const submitBtn = document.getElementById('admin-submit-btn');
    if(submitBtn) submitBtn.innerText = 'حفظ المنتج';
    
    const fileInput = document.getElementById('admin-p-img');
    if(fileInput) fileInput.required = true;
    
    const cancelBtn = document.getElementById('admin-cancel-edit-btn');
    if(cancelBtn) cancelBtn.classList.add('style-hidden');
    
    const counter = document.getElementById("specs-char-counter");
    if(counter) counter.innerText = `0 / 1000 حرف`;
}

function deleteProduct(pId) {
    if(confirm("هل أنت متأكد من حذف هذا المنتج نهائياً؟")) {
        products = products.filter(p => p.id !== pId);
        localStorage.setItem('rw_products', JSON.stringify(products));
        renderProducts();
        renderAdminProductsTable();
        showToast("تم حذف المنتج");
    }
}

function renderAdminProductsTable() {
    const tbody = document.getElementById('admin-products-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    if(products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#888;">لا توجد منتجات.</td></tr>';
        return;
    }
    products.forEach(product => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${product.nameAr}</strong></td>
                <td>${product.price.toLocaleString()} د.ع</td>
                <td>
                    <button class="btn btn-sm" onclick="startProductEdit(${product.id})"><i class="fas fa-pen"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct(${product.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function saveAdminOrderNote(orderId, noteText) {
    const index = orders.findIndex(o => o.orderId == orderId);
    if(index !== -1) {
        orders[index].adminNotes = noteText;
        localStorage.setItem('rw_orders', JSON.stringify(orders));
    }
}

function updateAdminOrdersUI() {
    const statsSalesEl = document.getElementById('stat-sales');
    if(statsSalesEl) statsSalesEl.innerText = totalSales.toLocaleString() + " د.ع";
    
    const statsOrdersCountEl = document.getElementById('stat-orders-count');
    if(statsOrdersCountEl) statsOrdersCountEl.innerText = orders.length;
    
    const tbody = document.getElementById('admin-orders-table-body'); 
    if(!tbody) return;
    tbody.innerHTML = '';

    if(orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#888; padding:30px;">لا توجد طلبات واردة حالياً.</td></tr>';
        return;
    }

    orders.forEach(order => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${order.orderId}</strong><br><small style="color:#666;">${order.dateStr}</small></td>
                <td>${order.customerName}<br><small style="color:#777;">${order.userEmail}</small></td>
                <td><a href="tel:${order.phone}" style="color:inherit; font-weight:bold;">${order.phone}</a></td>
                <td><span class="color-badge">${order.province}</span><br>${order.address}</td>
                <td><small>${order.itemsSummary}</small></td>
                <td><strong style="color:var(--primary-color);">${order.totalAmount.toLocaleString()} د.ع</strong></td>
                <td>
                    <input type="text" class="admin-note-input" value="${order.adminNotes || ''}" 
                           placeholder="أضف ملاحظة هنا..." oninput="saveAdminOrderNote(${order.orderId}, this.value)">
                </td>
            </tr>
        `;
    });
}

// تصدير التقارير إكسل
function exportOrdersToExcel() {
    if(orders.length === 0) { alert("لا توجد بيانات طلبات لتصديرها حالياً!"); return; }
    const excelData = orders.map(o => ({
        "رقم الطلب": o.orderId,
        "تاريخ الطلب": o.dateStr,
        "حساب العميل": o.userEmail,
        "اسم العميل": o.customerName,
        "رقم الهاتف": o.phone,
        "المحافظة": o.province,
        "العنوان بالتفصيل": o.address,
        "المنتجات والخيارات المختارة": o.itemsSummary,
        "إجمالي المبلغ (د.ع)": o.totalAmount,
        "ملاحظات المشرف الإدارية": o.adminNotes || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الطلبات المستلمة");
    XLSX.writeFile(workbook, `طلبات_متجر_رواسي_${Date.now()}.xlsx`);
}

// أدوات الفلترة والبحث الآمنة
function searchProducts(query) {
    const filtered = products.filter(p => p.nameAr.toLowerCase().includes(query.toLowerCase()));
    renderProducts(filtered);
}

function filterProducts() {
    const selectEl = document.getElementById('filter-category');
    if(!selectEl) return;
    const cat = selectEl.value;
    const filtered = cat === 'all' ? products : products.filter(p => p.category === cat);
    renderProducts(filtered);
}

function toggleTheme() {
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
}

function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    updateCategorySelects();
    renderProducts();
}

// التشغيل الفوري الآمن عند اكتمال تحميل النافذة
window.onload = () => { 
    updateCategorySelects();
    renderProducts(); 
    updateCartUI();
    updateAuthUI();
    renderUserHistory();
    renderAdminCats();
    renderAdminProductsTable();
};
