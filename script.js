const bar = document.getElementById('bar');
const close = document.getElementById('close');
const nav = document.getElementById('navbar');

if(bar){
  bar.addEventListener('click', () => {
    nav.classList.add('active');
  })
}
if (close){
  close.addEventListener('click', () => {
    nav.classList.remove('active');
  })
}
document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelectorAll("#navbar li a");
  const currentPage = window.location.pathname.split("/").pop();

  navLinks.forEach(link => {
    const linkPage = link.getAttribute("href");

    if (linkPage === currentPage || (linkPage === "#" && currentPage === "")) {
      link.classList.add("active");
    }

    link.addEventListener("click", () => {
      navLinks.forEach(nav => nav.classList.remove("active"));
      link.classList.add("active");
    });
  });
});


import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";



// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBsQNrAnhfzhWSepgMJEr3DbnLIUwHhOP0",
  authDomain: "localarthub-38ae5.firebaseapp.com",
  projectId: "localarthub-38ae5",
   storageBucket: "localarthub-38ae5.firebasestorage.app",   
  messagingSenderId: "741966380978",
  appId: "1:741966380978:web:d94d5516d308b799c1eeab",
  measurementId: "G-Y7F4HQQ3ZX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Global variable for products
let allProducts = [];

import { onAuthStateChanged, getIdToken, signOut } 
from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const token = await getIdToken(user);
    localStorage.setItem("authToken", token);
    console.log("🔥 Firebase token saved");

    const adminLink = document.querySelector('a[href="admin.html"]');
    if (adminLink) {
      try {
        const idTokenResult = await user.getIdTokenResult();
        const customClaims = idTokenResult.claims;
        const hasAdminRole = customClaims.admin === true;
        const hasSellerRole = customClaims.seller === true;
        console.log("Custom claims:", customClaims);
        console.log("Has admin role:", hasAdminRole);
        console.log("Has seller role:", hasSellerRole);
        adminLink.parentElement.style.display = (hasAdminRole || hasSellerRole) ? 'block' : 'none';
        
        if (hasSellerRole || hasAdminRole) {
          hideSellerBuyerNavigation();
        }
      } catch (e) {
        console.error("Error checking custom claims:", e);
        adminLink.parentElement.style.display = 'none';
      }
    }
  } else {
    localStorage.removeItem("authToken");

    const adminLink = document.querySelector('a[href="admin.html"]');
    if (adminLink) {
      adminLink.parentElement.style.display = 'none';
    }
  }

  try {
    updateLoginUI(user, user ? await getIdToken(user) : null);
  } catch (e) {
    // ignore UI update errors for pages without those elements
  }
});

function hideSellerBuyerNavigation() {
  const homeBtn    = document.getElementById('Home-ID');
  const aboutBtn   = document.getElementById('About-ID');
  const contactBtn = document.getElementById('Contact-ID');
  const shopBtn    = document.getElementById('Shop-ID');
  
  if (homeBtn)    homeBtn.parentElement.style.display    = 'none';
  if (aboutBtn)   aboutBtn.parentElement.style.display   = 'none';
  if (contactBtn) contactBtn.parentElement.style.display = 'none';
  if (shopBtn)    shopBtn.parentElement.style.display    = 'none';
  
  const adminLink  = document.querySelector('a[href="admin.html"]');
  const ordersLink = document.querySelector('a[href="user-orders.html"]');
  if (adminLink)  adminLink.parentElement.style.display  = 'block';
  if (ordersLink) ordersLink.parentElement.style.display = 'block';
}

// ── Seller request status check ───────────────────────────────────────────
// Called after login. Disables "Become Seller" button if user already has
// a pending or approved application, and updates its label to reflect status.
async function checkSellerRequestStatus(token, btn) {
  if (!token || !btn) return;
  try {
    const API_BASE = (window.location.port === '5000') ? '' : 'http://localhost:5000';
    const res  = await fetch(`${API_BASE}/api/users/seller-request/status`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) return; // silently ignore — don't block UI on network error
    const data = await res.json();
    if (!data.exists) return; // no application yet — button stays enabled

    // Application exists: disable the button and show its current status
    btn.disabled = true;
    btn.style.opacity = '0.55';
    btn.style.cursor  = 'not-allowed';

    if (data.status === 'pending') {
      btn.textContent = '⏳ Application Pending';
      btn.title = 'Your seller application is under review. Please wait for admin approval.';
    } else if (data.status === 'approved') {
      btn.textContent = '✅ Already a Seller';
      btn.title = 'Your seller application has been approved.';
    } else if (data.status === 'rejected') {
      // Rejected users ARE allowed to re-apply — keep button enabled
      btn.disabled = false;
      btn.style.opacity = '';
      btn.style.cursor  = '';
      btn.textContent = '🔄 Re-apply as Seller';
      btn.title = 'Your previous application was rejected. You may submit a new one.';
    }
  } catch (e) {
    // Network error — don't block the button, just log quietly
    console.warn('Could not check seller request status:', e.message);
  }
}

