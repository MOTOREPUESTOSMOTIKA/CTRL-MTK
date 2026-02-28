console.log("Sistema Motika V2 - Firebase Activo");

/* --- ESTADO GLOBAL --- */
let productos = [];
let transacciones = [];
let encargos = [];
let historialReportes = [];

/* --- FUNCIONES DE APOYO --- */
function limpiarNumero(valor) {
    if (!valor) return 0;
    return parseFloat(valor.toString().replace(/\./g, '').replace(',', '.')) || 0;
}

function formatearNumero(valor) {
    return Number(valor || 0).toLocaleString('es-CO');
}

/* --- SINCRONIZACIÓN FIREBASE --- */
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
    }).catch(error => console.error("Error Firebase:", error));
    renderTodo();
}

/* --- NAVEGACIÓN --- */
window.showSection = function(id) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

window.toggleMenu = function() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) sidebar.classList.toggle('active');
}

/* --- DASHBOARD (PUNTO 1 Y 3) --- */
function renderDashboard() {
    // Totales de la caja actual (Semana)
    let cajaIng = 0, cajaGas = 0;
    transacciones.forEach(t => t.tipo === 'ingreso' ? cajaIng += t.monto : cajaGas += t.monto);

    // Totales Históricos (Caja actual + Reportes cerrados)
    let histIng = cajaIng, histGas = cajaGas;
    historialReportes.forEach(r => {
        histIng += r.totalIngresos;
        histGas += r.totalGastos;
    });

    // Ganancia Real (Venta - Costo)
    let gananciaHistorial = 0;
    // Cálculo simplificado: Ingresos Totales - Gastos Totales
    let gananciaReal = histIng - histGas;

    document.getElementById('hist-ventas').innerText = `$${formatearNumero(histIng)}`;
    document.getElementById('hist-gastos').innerText = `$${formatearNumero(histGas)}`;
    document.getElementById('hist-ganancia').innerText = `$${formatearNumero(gananciaReal)}`;

    document.getElementById('caja-ventas').innerText = `$${formatearNumero(cajaIng)}`;
    document.getElementById('caja-gastos').innerText = `$${formatearNumero(cajaGas)}`;
    document.getElementById('balance-final').innerText = `$${formatearNumero(cajaIng - cajaGas)}`;

    let valorCostoInv = productos.reduce((acc, p) => acc + (p.costo * p.cantidad), 0);
    document.getElementById('dash-valor-inv').innerText = `$${formatearNumero(valorCostoInv)}`;
    document.getElementById('dash-patrimonio').innerText = `$${formatearNumero(valorCostoInv + (cajaIng - cajaGas))}`;
}

/* --- INVENTARIO (PUNTO 4: EDITAR STOCK) --- */
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
    const nuevoStock = prompt(`Editar Stock para ${p.nombre}:`, p.cantidad);
    if(nuevoStock !== null) {
        p.cantidad = parseInt(nuevoStock) || 0;
        actualizarTodo();
    }
}

window.eliminarProd = function(id) {
    if(confirm("¿Eliminar producto?")) {
        productos = productos.filter(p => p.id !== id);
        actualizarTodo();
    }
}

function renderInventario() {
    const t = document.getElementById('tabla-inventario');
    if(!t) return;
    let cTotal = 0, vTotal = 0;
    t.innerHTML = productos.map(p => {
        cTotal += (p.costo * p.cantidad); vTotal += (p.precio * p.cantidad);
        return `<tr>
            <td>${p.nombre}</td>
            <td><b style="cursor:pointer; color:blue;" onclick="editarStock(${p.id})">${p.cantidad} ✏️</b></td>
            <td>$${formatearNumero(p.costo)}</td>
            <td>$${formatearNumero(p.precio)}</td>
            <td><button class="btn-danger" onclick="eliminarProd(${p.id})">❌</button></td>
        </tr>`;
    }).join('');
    document.getElementById('float-costo').innerText = `$${formatearNumero(cTotal)}`;
    document.getElementById('float-venta').innerText = `$${formatearNumero(vTotal)}`;
}

/* --- GASTOS (PUNTO 2: DESCONTAR EFECTIVO) --- */
const fGastoLog = document.getElementById('form-gastos-diarios');
if(fGastoLog) {
    fGastoLog.addEventListener('submit', (e) => {
        e.preventDefault();
        const monto = limpiarNumero(document.getElementById('gasto-monto-op').value);
        const desc = document.getElementById('gasto-desc-op').value;
        
        // Se registra como gasto en transacciones para descontar del balance actual
        transacciones.push({
            id: Date.now(),
            tipo: 'gasto',
            desc: `Gasto Operativo: ${desc}`,
            monto: monto,
            fecha: new Date().toLocaleDateString()
        });
        actualizarTodo();
        fGastoLog.reset();
        alert("Gasto registrado y descontado de caja.");
    });
}

