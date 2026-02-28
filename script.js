/* --- ESTADO GLOBAL --- */
let productos = [];
let transacciones = [];
let encargos = [];
let historialReportes = [];

/* --- FORMATEO DE NÚMEROS --- */
function limpiarNumero(valor) {
    if (!valor) return 0;
    // Elimina puntos de miles y cambia coma por punto decimal si existe
    return parseFloat(valor.toString().replace(/\./g, '').replace(',', '.')) || 0;
}
function formatearNumero(valor) {
    return Number(valor || 0).toLocaleString('es-CO');
}

/* --- SINCRONIZACIÓN FIREBASE --- */
/* --- INICIO FORZADO DE DATOS --- */
function cargarDatosDesdeNube() {
    console.log("Intentando conectar con Firebase...");
    db.ref('motika_data/').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            console.log("Datos recibidos correctamente:", data);
            productos = data.productos || [];
            transacciones = data.transacciones || [];
            encargos = data.encargos || [];
            historialReportes = data.historialReportes || [];
            renderTodo(); // Esto dibuja todo en pantalla
        } else {
            console.log("Firebase está vacío o no hay datos aún.");
        }
    }, (error) => {
        console.error("Error de lectura en Firebase:", error);
    });
}

/* --- VARIABLES GLOBALES --- */
let productos = [];
let transacciones = [];
let encargos = [];
let historialReportes = [];

/* --- FUNCIONES DE FORMATEO --- */
function limpiarNumero(valor) {
    if (!valor) return 0;
    return parseFloat(valor.toString().replace(/\./g, '').replace(',', '.')) || 0;
}
function formatearNumero(valor) {
    return Number(valor || 0).toLocaleString('es-CO');
}

/* --- FUNCIÓN DE GUARDADO --- */
function actualizarTodo() {
    db.ref('motika_data/').set({
        productos: productos,
        transacciones: transacciones,
        encargos: encargos,
        historialReportes: historialReportes
    }).then(() => {
        console.log("Sincronizado con éxito.");
    }).catch(err => alert("Error al guardar: " + err));
    renderTodo();
}

/* --- RENDERIZADO DEL DASHBOARD CORREGIDO --- */
function renderDashboard() {
    let ingHist = 0, gasHist = 0;
    let ingCaja = 0, gasCaja = 0;

    historialReportes.forEach(r => {
        ingHist += (r.totalIngresos || 0);
        gasHist += (r.totalGastos || 0);
    });

    transacciones.forEach(t => {
        const monto = parseFloat(t.monto) || 0;
        if(t.tipo === 'ingreso') {
            ingHist += monto;
            ingCaja += monto;
        } else {
            gasHist += monto;
            gasCaja += monto;
        }
    });

    // Suma de inventario (Aquí se asegura que lea los productos de la nube)
    let valorCostoInventario = 0;
    productos.forEach(p => {
        const c = parseFloat(p.costo) || 0;
        const q = parseInt(p.cantidad) || 0;
        valorCostoInventario += (c * q);
    });

    // Actualizar Textos
    const ids = {
        'total-ganancias-hist': ingHist,
        'total-gastos-hist': gasHist,
        'ganancia-neta-hist': ingHist - gasHist,
        'total-ganancias-caja': ingCaja,
        'total-gastos-caja': gasCaja,
        'balance-final-caja': ingCaja - gasCaja,
        'dash-valor-inv': valorCostoInventario,
        'dash-patrimonio': valorCostoInventario + (ingCaja - gasCaja)
    };

    for (let id in ids) {
        const el = document.getElementById(id);
        if (el) el.innerText = `$${formatearNumero(ids[id])}`;
    }
}

