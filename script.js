console.log("Sistema Motika V2 - Firebase Activo");

/* --- ESTADO GLOBAL --- */
let productos = [];
let transacciones = [];
let encargos = [];
let historialReportes = [];
let gastosOperativos = []; // Nueva lista para persistencia de gastos operativos

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
        gastosOperativos = data.gastosOperativos || [];
        renderTodo();
    }
});

function actualizarTodo() {
    db.ref('motika_data/').set({
        productos, transacciones, encargos, historialReportes, gastosOperativos
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

/* --- DASHBOARD --- */
function renderDashboard() {
    let cajaIng = 0, cajaGas = 0;
    transacciones.forEach(t => t.tipo === 'ingreso' ? cajaIng += t.monto : cajaGas += t.monto);

    let histIng = cajaIng, histGas = cajaGas;
    historialReportes.forEach(r => {
        histIng += r.totalIngresos;
        histGas += r.totalGastos;
    });

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

/* --- INVENTARIO --- */
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

/* --- GASTOS OPERATIVOS --- */
const fGastoLog = document.getElementById('form-gastos-diarios');
if(fGastoLog) {
    fGastoLog.addEventListener('submit', (e) => {
        e.preventDefault();
        const monto = limpiarNumero(document.getElementById('gasto-monto-op').value);
        const desc = document.getElementById('gasto-desc-op').value;
        const cat = document.getElementById('gasto-categoria').value;
        const fecha = document.getElementById('gasto-fecha').value || new Date().toLocaleDateString();
        
        const nuevoGasto = {
            id: Date.now(),
            fecha,
            cat,
            desc,
            monto
        };

        gastosOperativos.push(nuevoGasto);
        
        transacciones.push({
            id: Date.now() + 1,
            tipo: 'gasto',
            desc: `[${cat}] ${desc}`,
            monto: monto,
            fecha: fecha
        });

        actualizarTodo();
        fGastoLog.reset();
        alert("Gasto registrado y descontado de caja.");
    });
}

function renderGastos() {
    const tabla = document.getElementById('tabla-gastos-logistica');
    if(tabla) {
        tabla.innerHTML = gastosOperativos.map(g => `
            <tr>
                <td>${g.fecha}</td>
                <td>${g.cat}</td>
                <td>${g.desc}</td>
                <td style="color:red">-$${formatearNumero(g.monto)}</td>
            </tr>
        `).reverse().join('');
    }
}

/* --- PEDIDOS --- */
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
                id: Date.now() + 1, tipo: 'ingreso', desc: `Abono inicial pedido: ${cliente}`,
                monto: abono, fecha: new Date().toLocaleDateString()
            });
        }
        actualizarTodo();
        fEnc.reset();
        document.getElementById('contenedor-filas-productos').innerHTML = '<div class="fila-producto"><input type="text" placeholder="Producto" class="p-nombre" required><input type="number" placeholder="Cant." class="p-cant" required></div>';
    });
}

window.procesarEntregaItem = function(pedidoId, itemIndex, modo) {
    const p = encargos.find(x => x.id === pedidoId);
    const item = p.items[itemIndex];
    
    // Si el modo es 'venta', preguntamos el valor de este ítem para sumar a caja
    if(modo === 'venta') {
        const valor = prompt(`¿Qué valor sumar a caja por la entrega de ${item.nombre}?`, "0");
        const monto = limpiarNumero(valor);
        if(monto > 0) {
            transacciones.push({
                id: Date.now(), tipo: 'ingreso', desc: `Entrega: ${item.nombre} (Cliente: ${p.cliente})`,
                monto: monto, fecha: new Date().toLocaleDateString()
            });
            p.abono += monto;
            p.deuda = Math.max(0, p.total - p.abono);
        }
    } else {
        alert(`${item.nombre} enviado a deuda pendiente.`);
    }
    
    item.entregado = true;
    if(p.items.every(i => i.entregado)) p.entregadoTotal = true;
    actualizarTodo();
}