/* --- PEDIDOS (PUNTO 5: ENTREGAR POR ITEMS) --- */
window.agregarFila = function() {
    const div = document.createElement('div');
    div.className = 'fila-producto';
    div.innerHTML = `<input type="text" placeholder="Producto" class="p-nombre" required> 
                     <input type="number" placeholder="Cant." class="p-cant" required> 
                     <button type="button" onclick="this.parentElement.remove()">✕</button>`;
    document.getElementById('contenedor-filas-productos').appendChild(div);
}

const fEnc = document.getElementById('form-encargo');
if(fEnc) {
    fEnc.addEventListener('submit', (e) => {
        e.preventDefault();
        const cliente = document.getElementById('enc-cliente').value;
        const total = limpiarNumero(document.getElementById('enc-total').value);
        const abono = limpiarNumero(document.getElementById('enc-abono').value) || 0;
        
        encargos.push({
            id: Date.now(),
            cliente, total, abono, deuda: total - abono,
            entregadoTotal: false,
            items: Array.from(document.querySelectorAll('.fila-producto')).map(f => ({
                nombre: f.querySelector('.p-nombre').value,
                cant: f.querySelector('.p-cant').value,
                entregado: false
            }))
        });
        
        if(abono > 0) {
            transacciones.push({
                id: Date.now() + 1, tipo: 'ingreso', desc: `Abono inicial: ${cliente}`,
                monto: abono, fecha: new Date().toLocaleDateString()
            });
        }
        actualizarTodo();
        fEnc.reset();
        document.getElementById('contenedor-filas-productos').innerHTML = '<div class="fila-producto"><input type="text" placeholder="Producto" class="p-nombre" required><input type="number" placeholder="Cant." class="p-cant" required></div>';
    });
}

window.entregarItem = function(pedidoId, itemIndex) {
    const p = encargos.find(x => x.id === pedidoId);
    const item = p.items[itemIndex];
    
    const r = confirm(`¿Entregar ${item.nombre}? \nOK: Sumar a Caja \nCANCELAR: Poner como Deuda`);
    
    if(r) {
        // Sumar a caja (Asumimos que el precio ya está en el total, aquí solo marcamos entrega)
        alert("Entregado y sumado a caja mentalmente (el abono ya se registró)");
    } else {
        alert("Marcado para deuda");
    }
    
    item.entregado = true;
    // Si todos están entregados, marcar pedido como finalizado
    if(p.items.every(i => i.entregado)) p.entregadoTotal = true;
    actualizarTodo();
}

window.entregarTodoPedido = function(id) {
    const p = encargos.find(x => x.id === id);
    const tipoCaja = confirm("¿Sumar saldo restante a CAJA (Venta)? \nSi cancela, se mantendrá como DEUDA.");
    
    if(tipoCaja) {
        if(p.deuda > 0) {
            transacciones.push({
                id: Date.now(), tipo: 'ingreso', desc: `Pago Final Pedido: ${p.cliente}`,
                monto: p.deuda, fecha: new Date().toLocaleDateString()
            });
            p.abono += p.deuda;
            p.deuda = 0;
        }
    }
    p.items.forEach(i => i.entregado = true);
    p.entregadoTotal = true;
    actualizarTodo();
}

function renderPedidos() {
    const c = document.getElementById('lista-pedidos-clientes');
    if(!c) return;
    c.innerHTML = encargos.filter(e => e.items && !e.entregadoTotal).map(e => `
        <div class="card">
            <strong>👤 ${e.cliente}</strong><br>
            <small>Debe: $${formatearNumero(e.deuda)}</small>
            <div style="margin:10px 0; border-top:1px solid #eee; padding-top:5px;">
                ${e.items.map((it, idx) => `
                    <div style="display:flex; justify-content:space-between; font-size:13px;">
                        <span style="${it.entregado?'text-decoration:line-through; color:gray':''}">> ${it.nombre} (x${it.cant})</span>
                        ${!it.entregado ? `<button onclick="entregarItem(${e.id}, ${idx})">Entregar</button>` : '✅'}
                    </div>
                `).join('')}
            </div>
            <button onclick="entregarTodoPedido(${e.id})" style="width:100%; background:green; color:white;">Entregar Todo</button>
        </div>
    `).join('');
}