/* --- RENDERIZADO DE TABLA INVENTARIO --- */
function renderInventario() {
    const t = document.getElementById('tabla-inventario');
    if(!t) return;
    let costoTotalInv = 0;
    let ventaTotalInv = 0;

    t.innerHTML = productos.map(p => {
        const cTotal = (p.costo * p.cantidad);
        const vTotal = (p.precio * p.cantidad);
        costoTotalInv += cTotal;
        ventaTotalInv += vTotal;

        return `<tr>
            <td>${p.nombre}</td>
            <td onclick="editarStock(${p.id})" style="cursor:pointer; font-weight:bold; color:#3498db;">${p.cantidad} ✏️</td>
            <td>$${formatearNumero(p.costo)}</td>
            <td>$${formatearNumero(p.precio)}</td>
            <td><button class="btn-danger" onclick="eliminarProd(${p.id})">❌</button></td>
        </tr>`;
    }).join('');

    if(document.getElementById('float-costo')) document.getElementById('float-costo').innerText = `$${formatearNumero(costoTotalInv)}`;
    if(document.getElementById('float-venta')) document.getElementById('float-venta').innerText = `$${formatearNumero(ventaTotalInv)}`;
}

/* --- RESTO DE FUNCIONES (PEDIDOS, DEUDAS, ETC) --- */
// (Copia las funciones de los pedidos, deudas y finanzas del código anterior aquí)

function renderTodo() {
    renderInventario();
    renderPedidos();
    renderDeudas();
    renderFinanzas();
    renderDashboard();
    renderHistorialReportes();
}

/* --- INICIALIZACIÓN --- */
window.onload = () => {
    cargarDatosDesdeNube(); // <--- Llama a la nube al abrir
    if(typeof toggleProductoSelector === 'function') toggleProductoSelector();
};

});

function actualizarTodo() {
    db.ref('motika_data/').set({
        productos, transacciones, encargos, historialReportes
    }).catch(err => console.error("Error Firebase:", err));
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

/* --- 1. INVENTARIO (EDITABLE) --- */
const fProd = document.getElementById('form-producto');
if(fProd) {
    fProd.addEventListener('submit', (e) => {
        e.preventDefault();
        const nuevoProd = {
            id: Date.now(),
            nombre: document.getElementById('prod-nombre').value,
            cantidad: parseInt(document.getElementById('prod-cantidad').value) || 0,
            costo: limpiarNumero(document.getElementById('prod-costo').value),
            precio: limpiarNumero(document.getElementById('prod-precio').value)
        };
        productos.push(nuevoProd);
        actualizarTodo();
        fProd.reset();
    });
}

window.editarStock = function(id) {
    const p = productos.find(x => x.id === id);
    const nuevoStock = prompt(`Editar cantidad para ${p.nombre}:`, p.cantidad);
    if(nuevoStock !== null) {
        p.cantidad = parseInt(nuevoStock) || 0;
        actualizarTodo();
    }
}

function renderInventario() {
    const t = document.getElementById('tabla-inventario');
    if(!t) return;
    let costoTotalInv = 0;
    let ventaTotalInv = 0;

    t.innerHTML = productos.map(p => {
        const cTotal = (p.costo * p.cantidad);
        const vTotal = (p.precio * p.cantidad);
        costoTotalInv += cTotal;
        ventaTotalInv += vTotal;

        return `<tr>
            <td>${p.nombre}</td>
            <td onclick="editarStock(${p.id})" style="cursor:pointer; font-weight:bold; color:#3498db;">${p.cantidad} ✏️</td>
            <td>$${formatearNumero(p.costo)}</td>
            <td>$${formatearNumero(p.precio)}</td>
            <td><button class="btn-danger" onclick="eliminarProd(${p.id})">❌</button></td>
        </tr>`;
    }).join('');

    document.getElementById('float-costo').innerText = `$${formatearNumero(costoTotalInv)}`;
    document.getElementById('float-venta').innerText = `$${formatearNumero(ventaTotalInv)}`;
}

window.eliminarProd = function(id) { 
    if(confirm("¿Eliminar producto definitivamente?")) { 
        productos = productos.filter(p => p.id !== id); 
        actualizarTodo(); 
    } 
}

/* --- 2. DASHBOARD (CÁLCULO DE COSTO CORREGIDO) --- */
function renderDashboard() {
    let ingHist = 0, gasHist = 0;
    let ingCaja = 0, gasCaja = 0;

    // 1. Sumar historial de cierres pasados
    historialReportes.forEach(r => {
        ingHist += (r.totalIngresos || 0);
        gasHist += (r.totalGastos || 0);
    });

    // 2. Sumar transacciones actuales (de la caja abierta)
    transacciones.forEach(t => {
        const monto = parseFloat(t.monto) || 0;
        if(t.tipo === 'ingreso') {
            ingHist += monto;
            ingCaja += monto;
        } else {
            gasHist += monto;
            gasCaja += monto;
        }
    });

    // 3. CÁLCULO DE INVENTARIO (Aquí estaba el fallo)
    let valorCostoInventario = 0;
    productos.forEach(p => {
        valorCostoInventario += (limpiarNumero(p.costo) * parseInt(p.cantidad || 0));
    });

    // Renderizar en pantalla
    document.getElementById('total-ganancias-hist').innerText = `$${formatearNumero(ingHist)}`;
    document.getElementById('total-gastos-hist').innerText = `$${formatearNumero(gasHist)}`;
    document.getElementById('ganancia-neta-hist').innerText = `$${formatearNumero(ingHist - gasHist)}`;

    document.getElementById('total-ganancias-caja').innerText = `$${formatearNumero(ingCaja)}`;
    document.getElementById('total-gastos-caja').innerText = `$${formatearNumero(gasCaja)}`;
    document.getElementById('balance-final-caja').innerText = `$${formatearNumero(ingCaja - gasCaja)}`;

    document.getElementById('dash-valor-inv').innerText = `$${formatearNumero(valorCostoInventario)}`;
    // Patrimonio = Dinero en caja hoy + Valor de la mercancía
    document.getElementById('dash-patrimonio').innerText = `$${formatearNumero(valorCostoInventario + (ingCaja - gasCaja))}`;
}

/* --- 3. GESTIÓN DE PEDIDOS Y ENTREGAS --- */
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
        
        encargos.push({
            id: Date.now(),
            cliente, total, abono, deuda: total - abono,
            entregado: false,
            items: Array.from(document.querySelectorAll('.fila-producto')).map(f => ({
                nombre: f.querySelector('.p-nombre').value, 
                cant: f.querySelector('.p-cant').value, 
                entregado: false
            }))
        });
        
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
                <div style="display:flex; justify-content:space-between; margin:5px 0; font-size:14px;">
                    <span>${it.nombre} (x${it.cant})</span>
                    ${it.entregado ? '✅' : `<button onclick="entregarItem(${e.id}, ${idx})" style="padding:2px 5px; font-size:10px;">Entregar</button>`}
                </div>
            `).join('')}
            <button onclick="entregarTodoPedido(${e.id})" style="background:green; color:white; width:100%; margin-top:10px; font-size:12px;">Entregar Todo</button>
        </div>
    `).join('');
}

