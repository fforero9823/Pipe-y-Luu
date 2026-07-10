    // --- FIREBASE CONFIG ---
    const firebaseConfig = {
        apiKey: "AIzaSyB5GHHomIJc2JLzKyfnUntxL_brSiU9gVU",
        authDomain: "pipe-y-luu-finanzas.firebaseapp.com",
        projectId: "pipe-y-luu-finanzas",
        storageBucket: "pipe-y-luu-finanzas.firebasestorage.app",
        messagingSenderId: "1008646227450",
        appId: "1:1008646227450:web:070091ff8b542d3a621043"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    // --- ESTADO GLOBAL ---
    let dbData = {
        movimientos: [], recurrentes: [], creditos: [], comprasCredito: [], proyectos: [],
        categorias: ['Hogar', 'Comida', 'Transporte', 'Ocio', 'Salud', 'Gatos', 'Ahorro/Proyecto', 'Deudas', 'Otros', 'Transferencia'],
        lugares: [{name: 'Efectivo', saldo: 0}, {name: 'Cuenta Ahorros', saldo: 0}, {name: 'Nequi', saldo: 0}, {name: 'Daviplata', saldo: 0}],
        presupuestos: {}
    };
    let currentMonthOffset = 0, currentProjectId = null, currentCreditId = null, splitMode = '5050', isCapitalAbonoMode = false, currentPayCreditId = null;

    // --- INICIALIZACIÓN ---
    window.addEventListener('DOMContentLoaded', async () => {
        loadLocalData();procesarRecurrentes();
        
        try {
            const doc = await db.collection('finanzas').doc('datos').get();
            if (doc.exists) {
                const fd = doc.data();
                // Migración de lugares (de strings a objetos)
                let nuevosLugares = fd.lugares || dbData.lugares;
                if(nuevosLugares.length > 0 && typeof nuevosLugares[0] === 'string') {
                    nuevosLugares = nuevosLugares.map(l => ({name: l, saldo: 0}));
                }
                
                // Migración de owner en lugares
if (nuevosLugares && nuevosLugares.length > 0) {
    if (typeof nuevosLugares[0] === 'string') {
        nuevosLugares = nuevosLugares.map(l => ({name: l, owner: 'conjunto', saldo: 0}));
    } else if (!nuevosLugares[0].owner) {
        nuevosLugares = nuevosLugares.map(l => ({...l, owner: l.owner || 'conjunto'}));
    }
}

                dbData = {
                    movimientos: fd.movimientos || [], 
                    recurrentes: fd.recurrentes || [],
                    creditos: fd.creditos || [], 
                    comprasCredito: fd.comprasCredito || [],
                    proyectos: fd.proyectos || [], 
                    categorias: fd.categorias || dbData.categorias,
                    lugares: nuevosLugares, 
                    presupuestos: fd.presupuestos || {}
                };
                saveLocalData();
                updateConnectionStatus(true); // ÉXITO: Cambia a Nube
            } else { 
                await saveData(); 
                updateConnectionStatus(true);
            }
        } catch (error) {
            console.error('Error Firebase:', error);
            mostrarToast('️ Usando datos locales (Error de conexión)', 'warning');
            updateConnectionStatus(false);
        }

        // Listener en tiempo real
        db.collection('finanzas').doc('datos').onSnapshot(doc => {
            if (doc.exists) {
                const fd = doc.data();
                let nuevosLugares = fd.lugares || dbData.lugares;
                if(nuevosLugares.length > 0 && typeof nuevosLugares[0] === 'string') {
                    nuevosLugares = nuevosLugares.map(l => ({name: l, saldo: 0}));
                }
// Migración de owner en lugares
if (nuevosLugares && nuevosLugares.length > 0) {
    if (typeof nuevosLugares[0] === 'string') {
        nuevosLugares = nuevosLugares.map(l => ({name: l, owner: 'conjunto', saldo: 0}));
    } else if (!nuevosLugares[0].owner) {
        nuevosLugares = nuevosLugares.map(l => ({...l, owner: l.owner || 'conjunto'}));
    }
}

                dbData = {
                    movimientos: fd.movimientos || [], 
                    recurrentes: fd.recurrentes || [],
                    creditos: fd.creditos || [], 
                    comprasCredito: fd.comprasCredito || [],
                    proyectos: fd.proyectos || [], 
                    categorias: fd.categorias || dbData.categorias,
                    lugares: nuevosLugares, 
                    presupuestos: fd.presupuestos || {}
                };
                saveLocalData();
                renderCategories(); renderPlaces(); renderBudgetsConfig(); renderRecurrentes();
                updateDashboard(); renderMovimientos(); renderCreditos(); renderComprasCredito(); renderProyectos();
                updateConnectionStatus(true);
            }
        }, (error) => {
            console.error("Listener error:", error);
            updateConnectionStatus(false);
        });

        renderCategories(); renderPlaces(); renderBudgetsConfig();
        document.getElementById('m-date').valueAsDate = new Date();
        document.getElementById('c-start').valueAsDate = new Date();
        document.getElementById('cc-start').valueAsDate = new Date();
        
        updateDashboard(); renderMovimientos(); renderCreditos(); renderComprasCredito(); renderProyectos();
        setupConnectionListener(); setupFAB();
    });

    // --- DATOS ---
    async function saveData() {
        saveLocalData();
        if (navigator.onLine) {
            try { 
                await db.collection('finanzas').doc('datos').set(dbData); 
                updateConnectionStatus(true); 
            } catch (e) { 
                updateConnectionStatus(false); 
                mostrarToast('⚠️ Guardado solo local', 'warning'); 
            }
        } else { updateConnectionStatus(false); }
        updateDashboard();
    }
    function saveLocalData() { localStorage.setItem('pipeLuuData_v2', JSON.stringify(dbData)); }
            function loadLocalData() {
        const s = localStorage.getItem('pipeLuuData_v2');
        if (s) {
            dbData = JSON.parse(s);
            
            if (!dbData.recurrentes) dbData.recurrentes = []; 
            // Migración de Lugares (Cuentas) para añadir el 'owner'
            if (dbData.lugares && dbData.lugares.length > 0) {
                // Si es la versión antigua (solo strings)
                if (typeof dbData.lugares[0] === 'string') {
                    dbData.lugares = dbData.lugares.map(l => ({name: l, owner: 'conjunto', saldo: 0}));
                } 
                // Si ya son objetos pero no tienen owner
                else if (!dbData.lugares[0].owner) {
                    dbData.lugares = dbData.lugares.map(l => ({...l, owner: l.owner || 'conjunto'}));
                }
            } else {
                // Datos por defecto si no hay nada
                dbData.lugares = [
                    {name: 'Efectivo', owner: 'conjunto', saldo: 0}, 
                    {name: 'Cuenta Ahorros', owner: 'conjunto', saldo: 0}, 
                    {name: 'Nequi Pipe', owner: 'pipe', saldo: 0}, 
                    {name: 'Nequi Luu', owner: 'luu', saldo: 0}
                ];
            }

            if (!dbData.presupuestos) dbData.presupuestos = {};
            if (!dbData.comprasCredito) dbData.comprasCredito = [];
            if (dbData.proyectos) dbData.proyectos.forEach(p => { if (!p.locations) p.locations = [{ name: 'General', amount: p.current || 0, yield: 0 }]; });
        }
    }
function procesarRecurrentes() {
    if (!dbData.recurrentes || dbData.recurrentes.length === 0) return;

    const td = getTargetDate(currentMonthOffset);
    const y = td.getFullYear();
    const m = td.getMonth();
    const diasEnMes = new Date(y, m + 1, 0).getDate();
    
    // Fecha actual (hoy) para comparar
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Normalizar a medianoche
    
    let huboCambios = false;

    dbData.recurrentes.forEach(rec => {
        // --- BLOQUEO 1: No generar en meses anteriores a startDate ---
        if (rec.startDate) {
            const start = new Date(rec.startDate);
            if (y < start.getFullYear() || (y === start.getFullYear() && m < start.getMonth())) {
                return;
            }
        }
        
        // --- BLOQUEO 2: No generar si la fecha del gasto aún no llega en la vida real ---
        let dia = rec.dayOfMonth || 1;
        if (dia > diasEnMes) dia = diasEnMes;
        
        // Construir la fecha exacta del movimiento en este mes
        const fechaMovimiento = new Date(y, m, dia);
        
        // Si la fecha del movimiento es mayor a hoy, NO generar
        if (fechaMovimiento > hoy) {
            return;
        }
        // ---------------------------------------------------------------

        // Verificar si ya existe en este mes
        const yaExiste = dbData.movimientos.some(mov => {
            const movDate = new Date(mov.date);
            return mov.desc === rec.desc &&
                   movDate.getFullYear() === y &&
                   movDate.getMonth() === m;
        });

        if (!yaExiste) {
            const fecha = `${y}-${String(m + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

            dbData.movimientos.push({
                ...rec,
                id: Date.now() + Math.floor(Math.random() * 1000000),
                date: fecha
            });
            // Limpiar propiedades internas
            delete dbData.movimientos[dbData.movimientos.length - 1].dayOfMonth;
            delete dbData.movimientos[dbData.movimientos.length - 1].startDate;
            
            huboCambios = true;
        }
    });

    if (huboCambios) {
        saveData();
        renderMovimientos();
        updateDashboard();
    }
}
    // --- UI HELPERS ---
    function mostrarToast(msg, tipo = 'success') {
        const c = document.getElementById('toastContainer'), t = document.createElement('div');
        t.className = `toast-msg ${tipo}`; t.textContent = msg; c.appendChild(t);
        setTimeout(() => t.classList.add('show'), 10);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => c.removeChild(t), 300); }, 3000);
    }
    function updateConnectionStatus(isOnline) {
        const b = document.getElementById('connection-status');
        if(isOnline) {
            b.innerHTML = '<i class="fas fa-cloud"></i> Nube (Sync)';
            b.className = 'status-badge online';
        } else {
            b.innerHTML = '<i class="fas fa-wifi-slash"></i> Offline (Local)';
            b.className = 'status-badge offline';
        }
    }
    function setupConnectionListener() {
        window.addEventListener('online', () => updateConnectionStatus(true));
        window.addEventListener('offline', () => updateConnectionStatus(false));
    }
    function setupFAB() {
        document.getElementById('fabAdd').addEventListener('click', () => {
            if ('vibrate' in navigator) navigator.vibrate(30);
            navTo('movimientos');
            setTimeout(() => { document.getElementById('form-movimiento').scrollIntoView({behavior:'smooth'}); document.getElementById('m-desc').focus(); }, 100);
        });
    }
    function navTo(id) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        document.getElementById('nav-' + id).classList.add('active');
        window.scrollTo(0,0);
    
        if(id==='dashboard') updateDashboard(); 
        if(id==='reportes') {
            reportMonthOffset = currentMonthOffset; // ← Sincronizar offsets
            renderAllCharts();
        }
        if(id==='movimientos') renderMovimientos();
        if(id==='creditos') renderCreditos(); 
        if(id==='compras-credito') renderComprasCredito();
        if(id==='proyectos') renderProyectos(); 
        if(id==='config') { renderCategories(); renderRecurrentes(); renderPlaces(); renderBudgetsConfig(); }
    }
    function closeModal(id) { document.getElementById(id).style.display = 'none'; }
    window.onclick = (e) => { if(e.target.classList.contains('modal')) e.target.style.display = 'none'; }

    // --- DASHBOARD ---
    function getTargetDate(offset) { const d = new Date(); d.setMonth(d.getMonth() + offset); return d; }
      function changeMonth(delta) { 
        currentMonthOffset += delta; 
        procesarRecurrentes(); // <-- AÑADIR
        updateDashboard(); 
        renderMovimientos(); 
    }
    function updateDashboard() {
        const td = getTargetDate(currentMonthOffset);
        const mn = td.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        document.getElementById('dash-month-label').textContent = mn.charAt(0).toUpperCase() + mn.slice(1);
        document.getElementById('history-filter-label').textContent = `(Filtrado: ${mn})`;
        const y = td.getFullYear(), m = td.getMonth();

        const mm = dbData.movimientos.filter(x => { const d = new Date(x.date); return d.getFullYear() === y && d.getMonth() === m; });
        let inc = 0, exp = 0, pN = 0, lN = 0, gC = {};

        mm.forEach(x => {
            const a = parseFloat(x.amount);
            if (x.type === 'ingreso') { inc += a; } 
            else if (x.type === 'gasto') {
                exp += a;
                if (x.category && !['Deudas','Ahorro/Proyecto','Transferencia'].includes(x.category)) gC[x.category] = (gC[x.category]||0) + a;
                let pS=0, lS=0;
                if (x.splitType === '5050') { pS=a/2; lS=a/2; } else if (x.splitType === '1000') { pS=a; } else if (x.splitType === '0100') { lS=a; } else { pS=(parseFloat(x.splitP)||50)/100*a; lS=(parseFloat(x.splitL)||50)/100*a; }
                if (x.payer === 'pipe') { pN += lS; lN -= lS; } else if (x.payer === 'luu') { lN += pS; pN -= pS; }
            }
        });

        document.getElementById('dash-income').textContent = `$${inc.toLocaleString()}`;
        document.getElementById('dash-expense').textContent = `$${exp.toLocaleString()}`;
        document.getElementById('dash-balance').textContent = `$${(inc-exp).toLocaleString()}`;

        let dA=0, dT="", sL=false;
        if (pN > 1) { dA=pN; dT=`Luu le debe a Pipe: $${Math.abs(pN).toLocaleString()}`; sL=true; } 
        else if (pN < -1) { dA=Math.abs(pN); dT=`Pipe le debe a Luu: $${Math.abs(pN).toLocaleString()}`; sL=true; } 
        else { dT = `¡Cuentas claras este mes! 😎`; }

                // --- LIQUIDACIÓN DE DEUDA DEL MES ---
        let hS = `<div class="settlement-box"><strong>${dT}</strong>`;
        if(sL) {
            const p = pN>0?'luu':'pipe', r = pN>0?'pipe':'luu';
            // Generar opciones de cuentas
            let lugarOptions = dbData.lugares.map(l => `<option value="${l.name}">${l.name} (${l.owner === 'pipe' ? 'Pipe' : l.owner === 'luu' ? 'Luu' : 'Común'})</option>`).join('');
            
            hS += `<div class="settlement-form">
                        <input type="number" id="settlement-amount" value="${Math.round(dA)}" inputmode="numeric" placeholder="Monto">
                        <div style="display:flex; gap:5px; font-size:0.8rem; color:var(--text-light); margin-bottom:5px;">
                            <span>De:</span>
                        </div>
                        <select id="settlement-lugar">${lugarOptions}</select>
                        <div style="display:flex; gap:5px; font-size:0.8rem; color:var(--text-light); margin:5px 0;">
                            <span>Hacia (Cuenta de ${r}):</span>
                        </div>
                        <select id="settlement-lugar-dest">${lugarOptions}</select>
                        <button onclick="liquidarDeuda('${p}','${r}', 'monthly')" class="btn-liquidate" style="margin:0;">💸 Abonar</button>
                   </div>`;
        }
        hS += `</div>`;
        document.getElementById('dash-settlement-container').innerHTML = hS;

        let hPN=0;
        dbData.movimientos.forEach(x => {
            if(x.type==='gasto') {
                let pS=0, lS=0;
                if (x.splitType === '5050') { pS=x.amount/2; lS=x.amount/2; } else if (x.splitType === '1000') { pS=x.amount; } else if (x.splitType === '0100') { lS=x.amount; } else { pS=(parseFloat(x.splitP)||50)/100*x.amount; lS=(parseFloat(x.splitL)||50)/100*x.amount; }
                if (x.payer === 'pipe') hPN += lS; else if (x.payer === 'luu') hPN -= pS;
            }
        });
        
                let hDT = "", hSForm = "";
        if (hPN > 1) { 
            hDT = `Luu le debe a Pipe (Histórico): <strong>$${Math.round(hPN).toLocaleString()}</strong>`; 
            const p='luu', r='pipe';
            let lugarOptions = dbData.lugares.map(l => `<option value="${l.name}">${l.name} (${l.owner === 'pipe' ? 'Pipe' : l.owner === 'luu' ? 'Luu' : 'Común'})</option>`).join('');
            
            hSForm = `<div class="settlement-form" style="margin-top:10px;">
                            <input type="number" id="hist-settlement-amount" value="${Math.round(hPN)}" inputmode="numeric" placeholder="Monto">
                            <div style="display:flex; gap:5px; font-size:0.8rem; color:var(--text-light); margin-bottom:5px;"><span>De:</span></div>
                            <select id="hist-settlement-lugar">${lugarOptions}</select>
                            <div style="display:flex; gap:5px; font-size:0.8rem; color:var(--text-light); margin:5px 0;"><span>Hacia (Cuenta de ${r}):</span></div>
                            <select id="hist-settlement-lugar-dest">${lugarOptions}</select>
                            <button onclick="liquidarDeuda('${p}','${r}', 'historical')" class="btn-liquidate" style="margin:0;">💸 Abonar Deuda Histórica</button>
                      </div>`;
        } else if (hPN < -1) { 
            hDT = `Pipe le debe a Luu (Histórico): <strong>$${Math.round(Math.abs(hPN)).toLocaleString()}</strong>`;
            const p='pipe', r='luu';
            let lugarOptions = dbData.lugares.map(l => `<option value="${l.name}">${l.name} (${l.owner === 'pipe' ? 'Pipe' : l.owner === 'luu' ? 'Luu' : 'Común'})</option>`).join('');
            
            hSForm = `<div class="settlement-form" style="margin-top:10px;">
                            <input type="number" id="hist-settlement-amount" value="${Math.round(Math.abs(hPN))}" inputmode="numeric" placeholder="Monto">
                            <div style="display:flex; gap:5px; font-size:0.8rem; color:var(--text-light); margin-bottom:5px;"><span>De:</span></div>
                            <select id="hist-settlement-lugar">${lugarOptions}</select>
                            <div style="display:flex; gap:5px; font-size:0.8rem; color:var(--text-light); margin:5px 0;"><span>Hacia (Cuenta de ${r}):</span></div>
                            <select id="hist-settlement-lugar-dest">${lugarOptions}</select>
                            <button onclick="liquidarDeuda('${p}','${r}', 'historical')" class="btn-liquidate" style="margin:0;">💸 Abonar Deuda Histórica</button>
                      </div>`;
        } else { 
            hDT = `¡Sin deudas acumuladas! 🎉`; 
        }
        document.getElementById('dash-debt-history-container').innerHTML = `<div class="debt-history-box"><div class="debt-history-title">Acumulado histórico total</div><div style="font-size:1rem; color:var(--primary-dark); margin-bottom:5px;">${hDT}</div>${hSForm}</div>`;
        // CÁLCULO DE SALDOS POR CUENTA
        let saldos = {};
        dbData.lugares.forEach(l => saldos[l.name] = parseFloat(l.saldo) || 0);
        
        dbData.movimientos.forEach(x => {
            const l = x.lugar || 'Efectivo';
            const lDest = x.lugarDestino || l;
            if (saldos[l] === undefined) saldos[l] = 0;
            if (saldos[lDest] === undefined) saldos[lDest] = 0;
            const amt = parseFloat(x.amount);

            if (x.type === 'ingreso') { saldos[l] += amt; } 
            else if (x.type === 'gasto') { saldos[l] -= amt; } 
            else if (x.type === 'transferencia') { saldos[l] -= amt; saldos[lDest] += amt; }
        });

        let accountsHtml = '';
        dbData.lugares.forEach(l => {
            const balance = saldos[l.name] || 0;
            const colorClass = balance >= 0 ? 'positive' : 'negative';
            const icon = l.name.toLowerCase().includes('efectivo') ? 'fa-money-bill-wave' : 
                         l.name.toLowerCase().includes('nequi') || l.name.toLowerCase().includes('daviplata') ? 'fa-mobile-alt' : 'fa-credit-card';
            
            accountsHtml += `<div class="account-balance-item"><div class="account-name"><i class="fas ${icon}" style="color:var(--accent-blue);"></i> ${l.name}</div><div class="account-amount ${colorClass}">$${balance.toLocaleString()}</div></div>`;
        });
        document.getElementById('dash-accounts-container').innerHTML = accountsHtml || '<p style="color:var(--text-light); text-align:center;">No hay cuentas configuradas.</p>';

        const tP = dbData.proyectos.reduce((s,p) => s + (p.locations ? p.locations.reduce((a,loc)=>a+parseFloat(loc.amount),0) : parseFloat(p.current||0)), 0);
        document.getElementById('dash-projects-total').textContent = `$${tP.toLocaleString()}`;
        renderDashboardBudgets(gC);

        let cH = '';
        dbData.creditos.forEach(c => {
            const sd = new Date(c.startDate); let mp = (y-sd.getFullYear())*12 + (m-sd.getMonth()); const tm = parseInt(c.term), pm = parseInt(c.paidMonths||0);
            if (mp >= 0 && mp < tm) {
                const hp = mm.some(x => x.desc && x.desc.toLowerCase().includes(c.name.toLowerCase()) && (x.desc.toLowerCase().includes('pago cuota') || x.desc.toLowerCase().includes('abono')));
                cH += `<div class="list-item"><div class="item-info"><div class="item-title">${c.name}</div><div class="item-sub">Cuota: $${Math.round(c.cuota).toLocaleString()}</div></div><div class="badge ${mp<pm||hp?'bg-success':'bg-danger'}">${mp<pm||hp?'✅ Pagado':'Pendiente'}</div></div>`;
            }
        });
        document.getElementById('dash-credits-summary').innerHTML = cH || "<small>No hay cuotas activas.</small>";
    }

    function renderDashboardBudgets(gC) {
        const c = document.getElementById('dash-budgets-summary'), p = dbData.presupuestos||{}, cats = Object.keys(p);
        if(!cats.length) { c.innerHTML = '<small style="color:var(--text-light);">Sin presupuestos. <a href="#" onclick="navTo(\'config\');return false;" style="color:var(--accent-blue);">Configurar</a></small>'; return; }
        let h = '';
        cats.forEach(cat => {
            const l = p[cat], g = gC[cat]||0, pct = Math.min(100,(g/l)*100), pr = (g/l)*100;
            let bc = 'ok', st = `<span style="color:var(--success);">✓ En rango</span>`;
            if(pr>=100) { bc='over'; st=`<span style="color:var(--danger); font-weight:bold;">⚠️ Excedido</span>`; } else if(pr>=80) { bc='warn'; st=`<span style="color:var(--warning); font-weight:bold;">⚡ Cerca</span>`; }
            h += `<div class="budget-item"><div class="budget-header"><strong>${cat}</strong>${st}</div><div class="budget-bar-bg"><div class="budget-bar-fill ${bc}" style="width:${pct}%"></div></div><div class="budget-values"><span>Gastado: $${Math.round(g).toLocaleString()}</span><span>Límite: $${l.toLocaleString()}</span></div></div>`;
        });
        c.innerHTML = h;
    }

        function liquidarDeuda(payer, receiver, type) {
        let amount, lugar, lugarDest;
        
        if (type === 'monthly') {
            amount = parseFloat(document.getElementById('settlement-amount').value);
            lugar = document.getElementById('settlement-lugar').value;
            lugarDest = document.getElementById('settlement-lugar-dest').value;
        } else {
            amount = parseFloat(document.getElementById('hist-settlement-amount').value);
            lugar = document.getElementById('hist-settlement-lugar').value;
            lugarDest = document.getElementById('hist-settlement-lugar-dest').value;
        }

        if(!amount || amount<=0) return mostrarToast('❌ Monto inválido', 'error');
        if(!confirm(`¿${payer.toUpperCase()} abona $${amount.toLocaleString()} a ${receiver.toUpperCase()}?\nDe: ${lugar}\nHacia: ${lugarDest}`)) return;
        
        const isP = payer==='pipe';
        dbData.movimientos.unshift({ 
            id: Date.now(), 
            date: new Date().toISOString().split('T')[0], 
            desc: `Abono deuda a ${receiver}`, 
            amount: amount, 
            category: 'Otros', 
            type: 'gasto', // Mantenemos tipo gasto para el balance general, pero el cálculo de saldos lo maneja
            payer: payer, 
            splitType: isP?'0100':'1000', 
            splitP: isP?0:100, 
            splitL: isP?100:0, 
            lugar: lugar,
            lugarDestino: lugarDest // ¡Aquí está la clave!
        });
        
        saveData(); updateDashboard();
        if('vibrate' in navigator) navigator.vibrate([50,30,50]);
        mostrarToast('✅ Abono registrado', 'success');
    }

    function toggleSplitOptions() {
        const type = document.getElementById('m-type').value;
        const splitSection = document.getElementById('split-section');
        const lugarDestGroup = document.getElementById('lugar-destino-group');
        if (type === 'transferencia') { splitSection.style.display = 'none'; lugarDestGroup.style.display = 'block'; document.getElementById('lugar-origen-group').querySelector('label').textContent = '¿De dónde sale el dinero?'; } 
        else if (type === 'ingreso') { splitSection.style.display = 'none'; lugarDestGroup.style.display = 'none'; document.getElementById('lugar-origen-group').querySelector('label').textContent = '¿A dónde entra el dinero?'; } 
        else { splitSection.style.display = 'block'; lugarDestGroup.style.display = 'none'; document.getElementById('lugar-origen-group').querySelector('label').textContent = '¿De dónde sale el dinero?'; }
    }

    function setSplit(m, b) { 
        splitMode = m; 
        document.querySelectorAll('.split-btn').forEach(x => x.classList.remove('selected')); 
        b.classList.add('selected'); 
        document.getElementById('custom-split').style.display = m === 'custom' ? 'flex' : 'none'; 
    
        // Resetear a 50/50 cuando se selecciona personalizado
        if (m === 'custom') {
            document.getElementById('split-p').value = 50;
            document.getElementById('split-l').value = 50;
            updateSplitTotal();
        }
    }

    // Función para auto-ajustar porcentajes
    function autoAdjustSplit(who) {
        const inputP = document.getElementById('split-p');
        const inputL = document.getElementById('split-l');
    
        let p = parseFloat(inputP.value) || 0;
        let l = parseFloat(inputL.value) || 0;
    
        // Limitar entre 0 y 100
        if (p > 100) { p = 100; inputP.value = 100; }
        if (p < 0) { p = 0; inputP.value = 0; }
        if (l > 100) { l = 100; inputL.value = 100; }
        if (l < 0) { l = 0; inputL.value = 0; }
    
        // Auto-ajustar el otro campo
        if (who === 'p') {
            l = 100 - p;
            inputL.value = l;
        } else {
            p = 100 - l;
            inputP.value = p;
        }
    
        updateSplitTotal();
    }

    // Función para mostrar el total
    function updateSplitTotal() {
        const p = parseFloat(document.getElementById('split-p').value) || 0;
        const l = parseFloat(document.getElementById('split-l').value) || 0;
        const total = p + l;
        const totalDiv = document.getElementById('split-total');
    
        if (total === 100) {
            totalDiv.textContent = '✓ 100%';
            totalDiv.style.color = 'var(--success)';
        } else {
            totalDiv.textContent = `⚠️ ${total}%`;
            totalDiv.style.color = 'var(--danger)';
        }
    }
            document.getElementById('form-movimiento').addEventListener('submit', e => {
        e.preventDefault();
        
        const t = document.getElementById('m-type').value;
        
        // Verificar si el checkbox existe antes de leerlo
        const checkboxRecurrente = document.getElementById('m-recurrente');
        const esRecurrente = checkboxRecurrente ? checkboxRecurrente.checked : false;
        
        // Validar porcentajes si es personalizado
        if (t === 'gasto' && splitMode === 'custom') {
            const p = parseFloat(document.getElementById('split-p').value) || 0;
            const l = parseFloat(document.getElementById('split-l').value) || 0;
    
            if (p + l !== 100) {
                mostrarToast('❌ Los porcentajes deben sumar 100%', 'error');
                return; // Detener el guardado
            }
        }

        const mov = {
            id: Date.now(), 
            date: document.getElementById('m-date').value, 
            desc: document.getElementById('m-desc').value, 
            amount: parseFloat(document.getElementById('m-amount').value),
            category: t === 'transferencia' ? 'Transferencia' : document.getElementById('m-category').value, 
            type: t,
            payer: t === 'gasto' ? document.getElementById('m-payer').value : 'pipe',
            splitType: t === 'gasto' ? splitMode : null, 
            splitP: t === 'gasto' ? document.getElementById('split-p').value : null, 
            splitL: t === 'gasto' ? document.getElementById('split-l').value : null,
            lugar: document.getElementById('m-place').value || 'Efectivo',
            lugarDestino: t === 'transferencia' ? (document.getElementById('m-place-dest').value || 'Efectivo') : (document.getElementById('m-place').value || 'Efectivo')
        };

        // Guardar el movimiento SIEMPRE (recurrente o no)
        dbData.movimientos.unshift(mov);

        // Si es recurrente, añadirlo a la lista de recurrentes
        if (esRecurrente) {
            if (!dbData.recurrentes) dbData.recurrentes = [];
            
            const diaDelMes = parseInt(document.getElementById('m-date').value.split('-')[2]);
            dbData.recurrentes.push({ 
                ...mov, 
                id: Date.now() + Math.random(), 
                dayOfMonth: diaDelMes 
            });
            
            mostrarToast('🔄 Movimiento recurrente configurado', 'success');
        } else {
            mostrarToast('✅ Movimiento guardado', 'success');
        }

        saveData(); 
        renderMovimientos(); 
        e.target.reset(); 
        document.getElementById('m-date').valueAsDate = new Date(); 
        toggleSplitOptions();
        
        if ('vibrate' in navigator) navigator.vibrate([50, 30, 50]);
    });
    function renderMovimientos() {
        const l = document.getElementById('movimientos-list'); l.innerHTML = '';
        const td = getTargetDate(currentMonthOffset), y = td.getFullYear(), m = td.getMonth();
        const f = dbData.movimientos.filter(x => { const d = new Date(x.date); return d.getFullYear()===y && d.getMonth()===m; }).sort((a,b)=>new Date(b.date)-new Date(a.date));
        if(!f.length) { l.innerHTML = '<p style="text-align:center; color:var(--text-light); padding:20px;">Sin movimientos.</p>'; return; }
        f.forEach(x => {
            const isE = x.type==='gasto', col = x.type==='transferencia'?'var(--accent-blue)':(isE?'var(--danger)':'var(--success)'), sign = x.type==='transferencia'?'↔':(isE?'-':'+');
            let pi = x.payer==='pipe'?'<i class="fas fa-male" style="color:#3B82F6"></i>':x.payer==='luu'?'<i class="fas fa-female" style="color:#EC4899"></i>':'<i class="fas fa-paw" style="color:#F59E0B"></i>';
            const lb = x.lugar?`<span class="badge" style="background:#e0e7ff; color:#3730a3; margin-left:5px;">${x.lugar}</span>`:'';
            const lbDest = x.type==='transferencia' && x.lugarDestino?`<span class="badge" style="background:#D1FAE5; color:#065F46; margin-left:5px;">→ ${x.lugarDestino}</span>`:'';
            
            // AÑADIDO: Botón de editar (lápiz)
            l.innerHTML += `<div class="list-item"><div class="item-info"><div class="item-title">${x.desc} <span class="badge" style="background:#eee; color:#333; margin-left:5px;">${x.category}</span>${lb}${lbDest}</div><div class="item-sub">${x.date} ${pi}</div></div><div style="text-align:right; display:flex; gap:10px; align-items:center;"><div style="font-weight:bold; color:${col}">${sign}$${parseFloat(x.amount).toLocaleString()}</div><button class="delete-btn" onclick="openEditModal(${x.id})" style="color:var(--accent-blue);"><i class="fas fa-edit"></i></button><button class="delete-btn" onclick="deleteMov(${x.id})"><i class="fas fa-trash"></i></button></div></div>`;
        });
    }

    function deleteMov(id) {
        if(!confirm('¿Borrar movimiento?')) return;
        const mov = dbData.movimientos.find(x=>x.id===id);
        if(mov && mov.desc && mov.desc.toLowerCase().includes('pago cuota:')) {
            const cn = mov.desc.replace('Pago cuota: ','').trim();
            const cr = dbData.creditos.find(c=>c.name.toLowerCase()===cn.toLowerCase());
            if(cr) { cr.paidMonths = Math.max(0, cr.paidMonths-1); cr.currentBalance += (parseFloat(mov.amount) - (cr.currentBalance*cr.rate)); mostrarToast('⚠️ Crédito revertido', 'warning'); }
        }
        dbData.movimientos = dbData.movimientos.filter(x=>x.id!==id);
        saveData(); renderMovimientos(); updateDashboard(); renderCreditos();
        mostrarToast('️ Eliminado', 'warning');
    }
        // --- LÓGICA DE EDICIÓN ---
    let editingMovId = null;
    let editSplitMode = '5050';

    function toggleEditSplitOptions() {
        const type = document.getElementById('edit-m-type').value;
        const splitSection = document.getElementById('edit-split-section');
        const lugarDestGroup = document.getElementById('edit-lugar-destino-group');
        if (type === 'transferencia') { splitSection.style.display = 'none'; lugarDestGroup.style.display = 'block'; } 
        else if (type === 'ingreso') { splitSection.style.display = 'none'; lugarDestGroup.style.display = 'none'; } 
        else { splitSection.style.display = 'block'; lugarDestGroup.style.display = 'none'; }
    }

    function setEditSplit(m, btn) { 
        editSplitMode = m; 
        document.querySelectorAll('#modal-edit-movimiento .split-btn').forEach(x => x.classList.remove('selected')); 
        btn.classList.add('selected'); 
        document.getElementById('edit-custom-split').style.display = m === 'custom' ? 'flex' : 'none'; 
    
        if (m === 'custom') {
            document.getElementById('edit-split-p').value = 50;
            document.getElementById('edit-split-l').value = 50;
            updateEditSplitTotal();
        }
    }

    function autoAdjustEditSplit(who) {
        const inputP = document.getElementById('edit-split-p');
        const inputL = document.getElementById('edit-split-l');
    
        let p = parseFloat(inputP.value) || 0;
        let l = parseFloat(inputL.value) || 0;
        
        if (p > 100) { p = 100; inputP.value = 100; }
        if (p < 0) { p = 0; inputP.value = 0; }
        if (l > 100) { l = 100; inputL.value = 100; }
        if (l < 0) { l = 0; inputL.value = 0; }
    
        if (who === 'p') {
            l = 100 - p;
            inputL.value = l;
        } else {
            p = 100 - l;
            inputP.value = p;
        }
    
        updateEditSplitTotal();
    }

    function updateEditSplitTotal() {
        const p = parseFloat(document.getElementById('edit-split-p').value) || 0;
        const l = parseFloat(document.getElementById('edit-split-l').value) || 0;
        const total = p + l;
        const totalDiv = document.getElementById('edit-split-total');
    
        if (total === 100) {
            totalDiv.textContent = '✓ 100%';
            totalDiv.style.color = 'var(--success)';
        } else {
            totalDiv.textContent = `⚠️ ${total}%`;
            totalDiv.style.color = 'var(--danger)';
        }
    }

    function openEditModal(id) {
        const mov = dbData.movimientos.find(x => x.id === id);
        if (!mov) return;
        editingMovId = id;

        // Llenar selects de lugares y categorías primero
        renderEditSelects();

        document.getElementById('edit-m-type').value = mov.type;
        document.getElementById('edit-m-desc').value = mov.desc;
        document.getElementById('edit-m-amount').value = mov.amount;
        document.getElementById('edit-m-date').value = mov.date;
        
        // Manejo seguro de categorías y lugares
        const catSelect = document.getElementById('edit-m-category');
        if ([...catSelect.options].some(o => o.value === mov.category)) catSelect.value = mov.category;
        
        const placeSelect = document.getElementById('edit-m-place');
        if ([...placeSelect.options].some(o => o.value === mov.lugar)) placeSelect.value = mov.lugar;

        toggleEditSplitOptions();

        if (mov.type === 'transferencia') {
            const destSelect = document.getElementById('edit-m-place-dest');
            if ([...destSelect.options].some(o => o.value === mov.lugarDestino)) destSelect.value = mov.lugarDestino;
        } else {
            document.getElementById('edit-m-payer').value = mov.payer || 'pipe';
            editSplitMode = mov.splitType || '5050';
            
            // Actualizar UI de botones de split
            document.querySelectorAll('#modal-edit-movimiento .split-btn').forEach(b => b.classList.remove('selected'));
            const activeBtn = document.getElementById(`edit-split-${mov.splitType || '5050'}`);
            if(activeBtn) activeBtn.classList.add('selected');
            
            document.getElementById('edit-split-p').value = mov.splitP || 50;
            document.getElementById('edit-split-l').value = mov.splitL || 50;
            document.getElementById('edit-custom-split').style.display = (mov.splitType === 'custom') ? 'flex' : 'none';
        }

        document.getElementById('modal-edit-movimiento').style.display = 'flex';
    }

    function renderEditSelects() {
        const catSelect = document.getElementById('edit-m-category');
        const placeSelect = document.getElementById('edit-m-place');
        const destSelect = document.getElementById('edit-m-place-dest');
        
        catSelect.innerHTML = ''; placeSelect.innerHTML = ''; destSelect.innerHTML = '';
        
        dbData.categorias.forEach(c => { 
            if(c !== 'Transferencia') { 
                const o = document.createElement('option'); o.value = c; o.textContent = c; catSelect.appendChild(o); 
            } 
        });
        
        dbData.lugares.forEach(l => { 
            const o1 = document.createElement('option'); o1.value = l.name; o1.textContent = l.name; placeSelect.appendChild(o1);
            const o2 = document.createElement('option'); o2.value = l.name; o2.textContent = l.name; destSelect.appendChild(o2);
        });
    }

    function saveEditMovement() {
        if (!editingMovId) return;
    
        const idx = dbData.movimientos.findIndex(x => x.id === editingMovId);
        if (idx === -1) return;

        const t = document.getElementById('edit-m-type').value;
    
        // Validar porcentajes si es personalizado
        if (t === 'gasto' && editSplitMode === 'custom') {
            const p = parseFloat(document.getElementById('edit-split-p').value) || 0;
            const l = parseFloat(document.getElementById('edit-split-l').value) || 0;
        
            if (p + l !== 100) {
                mostrarToast('❌ Los porcentajes deben sumar 100%', 'error');
                return;
            }
        }
        
        const updatedMov = {
            id: editingMovId,
            date: document.getElementById('edit-m-date').value,
            desc: document.getElementById('edit-m-desc').value,
            amount: parseFloat(document.getElementById('edit-m-amount').value),
            category: t === 'transferencia' ? 'Transferencia' : document.getElementById('edit-m-category').value,
            type: t,
            payer: t === 'gasto' ? document.getElementById('edit-m-payer').value : 'pipe',
            splitType: t === 'gasto' ? editSplitMode : null,
            splitP: t === 'gasto' ? document.getElementById('edit-split-p').value : null,
            splitL: t === 'gasto' ? document.getElementById('edit-split-l').value : null,
            lugar: document.getElementById('edit-m-place').value || 'Efectivo',
            lugarDestino: t === 'transferencia' ? (document.getElementById('edit-m-place-dest').value || 'Efectivo') : (document.getElementById('edit-m-place').value || 'Efectivo')
        };

        dbData.movimientos[idx] = updatedMov;
        saveData();
        renderMovimientos();
        updateDashboard(); // Actualiza saldos y balance
        closeModal('modal-edit-movimiento');
        
        if('vibrate' in navigator) navigator.vibrate([50,30,50]);
        mostrarToast('✅ Movimiento actualizado', 'success');
    }
    document.getElementById('form-credito').addEventListener('submit', e => {
        e.preventDefault();
        const tot = parseFloat(document.getElementById('c-total').value), term = parseInt(document.getElementById('c-term').value), rate = parseFloat(document.getElementById('c-rate').value)/100, pm = parseInt(document.getElementById('c-paid-months').value)||0;
        let cuo = rate>0 ? tot*(rate*Math.pow(1+rate,term))/(Math.pow(1+rate,term)-1) : tot/term;
        let bal = tot;
        if(pm>0) bal = rate>0 ? tot*((Math.pow(1+rate,term)-Math.pow(1+rate,pm))/(Math.pow(1+rate,term)-1)) : tot-(cuo*pm);
        const own = document.getElementById('c-owner').value, sd = new Date(document.getElementById('c-start').value), day = parseInt(document.getElementById('c-day').value);
        if(pm>0 && confirm(`Se generarán ${pm} pagos históricos.`)) {
            for(let i=1;i<=pm;i++) {
                const pd = new Date(sd); pd.setMonth(sd.getMonth()+i); pd.setDate(day);
                dbData.movimientos.push({ id: Date.now()+i, date: pd.toISOString().split('T')[0], desc: `Pago cuota ${i}: ${document.getElementById('c-name').value}`, amount: cuo, category: 'Deudas', type: 'gasto', payer: own, splitType: '1000', splitP: own==='pipe'?100:0, splitL: own==='luu'?100:0, lugar: 'Efectivo', creditoId: Date.now() });
            }
        }
        dbData.creditos.push({ id: Date.now(), name: document.getElementById('c-name').value, originalAmount: tot, currentBalance: bal, rate: rate, term: term, cuota: cuo, startDate: document.getElementById('c-start').value, day: day, owner: own, paidMonths: pm, completed: false });
        saveData(); renderCreditos(); e.target.reset();
        if('vibrate' in navigator) navigator.vibrate([50,30,50]); mostrarToast('✅ Crédito creado', 'success');
    });

    function renderCreditos() {
        const l = document.getElementById('creditos-list'); l.innerHTML = '';
        dbData.creditos.forEach(c => {
            const pct = ((c.originalAmount-c.currentBalance)/c.originalAmount)*100, isC = c.currentBalance<=0 || c.paidMonths>=c.term;
            if(isC && !c.completed) { c.completed=true; saveData(); }
            const d = document.createElement('div'); d.className = 'card' + (isC?' credit-card-completed':'');
            d.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><h3>${c.name} <small style="font-size:0.8rem; color:var(--text-light)">(${c.owner})</small></h3><div style="display:flex; gap:5px; align-items:center;">${isC?'<span class="badge bg-completed">✅ COMPLETADO</span>':''}<button class="delete-btn" onclick="deleteCredito(${c.id})"><i class="fas fa-trash"></i></button></div></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${Math.min(100,pct)}%; ${isC?'background:var(--success);':''}"></div></div><div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-bottom:10px;"><span>Pendiente: <strong>$${Math.round(c.currentBalance).toLocaleString()}</strong></span><span>Cuota: $${Math.round(c.cuota).toLocaleString()}</span></div><button onclick="openCreditoModal(${c.id})" class="btn btn-sm btn-secondary">Ver / Pagar</button>`;
            l.appendChild(d);
        });
    }

    function openCreditoModal(id) {
        currentCreditId = id; const c = dbData.creditos.find(x=>x.id===id);
        document.getElementById('modal-c-title').textContent = c.name;
        const rm = c.term-c.paidMonths, npd = new Date(c.startDate); npd.setMonth(npd.getMonth()+c.paidMonths+1); npd.setDate(c.day);
        const isC = c.currentBalance<=0 || c.paidMonths>=c.term;
        document.getElementById('modal-c-body').innerHTML = `<p><strong>Saldo:</strong> $${Math.round(c.currentBalance).toLocaleString()}</p><p><strong>Cuota:</strong> $${Math.round(c.cuota).toLocaleString()}</p><p><strong>Restantes:</strong> ${rm}</p><p><strong>Próximo:</strong> ${npd.toLocaleDateString()}</p>${isC?'<p style="color:var(--success); font-weight:bold; margin-top:10px;">🎉 ¡Completado!</p>':''}`;
        document.getElementById('modal-credito').style.display = 'flex';
    }

        function openPayModal(isAbono) {
        isCapitalAbonoMode = isAbono; 
        closeModal('modal-credito');
        
        const c = dbData.creditos.find(x => x.id === currentCreditId); 
        currentPayCreditId = currentCreditId;
        
        document.getElementById('modal-pay-title').textContent = isAbono ? 'Abono a Capital' : 'Pagar Cuota';
        
        // Monto por defecto
        const pa = document.getElementById('pay-amount'); 
        pa.value = isAbono ? '' : Math.round(c.cuota);
        
        // Quién paga: por defecto el dueño del crédito
        const payerSelect = document.getElementById('pay-payer');
        payerSelect.innerHTML = '<option value="pipe">Pipe</option><option value="luu">Luu</option>';
        payerSelect.value = c.owner === 'conjunto' ? 'pipe' : c.owner;
        
        // Llenar cuentas
        const ps = document.getElementById('pay-place'); 
        ps.innerHTML = ''; 
        dbData.lugares.forEach(l => { 
            const ownerTag = l.owner === 'pipe' ? ' (Pipe)' : l.owner === 'luu' ? ' (Luu)' : ' (Común)';
            const o = document.createElement('option'); 
            o.value = l.name; 
            o.textContent = l.name + ownerTag; 
            ps.appendChild(o); 
        });
        
        document.getElementById('modal-pay-credit').style.display = 'flex';
    }

        function confirmPayCredit() {
        const v = parseFloat(document.getElementById('pay-amount').value);
        const payerReal = document.getElementById('pay-payer').value; // Quién paga realmente
        const lugar = document.getElementById('pay-place').value;
        
        if(isNaN(v) || v <= 0) return mostrarToast('❌ Monto inválido', 'error');
        
        const c = dbData.creditos.find(x => x.id === currentPayCreditId);
        closeModal('modal-pay-credit');
        procesarPagoCredito(c, v, isCapitalAbonoMode, lugar, payerReal);
    }

    function procesarPagoCredito(c, v, isAbono, lugar, payerReal) {
        // Actualizar saldo del crédito
        if(isAbono) { 
            c.currentBalance -= v; 
        } else { 
            const i = c.currentBalance * c.rate; 
            const principal = v - i; 
            if(principal > 0) c.currentBalance -= principal; 
            c.paidMonths++; 
        }
        if(c.currentBalance < 0) c.currentBalance = 0;
        
        // Determinar split para generar deuda interna si es necesario
        // Si quien paga es distinto al dueño, se genera deuda
        let splitType = '1000';
        let splitP = 100, splitL = 0;
        
        if (c.owner === 'pipe' && payerReal === 'luu') {
            // Luu paga crédito de Pipe → Pipe le debe a Luu
            splitType = '0100'; splitP = 0; splitL = 100;
        } else if (c.owner === 'luu' && payerReal === 'pipe') {
            // Pipe paga crédito de Luu → Luu le debe a Pipe
            splitType = '1000'; splitP = 100; splitL = 0;
        } else if (c.owner === 'conjunto') {
            // Crédito conjunto: 50/50 por defecto
            splitType = '5050'; splitP = 50; splitL = 50;
        }
        
        dbData.movimientos.unshift({ 
            id: Date.now(), 
            date: new Date().toISOString().split('T')[0], 
            desc: `${isAbono ? 'Abono' : 'Pago cuota'}: ${c.name}`, 
            amount: v, 
            category: 'Deudas', 
            type: 'gasto', 
            payer: payerReal, // ¡El que paga realmente!
            splitType: splitType, 
            splitP: splitP, 
            splitL: splitL, 
            lugar: lugar || 'Efectivo', 
            creditoId: c.id 
        });
        
        saveData(); 
        renderCreditos(); 
        renderMovimientos(); 
        updateDashboard(); // Actualiza deudas internas
        
        if('vibrate' in navigator) navigator.vibrate([50,30,50]); 
        
        // Mensaje especial si hubo cruce de pagos
        if (c.owner !== payerReal && c.owner !== 'conjunto') {
            mostrarToast(`💸 ${payerReal.toUpperCase()} pagó. ${c.owner.toUpperCase()} ahora le debe.`, 'warning');
        } else {
            mostrarToast(isAbono ? '✅ Abono registrado' : '✅ Pago registrado', 'success');
        }
        
        if((c.currentBalance <= 0 || c.paidMonths >= c.term) && !c.completed) { 
            c.completed = true; 
            saveData(); 
            renderCreditos(); 
            mostrarCongratulaciones(c.name); 
        }
    }

    function deleteCredito(id) {
        if(!confirm('¿Eliminar crédito y sus pagos asociados?')) return;
        const c = dbData.creditos.find(x=>x.id===id);
        if(c) dbData.movimientos = dbData.movimientos.filter(m => !(m.desc && m.desc.toLowerCase().includes(c.name.toLowerCase()) && (m.desc.toLowerCase().includes('pago cuota') || m.desc.toLowerCase().includes('abono'))));
        dbData.creditos = dbData.creditos.filter(x=>x.id!==id);
        saveData(); renderCreditos(); renderMovimientos(); updateDashboard(); mostrarToast('🗑️ Crédito eliminado', 'warning');
    }
    function deleteCreditoFromModal() { if(currentCreditId) { deleteCredito(currentCreditId); closeModal('modal-credito'); } }

    function mostrarCongratulaciones(name) {
        const o = document.createElement('div'); o.className='congrats-overlay';
        o.innerHTML = `<div class="congrats-modal"><div class="congrats-icon">🎉</div><div class="congrats-title">¡Felicidades!</div><div class="congrats-text">Terminaste de pagar <strong>${name}</strong>. ¡Libertad financiera! 💪</div><button class="congrats-btn" onclick="this.parentElement.parentElement.remove()">¡Genial!</button></div>`;
        document.body.appendChild(o); if('vibrate' in navigator) navigator.vibrate([100,50,100,50,200]);
    }

    document.getElementById('form-compra-credito').addEventListener('submit', e => {
        e.preventDefault();
        const tot = parseFloat(document.getElementById('cc-total').value), dp = parseFloat(document.getElementById('cc-downpayment').value)||0, inst = parseInt(document.getElementById('cc-installments').value), iv = parseFloat(document.getElementById('cc-installment-value').value), paid = parseInt(document.getElementById('cc-paid').value)||0;
        const own = document.getElementById('cc-owner').value, sd = new Date(document.getElementById('cc-start').value), day = parseInt(document.getElementById('cc-day').value);
        const cc = { id: Date.now(), item: document.getElementById('cc-item').value, creditor: document.getElementById('cc-creditor').value, total: tot, downpayment: dp, installments: inst, installmentValue: iv, paid: paid, startDate: document.getElementById('cc-start').value, day: day, owner: own, completed: false };
        if(paid>0 && confirm(`Se generarán ${paid} pagos históricos.`)) {
            for(let i=1;i<=paid;i++) { const pd=new Date(sd); pd.setMonth(sd.getMonth()+i); pd.setDate(day); dbData.movimientos.push({ id: Date.now()+i, date: pd.toISOString().split('T')[0], desc: `Cuota ${i}/${inst}: ${cc.item} (${cc.creditor})`, amount: iv, category: 'Deudas', type: 'gasto', payer: own, splitType: '1000', splitP: own==='pipe'?100:0, splitL: own==='luu'?100:0, lugar: 'Efectivo', compraCreditoId: cc.id }); }
        }
        dbData.comprasCredito.push(cc); saveData(); renderComprasCredito(); e.target.reset(); document.getElementById('cc-start').valueAsDate = new Date();
        if('vibrate' in navigator) navigator.vibrate([50,30,50]); mostrarToast('✅ Compra registrada', 'success');
    });

    function renderComprasCredito() {
        const l = document.getElementById('compras-credito-list'); l.innerHTML = '';
        if(!dbData.comprasCredito.length) { l.innerHTML='<p style="text-align:center; color:var(--text-light); padding:20px;">Sin compras a crédito.</p>'; return; }
        dbData.comprasCredito.forEach(cc => {
            const rem = cc.installments-cc.paid, pct = (cc.paid/cc.installments)*100, isC = cc.paid>=cc.installments;
            if(isC && !cc.completed) { cc.completed=true; saveData(); }
            const d = document.createElement('div'); d.className = 'card' + (isC?' credit-card-completed':'');
            d.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><h3>${cc.item} <small style="font-size:0.8rem; color:var(--text-light)">(${cc.owner})</small></h3><div style="display:flex; gap:5px; align-items:center;">${isC?'<span class="badge bg-completed">✅ PAGADO</span>':''}<button class="delete-btn" onclick="deleteCompraCredito(${cc.id})"><i class="fas fa-trash"></i></button></div></div><p style="font-size:0.85rem; color:var(--text-light); margin-bottom:10px;">A: ${cc.creditor}</p><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${Math.min(100,pct)}%; ${isC?'background:var(--success);':''}"></div></div><div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-bottom:10px;"><span>Cuotas: <strong>${cc.paid}/${cc.installments}</strong></span><span>Restantes: ${rem}</span></div><div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-light);"><span>Total: $${cc.total.toLocaleString()}</span><span>Cuota: $${cc.installmentValue.toLocaleString()}</span></div>${!isC?`<button onclick="pagarCuotaCompra(${cc.id})" class="btn btn-sm" style="margin-top:10px;">💰 Pagar Cuota</button>`:''}`;
            l.appendChild(d);
        });
    }

        function pagarCuotaCompra(id) {
        const cc = dbData.comprasCredito.find(x => x.id === id); 
        if(!cc) return;
        
        // Abrir modal personalizado para esta compra
        currentPayCompraId = id;
        
        document.getElementById('modal-pay-title').textContent = `Pagar Cuota: ${cc.item}`;
        document.getElementById('pay-amount').value = cc.installmentValue;
        
        // Quién paga
        const payerSelect = document.getElementById('pay-payer');
        payerSelect.innerHTML = '<option value="pipe">Pipe</option><option value="luu">Luu</option>';
        payerSelect.value = cc.owner === 'conjunto' ? 'pipe' : cc.owner;
        
        // Cuentas
        const ps = document.getElementById('pay-place'); 
        ps.innerHTML = ''; 
        dbData.lugares.forEach(l => { 
            const ownerTag = l.owner === 'pipe' ? ' (Pipe)' : l.owner === 'luu' ? ' (Luu)' : ' (Común)';
            const o = document.createElement('option'); 
            o.value = l.name; 
            o.textContent = l.name + ownerTag; 
            ps.appendChild(o); 
        });
        
        // Cambiar el botón para que llame a otra función
        const btn = document.querySelector('#modal-pay-credit button:last-child');
        btn.setAttribute('onclick', 'confirmPayCompra()');
        
        document.getElementById('modal-pay-credit').style.display = 'flex';
    }

    // Variable global para compras
    let currentPayCompraId = null;

    function confirmPayCompra() {
        const v = parseFloat(document.getElementById('pay-amount').value);
        const payerReal = document.getElementById('pay-payer').value;
        const lugar = document.getElementById('pay-place').value;
        
        if(isNaN(v) || v <= 0) return mostrarToast('❌ Monto inválido', 'error');
        
        const cc = dbData.comprasCredito.find(x => x.id === currentPayCompraId);
        closeModal('modal-pay-credit');
        
        // Restaurar el botón para créditos
        const btn = document.querySelector('#modal-pay-credit button:last-child');
        btn.setAttribute('onclick', 'confirmPayCredit()');
        
        cc.paid++;
        
        // Determinar split para deuda interna
        let splitType = '1000', splitP = 100, splitL = 0;
        
        if (cc.owner === 'pipe' && payerReal === 'luu') {
            splitType = '0100'; splitP = 0; splitL = 100;
        } else if (cc.owner === 'luu' && payerReal === 'pipe') {
            splitType = '1000'; splitP = 100; splitL = 0;
        } else if (cc.owner === 'conjunto') {
            splitType = '5050'; splitP = 50; splitL = 50;
        }
        
        dbData.movimientos.unshift({ 
            id: Date.now(), 
            date: new Date().toISOString().split('T')[0], 
            desc: `Cuota ${cc.paid}/${cc.installments}: ${cc.item} (${cc.creditor})`, 
            amount: v, 
            category: 'Deudas', 
            type: 'gasto', 
            payer: payerReal, 
            splitType: splitType, 
            splitP: splitP, 
            splitL: splitL, 
            lugar: lugar || 'Efectivo', 
            compraCreditoId: cc.id 
        });
        
        saveData(); 
        renderComprasCredito(); 
        renderMovimientos(); 
        updateDashboard();
        
        if('vibrate' in navigator) navigator.vibrate([50,30,50]); 
        
        if (cc.owner !== payerReal && cc.owner !== 'conjunto') {
            mostrarToast(`💸 ${payerReal.toUpperCase()} pagó. ${cc.owner.toUpperCase()} ahora le debe.`, 'warning');
        } else {
            mostrarToast('✅ Cuota pagada', 'success');
        }
        
        if(cc.paid >= cc.installments && !cc.completed) { 
            cc.completed = true; 
            saveData(); 
            renderComprasCredito(); 
            mostrarCongratulaciones(cc.item); 
        }
    }

    function deleteCompraCredito(id) {
        if(!confirm('¿Eliminar compra y sus pagos?')) return;
        const cc = dbData.comprasCredito.find(x=>x.id===id);
        if(cc) dbData.movimientos = dbData.movimientos.filter(m => !(m.desc && m.desc.includes(cc.item) && m.desc.includes(cc.creditor)));
        dbData.comprasCredito = dbData.comprasCredito.filter(x=>x.id!==id);
        saveData(); renderComprasCredito(); renderMovimientos(); updateDashboard(); mostrarToast('️ Eliminado', 'warning');
    }

    document.getElementById('form-proyecto').addEventListener('submit', e => {
        e.preventDefault();
        const p = { id: Date.now(), name: document.getElementById('p-name').value, goal: parseFloat(document.getElementById('p-goal').value), current: parseFloat(document.getElementById('p-current').value), deadline: document.getElementById('p-deadline').value, locations: [] };
        if(p.current>0) { p.locations.push({name:'General', amount:p.current, yield:0}); dbData.movimientos.unshift({id:Date.now(), date:new Date().toISOString().split('T')[0], desc:`Ahorro inicial: ${p.name}`, amount:p.current, category:'Ahorro/Proyecto', type:'gasto', payer:'pipe', splitType:'1000', splitP:100, splitL:0, lugar:'Efectivo'}); }
        dbData.proyectos.push(p); saveData(); renderProyectos(); e.target.reset();
        if('vibrate' in navigator) navigator.vibrate([50,30,50]); mostrarToast('✅ Proyecto creado', 'success');
    });

    function renderProyectos() {
        const l = document.getElementById('proyectos-list'); l.innerHTML = '';
        dbData.proyectos.forEach(p => {
            const tc = p.locations ? p.locations.reduce((s,x)=>s+parseFloat(x.amount),0) : parseFloat(p.current||0), pct = Math.min(100,(tc/p.goal)*100);
            const d = document.createElement('div'); d.className='card'; d.onclick=()=>openProjectModal(p.id); d.style.cursor='pointer';
            d.innerHTML = `<div style="display:flex; justify-content:space-between;"><h3>${p.name}</h3><button class="delete-btn" onclick="event.stopPropagation(); deleteProject(${p.id})"><i class="fas fa-trash"></i></button></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%"></div></div><div style="display:flex; justify-content:space-between; font-size:0.9rem;"><span>$${tc.toLocaleString()}</span><span>Meta: $${p.goal.toLocaleString()}</span></div>${p.locations&&p.locations.length?`<div style="font-size:0.75rem; color:var(--text-light); margin-top:5px;">${p.locations.length} ubicación(es)</div>`:''}`;
            l.appendChild(d);
        });
    }

    function openProjectModal(id) {
        currentProjectId = id; const p = dbData.proyectos.find(x=>x.id===id);
        document.getElementById('modal-p-title').textContent = p.name;
        const tc = p.locations ? p.locations.reduce((s,x)=>s+parseFloat(x.amount),0) : parseFloat(p.current||0), pct = Math.min(100,(tc/p.goal)*100);
        document.getElementById('modal-p-progress').style.width = pct+'%'; document.getElementById('modal-p-stats').textContent = `${pct.toFixed(1)}% - $${tc.toLocaleString()} de $${p.goal.toLocaleString()}`;
        renderProjectLocations(p);
        const s = document.getElementById('modal-p-location-select'); s.innerHTML='';
        if(p.locations&&p.locations.length) p.locations.forEach((x,i) => { const o=document.createElement('option'); o.value=i; o.textContent=`${x.name} ($${parseFloat(x.amount).toLocaleString()})`; s.appendChild(o); });
        document.getElementById('modal-p-amount').value=''; document.getElementById('modal-proyecto').style.display='flex';
    }

    function renderProjectLocations(p) {
        const c = document.getElementById('modal-p-locations-container');
        if(!p.locations||!p.locations.length) { c.innerHTML='<p style="color:var(--text-light); font-size:0.85rem; text-align:center; padding:10px;">Sin ubicaciones.</p>'; return; }
        let h = '<div class="project-locations"><h4 style="margin-bottom:10px; font-size:0.95rem;">Ubicaciones</h4>';
        p.locations.forEach((x,i) => {
            const yb = x.yield>0?`<span class="badge" style="background:#D1FAE5; color:#065F46; margin-left:5px;">${x.yield}% anual</span>`:'';
            h += `<div class="list-item"><div class="item-info"><div class="item-title">${x.name} ${yb}</div><div class="item-sub">Rendimiento: ${x.yield||0}%</div></div><div style="display:flex; align-items:center; gap:10px;"><div style="font-weight:bold; color:var(--accent-blue);">$${parseFloat(x.amount).toLocaleString()}</div><button class="delete-btn" onclick="event.stopPropagation(); deleteLocation(${i})"><i class="fas fa-trash"></i></button></div></div>`;
        });
        c.innerHTML = h+'</div>';
    }

    function openAddLocationModal() { document.getElementById('loc-name').value=''; document.getElementById('loc-amount').value=''; document.getElementById('loc-yield').value='0'; document.getElementById('modal-add-location').style.display='flex'; }
    function saveLocation() {
        const n = document.getElementById('loc-name').value.trim(), a = parseFloat(document.getElementById('loc-amount').value), y = parseFloat(document.getElementById('loc-yield').value)||0;
        if(!n||isNaN(a)||a<0) return mostrarToast('❌ Inválido', 'error');
        const p = dbData.proyectos.find(x=>x.id===currentProjectId); if(!p.locations) p.locations=[];
        p.locations.push({name:n, amount:a, yield:y}); saveData(); renderProjectLocations(p); closeModal('modal-add-location'); mostrarToast('✅ Añadido', 'success');
    }
    function deleteLocation(i) { if(confirm('¿Eliminar ubicación?')) { const p=dbData.proyectos.find(x=>x.id===currentProjectId); p.locations.splice(i,1); saveData(); renderProjectLocations(p); mostrarToast('🗑️ Eliminado', 'warning'); } }
    function saveProjectFund() {
        const li = parseInt(document.getElementById('modal-p-location-select').value), a = parseFloat(document.getElementById('modal-p-amount').value);
        if(!a||a<=0) return mostrarToast('❌ Inválido', 'error');
        const p = dbData.proyectos.find(x=>x.id===currentProjectId);
        if(p.locations&&p.locations[li]) p.locations[li].amount+=a; else { if(!p.locations) p.locations=[]; p.locations.push({name:'General', amount:a, yield:0}); }
        dbData.movimientos.unshift({id:Date.now(), date:new Date().toISOString().split('T')[0], desc:`Ahorro: ${p.name}`, amount:a, category:'Ahorro/Proyecto', type:'gasto', payer:'pipe', splitType:'1000', splitP:100, splitL:0, lugar:'Efectivo'});
        saveData(); renderProyectos(); openProjectModal(currentProjectId);
        if('vibrate' in navigator) navigator.vibrate([50,30,50]); mostrarToast('✅ Ahorro registrado', 'success');
    }
    function deleteCurrentProject() { if(confirm('¿Eliminar proyecto?')) { dbData.proyectos=dbData.proyectos.filter(x=>x.id!==currentProjectId); saveData(); renderProyectos(); closeModal('modal-proyecto'); mostrarToast('️ Eliminado', 'warning'); } }
    function deleteProject(id) { if(confirm('¿Eliminar?')) { dbData.proyectos=dbData.proyectos.filter(x=>x.id!==id); saveData(); renderProyectos(); mostrarToast('🗑️ Eliminado', 'warning'); } }

    function renderCategories() {
        const s = document.getElementById('m-category'), l = document.getElementById('config-categories-list'); s.innerHTML=''; l.innerHTML='';
        dbData.categorias.forEach(c => { if(c !== 'Transferencia') { const o=document.createElement('option'); o.value=c; o.textContent=c; s.appendChild(o); l.innerHTML+=`<div class="list-item"><span>${c}</span><button class="delete-btn" onclick="removeCategory('${c}')"><i class="fas fa-times"></i></button></div>`; } });
    }
    function addCategory() { const n = document.getElementById('new-cat-name').value; if(n&&!dbData.categorias.includes(n)) { dbData.categorias.push(n); saveData(); renderCategories(); document.getElementById('new-cat-name').value=''; mostrarToast('✅ Añadida', 'success'); } }
    function removeCategory(n) { if(confirm('¿Quitar?')) { dbData.categorias=dbData.categorias.filter(x=>x!==n); saveData(); renderCategories(); mostrarToast('️ Quitada', 'warning'); } }

        function renderPlaces() {
        const s = document.getElementById('m-place'), sd = document.getElementById('m-place-dest'), l = document.getElementById('config-places-list'); 
        if(!s||!l) return; 
        s.innerHTML=''; sd.innerHTML=''; l.innerHTML='';
        
        dbData.lugares.forEach((p, idx) => { 
            // Etiqueta visual del dueño
            const ownerTag = p.owner === 'pipe' ? '👤 Pipe' : p.owner === 'luu' ? ' Luu' : '👥 Conjunto';
            const displayName = `${p.name} <span style="font-size:0.75rem; color:var(--text-light); margin-left:5px;">(${ownerTag})</span>`;
            
            const o1=document.createElement('option'); o1.value=p.name; o1.innerHTML=displayName; s.appendChild(o1);
            const o2=document.createElement('option'); o2.value=p.name; o2.innerHTML=displayName; sd.appendChild(o2);
            
            l.innerHTML+=`<div class="list-item">
                <div class="item-info">
                    <span><i class="fas fa-wallet" style="color:var(--accent-blue); margin-right:8px;"></i>${p.name}</span>
                    <div class="item-sub">Dueño: ${ownerTag} | Saldo: $${(p.saldo||0).toLocaleString()}</div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="btn btn-sm" onclick="editPlaceSaldo(${idx})" style="width:auto; padding:6px 10px;"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" onclick="removePlace('${p.name.replace(/'/g,"\\'")}')"><i class="fas fa-times"></i></button>
                </div>
            </div>`; 
        });
    }

    function addPlace() { 
        const n = document.getElementById('new-place-name').value.trim(); 
        const owner = document.getElementById('new-place-owner').value; // Nuevo campo
        
        if(n && !dbData.lugares.find(l => l.name.toLowerCase() === n.toLowerCase())) { 
            dbData.lugares.push({name: n, owner: owner, saldo: 0}); 
            saveData(); renderPlaces(); 
            document.getElementById('new-place-name').value=''; 
            mostrarToast('✅ Cuenta añadida', 'success'); 
        } else if (dbData.lugares.find(l => l.name.toLowerCase() === n.toLowerCase())) {
            mostrarToast('⚠️ Esa cuenta ya existe', 'warning');
        }
    }

    function editPlaceSaldo(idx) {
        const p = dbData.lugares[idx];
        const nuevoSaldo = prompt(`Saldo inicial de "${p.name}":`, p.saldo || 0);
        if (nuevoSaldo !== null && !isNaN(parseFloat(nuevoSaldo))) {
            p.saldo = parseFloat(nuevoSaldo);
            saveData(); renderPlaces(); updateDashboard();
            mostrarToast('✅ Saldo actualizado', 'success');
        }
    }

    function removePlace(n) { if(confirm(`¿Quitar "${n}"?`)) { dbData.lugares=dbData.lugares.filter(x=>x.name!==n); saveData(); renderPlaces(); mostrarToast('️ Quitado', 'warning'); } }

    function renderBudgetsConfig() {
        const l = document.getElementById('config-budgets-list'); if(!l) return; l.innerHTML='';
        const p = dbData.presupuestos||{}, cats = Object.keys(p);
        if(!cats.length) { l.innerHTML='<p style="color:var(--text-light); font-size:0.9rem; text-align:center; padding:10px;">Sin presupuestos.</p>'; return; }
        cats.forEach(c => { l.innerHTML+=`<div class="list-item"><div class="item-info"><div class="item-title">${c}</div><div class="item-sub">Límite: $${p[c].toLocaleString()}/mes</div></div><button class="delete-btn" onclick="removeBudget('${c.replace(/'/g,"\\'")}')"><i class="fas fa-times"></i></button></div>`; });
    }
    function openBudgetModal() { const s=document.getElementById('budget-category'); s.innerHTML=''; dbData.categorias.forEach(c => { if(!['Deudas','Ahorro/Proyecto','Transferencia'].includes(c)) { const o=document.createElement('option'); o.value=c; o.textContent=c; s.appendChild(o); } }); document.getElementById('budget-amount').value=''; document.getElementById('modal-budget').style.display='flex'; }
    function saveBudget() { const c=document.getElementById('budget-category').value, a=parseFloat(document.getElementById('budget-amount').value); if(!c||!a||a<=0) return mostrarToast('❌ Inválido', 'error'); if(!dbData.presupuestos) dbData.presupuestos={}; dbData.presupuestos[c]=a; saveData(); renderBudgetsConfig(); closeModal('modal-budget'); mostrarToast('✅ Guardado', 'success'); }
    function removeBudget(c) { if(confirm(`¿Eliminar presupuesto de "${c}"?`)) { delete dbData.presupuestos[c]; saveData(); renderBudgetsConfig(); mostrarToast('️ Eliminado', 'warning'); } }

    function resetAll() {
        if(confirm('️ ¿ESTÁS SEGURO? Se borrará TODO.')) {
            if(confirm('🚨 ÚLTIMA OPORTUNIDAD: ¿Realmente borrar TODO?')) {
                localStorage.removeItem('pipeLuuData_v2');
                dbData = { movimientos:[], recurrentes:[], creditos:[], comprasCredito:[], proyectos:[], categorias:['Hogar','Comida','Transporte','Ocio','Salud','Gatos','Ahorro/Proyecto','Deudas','Otros','Transferencia'], lugares:[{name:'Efectivo',saldo:0},{name:'Cuenta Ahorros',saldo:0},{name:'Nequi',saldo:0},{name:'Daviplata',saldo:0}], presupuestos:{} };               
                saveData(); location.reload();
            }
        }
    }

    function exportCSV() {
        let c = "fecha,tipo,descripcion,monto,categoria,lugar,lugarDestino,payer,splitType,splitP,splitL\n";
        dbData.movimientos.forEach(m => { c += `${m.date},${m.type},"${m.desc}",${m.amount},${m.category},${m.lugar||''},${m.lugarDestino||''},${m.payer},${m.splitType||''},${m.splitP||''},${m.splitL||''}\n`; });
        const b = new Blob([c], {type:'text/csv'}), u = URL.createObjectURL(b), a = document.createElement('a'); a.href=u; a.download='finanzas_pipe_luu.csv'; a.click(); mostrarToast(' Descargado', 'success');
    }

    function importCSV() {
        const f = document.getElementById('csv-file').files[0]; if(!f) return alert('Selecciona archivo');
        const r = new FileReader(); r.onload = e => {
            const t = e.target.result, rows = t.split('\n').slice(1); let cnt=0;
            rows.forEach(row => { 
                const cols=row.split(','); 
                if(cols.length>=5) { 
                    dbData.movimientos.push({
                        id:Date.now()+Math.random(), date:cols[0], type:cols[1], desc:cols[2].replace(/"/g,''), amount:parseFloat(cols[3]), category:cols[4], 
                        lugar:cols[5]||'Efectivo', lugarDestino:cols[6]||cols[5]||'Efectivo',
                        payer:cols[7]||'pipe', splitType:cols[8]||'1000', splitP:cols[9]||100, splitL:cols[10]||0
                    }); 
                    cnt++; 
                } 
            });
            saveData(); renderMovimientos(); mostrarToast(`✅ ${cnt} importados`, 'success');
        }; r.readAsText(f);
    }
        function renderRecurrentes() {
        const l = document.getElementById('recurrentes-list');
        if(!l) return;
        l.innerHTML = '';
        if(!dbData.recurrentes || dbData.recurrentes.length === 0) {
            l.innerHTML = '<p style="color:var(--text-light); font-size:0.9rem; text-align:center; padding:10px;">No hay movimientos recurrentes configurados.</p>';
            return;
        }
        dbData.recurrentes.forEach((r, idx) => {
            const icon = r.type === 'ingreso' ? '🟢' : (r.type === 'transferencia' ? '🔵' : '');
            l.innerHTML += `<div class="list-item">
                <div class="item-info">
                    <div class="item-title">${icon} ${r.desc}</div>
                    <div class="item-sub">$${parseFloat(r.amount).toLocaleString()} | Día: ${r.dayOfMonth} | ${r.category}</div>
                </div>
                <button class="delete-btn" onclick="deleteRecurrente(${idx})"><i class="fas fa-trash"></i></button>
            </div>`;
        });
    }

    function deleteRecurrente(idx) {
        if(confirm('¿Dejar de repetir este movimiento en los próximos meses? (No borra los pasados)')) {
            dbData.recurrentes.splice(idx, 1);
            saveData();
            renderRecurrentes();
            mostrarToast('🗑️ Recurrente eliminado', 'warning');
        }
    }
// --- VARIABLES PARA GRÁFICOS ---
let reportMonthOffset = 0;

// Helper seguro para destruir y recrear gráficos sin errores
function getSafeChartCtx(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
    return canvas.getContext('2d');
}

function changeReportMonth(delta) {
    reportMonthOffset += delta;
    currentMonthOffset = reportMonthOffset; // Sincronizar con dashboard
    updateDashboard(); // Actualizar también el dashboard por si acaso
    renderAllCharts();
}

function renderAllCharts() {
    // Sincronizar offsets al entrar o cambiar mes
    reportMonthOffset = currentMonthOffset;

    const td = getTargetDate(reportMonthOffset);
    const mn = td.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    const labelEl = document.getElementById('report-month-label');
    if (labelEl) labelEl.textContent = mn.charAt(0).toUpperCase() + mn.slice(1);

    renderChartCategorias();
    renderChartIngresosGastos();
    renderChartBalance();
    renderChartTopGastos();
}

function renderChartCategorias() {
    const ctx = getSafeChartCtx('chart-categorias');
    if (!ctx) return;

    const td = getTargetDate(reportMonthOffset);
    const y = td.getFullYear(), m = td.getMonth();
    const gastosPorCat = {};

    dbData.movimientos.forEach(mov => {
        const d = new Date(mov.date);
        if (mov.type === 'gasto' && d.getFullYear() === y && d.getMonth() === m) {
            const cat = mov.category || 'Otros';
            if (!['Deudas', 'Ahorro/Proyecto', 'Transferencia'].includes(cat)) {
                gastosPorCat[cat] = (gastosPorCat[cat] || 0) + parseFloat(mov.amount);
            }
        }
    });

    const labels = Object.keys(gastosPorCat);
    const data = Object.values(gastosPorCat);

    if (labels.length === 0) {
        new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['Sin gastos'], datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
        return;
    }

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data, backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

function renderChartIngresosGastos() {
    const ctx = getSafeChartCtx('chart-ingresos-gastos');
    if (!ctx) return;

    const td = getTargetDate(reportMonthOffset);
    const y = td.getFullYear(), m = td.getMonth();
    let ingresos = 0, gastos = 0;

    dbData.movimientos.forEach(mov => {
        const d = new Date(mov.date);
        if (d.getFullYear() === y && d.getMonth() === m) {
            if (mov.type === 'ingreso') ingresos += parseFloat(mov.amount);
            if (mov.type === 'gasto') gastos += parseFloat(mov.amount);
        }
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ingresos', 'Gastos'],
            datasets: [{ label: 'Monto ($)', data: [ingresos, gastos], backgroundColor: ['#10B981', '#EF4444'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function renderChartBalance() {
    const ctx = getSafeChartCtx('chart-balance');
    if (!ctx) return;

    const balances = [], labels = [];
    for (let i = 5; i >= 0; i--) {
        const td = getTargetDate(-i);
        const y = td.getFullYear(), m = td.getMonth();
        const mesName = td.toLocaleString('es-ES', { month: 'short' });
        let inc = 0, exp = 0;
        dbData.movimientos.forEach(mov => {
            const d = new Date(mov.date);
            if (d.getFullYear() === y && d.getMonth() === m) {
                if (mov.type === 'ingreso') inc += parseFloat(mov.amount);
                if (mov.type === 'gasto') exp += parseFloat(mov.amount);
            }
        });
        balances.push(inc - exp);
        labels.push(mesName);
    }

    new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: 'Balance ($)', data: balances, borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function renderChartTopGastos() {
    const ctx = getSafeChartCtx('chart-top-gastos');
    if (!ctx) return;

    const td = getTargetDate(reportMonthOffset);
    const y = td.getFullYear(), m = td.getMonth();
    const gastosPorDesc = {};

    dbData.movimientos.forEach(mov => {
        const d = new Date(mov.date);
        if (mov.type === 'gasto' && d.getFullYear() === y && d.getMonth() === m) {
            gastosPorDesc[mov.desc] = (gastosPorDesc[mov.desc] || 0) + parseFloat(mov.amount);
        }
    });

    const sorted = Object.entries(gastosPorDesc).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (sorted.length === 0) {
        new Chart(ctx, {
            type: 'bar',
            data: { labels: ['Sin datos'], datasets: [{ data: [0], backgroundColor: ['#e2e8f0'] }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
        return;
    }

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(x => x[0].length > 15 ? x[0].substring(0, 15) + '...' : x[0]),
            datasets: [{ label: 'Gasto ($)', data: sorted.map(x => x[1]), backgroundColor: '#F59E0B' }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}
