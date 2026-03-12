console.log("Sistema Motika V3 - Contabilidad Profesional Activa");

/* --- ESTADO GLOBAL --- */
let productos = [];
let transacciones = []; 
let encargos = []; 
let historialReportes = []; 
let historialGastos = []; 
let historialAbonos = []; 

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
        if(t.tipo === 'ingreso'){
            ventasTotales += t.monto;
            costoDeLoVendido += (t.costoAsociado || 0);
        }else{
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
if(fProd){
    fProd.addEventListener('submit', (e)=>{
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

window.editarStock = function(id){

    const p = productos.find(x => x.id === id);

    const nuevoStock = prompt(`Editar Stock para ${p.nombre}:`, p.cantidad);

    if(nuevoStock !== null){
        p.cantidad = parseInt(nuevoStock) || 0;
        actualizarTodo();
    }

}

window.eliminarProd = function(id){

    if(confirm("¿Eliminar producto?")){
        productos = productos.filter(p => p.id !== id);
        actualizarTodo();
    }

}

function renderInventario(){

    const t = document.getElementById('tabla-inventario');

    if(!t) return;

    let cTotal = 0, vTotal = 0;

    t.innerHTML = productos.map(p => {

        cTotal += (p.costo * p.cantidad);
        vTotal += (p.precio * p.cantidad);

        return `
        <tr>
        <td>${p.nombre}</td>
        <td class="${p.cantidad <= 2 ? 'stock-bajo' : ''}">
        <b>${p.cantidad}</b>
        </td>
        <td>$${formatearNumero(p.costo)}</td>
        <td>$${formatearNumero(p.precio)}</td>
        <td>
        <button class="btn-danger" onclick="eliminarProd(${p.id})">❌</button>
        </td>
        </tr>`;

    }).join('');

    document.getElementById('float-costo').innerText = `$${formatearNumero(cTotal)}`;
    document.getElementById('float-venta').innerText = `$${formatearNumero(vTotal)}`;

}

/* --- GASTOS DIARIOS --- */
const fGastoLog = document.getElementById('form-gastos-diarios');

if(fGastoLog){

    fGastoLog.addEventListener('submit', (e)=>{

        e.preventDefault();

        const monto = limpiarNumero(document.getElementById('gasto-monto-op').value);
        const desc = document.getElementById('gasto-desc-op').value;
        const cat = document.getElementById('gasto-categoria').value;
        const fecha = document.getElementById('gasto-fecha').value || new Date().toLocaleDateString();

        const gastoData = { id: Date.now(), fecha, cat, desc, monto };

        historialGastos.push(gastoData);

        transacciones.push({
            id: Date.now()+1,
            tipo:'gasto',
            desc:`[${cat}] ${desc}`,
            monto:monto,
            fecha:fecha
        });

        actualizarTodo();
        fGastoLog.reset();

        alert("Gasto registrado en contabilidad.");

    });

}

function renderGastos(){

    const tabla = document.getElementById('tabla-gastos-logistica');

    if(tabla){

        tabla.innerHTML = historialGastos.slice(-20).map(g=>`
        <tr>
        <td>${g.fecha}</td>
        <td>${g.cat}</td>
        <td>${g.desc}</td>
        <td style="color:red">-$${formatearNumero(g.monto)}</td>
        </tr>
        `).reverse().join('');

    }

}

/* --- GESTIÓN DE PEDIDOS Y STOCK --- */

window.agregarFila = function(){

    const div = document.createElement('div');

    div.className='fila-producto';

    div.innerHTML=`
    <input type="text" placeholder="Producto exacto" class="p-nombre" required>
    <input type="number" placeholder="Cant." class="p-cant" required>
    <button type="button" onclick="this.parentElement.remove()">✕</button>
    `;

    document.getElementById('contenedor-filas-productos').appendChild(div);

}

/* --- LISTA DE COMPRAS DESDE PEDIDOS --- */

let listaCompras = [];

window.generarListaCompras = function(){

    const contenedor = document.getElementById("seccion-lista-compras");
    const ul = document.getElementById("lista-compras-items");

    if(!contenedor || !ul) return;

    let acumulado = {};

    encargos.forEach(pedido=>{

        pedido.items.forEach(item=>{

            if(item.entregado) return;

            const nombre = item.nombre.trim().toLowerCase();

            if(!acumulado[nombre]){

                acumulado[nombre] = {
                    id:nombre,
                    nombre:item.nombre,
                    cantidad:0,
                    comprado:false
                };

            }

            acumulado[nombre].cantidad += item.cant;

        });

    });

    listaCompras = Object.values(acumulado);

    renderListaCompras();

    contenedor.style.display="block";

}

function renderListaCompras(){

    const ul = document.getElementById("lista-compras-items");

    if(!ul) return;

    ul.innerHTML = listaCompras.map(p=>`

    <li style="margin-bottom:6px">

    <input type="checkbox"
    ${p.comprado?"checked":""}
    onchange="marcarComprado('${p.id}')">

    <b>${p.nombre}</b> x${p.cantidad}

    </li>

    `).join("");

}

window.marcarComprado = function(id){

    const prod = listaCompras.find(p=>p.id===id);

    if(!prod) return;

    prod.comprado = !prod.comprado;

    renderListaCompras();

}

/* --- RENDERS --- */

function renderPedidos(){}
function renderDeudas(){}
function renderFinanzas(){}
function renderHistorialReportes(){}

function renderTodo(){

    renderDashboard();
    renderInventario();
    renderFinanzas();
    renderGastos();
    renderPedidos();
    renderDeudas();
    renderHistorialReportes();

}