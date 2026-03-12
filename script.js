console.log("Sistema Motika V3 - Contabilidad Profesional Activa");

/* --- ESTADO GLOBAL --- */
let productos = [];
let transacciones = []; // Caja del día
let encargos = []; // Pedidos y Deudores
let historialReportes = []; // Cierres de caja
let historialGastos = []; // Historial permanente de gastos
let historialAbonos = []; // Registro de pagos de clientes

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
        historialGastos = data.historialGastos || [];
        historialAbonos = data.historialAbonos || [];
        renderTodo();
    }
});

function actualizarTodo() {
    return db.ref('motika_data/').set({
        productos, transacciones, encargos, historialReportes, historialGastos, historialAbonos
    }).catch(error => console.error("Error Firebase:", error));
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

/* --- DASHBOARD PROFESIONAL --- */
function renderDashboard() {
    let cajaIng = 0, cajaGas = 0;
    transacciones.forEach(t => t.tipo === 'ingreso' ? cajaIng += t.monto : cajaGas += t.monto);

    // Cálculo de Ganancia Real (Venta - Costo - Gastos)
    let ventasTotales = 0, costoDeLoVendido = 0, gastosTotales = 0;
    
    // Sumar de reportes cerrados
    historialReportes.forEach(r => {
        ventasTotales += r.totalIngresos;
        gastosTotales += r.totalGastos;
        costoDeLoVendido += (r.costoVentas || 0);
    });

    // Sumar de la caja actual
    transacciones.forEach(t => {
        if(t.tipo === 'ingreso') {
            ventasTotales += t.monto;
            costoDeLoVendido += (t.costoAsociado || 0);
        } else {
            gastosTotales += t.monto;
        }
    });

    let gananciaNeta = ventasTotales - costoDeLoVendido - gastosTotales;

    document.getElementById('hist-ventas').innerText = `$${formatearNumero(ventasTotales)}`;
    document.getElementById('hist-gastos').innerText = `$${formatearNumero(gastosTotales)}`;
    document.getElementById('hist-ganancia').innerText = `$${formatearNumero(gananciaNeta)}`;

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
            <td class="${p.cantidad <= 2 ? 'stock-bajo' : ''}"><b>${p.cantidad}</b></td>
            <td>$${formatearNumero(p.costo)}</td>
            <td>$${formatearNumero(p.precio)}</td>
            <td><button class="btn-danger" onclick="eliminarProd(${p.id})">❌</button></td>
        </tr>`;
    }).join('');
    document.getElementById('float-costo').innerText = `$${formatearNumero(cTotal)}`;
    document.getElementById('float-venta').innerText = `$${formatearNumero(vTotal)}`;
}

/* --- GASTOS DIARIOS --- */
const fGastoLog = document.getElementById('form-gastos-diarios');
if(fGastoLog) {
    fGastoLog.addEventListener('submit', (e) => {
        e.preventDefault();
        const monto = limpiarNumero(document.getElementById('gasto-monto-op').value);
        const desc = document.getElementById('gasto-desc-op').value;
        const cat = document.getElementById('gasto-categoria').value;
        const fecha = document.getElementById('gasto-fecha').value || new Date().toLocaleDateString();
        
        const gastoData = { id: Date.now(), fecha, cat, desc, monto };
        historialGastos.push(gastoData);
        transacciones.push({ id: Date.now()+1, tipo: 'gasto', desc: `[${cat}] ${desc}`, monto: monto, fecha: fecha });

        actualizarTodo();
        fGastoLog.reset();
        alert("Gasto registrado en contabilidad.");
    });
}

function renderGastos() {
    const tabla = document.getElementById('tabla-gastos-logistica');
    if(tabla) {
        tabla.innerHTML = historialGastos.slice(-20).map(g => `
            <tr><td>${g.fecha}</td><td>${g.cat}</td><td>${g.desc}</td><td style="color:red">-$${formatearNumero(g.monto)}</td></tr>
        `).reverse().join('');
    }
}

/* --- GESTIÓN DE PEDIDOS Y STOCK --- */
window.agregarFila = function() {
    const div = document.createElement('div');
    div.className = 'fila-producto';
    div.innerHTML = `<input type="text" placeholder="Producto exacto" class="p-nombre" required> 
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
            id: Date.now(), cliente, total, abono, deuda: total - abono, entregadoTotal: false,
            items: Array.from(document.querySelectorAll('.fila-producto')).map(f => ({
                nombre: f.querySelector('.p-nombre').value,
                cant: parseInt(f.querySelector('.p-cant').value),
                entregado: false
            }))
        });
        
        if(abono > 0) {
            transacciones.push({
                id: Date.now() + 1, tipo: 'ingreso', desc: `Abono inicial pedido: ${cliente}`,
                monto: abono, fecha: new Date().toLocaleDateString(), costoAsociado: 0
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
    
    // Intentar descontar de Stock automáticamente
    const prodInv = productos.find(prod => prod.nombre.toLowerCase() === item.nombre.toLowerCase());
    let costoItem = 0;

    if(prodInv) {
        if(prodInv.cantidad >= item.cant) {
            prodInv.cantidad -= item.cant;
            costoItem = prodInv.costo * item.cant;
        } else {
            alert(`¡Advertencia! No hay suficiente stock de ${item.nombre}. Se entregará pero el inventario quedará en negativo.`);
            prodInv.cantidad -= item.cant;
            costoItem = prodInv.costo * item.cant;
        }
    }

    if(modo === 'venta') {
        const valorVenta = prompt(`Valor a ingresar a caja por ${item.nombre}:`, "0");
        const monto = limpiarNumero(valorVenta);
        transacciones.push({
            id: Date.now(), tipo: 'ingreso', desc: `Entrega: ${item.nombre} (Cliente: ${p.cliente})`,
            monto: monto, costoAsociado: costoItem, fecha: new Date().toLocaleDateString()
        });
        p.abono += monto;
        p.deuda = Math.max(0, p.total - p.abono);
    } else {
        // Si va a deuda, no sumamos a caja hoy, pero el costo se debe reflejar para la ganancia neta final
        alert(`${item.nombre} entregado. Se sumó a la deuda de ${p.cliente} y se descontó del stock.`);
    }
    
    item.entregado = true;
    if(p.items.every(i => i.entregado)) p.entregadoTotal = true;
    actualizarTodo();
}

/* --- DEUDORES Y ABONOS --- */
window.abonar = function(id) {
    const e = encargos.find(x => x.id === id);
    const monto = limpiarNumero(document.getElementById(`in-abono-${id}`).value);
    if(!monto || monto > e.deuda) return alert("Monto inválido");
    
    e.deuda -= monto;
    e.abono += monto;

    const abonoData = { id: Date.now(), cliente: e.cliente, monto: monto, fecha: new Date().toLocaleString() };
    historialAbonos.push(abonoData);

    transacciones.push({
        id: Date.now() + 1, tipo: 'ingreso', desc: `Abono Deuda: ${e.cliente}`, 
        monto: monto, costoAsociado: 0, fecha: new Date().toLocaleDateString()
    });
    actualizarTodo();
    alert("Abono registrado con éxito.");
}

/* --- CIERRE DE CAJA --- */
window.cerrarCaja = function() {
    if (!confirm("¿Desea cerrar la caja? Esto archivará las ventas de hoy.")) return;
    
    let ing = 0, gas = 0, costoV = 0;
    transacciones.forEach(t => {
        if(t.tipo === 'ingreso') {
            ing += t.monto;
            costoV += (t.costoAsociado || 0);
        } else {
            gas += t.monto;
        }
    });

    historialReportes.push({
        id: Date.now(), fecha: new Date().toLocaleString(),
        totalIngresos: ing, totalGastos: gas, costoVentas: costoV, balance: ing - gas
    });

    transacciones = []; // Reiniciamos caja diaria
    actualizarTodo().then(() => alert("Caja cerrada y guardada."));
}

/* --- RENDERS --- */
function renderPedidos() {
    const c = document.getElementById('lista-pedidos-clientes');
    if(!c) return;
    c.innerHTML = encargos.filter(e => !e.entregadoTotal).map(e => `
        <div class="card" style="border-left: 5px solid #4A90E2">
            <strong>👤 ${e.cliente}</strong><br>
            <small>Pendiente: $${formatearNumero(e.deuda)}</small>
            <div style="margin:10px 0;">
                ${e.items.map((it, idx) => `
                    <div class="item-pedido">
                        <span style="${it.entregado?'text-decoration:line-through':''}">${it.nombre} (x${it.cant})</span>
                        ${!it.entregado ? `
                            <div class="btn-group">
                                <button class="btn-venta" onclick="procesarEntregaItem(${e.id}, ${idx}, 'venta')">Venta</button>
                                <button class="btn-deuda" onclick="procesarEntregaItem(${e.id}, ${idx}, 'deuda')">Deuda</button>
                            </div>` : ' ✅'}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderDeudas() {
    const t = document.getElementById('tabla-deudores');
    if(!t) return;
    t.innerHTML = encargos.filter(e => e.deuda > 0).map(e => `
        <tr>
            <td>${e.cliente}</td>
            <td style="color:red">$${formatearNumero(e.deuda)}</td>
            <td><input type="number" id="in-abono-${e.id}" class="small-input" placeholder="0"></td>
            <td><button class="btn-main" onclick="abonar(${e.id})">Abonar</button></td>
        </tr>
    `).join('');
}

function renderFinanzas() {
    const lista = document.getElementById('lista-transacciones');
    if(lista) {
        lista.innerHTML = transacciones.map(t => `
            <tr><td>${t.fecha}</td><td>${t.desc}</td><td style="color:${t.tipo==='ingreso'?'green':'red'}">$${formatearNumero(t.monto)}</td></tr>
        `).reverse().join('');
    }
}

function renderHistorialReportes() {
    const h = document.getElementById('historial-reportes');
    if(h) h.innerHTML = historialReportes.map(r => `
        <div class="card report-card">
            <h4>📅 ${r.fecha}</h4>
            <div class="report-grid">
                <span>Ventas: $${formatearNumero(r.totalIngresos)}</span>
                <span>Utilidad: $${formatearNumero(r.totalIngresos - r.costoVentas - r.totalGastos)}</span>
            </div>
        </div>
    `).reverse().join('');
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

/* --- VENTAS DIRECTAS --- */
const fTrans = document.getElementById('form-transaccion');
if(fTrans) {
    fTrans.addEventListener('submit', (e) => {
        e.preventDefault();
        const tipo = document.getElementById('trans-tipo').value;
        let monto = limpiarNumero(document.getElementById('trans-monto').value);
        let desc = document.getElementById('trans-desc').value;
        let costoVenta = 0;

        if(tipo === 'venta') {
            const pId = document.getElementById('select-producto-id').value;
            const cant = parseInt(document.getElementById('trans-cantidad').value);
            const p = productos.find(x => x.id == pId);
            if(p && p.cantidad >= cant) {
                p.cantidad -= cant;
                monto = p.precio * cant;
                costoVenta = p.costo * cant;
                desc = `Venta: ${p.nombre} x${cant}`;
            } else { return alert("Error: Stock insuficiente."); }
        }
        
        transacciones.push({
            id: Date.now(), tipo: (tipo === 'gasto' ? 'gasto' : 'ingreso'),
            desc, monto, costoAsociado: costoVenta, fecha: new Date().toLocaleDateString()
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

window.generarListaCompras = function() {
    const lista = productos.filter(p => p.cantidad <= 2);
    const contenedor = document.getElementById('seccion-lista-compras');
    const ul = document.getElementById('lista-compras-items');
    ul.innerHTML = lista.length ? lista.map(p => `<li>⚠️ <b>${p.nombre}</b>: Quedan ${p.cantidad}</li>`).join('') : '<li>✅ Stock completo</li>';
    contenedor.style.display = 'block';
}

window.onload = () => { if(window.toggleProductoSelector) window.toggleProductoSelector(); }; 

/* =========================================================
AJUSTES MOTIKA V3 (SIN MODIFICAR EL SCRIPT ORIGINAL)
ESTE BLOQUE SOLO AGREGA FUNCIONALIDADES
========================================================= */


/* =====================================
1. PEDIDOS SIN TOTAL OBLIGATORIO
===================================== */

document.addEventListener("DOMContentLoaded", () => {

    const campoTotal = document.getElementById("enc-total");

    if(campoTotal){

        campoTotal.removeAttribute("required");

        campoTotal.addEventListener("blur",()=>{
            if(campoTotal.value.trim()===""){
                campoTotal.value = "0";
            }
        });

    }

});


/* =====================================
2. BUSCADOR INTELIGENTE DE PRODUCTOS
EN VENTAS
===================================== */

window.inicializarBuscadorProductos = function(){

    const inputBusqueda = document.getElementById("busqueda-producto");

    if(!inputBusqueda) return;

    let contenedor = document.createElement("div");
    contenedor.id="resultados-busqueda-productos";
    contenedor.style.position="absolute";
    contenedor.style.background="#fff";
    contenedor.style.border="1px solid #ccc";
    contenedor.style.zIndex="9999";
    contenedor.style.maxHeight="200px";
    contenedor.style.overflowY="auto";

    inputBusqueda.parentNode.appendChild(contenedor);

    inputBusqueda.addEventListener("input", function(){

        const texto = this.value.toLowerCase();

        if(!texto){
            contenedor.innerHTML="";
            return;
        }

        const coincidencias = productos.filter(p =>
            p.nombre.toLowerCase().includes(texto)
        );

        contenedor.innerHTML = coincidencias.map(p=>`
            <div style="padding:6px;cursor:pointer"
                 onclick="seleccionarProductoBuscado(${p.id},'${p.nombre.replace(/'/g,"")}')">
                 ${p.nombre} (Stock: ${p.cantidad})
            </div>
        `).join("");

    });

};


window.seleccionarProductoBuscado = function(id,nombre){

    const select = document.getElementById("select-producto-id");
    const inputBusqueda = document.getElementById("busqueda-producto");
    const contenedor = document.getElementById("resultados-busqueda-productos");

    if(select) select.value=id;
    if(inputBusqueda) inputBusqueda.value=nombre;
    if(contenedor) contenedor.innerHTML="";

};



/* =====================================
3. LISTA DE PEDIDOS CON CHECKLIST
===================================== */

window.generarListaPedidosCompras = function(){

    const contenedor = document.getElementById("lista-pedidos-compras");

    if(!contenedor) return;

    let html="";

    encargos.forEach(pedido=>{

        html+=`
        <div style="margin-bottom:15px;border:1px solid #ccc;padding:10px">
        <strong>Cliente: ${pedido.cliente}</strong>
        `;

        pedido.items.forEach((item,index)=>{

            if(item.conseguido===undefined){
                item.conseguido=false;
            }

            html+=`
            <div style="margin-top:6px">
                <input type="checkbox"
                ${item.conseguido?"checked":""}
                onchange="marcarProductoPedido(${pedido.id},${index},this.checked)">

                ${item.nombre} x${item.cant}
            </div>
            `;

        });

        html+=`</div>`;

    });

    contenedor.innerHTML=html;

};



window.marcarProductoPedido = function(pedidoId,index,estado){

    const pedido = encargos.find(p=>p.id===pedidoId);

    if(!pedido) return;

    pedido.items[index].conseguido = estado;

    const faltantes = pedido.items.filter(i=>!i.conseguido);
    const encontrados = pedido.items.filter(i=>i.conseguido);

    pedido.items = [...faltantes,...encontrados];

    actualizarTodo();

};



/* =====================================
4. AUTO ACTUALIZAR LISTA PEDIDOS
===================================== */

const renderOriginal = renderTodo;

renderTodo = function(){

    renderOriginal();

    if(window.generarListaPedidosCompras){
        generarListaPedidosCompras();
    }

};



/* =====================================
5. INICIAR BUSCADOR AUTOMÁTICO
===================================== */

window.addEventListener("load",()=>{

    if(window.inicializarBuscadorProductos){
        inicializarBuscadorProductos();
    }

});
/* =====================================
BUSCADOR DE PRODUCTOS PARA TU HTML REAL
===================================== */

function iniciarBuscadorProductos() {

    const input = document.getElementById("input-buscar-prod");
    const lista = document.getElementById("lista-sugerencias");
    const hidden = document.getElementById("select-producto-id");

    if(!input || !lista || !hidden) return;

    input.addEventListener("input", function(){

        const texto = this.value.toLowerCase().trim();

        if(texto === ""){
            lista.innerHTML = "";
            return;
        }

        const resultados = productos.filter(p =>
            p.nombre.toLowerCase().includes(texto)
        );

        lista.innerHTML = resultados.map(p => `
            <div style="padding:6px; cursor:pointer;"
                 onclick="seleccionarProductoVenta(${p.id}, '${p.nombre.replace(/'/g,"")}')">
                 ${p.nombre} (Stock: ${p.cantidad})
            </div>
        `).join("");

    });

}

window.seleccionarProductoVenta = function(id,nombre){

    document.getElementById("input-buscar-prod").value = nombre;
    document.getElementById("select-producto-id").value = id;
    document.getElementById("lista-sugerencias").innerHTML = "";

};


/* INICIAR BUSCADOR */
window.addEventListener("load", iniciarBuscadorProductos);
/* =====================================
LISTA INTELIGENTE DE COMPRAS DESDE PEDIDOS
===================================== */

let listaCompras = [];

window.generarListaCompras = function(){

    const contenedor = document.getElementById("seccion-lista-compras");
    const ul = document.getElementById("lista-compras-items");

    let acumulado = {};

    encargos.forEach(pedido => {

        pedido.items.forEach(item => {

            if(item.entregado) return;

            const nombre = item.nombre.toLowerCase();

            if(!acumulado[nombre]){
                acumulado[nombre] = {
                    nombre: item.nombre,
                    cantidad: 0,
                    comprado:false
                };
            }

            acumulado[nombre].cantidad += item.cant;

        });

    });

    listaCompras = Object.values(acumulado);

    renderListaCompras();

    contenedor.style.display = "block";
}


function renderListaCompras(){

    const ul = document.getElementById("lista-compras-items");

    if(!ul) return;

    const pendientes = listaCompras.filter(p=>!p.comprado);
    const comprados = listaCompras.filter(p=>p.comprado);

    ul.innerHTML = [...pendientes,...comprados].map((p,i)=>`

        <li style="margin-bottom:6px">

        <input type="checkbox"
        ${p.comprado?"checked":""}
        onchange="marcarComprado(${i})">

        <b>${p.nombre}</b> x${p.cantidad}

        </li>

    `).join("");

}


window.marcarComprado = function(index){

    listaCompras[index].comprado = !listaCompras[index].comprado;

    renderListaCompras();

}


/* =====================================
GENERAR PRODUCTOS LISTOS PARA ENTREGA
===================================== */

window.prepararEntregas = function(){

    const comprados = listaCompras.filter(p=>p.comprado);

    encargos.forEach(pedido => {

        pedido.items.forEach(item => {

            const match = comprados.find(p=>
                p.nombre.toLowerCase() === item.nombre.toLowerCase()
            );

            if(match){
                item.entregado = false;
            }

        });

    });

    actualizarTodo();

    alert("Productos comprados listos para entregar");

}
