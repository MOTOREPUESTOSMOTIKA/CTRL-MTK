/* --- ESTADO GLOBAL --- */
let productos = [];
let transacciones = [];
let encargos = [];
let historialReportes = [];

/* --- FORMATEO --- */
function limpiarNumero(valor) {
    if (!valor) return 0;
    return parseFloat(valor.toString().replace(/\./g, '').replace(',', '.')) || 0;
}
function formatearNumero(valor) {
    return Number(valor || 0).toLocaleString('es-CO');
}

/* --- FIREBASE --- */
db.ref('motika_data/').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        productos = data.productos || [];
        transacciones = data.transacciones || [];
        encargos = data.encargos || [];
        historialReportes = data.historialReportes || [];
        renderTodo();
    }
});

function actualizarTodo() {
    db.ref('motika_data/').set({
        productos, transacciones, encargos, historialReportes
    });
    renderTodo();
}

function renderTodo() {
    renderInventario();
    renderPedidos();
    renderDeudas();
    renderFinanzas();
    renderDashboard();
    renderHistorialReportes();
}

/* --- INVENTARIO (EDITABLE) --- */
const fProd = document.getElementById('form-producto');
if(fProd) {
    fProd.addEventListener('submit', (e) => {
        e.preventDefault();
        productos.push({
            id: Date.now(),
            nombre: document.getElementById('prod-nombre').value,
            cantidad: parseInt(document.getElementById('prod-cantidad').value),
            costo: limpiarNumero(document.getElementById('prod-costo').value),
            precio: limpiarNumero(document.getElementById('prod-precio').value)
        });
        actualizarTodo();
        fProd.reset();
    });
}

window.editarStock = function(id) {
    const p = productos.find(x => x.id === id);
    const nuevoStock = prompt(`Editar stock para ${p.nombre}:`, p.cantidad);
    if(nuevoStock !== null) {
        p.cantidad = parseInt(nuevoStock) || 0;
        actualizarTodo();
    }
}

function renderInventario() {
    const t = document.getElementById('tabla-inventario');
    if(!t) return;
    let cTotal = 0, vTotal = 0;
    t.innerHTML = productos.map(p => {
        cTotal += (p.costo * p.cantidad); 
        vTotal += (p.precio * p.cantidad);
        return `<tr>
            <td>${p.nombre}</td>
            <td onclick="editarStock(${p.id})" style="cursor:pointer; font-weight:bold; color:blue;">${p.cantidad} ✏️</td>
            <td>$${formatearNumero(p.costo)}</td>
            <td>$${formatearNumero(p.precio)}</td>
            <td><button class="btn-danger" onclick="eliminarProd(${p.id})">❌</button></td>
        </tr>`;
    }).join('');
    document.getElementById('float-costo').innerText = `$${formatearNumero(cTotal)}`;
    document.getElementById('float-venta').innerText = `$${formatearNumero(vTotal)}`;
}

window.eliminarProd = function(id) { if(confirm("¿Eliminar?")) { productos = productos.filter(p => p.id !== id); actualizarTodo(); } }

/* --- PEDIDOS --- */
window.agregarFila = function() {
    const div = document.createElement('div');
    div.className = 'fila-producto';
    div.innerHTML = `<input type="text" placeholder="Producto" class="p-nombre" required><input type="number" placeholder="Cant." class="p-cant" required><button type="button" onclick="this.parentElement.remove()">✕</button>`;
    document.getElementById('contenedor-filas-productos').appendChild(div);
}

const fEnc = document.getElementById('form-encargo');
if(fEnc) {
    fEnc.addEventListener('submit', (e) => {
        e.preventDefault();
        const cliente = document.getElementById('enc-cliente').value;
        const total = limpiarNumero(document.getElementById('enc-total').value);
        const abono = limpiarNumero(document.getElementById('enc-abono').value);
        const pedido = {
            id: Date.now(),
            cliente, total, abono, deuda: total - abono,
            entregado: false,
            items: Array.from(document.querySelectorAll('.fila-producto')).map(f => ({
                nombre: f.querySelector('.p-nombre').value, cant: f.querySelector('.p-cant').value, entregado: false
            }))
        };
        encargos.push(pedido);
        if(abono > 0) registrarMovimiento('ingreso', `Abono inicial: ${cliente}`, abono);
        actualizarTodo();
        fEnc.reset();
    });
}