function updateLoginUI(user, token) {
  const loginBtn       = document.getElementById('login-btn');
  const modal          = document.getElementById('logout-modal');
  const cancelBtn      = document.getElementById('cancel-logout');
  const logoutBtn      = document.getElementById('confirm-logout');
  const becomeSellerBtn = document.getElementById('become-seller');

  if (!loginBtn) return;

  if (user) {
    loginBtn.innerHTML = `
      <img 
        src="https://cdn-icons-png.flaticon.com/512/9131/9131478.png" 
        alt="User" 
        style="width:24px; height:24px; border-radius:50%;"
      >
    `;
    loginBtn.href = "#";
    loginBtn.onclick = (e) => {
      e.preventDefault();
      if (modal) modal.style.display = 'flex';
    };

    if (cancelBtn) cancelBtn.onclick = () => { if (modal) modal.style.display = 'none'; };

    if (logoutBtn) logoutBtn.onclick = async () => {
      try {
        await signOut(auth);
      } catch (e) {
        console.error('Sign out failed', e);
      }
      if (modal) modal.style.display = 'none';
      localStorage.removeItem('authToken');
      setTimeout(() => window.location.href = 'main.html', 200);
    };

    if (becomeSellerBtn) {
      // Check if this user already has a pending/approved request — disable button if so
      checkSellerRequestStatus(token, becomeSellerBtn);

      becomeSellerBtn.onclick = () => {
        if (becomeSellerBtn.disabled) return;
        if (modal) modal.style.display = 'none';
        const sellerModal = document.getElementById('seller-modal');
        if (sellerModal) {
          sellerModal.classList.add('open');
          if (typeof sfGoToPage === 'function') sfGoToPage(1);
        }
      };
    }
  } else {
    loginBtn.innerText = 'Login';
    loginBtn.href = 'signin.html';
    loginBtn.onclick = null;
  }
  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
}


// SIGN IN button
const submitSignin = document.getElementById('Existing-Signin');
if (submitSignin) {
  submitSignin.addEventListener("click", (e) => {
    e.preventDefault();
    const email    = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    signInWithEmailAndPassword(auth, email, password)
      .then(() => { alert("Sign in successful!"); window.location.href = 'main.html'; })
      .catch((error) => { alert(error.message); });
  });
}

// REGISTER button
const submitRegister = document.getElementById('Register-New');
if (submitRegister) {
  submitRegister.addEventListener("click", (e) => { 
    e.preventDefault();
    const email    = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    createUserWithEmailAndPassword(auth, email, password)
      .then(() => { alert("Account created successfully!"); window.location.href = 'main.html'; })
      .catch((error) => { alert(error.message); });
  });
}

// Slideshow
let slideIndex = 0;
let slideTimer;
const slides = document.querySelectorAll('.slide');

function showSlides() {
  slides.forEach(slide => slide.classList.remove('active'));
  slideIndex++;
  if (slideIndex > slides.length) slideIndex = 1;
  slides[slideIndex - 1].classList.add('active');
  slideTimer = setTimeout(showSlides, 3000);
}

function changeSlide(n) {
  clearTimeout(slideTimer);
  slides.forEach(slide => slide.classList.remove('active'));
  slideIndex += n;
  if (slideIndex > slides.length) slideIndex = 1;
  if (slideIndex < 1) slideIndex = slides.length;
  slides[slideIndex - 1].classList.add('active');
  slideTimer = setTimeout(showSlides, 3000);
}