window.entregarItem = function(pedId, itemIdx) {
    const e = encargos.find(x => x.id === pedId);
    const item = e.items[itemIdx];
    const decision = confirm(`¿Sumar entrega de "${item.nombre}" a la CAJA? (Aceptar = Venta, Cancelar = Deudor)`);
    item.entregado = true;
    if(decision) registrarMovimiento('ingreso', `Entrega parcial: ${item.nombre} (${e.cliente})`, (e.total / e.items.length));
    actualizarTodo();
}

window.entregarTodoPedido = function(id) {
    const e = encargos.find(x => x.id === id);
    const decision = confirm(`¿Sumar el valor pendiente ($${formatearNumero(e.deuda)}) a la CAJA como venta final?`);
    if(decision) registrarMovimiento('ingreso', `Cobro final pedido: ${e.cliente}`, e.deuda);
    e.entregado = true;
    e.deuda = 0;
    actualizarTodo();
}

/* --- 4. DEUDORES ACUMULATIVOS --- */
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
    const inp = document.getElementById(`in-abono-${id}`);
    const monto = limpiarNumero(inp.value);
    if(monto > 0 && monto <= e.deuda) {
        e.deuda -= monto;
        e.abono += monto;
        registrarMovimiento('ingreso', `Abono de Deuda: ${e.cliente}`, monto);
        actualizarTodo();
    } else { alert("Monto no válido"); }
}

function renderDeudas() {
    const t = document.getElementById('tabla-deudores');
    if(!t) return;
    t.innerHTML = encargos.filter(e => e.deuda > 0).map(e => `
        <tr><td>${e.cliente}</td><td style="color:red; font-weight:bold;">$${formatearNumero(e.deuda)}</td>
        <td><input type="number" id="in-abono-${e.id}" style="width:80px" placeholder="$"></td>
        <td><button onclick="abonar(${e.id})" style="background:green; color:white;">Abonar</button></td></tr>
    `).join('');
}

