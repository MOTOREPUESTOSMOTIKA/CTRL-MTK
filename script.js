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

    let ventasTotales = 0, costoDeLoVendido = 0, gastosTotales = 0;
    
    historialReportes.forEach(r => {
        ventasTotales += r.totalIngresos;
        gastosTotales += r.totalGastos;
        costoDeLoVendido += (r.costoVentas || 0);
    });

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

/* --- BUSCADOR INTELIGENTE DE PRODUCTOS (NUEVO) --- */

window.buscarProductoVenta = function(texto){
    const lista = productos.filter(p =>
        p.nombre.toLowerCase().includes(texto.toLowerCase())
    );

    const cont = document.getElementById("resultados-busqueda-prod");
    if(!cont) return;

    cont.innerHTML = lista.map(p=>`
        <div onclick="seleccionarProductoVenta(${p.id})" class="item-busqueda">
            ${p.nombre} (Stock: ${p.cantidad})
        </div>
    `).join('');
}

window.seleccionarProductoVenta = function(id){
    const p = productos.find(x=>x.id==id);
    document.getElementById("select-producto-id").value=id;
    document.getElementById("busqueda-producto").value=p.nombre;
    document.getElementById("resultados-busqueda-prod").innerHTML="";
}

/* --- GESTIÓN DE PEDIDOS SIN TOTAL OBLIGATORIO (AJUSTE) --- */

const fEnc = document.getElementById('form-encargo');
if(fEnc) {
    fEnc.addEventListener('submit', (e) => {
        e.preventDefault();

        const cliente = document.getElementById('enc-cliente').value;

        let total = limpiarNumero(document.getElementById('enc-total')?.value);
        if(!total) total = 0;

        const abono = limpiarNumero(document.getElementById('enc-abono')?.value) || 0;

        encargos.push({
            id: Date.now(),
            cliente,
            total,
            abono,
            deuda: Math.max(0,total-abono),
            entregadoTotal:false,
            items:Array.from(document.querySelectorAll('.fila-producto')).map(f=>({
                nombre:f.querySelector('.p-nombre').value,
                cant:parseInt(f.querySelector('.p-cant').value),
                entregado:false,
                conseguido:false
            }))
        });

        actualizarTodo();
        fEnc.reset();
    });
}

/* --- LISTA DE COMPRAS INTERACTIVA (NUEVO) --- */

window.generarListaPedidos = function(){

    const cont = document.getElementById("lista-pedidos-compras");
    if(!cont) return;

    let html="";

    encargos.forEach(p=>{
        html+=`<div class="card">
        <strong>${p.cliente}</strong>`;

        p.items.forEach((it,i)=>{
            html+=`
            <div>
            <input type="checkbox"
            onchange="marcarProductoConseguido(${p.id},${i},this.checked)">
            ${it.nombre} x${it.cant}
            </div>`;
        });

        html+=`</div>`;
    });

    cont.innerHTML=html;
}

window.marcarProductoConseguido=function(pedidoId,index,estado){

    const p=encargos.find(x=>x.id===pedidoId);
    if(!p) return;

    p.items[index].conseguido=estado;

    const conseguidos=p.items.filter(i=>i.conseguido);
    const faltantes=p.items.filter(i=>!i.conseguido);

    p.items=[...faltantes,...conseguidos];

    actualizarTodo();
}

/* --- RENDERS --- */

function renderTodo() {
    renderDashboard();
    renderInventario();
    renderFinanzas();
    renderGastos();
    renderPedidos();
    renderDeudas();
    renderHistorialReportes();
    if(window.generarListaPedidos) generarListaPedidos();
}

/* --- RESTO DEL SCRIPT ORIGINAL CONTINÚA IGUAL --- */

window.onload = () => { 
    if(window.toggleProductoSelector) window.toggleProductoSelector(); 
};