if (slides.length > 0) {
  showSlides();
  const prevBtn = document.querySelector('.prev');
  const nextBtn = document.querySelector('.next');
  if (prevBtn) prevBtn.addEventListener('click', () => changeSlide(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => changeSlide(1));
}

// Add product (admin)
async function addProduct() {
  const token = localStorage.getItem("authToken");
  if (!token) { alert("Login as admin first"); return; }

  const isUpload = document.getElementById('image-upload-radio').checked;
  const formData = new FormData();
  formData.append('title',       document.getElementById("pname").value);
  formData.append('price',       document.getElementById("pprice").value);
  formData.append('stock',       document.getElementById("stock").value || 0);
  formData.append('category',    document.getElementById("pcategory").value);
  formData.append('subcategory', document.getElementById("psubcategory").value);
  formData.append('era',         document.getElementById("pera").value);
  formData.append('description', document.getElementById("pdescription").value || "Local artisan product");

  if (isUpload) {
    const file = document.getElementById('pimagefile').files[0];
    if (file) { formData.append('image', file); } else { alert("Please select a file"); return; }
  } else {
    formData.append('image', document.getElementById("pimage").value);
  }

  const response = await fetch("http://localhost:5000/api/products", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  if (response.ok) {
    alert("Product added successfully");
    ["pname","pprice","pimage","pimagefile","stock","pcategory","psubcategory","pera","pdescription"]
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  } else {
    alert("Failed to add product");
  }
}

// Subcategory mapping
const subcategoryMap = {
  "Antiques Artifacts": ["Furniture", "Jewelry", "Metal", "Glass", "Wood"],
  "Decorative Arts":    ["Ceramics", "Pottery", "Glassware", "Textile"],
  "Fine Art":           ["Painting", "Drawing", "Sculpture"]
};

function updateSubcategories(categorySelectId, subcategorySelectId) {
  const categorySelect    = document.getElementById(categorySelectId);
  const subcategorySelect = document.getElementById(subcategorySelectId);
  if (categorySelect && subcategorySelect) {
    const selectedCategory = categorySelect.value;
    subcategorySelect.innerHTML = '<option value="">Select Subcategory</option>';
    if (selectedCategory && subcategoryMap[selectedCategory]) {
      subcategoryMap[selectedCategory].forEach(subcat => {
        const option = document.createElement('option');
        option.value = subcat; option.textContent = subcat;
        subcategorySelect.appendChild(option);
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const categorySelect = document.getElementById('pcategory');
  if (categorySelect) categorySelect.addEventListener('change', () => updateSubcategories('pcategory', 'psubcategory'));
  
  const editCategorySelect = document.getElementById('edit-category');
  if (editCategorySelect) editCategorySelect.addEventListener('change', () => updateSubcategories('edit-category', 'edit-subcategory'));
});


// Image helper
function getImageSrc(imagePath) {
  if (!imagePath || imagePath === 'undefined') return 'images/ceramicvase.jpg';
  if (imagePath.startsWith('http')) return imagePath;
  if (!imagePath.startsWith('/')) imagePath = '/' + imagePath;
  return 'http://localhost:5000' + imagePath;
}
window.getImageSrc = getImageSrc;

// ── loadProducts: accepts options { sort, limit } ────────────────────────────
async function loadProducts(containerId, options = {}) {
  const token = localStorage.getItem("authToken");

  const params = new URLSearchParams();
  if (options.sort)  params.set("sort",  options.sort);
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(`http://localhost:5000/api/products${query}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const products = await res.json();
  allProducts = products;
  renderProducts(containerId, products);

  if (containerId === "shop-products") {
    initializeFilters();
    renderPagination(containerId, products, 1); // init pagination
  }
}

// ── loadFeaturedProducts: personalised for logged-in users ──────────────────
async function loadFeaturedProducts() {
  const token     = localStorage.getItem("authToken");
  const container = document.getElementById("featured-products");
  if (!container) return;

  if (token) {
    try {
      // Fetch user orders
      const ordersRes = await fetch("http://localhost:5000/api/orders", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (ordersRes.ok) {
        const orders = await ordersRes.json();

        if (orders.length > 0) {
          // Get unique bought product IDs
          const boughtIds = [...new Set(orders.flatMap(o => o.items.map(i => i.productId)))];

          // Fetch product details for bought items
          const boughtProducts = (await Promise.all(
            boughtIds.map(id =>
              fetch(`http://localhost:5000/api/products/${id}`)
                .then(r => r.ok ? r.json() : null)
                .catch(() => null)
            )
          )).filter(Boolean);

          // Build category + subcategory frequency from order quantities
          const catFreq    = {};
          const subcatFreq = {};
          orders.forEach(order => {
            order.items.forEach(item => {
              const prod = boughtProducts.find(p => p._id === item.productId);
              if (!prod) return;
              const qty = item.qty || 1;
              catFreq[prod.category]       = (catFreq[prod.category]       || 0) + qty;
              subcatFreq[prod.subcategory] = (subcatFreq[prod.subcategory] || 0) + qty;
            });
          });

          // Find top category and subcategory
          const topCategory = Object.entries(catFreq).sort((a, b) => b[1] - a[1])[0]?.[0];
          const topSubcat   = Object.entries(subcatFreq).sort((a, b) => b[1] - a[1])[0]?.[0];

          if (topCategory) {
            // Fetch newest products
            const allRes = await fetch(`http://localhost:5000/api/products?sort=newest`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const allProds = await allRes.json();

            // Sort: same subcategory first, then same category, then the rest — all by newest (_id desc)
            const sameSubcat  = allProds.filter(p => p.subcategory === topSubcat);
            const sameCat     = allProds.filter(p => p.category === topCategory && p.subcategory !== topSubcat);
            const others      = allProds.filter(p => p.category !== topCategory);
            const featured    = [...sameSubcat, ...sameCat, ...others].slice(0, 12);

            renderProducts("featured-products", featured);

            // Update the section subtitle to explain personalisation
            const subtitle = container.closest("section")?.querySelector("p");
            if (subtitle) {
              const label = topSubcat || topCategory;
              subtitle.innerHTML = `✦ Personalised picks — based on your interest in <strong>${label}</strong>`;
              subtitle.style.cssText = "color:#b5551a; font-size:13px; margin-top:4px;";
            }
            return; // done — skip fallback
          }
        }
      }
    } catch (e) {
      console.error("Featured personalisation error:", e);
    }
  }

  // Fallback: guest or user with no orders → newest 12 products
  loadProducts("featured-products", { sort: "newest", limit: 12 });
}

// Render product cards
const PRODUCTS_PER_PAGE = 18;

// ── Rating star helper ────────────────────────────────────────────────────────
// Converts a numeric average (0–5) into 5 Font Awesome star icons.
function buildStarHTML(average, count) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (average >= i)           stars.push('<i class="fas fa-star"></i>');
    else if (average >= i - 0.5) stars.push('<i class="fas fa-star-half-alt"></i>');
    else                         stars.push('<i class="far fa-star"></i>');
  }
  const label = count > 0 ? `<small style="color:#888;font-size:11px;margin-left:4px;">(${count})</small>` : '';
  return stars.join('') + label;
}

// Fetch bulk ratings for an array of product IDs.
// Returns a map { productId: { average, count } }
async function fetchBulkRatings(productIds) {
  if (!productIds.length) return {};
  try {
    const res = await fetch("http://localhost:5000/api/reviews/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds })
    });
    return res.ok ? await res.json() : {};
  } catch (e) {
    return {};
  }
}

async function renderProducts(containerId, products, page = 1) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Fetch ratings for the products we are about to render
  const productIds  = products.map(p => p._id);
  const ratingsMap  = await fetchBulkRatings(productIds);

  const makeCard = (p) => {
    const imageSrc = getImageSrc(p.images && p.images[0]);
    const ratingInfo = ratingsMap[p._id] || { average: 0, count: 0 };
    const starHTML   = buildStarHTML(ratingInfo.average, ratingInfo.count);
    return `
      <div class="pro" onclick="window.location.href='sproduct.html?productId=${p._id}'">
        <img src="${imageSrc}" alt="${p.title}">
        <div class="des">
          <span>${p.category || ""}</span>
          <h5>${p.title}</h5>
          <div class="star">${starHTML}</div>
          <h4>Rs. ${p.price}</h4>
        </div>
        <a href="#" onclick="event.stopPropagation(); addToCart('${p._id}')">
          <i class="fal fa-shopping-cart cart"></i>
        </a>
      </div>`;
  };

  // Only paginate the shop page
  if (containerId === "shop-products") {
    const start     = (page - 1) * PRODUCTS_PER_PAGE;
    const paginated = products.slice(start, start + PRODUCTS_PER_PAGE);

    container.innerHTML = "";
    paginated.forEach(p => { container.innerHTML += makeCard(p); });

    renderPagination(containerId, products, page);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  // Non-paginated containers (featured, admin, etc.)
  container.innerHTML = "";
  products.forEach(p => { container.innerHTML += makeCard(p); });
}