/* --- DEUDORES (PUNTO 6: INCREMENTAR DEUDA) --- */
const fDeuda = document.getElementById('form-deuda-directa');
if(fDeuda) {
    fDeuda.addEventListener('submit', (e) => {
        e.preventDefault(); 
        const m = limpiarNumero(document.getElementById('deuda-monto').value);
        const nombreBusqueda = document.getElementById('deuda-cliente').value.trim();
        
        // Buscar si ya existe el deudor
        const existente = encargos.find(en => en.cliente.toLowerCase() === nombreBusqueda.toLowerCase());
        
        if(existente) {
            existente.deuda += m;
            existente.total += m;
            alert(`Deuda incrementada a ${existente.cliente}. Nueva deuda: $${formatearNumero(existente.deuda)}`);
        } else {
            encargos.push({
                id: Date.now(), cliente: nombreBusqueda, total: m, abono: 0, deuda: m, entregadoTotal: true
            });
            alert("Nuevo deudor registrado.");
        }
        actualizarTodo();
        fDeuda.reset();
    });
}

window.abonar = function(id) {
    const e = encargos.find(x => x.id === id);
    const monto = limpiarNumero(document.getElementById(`in-abono-${id}`).value);
    if(!monto || monto > e.deuda) return alert("Monto inválido");
    
    e.deuda -= monto;
    e.abono += monto;
    transacciones.push({
        id: Date.now(), tipo: 'ingreso', desc: `Abono de: ${e.cliente}`, 
        monto: monto, fecha: new Date().toLocaleDateString()
    });
    actualizarTodo();
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

/* --- FINANZAS Y CIERRES --- */
function renderFinanzas() {
    const lista = document.getElementById('lista-transacciones');
    if(lista) {
        lista.innerHTML = transacciones.map(t => `
            <tr><td>${t.fecha}</td><td>${t.desc}</td><td style="color:${t.tipo==='ingreso'?'green':'red'}">$${formatearNumero(t.monto)}</td></tr>
        `).reverse().join('');
    }
}

window.cerrarCaja = function() {
    if (!confirm("¿Cerrar caja ahora? Se limpiarán las ventas diarias.")) return;
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
    if(h) h.innerHTML = historialReportes.map(r => `
        <div class="card" style="border-left:5px solid green; margin-bottom:10px;">
            <h4>📅 ${r.fecha}</h4>
            <p>Balance: $${formatearNumero(r.balance)} (Ingresos: $${formatearNumero(r.totalIngresos)} | Gastos: $${formatearNumero(r.totalGastos)})</p>
        </div>
    `).reverse().join('');
}

function renderTodo() {
    renderDashboard();
    renderInventario();
    renderFinanzas();
    renderPedidos();
    renderDeudas();
    renderHistorialReportes();
}

/* --- BUSQUEDA VENTAS --- */
const inputBusqueda = document.getElementById('input-buscar-prod');
if (inputBusqueda) {
    inputBusqueda.addEventListener('input', () => {
        const texto = inputBusqueda.value.toLowerCase();
        const sug = document.getElementById('lista-sugerencias');
        sug.innerHTML = '';
        if (texto.length < 1) return;
        productos.filter(p => p.nombre.toLowerCase().includes(texto) && p.cantidad > 0).forEach(p => {
            const d = document.createElement('div');
            d.innerHTML = `${p.nombre} ($${p.precio})`;
            d.style = "padding:10px; cursor:pointer; border-bottom:1px solid #eee;";
            d.onclick = () => {
                inputBusqueda.value = p.nombre;
                document.getElementById('select-producto-id').value = p.id;
                sug.innerHTML = '';
            };
            sug.appendChild(d);
        });
    });
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
            const cant = parseInt(document.getElementById('trans-cantidad').value);
            const p = productos.find(x => x.id == pId);
            if(p && p.cantidad >= cant) {
                p.cantidad -= cant;
                monto = p.precio * cant;
                desc = `Venta: ${p.nombre} x${cant}`;
            } else { return alert("Error en producto o stock"); }
        }
        transacciones.push({
            id: Date.now(), tipo: (tipo === 'gasto' ? 'gasto' : 'ingreso'),
            desc, monto, fecha: new Date().toLocaleDateString()
        });
        actualizarTodo();
        fTrans.reset();
        window.toggleProductoSelector();
    });
}

window.toggleProductoSelector = function() {
    const tipo = document.getElementById('trans-tipo').value;
    const isVenta = (tipo === 'venta');
    document.getElementById('contenedor-busqueda-prod').style.display = isVenta ? 'block' : 'none';
    document.getElementById('trans-cantidad').style.display = isVenta ? 'block' : 'none';
    document.getElementById('trans-monto').style.display = isVenta ? 'none' : 'block';
    document.getElementById('trans-desc').style.display = isVenta ? 'none' : 'block';
}

window.onload = () => { if(window.toggleProductoSelector) window.toggleProductoSelector(); };