window.entregarTodoPedido = function(id) {
    const p = encargos.find(x => x.id === id);
    if(p.deuda > 0) {
        const confirmarVenta = confirm(`¿Desea que el saldo de $${formatearNumero(p.deuda)} entre como EFECTIVO a caja hoy?`);
        if(confirmarVenta) {
            transacciones.push({
                id: Date.now(), tipo: 'ingreso', desc: `Cierre total pedido: ${p.cliente}`,
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
    c.innerHTML = encargos.filter(e => !e.entregadoTotal).map(e => `
        <div class="card" style="border-left: 5px solid #4A90E2">
            <strong>👤 ${e.cliente}</strong><br>
            <small>Total: $${formatearNumero(e.total)} | Debe: $${formatearNumero(e.deuda)}</small>
            <div style="margin:10px 0; border-top:1px solid #eee; padding-top:5px;">
                ${e.items.map((it, idx) => `
                    <div style="margin-bottom:8px; border-bottom:1px solid #f9f9f9; padding-bottom:5px;">
                        <span style="${it.entregado?'text-decoration:line-through; color:gray':''}">${it.nombre} (x${it.cant})</span>
                        ${!it.entregado ? `
                            <div style="display:flex; gap:5px; margin-top:5px;">
                                <button onclick="procesarEntregaItem(${e.id}, ${idx}, 'venta')" style="background:#28a745; color:white; font-size:11px; padding:2px 5px;">Venta 💰</button>
                                <button onclick="procesarEntregaItem(${e.id}, ${idx}, 'deuda')" style="background:#dc3545; color:white; font-size:11px; padding:2px 5px;">Deuda 📉</button>
                            </div>
                        ` : ' ✅'}
                    </div>
                `).join('')}
            </div>
            <button onclick="entregarTodoPedido(${e.id})" style="width:100%; background:#4A90E2; color:white;">Finalizar Todo</button>
        </div>
    `).join('');
}

/* --- DEUDORES --- */
const fDeuda = document.getElementById('form-deuda-directa');
if(fDeuda) {
    fDeuda.addEventListener('submit', (e) => {
        e.preventDefault(); 
        const m = limpiarNumero(document.getElementById('deuda-monto').value);
        const nombreBusqueda = document.getElementById('deuda-cliente').value.trim();
        const existente = encargos.find(en => en.cliente.toLowerCase() === nombreBusqueda.toLowerCase());
        
        if(existente) {
            existente.deuda += m;
            existente.total += m;
            alert(`Deuda incrementada. Nueva deuda de ${existente.cliente}: $${formatearNumero(existente.deuda)}`);
        } else {
            encargos.push({
                id: Date.now(), cliente: nombreBusqueda, total: m, abono: 0, deuda: m, entregadoTotal: true, items: []
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
        id: Date.now(), tipo: 'ingreso', desc: `Abono de deudor: ${e.cliente}`, 
        monto: monto, fecha: new Date().toLocaleDateString()
    });
    actualizarTodo();
}

function renderDeudas() {
    const t = document.getElementById('tabla-deudores');
    if(!t) return;
    t.innerHTML = encargos.filter(e => e.deuda > 0).map(e => `
        <tr><td>${e.cliente}</td><td style="color:red">$${formatearNumero(e.deuda)}</td>
        <td><input type="number" id="in-abono-${e.id}" style="width:80px"></td>
        <td><button onclick="abonar(${e.id})">Abonar</button></td></tr>
    `).join('');
}

/* --- FINANZAS Y CIERRES --- */
function renderFinanzas() {
    const lista = document.getElementById('lista-transacciones');
    if(lista) {
        lista.innerHTML = transacciones.map(t => `
            <tr><td>${t.fecha}</td><td>${t.desc}</td><td style="color:${t.tipo==='ingreso'?'green':'red'}">${t.tipo==='ingreso'?'':'-'}$${formatearNumero(t.monto)}</td></tr>
        `).reverse().join('');
    }
}

window.cerrarCaja = function() {
    if (!confirm("¿Cerrar caja ahora? Se archivará el movimiento actual.")) return;
    let ing = 0, gas = 0;
    transacciones.forEach(t => t.tipo === 'ingreso' ? ing += t.monto : gas += t.monto);
    historialReportes.push({
        id: Date.now(), fecha: new Date().toLocaleString(),
        totalIngresos: ing, totalGastos: gas, balance: ing - gas
    });
    transacciones = []; 
    gastosOperativos = []; 
    actualizarTodo();
}

function renderHistorialReportes() {
    const h = document.getElementById('historial-reportes');
    if(h) h.innerHTML = historialReportes.map(r => `
        <div class="card" style="border-left:5px solid #333;">
            <h4>📅 ${r.fecha}</h4>
            <p><strong>Balance: $${formatearNumero(r.balance)}</strong></p>
            <small>Ingresos: $${formatearNumero(r.totalIngresos)} | Gastos: $${formatearNumero(r.totalGastos)}</small>
        </div>
    `).reverse().join('');
}

/* --- BÚSQUEDA Y VENTAS DIRECTAS --- */
const inputBusqueda = document.getElementById('input-buscar-prod');
if (inputBusqueda) {
    inputBusqueda.addEventListener('input', () => {
        const texto = inputBusqueda.value.toLowerCase();
        const sug = document.getElementById('lista-sugerencias');
        sug.innerHTML = '';
        if (texto.length < 1) return;
        productos.filter(p => p.nombre.toLowerCase().includes(texto) && p.cantidad > 0).forEach(p => {
            const d = document.createElement('div');
            d.innerHTML = `${p.nombre} (Stock: ${p.cantidad} | $${formatearNumero(p.precio)})`;
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
                desc = `Venta Stock: ${p.nombre} x${cant}`;
            } else { return alert("Stock insuficiente o producto no seleccionado"); }
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

function renderTodo() {
    renderDashboard();
    renderInventario();
    renderFinanzas();
    renderGastos();
    renderPedidos();
    renderDeudas();
    renderHistorialReportes();
}

window.onload = () => { if(window.toggleProductoSelector) window.toggleProductoSelector(); };

window.generarListaCompras = function() {
    const lista = productos.filter(p => p.cantidad <= 2);
    const contenedor = document.getElementById('seccion-lista-compras');
    const ul = document.getElementById('lista-compras-items');
    ul.innerHTML = '';
    if(lista.length === 0) {
        ul.innerHTML = '<li>✅ Todo el stock está al día.</li>';
    } else {
        lista.forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `⚠️ <b>${p.nombre}</b>: Quedan ${p.cantidad} unidades.`;
            ul.appendChild(li);
        });
    }
    contenedor.style.display = 'block';
}