function renderPagination(containerId, products, currentPage) {
  const ctrl = document.getElementById("pagination-controls");
  if (!ctrl) return;

  const totalPages = Math.ceil(products.length / PRODUCTS_PER_PAGE);

  if (totalPages <= 1) {
    ctrl.innerHTML = "";
    return;
  }

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  let html = "";

  // Prev arrow
  html += `<a href="#" class="${hasPrev ? '' : 'disabled'}"
    onclick="event.preventDefault(); ${hasPrev ? `changePage('${containerId}', ${currentPage - 1})` : ''}">
    <i class="fal fa-long-arrow-alt-left"></i>
  </a>`;

  // Page number buttons — show max 5 around current
  const range = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 || i === totalPages ||
      (i >= currentPage - range && i <= currentPage + range)
    ) {
      html += `<a href="#" class="${i === currentPage ? 'active' : ''}"
        onclick="event.preventDefault(); changePage('${containerId}', ${i})">${i}</a>`;
    } else if (i === currentPage - range - 1 || i === currentPage + range + 1) {
      html += `<span class="page-info">…</span>`;
    }
  }

  // Next arrow
  html += `<a href="#" class="${hasNext ? '' : 'disabled'}"
    onclick="event.preventDefault(); ${hasNext ? `changePage('${containerId}', ${currentPage + 1})` : ''}">
    <i class="fal fa-long-arrow-alt-right"></i>
  </a>`;

  html += `<span class="page-info">Page ${currentPage} of ${totalPages}</span>`;

  ctrl.innerHTML = html;
}

function changePage(containerId, page) {
  // Use the currently filtered product list if filters are active, otherwise allProducts
  const products = (window.filteredProducts && window.filteredProducts.length > 0)
    ? window.filteredProducts
    : allProducts;
  renderProducts(containerId, products, page);
}
window.changePage = changePage;

async function loadAdminProducts() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  const res = await fetch("http://localhost:5000/api/products", {
    headers: { Authorization: `Bearer ${token}` }
  });

  const products = await res.json();
  renderAdminProducts(products);
}

function renderAdminProducts(products) {
  const container = document.querySelector(".products-list");
  if (!container) return;

  container.innerHTML = "";

  products.forEach(p => {
    const imageSrc    = getImageSrc(p.images && p.images[0]);
    const imageForEdit = p.images && p.images[0] ? p.images[0] : '';
    container.innerHTML += `
      <div class="product-card">
        <img src="${imageSrc}" alt="${p.title}">
        <h3>${p.title}</h3>
        <p>Price: Rs. ${p.price}</p>
        <p>Stock: ${p.stock}</p>
        <p>Category: ${p.category || 'N/A'}</p>
        <p>Subcategory: ${p.subcategory || 'N/A'}</p>
        <p>Era: ${p.era || 'N/A'}</p>
        <div class="product-actions">
          <button onclick="editProduct('${p._id}', '${p.title}', ${p.price}, '${imageForEdit}', ${p.stock}, '${p.category || ''}', '${p.subcategory || ''}', '${p.era || ''}', '${(p.description || '').replace(/'/g, "\\'")}')">Edit</button>
          <button onclick="deleteProduct('${p._id}')">Delete</button>
        </div>
      </div>
    `;
  });
}

async function editProduct(id, title, price, image, stock, category, subcategory, era, description) {
  document.getElementById("edit-id").value          = id;
  document.getElementById("edit-name").value        = title;
  document.getElementById("edit-price").value       = price;
  document.getElementById("edit-image").value       = image || '';
  document.getElementById("edit-stock").value       = stock;
  document.getElementById("edit-category").value    = category || "";
  document.getElementById("edit-subcategory").value = subcategory || "";
  document.getElementById("edit-era").value         = era || "";
  document.getElementById("edit-description").value = description || "";
  
  updateSubcategories('edit-category', 'edit-subcategory');

  // ── Show the edit panel, hide the add panel ──
  const addPanel  = document.getElementById("add-product-panel");
  const editPanel = document.getElementById("edit-product-panel");
  if (addPanel)  addPanel.style.display  = "none";
  if (editPanel) editPanel.style.display = "block";

  // Always restore the inner form to visible.
  // cancelEdit() hides it; without this reset the form stays hidden
  // when Edit is clicked a second time on a different product.
  const editFormInner = document.getElementById("edit-product-form");
  if (editFormInner) editFormInner.style.display = "block";

  if (editPanel) editPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Legacy fallbacks (kept for compatibility with admin.html dummy elements)
  const addForm   = document.getElementById("add-product-form");
  const editTitle = document.getElementById("edit-title");
  if (addForm)   addForm.style.display   = "none";
  if (editTitle) editTitle.style.display = "block";
}

