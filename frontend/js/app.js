class PharmacyApp {
    constructor() {
        this.token = localStorage.getItem('token');
        this.username = localStorage.getItem('username');
        this.cart = [];
        this.medicines = [];
        this.purchaseConfirmed = false;

        this.init();
    }

    init() {
        this.bindEvents();
        if (this.token) {
            this.showDashboard();
            this.loadMedicines();
        } else {
            this.showLogin();
        }
    }

    bindEvents() {
        // Login
        document.getElementById('login-btn').addEventListener('click', () => this.login());

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchSection(e.target.dataset.section));
        });

        // Admin tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchAdminTab(e.target.dataset.tab));
        });

        // Add medicine
        document.getElementById('add-medicine-btn').addEventListener('click', () => this.addMedicine());

        // Add stock
        document.getElementById('add-stock-btn').addEventListener('click', () => this.addStock());

        // Checkout
        document.getElementById('checkout-btn').addEventListener('click', () => this.showCheckoutForm());
        document.getElementById('confirm-checkout-btn').addEventListener('click', () => this.confirmCheckout());
        document.getElementById('cancel-checkout-btn').addEventListener('click', () => this.cancelCheckout());

        // Receipt modal close
        document.querySelector('.close').addEventListener('click', () => this.closeReceiptModal());
    }

    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.username = data.username;
                localStorage.setItem('token', this.token);
                localStorage.setItem('username', this.username);
                this.showDashboard();
                this.loadMedicines();
            } else {
                this.showError('login-error', data.error);
            }
        } catch (error) {
            this.showError('login-error', 'Login failed');
        }
    }

    logout() {
        this.token = null;
        this.username = null;
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        this.cart = [];
        this.purchaseConfirmed = false;
        this.showLogin();
    }

    showLogin() {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
    }

    showDashboard() {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        document.getElementById('logout-btn').textContent = `Logout (${this.username})`;
    }

    switchSection(section) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden'));
        document.getElementById(`${section}-section`).classList.remove('hidden');

        if (section === 'cart') this.loadCart();
        if (section === 'reports') {
            this.loadDailyReport();
            // Ensure button is disabled if not confirmed
            const generateBtn = document.getElementById('generate-report-btn');
            if (generateBtn) {
                generateBtn.disabled = !this.purchaseConfirmed;
            }
        }
        if (section === 'admin') this.loadAdminData();
    }

    switchAdminTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

        document.querySelectorAll('.admin-form').forEach(form => form.classList.add('hidden'));
        document.getElementById(`${tab}-form`).classList.remove('hidden');
    }

    async loadMedicines() {
        try {
            const response = await fetch('/api/v1/medicines', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.medicines = await response.json();
                this.renderMedicines();
            } else {
                this.showError('medicines-list', 'Failed to load medicines');
            }
        } catch (error) {
            this.showError('medicines-list', 'Failed to load medicines');
        }
    }

    renderMedicines() {
        const container = document.getElementById('medicines-list');
        container.innerHTML = '';

        this.medicines.forEach(medicine => {
            const item = document.createElement('div');
            item.className = 'medicine-item';
            item.innerHTML = `
                <h3>${medicine.medicine}</h3>
                <p>Stock: ${medicine.stock} strips (${medicine.tablets_in_a_strip} tablets/strip)</p>
                <p>Price: ₹${medicine.price_per_strip}/strip</p>
                <input type="number" min="1" max="${medicine.stock * medicine.tablets_in_a_strip - (medicine.tablets_used_in_current_strip || 0)}" placeholder="Quantity" class="quantity-input">
                <button class="add-to-cart-btn" data-medicine="${medicine.medicine}">Add to Cart</button>
            `;
            container.appendChild(item);
        });

        // Bind add to cart events
        document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const medicine = e.target.dataset.medicine;
                const quantity = parseInt(e.target.previousElementSibling.value);
                if (quantity > 0) {
                    this.addToCart(medicine, quantity);
                }
            });
        });
    }

    async addToCart(medicine, quantity) {
        try {
            const response = await fetch('/api/v1/cart/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ medicine, quantity })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Added to cart successfully');
                this.loadCart();
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('Failed to add to cart');
        }
    }

    async loadCart() {
        try {
            const response = await fetch('/api/v1/cart', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.cart = await response.json();
                this.renderCart();
            }
        } catch (error) {
            console.error('Failed to load cart');
        }
    }

    renderCart() {
        const container = document.getElementById('cart-items');
        container.innerHTML = '';

        if (this.cart.length === 0) {
            container.innerHTML = '<p>Cart is empty</p>';
            return;
        }

        this.cart.forEach((item, index) => {
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <span>${item.medicine} - ${item.quantity} tablets</span>
                <button class="remove-btn" data-index="${index}">Remove</button>
            `;
            container.appendChild(cartItem);
        });

        // Bind remove events
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.removeFromCart(index);
            });
        });
    }

    async removeFromCart(index) {
        try {
            const response = await fetch(`/api/v1/cart/${index}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                this.loadCart();
            }
        } catch (error) {
            console.error('Failed to remove item');
        }
    }

    checkout() {
        // This method is no longer used, replaced by showCheckoutForm
    }

    showCheckoutForm() {
        if (this.cart.length === 0) {
            alert('Cart is empty');
            return;
        }
        document.getElementById('checkout-btn').classList.add('hidden');
        document.getElementById('checkout-form').classList.remove('hidden');
    }

    cancelCheckout() {
        document.getElementById('checkout-btn').classList.remove('hidden');
        document.getElementById('checkout-form').classList.add('hidden');
        document.getElementById('customer-name').value = '';
    }

    async confirmCheckout() {
        const customerName = document.getElementById('customer-name').value.trim();
        if (!customerName) {
            alert('Please enter customer name');
            return;
        }

        try {
            const response = await fetch('/api/v1/cart/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ customerName })
            });

            const data = await response.json();

            if (response.ok) {
                this.cart = [];
                this.renderCart();
                this.purchaseConfirmed = true;
                // Update button state if reports section is active
                const generateBtn = document.getElementById('generate-report-btn');
                if (generateBtn && !document.getElementById('reports-section').classList.contains('hidden')) {
                    generateBtn.disabled = false;
                }
                this.showReceipt(data.receipt);
                this.loadMedicines(); // Refresh stock
                this.cancelCheckout(); // Hide the form
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('Checkout failed');
        }
    }

    showReceipt(receipt) {
        const modal = document.getElementById('receipt-modal');
        const content = document.getElementById('receipt-content');

        content.innerHTML = `
            <h3>Purchase Receipt</h3>
            <div class="receipt-items">
                ${receipt.purchases.map(item => `
                    <div class="receipt-item">
                        <span>${item.medicine}</span>
                        <span>${item.quantity} tablets @ ₹${item.pricePerTablet.toFixed(2)}</span>
                        <span>₹${item.total.toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="receipt-total">
                <p>Subtotal: ₹${receipt.grandTotal.toFixed(2)}</p>
                ${receipt.discountPercent > 0 ? `<p>Discount (${receipt.discountPercent}%): -₹${receipt.discountAmount.toFixed(2)}</p>` : ''}
                <p><strong>Total: ₹${receipt.discountedTotal.toFixed(2)}</strong></p>
            </div>
        `;

        modal.classList.remove('hidden');
    }

    closeReceiptModal() {
        document.getElementById('receipt-modal').classList.add('hidden');
    }

    async addMedicine() {
        const name = document.getElementById('new-medicine-name').value;
        const quantity = document.getElementById('new-medicine-quantity').value;
        const price = document.getElementById('new-medicine-price').value;
        const tablets = document.getElementById('new-medicine-tablets').value;

        try {
            const response = await fetch('/api/v1/medicines', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    medicine: name,
                    quantity: parseInt(quantity),
                    price_per_strip: parseFloat(price),
                    tablets_in_a_strip: parseInt(tablets)
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Medicine added successfully');
                document.getElementById('add-medicine-form').reset();
                this.loadMedicines();
                this.loadAdminData();
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('Failed to add medicine');
        }
    }

    async loadAdminData() {
        // Load medicines for stock addition
        const select = document.getElementById('stock-medicine-select');
        select.innerHTML = '<option value="">Select Medicine</option>';
        this.medicines.forEach(medicine => {
            const option = document.createElement('option');
            option.value = medicine.medicine;
            option.textContent = medicine.medicine;
            select.appendChild(option);
        });
    }

    async addStock() {
        const medicine = document.getElementById('stock-medicine-select').value;
        const quantity = document.getElementById('stock-quantity').value;

        if (!medicine) {
            alert('Please select a medicine');
            return;
        }

        try {
            const response = await fetch(`/api/v1/medicines/${encodeURIComponent(medicine)}/stock`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ quantity: parseInt(quantity) })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Stock updated successfully');
                document.getElementById('add-stock-form').reset();
                this.loadMedicines();
            } else {
                alert(data.error);
            }
        } catch (error) {
            alert('Failed to update stock');
        }
    }

    async loadDailyReport() {
        try {
            const response = await fetch('/api/v1/reports/daily', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderDailyReport(data);
            }
        } catch (error) {
            console.error('Failed to load daily report');
        }
    }

    renderDailyReport(data) {
        const container = document.getElementById('daily-report');
        container.innerHTML = `
            <h3>Daily Collection - ${data.date}</h3>
            <p>Total Before Discount: ₹${data.totalBeforeDiscount.toFixed(2)}</p>
            <p>Total After Discount: ₹${data.totalAfterDiscount.toFixed(2)}</p>
        `;

        // Update generate report button state
        const generateBtn = document.getElementById('generate-report-btn');
        generateBtn.disabled = !this.purchaseConfirmed;
        generateBtn.addEventListener('click', () => this.loadDailyReport());
    }

    showError(elementId, message) {
        const element = document.getElementById(elementId);
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 3000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PharmacyApp();
});