/* --- 5. CAJA Y FINANZAS --- */
function registrarMovimiento(tipo, desc, monto) {
    transacciones.push({ id: Date.now(), tipo, desc, monto: parseFloat(monto), fecha: new Date().toLocaleDateString() });
}

const fTrans = document.getElementById('form-transaccion');
if(fTrans) {
    fTrans.addEventListener('submit', (e) => {
        e.preventDefault();
        const tipo = document.getElementById('trans-tipo').value;
        let monto = limpiarNumero(document.getElementById('trans-monto').value);
        let desc = document.getElementById('trans-desc').value;
        
        if(tipo === 'venta') {
            const pId = document.getElementById('select-producto-id').value;
            const p = productos.find(x => x.id == pId);
            const cant = parseInt(document.getElementById('trans-cantidad').value);
            if(p && p.cantidad >= cant) {
                p.cantidad -= cant;
                monto = p.precio * cant;
                desc = `Venta: ${p.nombre} x${cant}`;
            } else { return alert("Producto no seleccionado o sin stock"); }
        }
        registrarMovimiento(tipo === 'gasto' ? 'gasto' : 'ingreso', desc, monto);
        actualizarTodo();
        fTrans.reset();
    });
}

function renderFinanzas() {
    const l = document.getElementById('lista-transacciones');
    if(l) l.innerHTML = transacciones.map(t => `<tr><td>${t.fecha}</td><td>${t.desc}</td><td style="color:${t.tipo==='ingreso'?'green':'red'}">$${formatearNumero(t.monto)}</td></tr>`).reverse().join('');
}

window.cerrarCaja = function() {
    if(!confirm("¿Cerrar caja ahora? Se limpiará el efectivo de la columna derecha.")) return;
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
    if(h) h.innerHTML = historialReportes.map(r => `<div class="card" style="border-left:4px solid #2c3e50"><strong>📅 ${r.fecha}</strong><br>Balance: $${formatearNumero(r.balance)}</div>`).reverse().join('');
}

/* --- NAVEGACIÓN Y BUSCADOR --- */
window.toggleMenu = function() { document.getElementById('sidebar').classList.toggle('active'); }
window.showSection = function(id) { 
    document.querySelectorAll('section').forEach(s => s.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
}

const inBusq = document.getElementById('input-buscar-prod');
if(inBusq) {
    inBusq.addEventListener('input', () => {
        const txt = inBusq.value.toLowerCase();
        const sug = document.getElementById('lista-sugerencias');
        sug.innerHTML = '';
        if(txt.length < 1) return;
        productos.filter(p => p.nombre.toLowerCase().includes(txt)).forEach(p => {
            const d = document.createElement('div');
            d.innerText = `${p.nombre} (Stock: ${p.cantidad})`;
            d.style = "padding:10px; cursor:pointer; border-bottom:1px solid #eee;";
            d.onclick = () => { inBusq.value = p.nombre; document.getElementById('select-producto-id').value = p.id; sug.innerHTML = ''; };
            sug.appendChild(d);
        });
    });
}

window.toggleProductoSelector = function() {
    const isV = document.getElementById('trans-tipo').value === 'venta';
    document.getElementById('contenedor-busqueda-prod').style.display = isV ? 'block' : 'none';
    document.getElementById('trans-cantidad').style.display = isV ? 'block' : 'none';
    document.getElementById('trans-monto').style.display = isV ? 'none' : 'block';
    document.getElementById('trans-desc').style.display = isV ? 'none' : 'block';
}

window.onload = () => { if(typeof toggleProductoSelector === 'function') toggleProductoSelector(); };

/* GASTOS OPERATIVOS FORM */
const fGastosOp = document.getElementById('form-gastos-diarios');
if(fGastosOp){
    fGastosOp.addEventListener('submit', (e)=>{
        e.preventDefault();
        const monto = limpiarNumero(document.getElementById('gasto-monto-op').value);
        const desc = `${document.getElementById('gasto-categoria').value}: ${document.getElementById('gasto-desc-op').value}`;
        registrarMovimiento('gasto', desc, monto);
        actualizarTodo();
        fGastosOp.reset();
    });
}