// ── cancelEdit: hides edit panel, shows add panel ──
// Called directly by the editForm submit listener (module-local scope).
// Also assigned to window.cancelEdit but that is locked to _ourCancelEdit
// in admin.html — both implementations must be kept in sync.
function cancelEdit() {
  // Toggle the panel cards (admin.html structure)
  const addPanel  = document.getElementById("add-product-panel");
  const editPanel = document.getElementById("edit-product-panel");
  if (addPanel)  addPanel.style.display  = "block";
  if (editPanel) editPanel.style.display = "none";

  // Hide the inner form so it doesn't show when the panel is re-opened
  // (editProduct() will set it back to "block" on the next edit click)
  const editFormEl = document.getElementById("edit-product-form");
  if (editFormEl) editFormEl.style.display = "none";

  // Legacy fallbacks
  const addForm   = document.getElementById("add-product-form");
  const editTitle = document.getElementById("edit-title");
  if (addForm)   addForm.style.display   = "block";
  if (editTitle) editTitle.style.display = "none";
}

async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;

  const token = localStorage.getItem("authToken");
  const response = await fetch(`http://localhost:5000/api/products/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  if (response.ok) { alert("Product deleted"); loadAdminProducts(); }
  else              { alert("Failed to delete product"); }
}

const editForm = document.getElementById("edit-product-form");
if (editForm) {
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token    = localStorage.getItem("authToken");
    const id       = document.getElementById("edit-id").value;
    const isUpload = document.getElementById('edit-image-upload-radio').checked;
    const formData = new FormData();

    formData.append('title',       document.getElementById("edit-name").value);
    formData.append('price',       document.getElementById("edit-price").value);
    formData.append('stock',       document.getElementById("edit-stock").value);
    formData.append('category',    document.getElementById("edit-category").value);
    formData.append('subcategory', document.getElementById("edit-subcategory").value);
    formData.append('era',         document.getElementById("edit-era").value);
    formData.append('description', document.getElementById("edit-description").value);

    if (isUpload) {
      const file = document.getElementById('edit-imagefile').files[0];
      if (file) { formData.append('image', file); } else { alert("Please select a file"); return; }
    } else {
      formData.append('image', document.getElementById("edit-image").value);
    }

    const response = await fetch(`http://localhost:5000/api/products/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    if (response.ok) {
      alert("Product updated");
      // Use cancelEdit() directly — it now correctly toggles both panel cards AND form elements.
      // window.cancelEdit (locked to _ourCancelEdit in admin.html) also works but the local
      // cancelEdit is guaranteed available in this module scope.
      cancelEdit();
      loadAdminProducts();
    } else {
      alert("Failed to update product");
    }
  });
}

async function addToCart(productId) {
  const token = localStorage.getItem("authToken");
  if (!token) { alert("Please login first"); return; }

  await fetch("http://localhost:5000/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ productId })
  });

  alert("Added to cart!");
}