function renderPedidos() {
    const c = document.getElementById('lista-pedidos-clientes');
    if(!c) return;
    c.innerHTML = encargos.filter(e => !e.entregado).map(e => `
        <div class="card">
            <strong>👤 ${e.cliente}</strong><hr>
            ${e.items.map((it, idx) => `
                <div style="display:flex; justify-content:space-between; margin:5px 0;">
                    <span>${it.nombre} (x${it.cant})</span>
                    ${it.entregado ? '✅' : `<button onclick="entregarItem(${e.id}, ${idx})">Entregar</button>`}
                </div>
            `).join('')}
            <button onclick="entregarTodoPedido(${e.id})" style="background:green; color:white; width:100%; margin-top:10px;">Entregar Todo</button>
        </div>
    `).join('');
}

window.entregarItem = function(pedId, itemIdx) {
    const e = encargos.find(x => x.id === pedId);
    const item = e.items[itemIdx];
    const tipo = confirm(`¿Desea sumar la entrega de "${item.nombre}" como VENTA en caja? (Aceptar = Venta, Cancelar = Poner como deudor)`);
    item.entregado = true;
    if(tipo) registrarMovimiento('ingreso', `Entrega Pedido: ${item.nombre} (${e.cliente})`, (e.total / e.items.length));
    else alert("Registrado como pendiente del cliente.");
    actualizarTodo();
}

window.entregarTodoPedido = function(id) {
    const e = encargos.find(x => x.id === id);
    if(confirm(`¿Finalizar y entregar todo de ${e.cliente}?`)) {
        e.entregado = true;
        e.items.forEach(i => i.entregado = true);
        actualizarTodo();
    }
}

/* --- DEUDORES (ACUMULATIVO) --- */
const fDeuda = document.getElementById('form-deuda-directa');
if(fDeuda) {
    fDeuda.addEventListener('submit', (e) => {
        e.preventDefault();
        const nombre = document.getElementById('deuda-cliente').value.trim();
        const monto = limpiarNumero(document.getElementById('deuda-monto').value);
        let deudor = encargos.find(x => x.cliente.toLowerCase() === nombre.toLowerCase());
        if(deudor) {
            deudor.deuda += monto;
            deudor.total += monto;
        } else {
            encargos.push({ id: Date.now(), cliente: nombre, total: monto, abono: 0, deuda: monto, entregado: true, items: [] });
        }
        actualizarTodo();
        fDeuda.reset();
    });
}

window.abonar = function(id) {
    const e = encargos.find(x => x.id === id);
    const monto = limpiarNumero(document.getElementById(`in-abono-${id}`).value);
    if(monto > 0 && monto <= e.deuda) {
        e.deuda -= monto;
        e.abono += monto;
        registrarMovimiento('ingreso', `Abono de Deuda: ${e.cliente}`, monto);
        actualizarTodo();
    }
}

function renderDeudas() {
    const t = document.getElementById('tabla-deudores');
    if(!t) return;
    t.innerHTML = encargos.filter(e => e.deuda > 0).map(e => `
        <tr><td>${e.cliente}</td><td style="color:red">$${formatearNumero(e.deuda)}</td>
        <td><input type="number" id="in-abono-${e.id}" style="width:70px"></td>
        <td><button onclick="abonar(${e.id})">Abonar</button></td></tr>
    `).join('');
}

/* --- FINANZAS Y GASTOS --- */
function registrarMovimiento(tipo, desc, monto) {
    transacciones.push({ id: Date.now(), tipo, desc, monto, fecha: new Date().toLocaleDateString() });
}

const fTrans = document.getElementById('form-transaccion');
if(fTrans) {
    fTrans.addEventListener('submit', (e) => {
        e.preventDefault();
        const tipo = document.getElementById('trans-tipo').value;
        let monto = limpiarNumero(document.getElementById('trans-monto').value);
        let desc = document.getElementById('trans-desc').value;
        if(tipo === 'venta') {
            const p = productos.find(x => x.id == document.getElementById('select-producto-id').value);
            const cant = parseInt(document.getElementById('trans-cantidad').value);
            if(p && p.cantidad >= cant) {
                p.cantidad -= cant;
                monto = p.precio * cant;
                desc = `Venta: ${p.nombre} x${cant}`;
            } else return alert("Sin stock");
        }
        registrarMovimiento(tipo === 'gasto' ? 'gasto' : 'ingreso', desc, monto);
        actualizarTodo();
        fTrans.reset();
    });
}

