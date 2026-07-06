/* app.js */

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyB5GHHomIJc2JLzKyfnUntxL_brSiU9gVU",
  authDomain: "pipe-y-luu-finanzas.firebaseapp.com",
  projectId: "pipe-y-luu-finanzas",
  storageBucket: "pipe-y-luu-finanzas.firebasestorage.app",
  messagingSenderId: "1008646227450",
  appId: "1:1008646227450:web:070091ff8b542d3a621043"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Estado Global
let appData = {
    transactions: [],
    debts: [],
    projects: [],
    categories: ['hogar', 'comida', 'gatos', 'transporte', 'ocio', 'salud', 'otros'],
    currentMonth: new Date().toISOString().slice(0, 7) // YYYY-MM
};

let currentSplit = '5050';
let isConnected = false;

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    loadInitialData();
    setupForms();
    renderCategoriesConfig();
    
    // Set dates to today
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => { if(!input.value) input.value = today; });
});

function setupNavigation() {
    document.querySelectorAll('nav button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
            
            const target = e.target.getAttribute('data-target');
            document.getElementById(target).classList.add('active');
            e.target.classList.add('active');
            
            if(target === 'dashboard') updateDashboard();
        });
    });
}

// --- CARGA DE DATOS (FIREBASE + LOCAL FALLBACK) ---
async function loadInitialData() {
    showLoading(true);
    
    // Intentar cargar de Firebase con timeout
    try {
        const snapshot = await Promise.race([
            db.collection('data').doc('main').get(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);

        if (snapshot.exists) {
            appData = snapshot.data();
            // Asegurar que existan las categorías si es data vieja
            if(!appData.categories) appData.categories = ['hogar', 'comida', 'gatos', 'transporte', 'ocio', 'salud', 'otros'];
            isConnected = true;
            updateStatus(true);
            console.log("Datos cargados de la nube");
        } else {
            throw new Error("No hay datos en la nube");
        }
    } catch (error) {
        console.warn("Usando modo local o fallback:", error);
        const localData = localStorage.getItem('pipeLuuFinanzas');
        if (localData) {
            appData = JSON.parse(localData);
            if(!appData.categories) appData.categories = ['hogar', 'comida', 'gatos', 'transporte', 'ocio', 'salud', 'otros'];
        }
        isConnected = false;
        updateStatus(false);
        showNotification("Modo offline activado. Los cambios se guardarán localmente.", "warning");
    }

    showLoading(false);
    updateDashboard();
    renderTransactions();
    renderDebts();
    renderProjects();
}

async function saveDataToCloud() {
    // Guardar siempre en local primero
    localStorage.setItem('pipeLuuFinanzas', JSON.stringify(appData));
    
    // Intentar guardar en nube si hay conexión
    if (isConnected) {
        try {
            await db.collection('data').doc('main').set(appData);
        } catch (e) {
            console.error("Error guardando en nube:", e);
            isConnected = false;
            updateStatus(false);
            showNotification("Error de sincronización. Guardado solo localmente.", "error");
        }
    }
    updateDashboard();
}

function updateStatus(online) {
    const el = document.getElementById('connectionStatus');
    if(online) {
        el.textContent = "☁️ Nube";
        el.className = "status-indicator status-ok";
    } else {
        el.textContent = "💾 Local";
        el.className = "status-indicator status-offline";
    }
}

// --- DASHBOARD & LÓGICA DE NEGOCIO ---
function updateDashboard() {
    const [year, month] = appData.currentMonth.split('-');
    
    // Filtrar transacciones del mes seleccionado
    const monthTransactions = appData.transactions.filter(t => t.date.startsWith(appData.currentMonth));
    
    let pipeIncome = 0, luuIncome = 0;
    let pipeExpense = 0, luuExpense = 0;
    let totalDebtPayment = 0;

    monthTransactions.forEach(t => {
        const amount = t.amount;
        if (t.type === 'ingreso') {
            if (t.payer === 'pipe') pipeIncome += amount;
            else if (t.payer === 'luu') luuIncome += amount;
        } else {
            // Gastos
            const pipeShare = (t.split.pipe / 100) * amount;
            const luuShare = (t.split.luu / 100) * amount;
            
            pipeExpense += pipeShare;
            luuExpense += luuShare;
        }
    });

    // Calcular cuotas de créditos de este mes
    appData.debts.forEach(d => {
        const paymentDate = new Date(d.startDate);
        // Simular meses hasta llegar al mes actual o futuro
        let currentDate = new Date(paymentDate);
        let monthsPassed = 0;
        
        while(currentDate < new Date(year, month, 1)) {
            currentDate.setMonth(currentDate.getMonth() + 1);
            monthsPassed++;
        }
        
        // Si la fecha de pago cae en este mes (aproximación simple)
        // En una implementación real se compara el día exacto
        if (monthsPassed >= 0 && monthsPassed < d.months) {
             totalDebtPayment += d.fixedPayment;
        }
    });

    // Render Stats
    document.getElementById('dash-pipe-income').textContent = `$ ${pipeIncome.toLocaleString()}`;
    document.getElementById('dash-luu-income').textContent = `$ ${luuIncome.toLocaleString()}`;
    document.getElementById('dash-pipe-expense').textContent = `$ ${pipeExpense.toLocaleString()}`;
    document.getElementById('dash-luu-expense').textContent = `$ ${luuExpense.toLocaleString()}`;
    document.getElementById('dash-debt-month').textContent = `$ ${totalDebtPayment.toLocaleString()}`;
    
    const balance = (pipeIncome + luuIncome) - (pipeExpense + luuExpense + totalDebtPayment);
    document.getElementById('dash-balance').textContent = `$ ${balance.toLocaleString()}`;
    document.getElementById('month-display').textContent = getAppMonthName(appData.currentMonth);

    // Calcular deuda entre ellos (Acumulado histórico, no solo mes)
    calculateNetBalance();
}

function calculateNetBalance() {
    let pipeNet = 0;
    appData.transactions.forEach(t => {
        if(t.type === 'gasto') {
            const luuPart = (t.split.luu / 100) * t.amount;
            if(t.payer === 'pipe') pipeNet += luuPart;
            else if(t.payer === 'luu') pipeNet -= ((t.split.pipe/100) * t.amount);
        }
    });

    const elDebt = document.getElementById('dash-settlement-info');
    if (Math.abs(pipeNet) < 100) {
        elDebt.innerHTML = "✅ Están a paz y salvo";
        document.getElementById('btn-settle').style.display = 'none';
    } else {
        const debtor = pipeNet > 0 ? "Luu" : "Pipe";
        const creditor = pipeNet > 0 ? "Pipe" : "Luu";
        elDebt.innerHTML = `${debtor} le debe $${Math.round(Math.abs(pipeNet)).toLocaleString()} a ${creditor}`;
        document.getElementById('btn-settle').style.display = 'inline-block';
        document.getElementById('settle-amount').value = Math.round(Math.abs(pipeNet));
        document.getElementById('settle-from').value = debtor.toLowerCase();
        document.getElementById('settle-to').value = creditor.toLowerCase();
    }
}

function getAppMonthName(monthStr) {
    const [y, m] = monthStr.split('-');
    const date = new Date(y, m-1, 1);
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

function changeMonth(offset) {
    const [y, m] = appData.currentMonth.split('-');
    let date = new Date(parseInt(y), parseInt(m)-1 + offset, 1);
    appData.currentMonth = date.toISOString().slice(0, 7);
    updateDashboard();
    renderTransactions(); // Re-render para filtrar por mes
}

// --- TRANSACCIONES ---
function setSplit(type) {
    currentSplit = type;
    document.querySelectorAll('.split-btn').forEach(b => b.classList.remove('selected'));
    event.target.classList.add('selected');
    
    const customDiv = document.getElementById('custom-split-inputs');
    if (type === 'custom') customDiv.style.display = 'flex';
    else {
        customDiv.style.display = 'none';
        if(type === '5050') { document.getElementById('split-pipe').value = 50; document.getElementById('split-luu').value = 50; }
        if(type === '1000') { document.getElementById('split-pipe').value = 100; document.getElementById('split-luu').value = 0; }
        if(type === '0100') { document.getElementById('split-pipe').value = 0; document.getElementById('split-luu').value = 100; }
    }
}

function addTransaction(e) {
    e.preventDefault();
    const type = document.getElementById('t-type').value;
    
    let split = { pipe: 50, luu: 50 };
    if (type === 'gasto') {
        if (currentSplit === 'custom') {
            split.pipe = parseFloat(document.getElementById('split-pipe').value) || 0;
            split.luu = 100 - split.pipe;
        } else if (currentSplit === '1000') split = { pipe: 100, luu: 0 };
        else if (currentSplit === '0100') split = { pipe: 0, luu: 100 };
    }

    const transaction = {
        id: Date.now(),
        date: document.getElementById('t-date').value,
        type: type,
        desc: document.getElementById('t-desc').value,
        amount: parseFloat(document.getElementById('t-amount').value),
        payer: document.getElementById('t-payer').value,
        category: document.getElementById('t-category').value,
        split: split
    };

    appData.transactions.unshift(transaction);
    saveDataToCloud();
    renderTransactions();
    document.getElementById('form-transaccion').reset();
    setSplit('5050');
    showNotification("Movimiento guardado");
}

function renderTransactions() {
    const tbody = document.querySelector('#transactions-table tbody');
    tbody.innerHTML = '';
    
    // Filtrar por mes del dashboard? O mostrar todo? Mostraremos todo pero destacando el mes actual si se desea
    // Por ahora mostramos las últimas 50
    appData.transactions.slice(0, 50).forEach(t => {
        const tr = document.createElement('tr');
        const isExpense = t.type === 'gasto';
        tr.innerHTML = `
            <td>${t.date}</td>
            <td>
                <strong>${t.desc}</strong><br>
                <small style="color:#64748B">${t.category}</small>
            </td>
            <td><span class="badge ${isExpense ? 'badge-egreso' : 'badge-ingreso'}">${t.type}</span></td>
            <td>${t.payer === 'pipe' ? 'Pipe' : (t.payer === 'luu' ? 'Luu' : 'Gatos')}</td>
            <td style="font-weight:bold; color:${isExpense ? 'var(--danger)' : 'var(--success)'}">
                ${isExpense ? '-' : '+'}$ ${t.amount.toLocaleString()}
            </td>
            <td><button onclick="deleteTransaction(${t.id})" style="color:red; background:none; border:none; cursor:pointer;">🗑️</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteTransaction(id) {
    if(confirm('¿Borrar movimiento?')) {
        appData.transactions = appData.transactions.filter(t => t.id !== id);
        saveDataToCloud();
        renderTransactions();
        updateDashboard();
    }
}

// --- CRÉDITOS COMPLETOS ---
function addDebt(e) {
    e.preventDefault();
    const total = parseFloat(document.getElementById('d-total').value);
    const rateYearly = parseFloat(document.getElementById('d-rate').value) / 100;
    const months = parseInt(document.getElementById('d-months').value);
    const startDate = document.getElementById('d-start').value;
    
    // Cálculo de cuota fija (Francesa)
    const rateMonthly = rateYearly / 12;
    let fixedPayment = 0;
    
    if (rateMonthly === 0) {
        fixedPayment = total / months;
    } else {
        fixedPayment = total * (rateMonthly * Math.pow(1 + rateMonthly, months)) / (Math.pow(1 + rateMonthly, months) - 1);
    }

    // Generar tabla de amortización inicial
    let schedule = [];
    let balance = total;
    let currentDate = new Date(startDate);
    
    for(let i=1; i<=months; i++) {
        const interest = balance * rateMonthly;
        const principal = fixedPayment - interest;
        balance -= principal;
        if(balance < 0) balance = 0;
        
        currentDate.setMonth(currentDate.getMonth() + 1);
        schedule.push({
            month: i,
            date: currentDate.toISOString().split('T')[0],
            payment: fixedPayment,
            interest: interest,
            principal: principal,
            balance: balance,
            paid: false
        });
    }

    const debt = {
        id: Date.now(),
        name: document.getElementById('d-name').value,
        originalAmount: total,
        currentBalance: total,
        rate: rateYearly,
        monthsTotal: months,
        fixedPayment: fixedPayment,
        startDate: startDate,
        owner: document.getElementById('d-owner').value,
        schedule: schedule,
        manualAdjustment: 0 // Para seguros u otros
    };

    appData.debts.push(debt);
    saveDataToCloud();
    renderDebts();
    document.getElementById('form-deuda').reset();
    showNotification("Crédito creado con tabla de amortización");
}

function renderDebts() {
    const container = document.getElementById('debts-list');
    container.innerHTML = '';
    const today = new Date();

    appData.debts.forEach(d => {
        // Encontrar próxima cuota no pagada
        const nextPayment = d.schedule.find(p => !p.paid);
        let statusHtml = '<span class="badge badge-ingreso">Al día</span>';
        let isLate = false;

        if (nextPayment) {
            const payDate = new Date(nextPayment.date);
            if (payDate < today) {
                statusHtml = '<span class="badge badge-egreso">Atrasado</span>';
                isLate = true;
            }
        } else {
            statusHtml = '<span class="badge badge-ingreso">Pagado</span>';
        }

        const progressPct = ((d.originalAmount - d.currentBalance) / d.originalAmount) * 100;

        const card = document.createElement('div');
        card.className = 'card';
        
        // Detalle de amortización colapsable
        let scheduleHtml = '<div id="sched-'+d.id+'" style="display:none; margin-top:15px; background:#f8fafc; padding:10px; border-radius:8px;">';
        scheduleHtml += '<div class="amortization-header"><span>Mes</span><span>Fecha</span><span>Interés</span><span>Capital</span><span>Saldo</span><span>Pagar</span></div>';
        d.schedule.forEach((s, idx) => {
            const btn = s.paid ? '<span style="color:green">✓</span>' : `<button class="btn-small btn-secondary" onclick="payDebtInstallment(${d.id}, ${idx})">Pagar</button>`;
            scheduleHtml += `
                <div class="amortization-row" style="${!s.paid && isLate ? 'background:#fee2e2' : ''}">
                    <span>${s.month}</span>
                    <span>${s.date}</span>
                    <span>$${Math.round(s.interest)}</span>
                    <span>$${Math.round(s.principal)}</span>
                    <span>$${Math.round(s.balance)}</span>
                    <span>${btn}</span>
                </div>`;
        });
        scheduleHtml += '</div>';

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3>${d.name} (${d.owner})</h3>
                ${statusHtml}
            </div>
            <p style="font-size:0.9rem; color:#64748B; margin: 5px 0;">
                Cuota Fija: $${Math.round(d.fixedPayment)} | Plazo: ${d.monthsTotal} meses | Interés: ${(d.rate*100).toFixed(1)}%
            </p>
            <div style="margin: 10px 0;">
                <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                    <span>Pendiente: <strong>$ ${Math.round(d.currentBalance).toLocaleString()}</strong></span>
                    <span>Avance: ${Math.round(progressPct)}%</span>
                </div>
                <div class="progress-container"><div class="progress-bar" style="width:${progressPct}%"></div></div>
            </div>
            
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
                <button class="btn btn-small btn-secondary" onclick="toggleSchedule(${d.id})">Ver Tabla Amortización</button>
                <button class="btn btn-small" onclick="openAbonoModal(${d.id})">Abono a Capital</button>
                <button class="btn btn-small btn-danger" onclick="deleteDebt(${d.id})">Eliminar</button>
            </div>
            ${scheduleHtml}
        `;
        container.appendChild(card);
    });
}

function toggleSchedule(id) {
    const el = document.getElementById('sched-'+id);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function payDebtInstallment(debtId, installmentIndex) {
    const debt = appData.debts.find(d => d.id === debtId);
    const installment = debt.schedule[installmentIndex];
    
    if(confirm(`¿Registrar pago de cuota #${installment.month} por $${Math.round(installment.payment)}? Esto creará un movimiento de egreso.`)) {
        // Crear movimiento
        appData.transactions.unshift({
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            type: 'gasto',
            desc: `Cuota ${installment.month}: ${debt.name}`,
            amount: installment.payment,
            payer: debt.owner === 'conjunto' ? 'pipe' : debt.owner, // Simplificación: lo paga el dueño o pipe si es conjunto
            category: 'deudas',
            split: { pipe: debt.owner==='pipe'?100:(debt.owner==='luu'?0:50), luu: debt.owner==='luu'?100:(debt.owner==='pipe'?0:50) }
        });
        
        // Marcar como pagada
        installment.paid = true;
        debt.currentBalance = installment.balance;
        
        saveDataToCloud();
        renderDebts();
        renderTransactions();
        updateDashboard();
        showNotification("Cuota pagada y movimiento registrado");
    }
}

function openAbonoModal(id) {
    document.getElementById('abono-debt-id').value = id;
    document.getElementById('modal-abono').style.display = 'flex';
}

function confirmarAbono() {
    const id = parseInt(document.getElementById('abono-debt-id').value);
    const amount = parseFloat(document.getElementById('abono-monto').value);
    const debt = appData.debts.find(d => d.id === id);
    
    if(amount > 0 && debt) {
        // Crear movimiento de abono
        appData.transactions.unshift({
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            type: 'gasto',
            desc: `Abono capital: ${debt.name}`,
            amount: amount,
            payer: debt.owner === 'conjunto' ? 'pipe' : debt.owner,
            category: 'deudas',
            split: { pipe: 50, luu: 50 } // Asumimos 50/50 para abonos conjuntos por defecto
        });

        // Recalcular tabla desde el primer pago no realizado
        let balanceBefore = debt.currentBalance;
        let newBalance = balanceBefore - amount;
        
        let foundStart = false;
        for(let i=0; i<debt.schedule.length; i++) {
            if(!debt.schedule[i].paid && !foundStart) {
                // Este es el primer pago pendiente, aquí aplicamos el abono
                // En realidad el abono reduce el saldo actual, y recalculamos los intereses futuros
                // Simplificación: Restamos al saldo de esta cuota y propagamos
                debt.schedule[i].balance -= amount; 
                // Recalcular intereses de las siguientes basado en nuevo saldo
                let runningBalance = debt.schedule[i].balance;
                for(let j=i+1; j<debt.schedule.length; j++) {
                    const interest = runningBalance * (debt.rate/12);
                    const principal = debt.fixedPayment - interest;
                    runningBalance -= principal;
                    debt.schedule[j].interest = interest;
                    debt.schedule[j].principal = principal;
                    debt.schedule[j].balance = runningBalance < 0 ? 0 : runningBalance;
                }
                foundStart = true;
            }
        }
        
        debt.currentBalance = newBalance < 0 ? 0 : newBalance;
        
        saveDataToCloud();
        renderDebts();
        closeModal('modal-abono');
        showNotification("Abono registrado y proyección actualizada");
    }
}

function deleteDebt(id) {
    if(confirm("¿Eliminar crédito?")) {
        appData.debts = appData.debts.filter(d => d.id !== id);
        saveDataToCloud();
        renderDebts();
    }
}

// --- PROYECTOS ---
function addProject(e) {
    e.preventDefault();
    const project = {
        id: Date.now(),
        name: document.getElementById('p-name').value,
        goal: parseFloat(document.getElementById('p-goal').value),
        current: parseFloat(document.getElementById('p-current').value),
        deadline: document.getElementById('p-date').value,
        details: document.getElementById('p-details').value
    };
    appData.projects.push(project);
    saveDataToCloud();
    renderProjects();
    document.getElementById('form-proyecto').reset();
    showNotification("Proyecto creado");
}

function renderProjects() {
    const container = document.getElementById('projects-list');
    container.innerHTML = '';
    
    let totalSaved = 0;

    appData.projects.forEach(p => {
        totalSaved += p.current;
        const pct = Math.min(100, (p.current / p.goal) * 100);
        
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <h3>${p.name}</h3>
                <button onclick="deleteProject(${p.id})" style="color:red; background:none; border:none; cursor:pointer;">🗑️</button>
            </div>
            <p style="font-size:0.9rem; color:#64748B; margin-bottom:10px;">${p.details || ''} <br> <strong>Meta: ${p.deadline}</strong></p>
            
            <div class="progress-container">
                <div class="progress-bar" style="width:${pct}%"></div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:5px; font-size:0.9rem;">
                <span>$ ${p.current.toLocaleString()}</span>
                <span>$ ${p.goal.toLocaleString()}</span>
            </div>
            
            <div style="margin-top:15px; display:flex; gap:10px;">
                <input type="number" id="fund-${p.id}" placeholder="$ Abono" style="padding:8px;">
                <button onclick="addFunds(${p.id})" class="btn btn-small">Añadir Ahorro</button>
            </div>
        `;
        container.appendChild(card);
    });
    
    document.getElementById('dash-total-saved').textContent = `$ ${totalSaved.toLocaleString()}`;
}

function addFunds(id) {
    const input = document.getElementById(`fund-${id}`);
    const amount = parseFloat(input.value);
    if(!amount) return;
    
    const proj = appData.projects.find(p => p.id === id);
    
    // Crear movimiento
    appData.transactions.unshift({
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        type: 'gasto', // Es un egreso de dinero disponible hacia ahorro
        desc: `Ahorro: ${proj.name}`,
        amount: amount,
        payer: 'pipe', // Asumimos pipe por defecto o preguntar
        category: 'ahorro',
        split: { pipe: 50, luu: 50 }
    });
    
    proj.current += amount;
    saveDataToCloud();
    renderProjects();
    updateDashboard();
    input.value = '';
    showNotification("Ahorro añadido");
}

function deleteProject(id) {
    if(confirm("¿Borrar proyecto?")) {
        appData.projects = appData.projects.filter(p => p.id !== id);
        saveDataToCloud();
        renderProjects();
    }
}

// --- CONFIGURACIÓN Y CATEGORÍAS ---
function renderCategoriesConfig() {
    const list = document.getElementById('categories-list');
    list.innerHTML = '';
    appData.categories.forEach(cat => {
        const div = document.createElement('div');
        div.style.padding = "5px";
        div.style.borderBottom = "1px solid #eee";
        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        div.innerHTML = `<span>${cat}</span> <button onclick="removeCategory('${cat}')" style="color:red; border:none; background:none; cursor:pointer;">x</button>`;
        list.appendChild(div);
    });
    
    // Actualizar selects en formulario de movimientos
    const select = document.getElementById('t-category');
    select.innerHTML = '';
    appData.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        select.appendChild(opt);
    });
}

function addCategory() {
    const input = document.getElementById('new-category');
    const val = input.value.trim().toLowerCase();
    if(val && !appData.categories.includes(val)) {
        appData.categories.push(val);
        saveDataToCloud();
        renderCategoriesConfig();
        input.value = '';
        showNotification("Categoría añadida");
    }
}

function removeCategory(cat) {
    if(confirm(`¿Eliminar categoría ${cat}?`)) {
        appData.categories = appData.categories.filter(c => c !== cat);
        saveDataToCloud();
        renderCategoriesConfig();
    }
}

// --- LIQUIDACIÓN (SETTLEMENT) ---
function registerSettlement() {
    const amount = parseFloat(document.getElementById('settle-amount').value);
    const from = document.getElementById('settle-from').value;
    const to = document.getElementById('settle-to').value;
    
    if(!amount) return;
    
    appData.transactions.unshift({
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        type: 'gasto',
        desc: `Liquidación de deuda a ${to}`,
        amount: amount,
        payer: from,
        category: 'ajuste',
        split: { pipe: 100, luu: 0 } // El que paga asume el gasto de "pagar deuda"
    });
    
    saveDataToCloud();
    updateDashboard();
    renderTransactions();
    closeModal('modal-settle');
    showNotification("Liquidación registrada");
}

// --- UTILIDADES ---
function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showNotification(msg, type='success') {
    const container = document.getElementById('alertContainer');
    const div = document.createElement('div');
    div.className = `alert alert-${type}`;
    div.textContent = msg;
    container.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function setupForms() {
    document.getElementById('form-transaccion').addEventListener('submit', addTransaction);
    document.getElementById('form-deuda').addEventListener('submit', addDebt);
    document.getElementById('form-proyecto').addEventListener('submit', addProject);
    document.getElementById('btn-settle').addEventListener('click', () => {
        document.getElementById('modal-settle').style.display = 'flex';
    });
    document.getElementById('confirm-settle').addEventListener('click', registerSettlement);
    document.getElementById('add-cat-btn').addEventListener('click', addCategory);
}