async function removeFromCart(cartId) {
  const token = localStorage.getItem("authToken");
  await fetch(`http://localhost:5000/api/cart/${cartId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  loadCart();
}

async function loadCart() {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  const res = await fetch("http://localhost:5000/api/cart", {
    headers: { Authorization: `Bearer ${token}` }
  });

  const cart = await res.json();
  console.log("Fetched cart:", cart.length, "items");

  const productsRes = await fetch("http://localhost:5000/api/products");
  const products    = await productsRes.json();

  const productMap = {};
  products.forEach(p => productMap[p._id] = p);

  renderCart(cart, productMap);
}

// Stores price/qty data keyed by cart item _id so updateSelectionSummary can recalc without re-fetching
const _cartItemMeta = {};

function renderCart(cart, productMap) {
  const container    = document.getElementById("cart-list");
  const summaryPanel = document.getElementById("cart-summary-panel");
  const countLabel   = document.getElementById("cart-count-label");
  if (!container) return;

  container.innerHTML = "";
  // Reset meta cache
  Object.keys(_cartItemMeta).forEach(k => delete _cartItemMeta[k]);

  let total     = 0;
  let itemCount = 0;

  // Split into regular items and auction-won items
  const regularItems = cart.filter(item => !item.isAuctionWin);
  const auctionItems = cart.filter(item =>  item.isAuctionWin);

  if (cart.length === 0) {
    if (summaryPanel) summaryPanel.style.display = "none";
    if (countLabel)   countLabel.textContent = "Your cart is empty";
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <h3>Your cart is empty</h3>
        <p>Looks like you haven't added anything yet.</p>
        <a href="shop.html">Browse Products</a>
      </div>`;
    return;
  }

  // ── Auction-won items ────────────────────────────────────────────────────────
  if (auctionItems.length > 0) {
    container.innerHTML += `
      <div class="cart-section-label">
        <i class="fas fa-gavel"></i> Auction Wins
      </div>`;

    auctionItems.forEach(item => {
      const price = item.auctionPrice || 0;
      total      += price;
      itemCount  += 1;
      _cartItemMeta[item._id] = { price, qty: 1 };

      const imgSrc = item.auctionImage || "images/ceramicvase.jpg";

      container.innerHTML += `
        <div class="cart-item cart-item--auction" id="cart-item-${item._id}">
          <img src="${imgSrc}" alt="${item.auctionTitle || 'Auction item'}" class="cart-item-img"
               onerror="this.src='images/ceramicvase.jpg'">
          <div class="cart-item-details">
            <div class="cart-item-cat auction-win-badge">
              <i class="fas fa-gavel"></i> Won at Auction
            </div>
            <h4>${item.auctionTitle || 'Auction Item'}</h4>
            <div class="cart-item-unit-price">
              Final bid: <strong>Rs. ${Number(price).toLocaleString()}</strong>
            </div>
            <div class="cart-item-price-line">
              <span class="auction-qty-note">Qty: 1 (fixed)</span>
              <span class="cart-item-subtotal">Rs. ${Number(price).toLocaleString()}</span>
              <button class="checkout-item-btn" onclick="checkoutItem('${item._id}')">
                <i class="fas fa-bolt"></i> Buy Now
              </button>
            </div>
          </div>
          <div class="cart-item-actions">
            <label class="cart-item-select" title="Select for checkout">
              <input type="checkbox" class="cart-select-cb" data-id="${item._id}"
                     onchange="updateSelectionSummary()">
              <span class="cart-select-mark"></span>
            </label>
            <button class="remove-btn" onclick="removeFromCart('${item._id}')">Remove</button>
          </div>
        </div>`;
    });
  }

  // ── Regular product items ────────────────────────────────────────────────────
  if (regularItems.length > 0) {
    if (auctionItems.length > 0) {
      container.innerHTML += `
        <div class="cart-section-label">
          <i class="fas fa-shopping-bag"></i> Shop Items
        </div>`;
    }

    regularItems.forEach(item => {
      const product = productMap[item.productId];
      if (!product) return;

      const qty       = item.qty || 1;
      const itemTotal = product.price * qty;
      total      += itemTotal;
      itemCount  += qty;
      _cartItemMeta[item._id] = { price: product.price, qty };

      const imageSrc = getImageSrc(product.images && product.images[0]);

      container.innerHTML += `
        <div class="cart-item" id="cart-item-${item._id}">
          <img src="${imageSrc}" alt="${product.title}" class="cart-item-img"
               onerror="this.style.background='#f0f5f0'; this.style.display='flex'">
          <div class="cart-item-details">
            <div class="cart-item-cat">${product.category || "Art"}</div>
            <h4>${product.title}</h4>
            <div class="cart-item-unit-price">Rs. ${Number(product.price).toLocaleString()} each</div>
            <div class="cart-item-price-line">
              <div class="cart-qty-control">
                <button class="qty-btn" onclick="updateQty('${item._id}', ${qty - 1}, '${item.productId}')">−</button>
                <span class="qty-val">${qty}</span>
                <button class="qty-btn" onclick="updateQty('${item._id}', ${qty + 1}, '${item.productId}')">+</button>
              </div>
              <span class="cart-item-subtotal">Rs. ${Number(itemTotal).toLocaleString()}</span>
              <button class="checkout-item-btn" onclick="checkoutItem('${item._id}')">
                <i class="fas fa-bolt"></i> Buy Now
              </button>
            </div>
          </div>
          <div class="cart-item-actions">
            <label class="cart-item-select" title="Select for checkout">
              <input type="checkbox" class="cart-select-cb" data-id="${item._id}"
                     onchange="updateSelectionSummary()">
              <span class="cart-select-mark"></span>
            </label>
            <button class="remove-btn" onclick="removeFromCart('${item._id}')">Remove</button>
          </div>
        </div>`;
    });
  }

  // Update summary panel (full total — selection recalc happens on checkbox change)
  if (summaryPanel) {
    summaryPanel.style.display = "block";
    window._cartRawSubtotal = total; // store raw number for promo discount calc
    document.getElementById("summary-subtotal").textContent = `Rs. ${Number(total).toLocaleString()}`;
    // Re-apply promo discount if one is active (replaces summary-total)
    _applyActivePromo();
  }
  if (countLabel) {
    countLabel.textContent = `${itemCount} item${itemCount !== 1 ? "s" : ""} in your bag`;
  }

  // Ensure the checkout-selected button exists in the summary panel
  _ensureCheckoutSelectedBtn();
}

/* Inject "Checkout Selected" button into summary panel once */
function _ensureCheckoutSelectedBtn() {
  const panel = document.getElementById("cart-summary-panel");
  if (!panel || panel.querySelector("#checkout-selected-btn")) return;
  const checkoutAllBtn = panel.querySelector(".checkout-all-btn");
  if (!checkoutAllBtn) return;

  const selBtn = document.createElement("button");
  selBtn.id        = "checkout-selected-btn";
  selBtn.className = "checkout-selected-btn";
  selBtn.innerHTML = `<i class="fas fa-check-square"></i> Checkout Selected (<span id="sel-count">0</span>)`;
  selBtn.onclick   = checkoutSelected;
  selBtn.style.display = "none";
  // Insert right below the main checkout button
  checkoutAllBtn.insertAdjacentElement("afterend", selBtn);
}

/* Recalculate summary when checkboxes change */
function updateSelectionSummary() {
  const checkboxes = document.querySelectorAll(".cart-select-cb");
  const checked    = [...checkboxes].filter(cb => cb.checked);

  const selBtn   = document.getElementById("checkout-selected-btn");
  const selCount = document.getElementById("sel-count");

  if (checked.length === 0) {
    // Nothing selected — revert to full-cart totals
    let total = 0;
    checkboxes.forEach(cb => {
      const meta = _cartItemMeta[cb.dataset.id];
      if (meta) total += meta.price * meta.qty;
    });
    window._cartRawSubtotal = total;
    document.getElementById("summary-subtotal").textContent = `Rs. ${Number(total).toLocaleString()}`;
    _applyActivePromo();
    if (selBtn)   selBtn.style.display   = "none";
    return;
  }

  // Calculate selected-only total
  let selTotal = 0;
  checked.forEach(cb => {
    const meta = _cartItemMeta[cb.dataset.id];
    if (meta) selTotal += meta.price * meta.qty;
  });

  window._cartRawSubtotal = selTotal;
  document.getElementById("summary-subtotal").textContent = `Rs. ${Number(selTotal).toLocaleString()}`;
  _applyActivePromo();

  if (selBtn) {
    selBtn.style.display = "flex";
    if (selCount) selCount.textContent = checked.length;
  }
}

function checkoutSelected() {
  const checked = [...document.querySelectorAll(".cart-select-cb:checked")];
  if (checked.length === 0) { alert("Please select at least one item."); return; }
  const ids = checked.map(cb => cb.dataset.id).join(",");
  window.location.href = `checkout.html?items=${ids}`;
}