/* --- DASHBOARD (SISTEMA DE DOS COLUMNAS) --- */
function renderDashboard() {
    let ingH = 0, gasH = 0; // Históricos
    let ingC = 0, gasC = 0; // De la caja actual

    // Histórico: Reportes guardados + transacciones actuales
    historialReportes.forEach(r => { ingH += r.totalIngresos; gasH += r.totalGastos; });
    transacciones.forEach(t => {
        if(t.tipo === 'ingreso') { ingH += t.monto; ingC += t.monto; }
        else { gasH += t.monto; gasC += t.monto; }
    });

    document.getElementById('total-ganancias-hist').innerText = `$${formatearNumero(ingH)}`;
    document.getElementById('total-gastos-hist').innerText = `$${formatearNumero(gasH)}`;
    document.getElementById('ganancia-neta-hist').innerText = `$${formatearNumero(ingH - gasH)}`;

    document.getElementById('total-ganancias-caja').innerText = `$${formatearNumero(ingC)}`;
    document.getElementById('total-gastos-caja').innerText = `$${formatearNumero(gasC)}`;
    document.getElementById('balance-final-caja').innerText = `$${formatearNumero(ingC - gasC)}`;

    let vCosto = productos.reduce((acc, p) => acc + (p.costo * p.cantidad), 0);
    document.getElementById('dash-valor-inv').innerText = `$${formatearNumero(vCosto)}`;
    document.getElementById('dash-patrimonio').innerText = `$${formatearNumero(vCosto + (ingC - gasC))}`;
}

/* --- CIERRE DE CAJA --- */
window.cerrarCaja = function() {
    if(!confirm("¿Cerrar caja ahora? Esto limpiará la columna de 'Corte Actual'")) return;
    let ing = 0, gas = 0;
    transacciones.forEach(t => t.tipo === 'ingreso' ? ing += t.monto : gas += t.monto);
    historialReportes.push({
        id: Date.now(), fecha: new Date().toLocaleString(),
        totalIngresos: ing, totalGastos: gas, balance: ing - gas
    });
    transacciones = [];
    actualizarTodo();
}

function renderHistorialReportes() {
    const h = document.getElementById('historial-reportes');
    if(h) h.innerHTML = historialReportes.map(r => `<div class="card"><strong>📅 ${r.fecha}</strong><br>Balance: $${formatearNumero(r.balance)}</div>`).reverse().join('');
}

function renderFinanzas() {
    const l = document.getElementById('lista-transacciones');
    if(l) l.innerHTML = transacciones.map(t => `<tr><td>${t.fecha}</td><td>${t.desc}</td><td style="color:${t.tipo==='ingreso'?'green':'red'}">$${formatearNumero(t.monto)}</td></tr>`).reverse().join('');
}

/* --- UTILIDADES --- */
window.toggleMenu = function() { document.getElementById('sidebar').classList.toggle('active'); }
window.showSection = function(id) { document.querySelectorAll('section').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }
window.toggleProductoSelector = function() {
    const isV = document.getElementById('trans-tipo').value === 'venta';
    document.getElementById('contenedor-busqueda-prod').style.display = isV ? 'block' : 'none';
    document.getElementById('trans-cantidad').style.display = isV ? 'block' : 'none';
    document.getElementById('trans-monto').style.display = isV ? 'none' : 'block';
    document.getElementById('trans-desc').style.display = isV ? 'none' : 'block';
}

const inBusq = document.getElementById('input-buscar-prod');
if(inBusq) {
    inBusq.addEventListener('input', () => {
        const txt = inBusq.value.toLowerCase();
        const sug = document.getElementById('lista-sugerencias');
        sug.innerHTML = '';
        productos.filter(p => p.nombre.toLowerCase().includes(txt)).forEach(p => {
            const d = document.createElement('div');
            d.innerText = `${p.nombre} (Stock: ${p.cantidad})`;
            d.onclick = () => { inBusq.value = p.nombre; document.getElementById('select-producto-id').value = p.id; sug.innerHTML = ''; };
            sug.appendChild(d);
        });
    });
}
window.onload = () => { if(typeof toggleProductoSelector === 'function') toggleProductoSelector(); };