function checkoutItem(cartId) { window.location.href = `checkout.html?items=${cartId}`; }
function checkoutAll() {
  const checked = [...document.querySelectorAll(".cart-select-cb:checked")];
  if (checked.length > 0) {
    const ids = checked.map(cb => cb.dataset.id).join(",");
    window.location.href = `checkout.html?items=${ids}`;
  } else {
    window.location.href = "checkout.html";
  }
}

async function viewProductDetails(productId) {
  const token     = localStorage.getItem("authToken");
  const res       = await fetch(`http://localhost:5000/api/products/${productId}`, { headers: { Authorization: `Bearer ${token}` } });
  const product   = await res.json();
  const sellerRes = await fetch(`http://localhost:5000/api/users/${product.sellerId}`, { headers: { Authorization: `Bearer ${token}` } });
  const seller    = await sellerRes.json();

  const modal    = document.getElementById('product-modal');
  const content  = document.getElementById('product-detail-content');
  const imageSrc = getImageSrc(product.images && product.images[0]);

  content.innerHTML = `
    <img src="${imageSrc}" alt="${product.title}" style="width: 100%; max-height: 300px; object-fit: cover;">
    <h2>${product.title}</h2>
    <p><strong>Price:</strong> Rs. ${product.price}</p>
    <p><strong>Stock:</strong> ${product.stock}</p>
    <p><strong>Category:</strong> ${product.category || 'N/A'}</p>
    <p><strong>Subcategory:</strong> ${product.subcategory || 'N/A'}</p>
    <p><strong>Era:</strong> ${product.era || 'N/A'}</p>
    <p><strong>Seller:</strong> ${seller.displayName} (${seller.email})</p>
    <p><strong>Description:</strong> ${product.description || 'No description'}</p>
    <button onclick="addToCart('${product._id}'); closeProductModal();">Buy Now</button>
  `;
  modal.style.display = 'flex';
}

function closeProductModal() {
  document.getElementById('product-modal').style.display = 'none';
}

document.addEventListener("DOMContentLoaded", loadCart);


// ===== FILTER FUNCTIONALITY FOR SHOP PAGE =====
let activeFilters = {
  priceMin: 0,
  priceMax: 100000,
  categories: [],
  subcategories: [],
  eras: []
};

function initializeFilters() {
  const priceMinSlider  = document.getElementById('price-min');
  const priceMaxSlider  = document.getElementById('price-max');
  const priceMinDisplay = document.getElementById('price-min-display');
  const priceMaxDisplay = document.getElementById('price-max-display');

  if (priceMinSlider && priceMaxSlider) {
    priceMinSlider.addEventListener('input', (e) => {
      const minVal = parseInt(e.target.value);
      const maxVal = parseInt(priceMaxSlider.value);
      if (minVal <= maxVal) {
        activeFilters.priceMin    = minVal;
        priceMinDisplay.textContent = minVal;
        applyFilters();
      }
    });

    priceMaxSlider.addEventListener('input', (e) => {
      const maxVal = parseInt(e.target.value);
      const minVal = parseInt(priceMinSlider.value);
      if (maxVal >= minVal) {
        activeFilters.priceMax    = maxVal;
        priceMaxDisplay.textContent = maxVal;
        applyFilters();
      }
    });
  }

  const mainCategoryCheckboxes = document.querySelectorAll('.main-category');
  mainCategoryCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const category      = e.target.value;
      const subcategoryDiv = document.getElementById(`subcategory-${e.target.id.replace('type-', '')}`);
      
      if (e.target.checked) {
        activeFilters.categories.push(category);
        if (subcategoryDiv) subcategoryDiv.style.display = 'block';
      } else {
        activeFilters.categories = activeFilters.categories.filter(c => c !== category);
        if (subcategoryDiv) {
          subcategoryDiv.querySelectorAll('.subcategory-filter').forEach(sub => {
            if (sub.checked) {
              sub.checked = false;
              activeFilters.subcategories = activeFilters.subcategories.filter(s => s !== sub.value);
            }
          });
          subcategoryDiv.style.display = 'none';
        }
      }
      applyFilters();
    });
  });

  document.querySelectorAll('.subcategory-filter').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const subcategory = e.target.value;
      if (e.target.checked) activeFilters.subcategories.push(subcategory);
      else                  activeFilters.subcategories = activeFilters.subcategories.filter(s => s !== subcategory);
      applyFilters();
    });
  });

  document.querySelectorAll('.era-filter').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const era = e.target.value;
      if (e.target.checked) activeFilters.eras.push(era);
      else                  activeFilters.eras = activeFilters.eras.filter(e => e !== era);
      applyFilters();
    });
  });
}

function applyFilters() {
  let filtered = allProducts;

  filtered = filtered.filter(p => p.price >= activeFilters.priceMin && p.price <= activeFilters.priceMax);

  if (activeFilters.categories.length > 0) {
    if (activeFilters.subcategories.length > 0) {
      filtered = filtered.filter(p => activeFilters.subcategories.includes(p.subcategory));
    } else {
      filtered = filtered.filter(p => activeFilters.categories.includes(p.category));
    }
  }

  if (activeFilters.eras.length > 0) {
    filtered = filtered.filter(p => activeFilters.eras.includes(p.era));
  }

  window.filteredProducts = filtered;
  renderProducts("shop-products", filtered, 1);
  updateActiveFiltersDisplay();
}

function updateActiveFiltersDisplay() {
  const container  = document.getElementById('active-filters-container');
  const filtersList = document.getElementById('active-filters-list');
  if (!container) return;

  const filters = [];
  if (activeFilters.priceMin !== 0 || activeFilters.priceMax !== 100000) {
    filters.push(`Price: Rs. ${activeFilters.priceMin} - ${activeFilters.priceMax}`);
  }
  if (activeFilters.subcategories.length > 0) {
    activeFilters.subcategories.forEach(sub => filters.push(sub));
  } else if (activeFilters.categories.length > 0) {
    activeFilters.categories.forEach(cat => filters.push(cat));
  }
  if (activeFilters.eras.length > 0) {
    activeFilters.eras.forEach(era => filters.push(era));
  }

  if (filters.length > 0) {
    container.style.display = 'block';
    filtersList.innerHTML   = filters.map(f => `<span class="filter-tag">${f}</span>`).join('');
  } else {
    container.style.display = 'none';
  }
}

function clearAllFilters() {
  activeFilters = { priceMin: 0, priceMax: 100000, categories: [], subcategories: [], eras: [] };

  const priceMinSlider  = document.getElementById('price-min');
  const priceMaxSlider  = document.getElementById('price-max');
  const priceMinDisplay = document.getElementById('price-min-display');
  const priceMaxDisplay = document.getElementById('price-max-display');

  if (priceMinSlider) { priceMinSlider.value = 0;       if (priceMinDisplay) priceMinDisplay.textContent = '0'; }
  if (priceMaxSlider) { priceMaxSlider.value = 100000;  if (priceMaxDisplay) priceMaxDisplay.textContent = '100000'; }

  document.querySelectorAll('.main-category, .subcategory-filter, .era-filter').forEach(cb => cb.checked = false);
  document.querySelectorAll('[id^="subcategory-"]').forEach(div => div.style.display = 'none');

  window.filteredProducts = [];
  renderProducts("shop-products", allProducts, 1);
  updateActiveFiltersDisplay();
}

window.clearAllFilters = clearAllFilters;

document.addEventListener("DOMContentLoaded", loadCart);

// ── Page-specific product loading ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("shop-products")) {
    // New Arrivals — always newest first, capped at 16 on main page
    const isMainPage = !document.getElementById("pagination-controls");
    loadProducts("shop-products", { sort: "newest", ...(isMainPage && { limit: 16 }) });
  }
  if (document.getElementById("featured-products")) {
    // Featured — personalised for logged-in users, newest fallback for guests
    loadFeaturedProducts();
  }
  if (document.querySelector(".products-list")) {
    loadAdminProducts();
  }
});

async function updateQty(cartId, newQty, productId) {
  if (newQty < 1) { removeFromCart(cartId); return; }

  const token = localStorage.getItem("authToken");
  await fetch(`http://localhost:5000/api/cart/${cartId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ qty: newQty })
  });
  loadCart();
}

const PROMO_CODES = { "ARTLOVE10": 0.10, "SAVE50": 0.50, "FESTIVE20": 0.20 };

// Reapplies the currently stored promo (if any) to window._cartRawSubtotal.
// Called after every subtotal change (checkbox, qty update, full-cart revert).
function _applyActivePromo() {
  const totalEl      = document.getElementById("summary-total");
  const discountEl   = document.getElementById("summary-discount");
  const discountLine = document.getElementById("discount-line");
  if (!totalEl) return;

  const raw            = window._cartRawSubtotal || 0;
  const activeDiscount = parseFloat(localStorage.getItem("promoDiscount") || "0");
  const discountAmt    = Math.round(raw * activeDiscount);
  const finalTotal     = raw - discountAmt;

  if (activeDiscount > 0 && discountLine) {
    discountLine.style.display = "flex";
    if (discountEl) discountEl.textContent = `-Rs. ${discountAmt.toLocaleString()}`;
  } else if (discountLine) {
    discountLine.style.display = "none";
  }
  totalEl.textContent = `Rs. ${finalTotal.toLocaleString()}`;
}

function applyPromo() {
  const code = document.getElementById("promo-input")?.value.trim().toUpperCase();
  const msg  = document.getElementById("promo-msg");
  if (!msg) return;

  const discount = PROMO_CODES[code];
  if (discount) {
    msg.textContent = `✓ Promo "${code}" applied — ${discount * 100}% off!`;
    msg.style.color = "#088178";
    localStorage.setItem("promoCode",     code);
    localStorage.setItem("promoDiscount", String(discount));
  } else {
    msg.textContent = "Invalid promo code.";
    msg.style.color = "#c0392b";
    localStorage.removeItem("promoCode");
    localStorage.removeItem("promoDiscount");
  }
  msg.style.display = "block";

  // Re-apply (or clear) the discount on whatever subtotal is currently active
  // (selected items or full cart — _cartRawSubtotal is always kept up to date).
  _applyActivePromo();
}

window.updateQty   = updateQty;
window.applyPromo  = applyPromo;

// Expose functions to global scope
window.addProduct              = addProduct;
window.editProduct             = editProduct;
window.cancelEdit              = cancelEdit;
window.deleteProduct           = deleteProduct;
window.loadProducts            = loadProducts;
window.loadFeaturedProducts    = loadFeaturedProducts;
window.addToCart               = addToCart;
window.checkoutItem            = checkoutItem;
window.checkoutAll             = checkoutAll;
window.checkoutSelected        = checkoutSelected;
window.updateSelectionSummary  = updateSelectionSummary;
window.removeFromCart          = removeFromCart;
window.viewProductDetails      = viewProductDetails;
window.closeProductModal       = closeProductModal;
window.updateSubcategories     = updateSubcategories;
// Rating helpers — used by sproduct.html
window.buildStarHTML           = buildStarHTML;
window.fetchBulkRatings        = fetchBulkRatings;