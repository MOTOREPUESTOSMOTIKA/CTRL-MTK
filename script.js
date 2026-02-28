console.log("Sistema Motika cargado correctamente con Firebase");

/* ========= ESTADO ========= */
let productos = [];
let transacciones = [];
let encargos = [];
let historialReportes = [];
let efectivoCaja = 0;

/* ========= UTILIDADES ========= */
function limpiarNumero(valor){
    if(!valor) return 0;
    return parseFloat(valor.toString().replace(/\./g,'').replace(',','.')) || 0;
}

function formatearNumero(valor){
    return Number(valor || 0).toLocaleString('es-CO');
}

/* ========= MENU LATERAL ========= */
window.toggleMenu = function(){
    document.getElementById("sidebar").classList.toggle("active");
};

window.showSection = function(id){
    document.querySelectorAll("main section").forEach(sec=>{
        sec.classList.remove("active");
    });
    document.getElementById(id).classList.add("active");
};

/* ========= RENDER GENERAL ========= */
function renderTodo(){
    renderDashboard();
    renderInventario();
    renderTransacciones();
    renderPedidos();
    renderDeudores();
    renderReportes();
}

/* ========= FIREBASE ========= */
db.ref("motika_data").on("value", snap=>{
    const data = snap.val();
    if(data){
        productos = data.productos || [];
        transacciones = data.transacciones || [];
        encargos = data.encargos || [];
        historialReportes = data.historialReportes || [];
        efectivoCaja = data.efectivoCaja || 0;
    }
    renderTodo();
});

function actualizarTodo(){
    db.ref("motika_data").set({
        productos,
        transacciones,
        encargos,
        historialReportes,
        efectivoCaja
    });
}

/* ========= DASHBOARD ========= */
function renderDashboard(){

    let ventasHistorico = 0;
    let gastosHistorico = 0;

    historialReportes.forEach(r=>{
        ventasHistorico += r.totalIngresos;
        gastosHistorico += r.totalGastos;
    });

    let ventasSemana = 0;
    let gastosSemana = 0;

    transacciones.forEach(t=>{
        if(t.tipo==="venta" || t.tipo==="ingreso") ventasSemana += t.monto;
        if(t.tipo==="gasto") gastosSemana += t.monto;
    });

    const gananciaHistorica = ventasHistorico - gastosHistorico + (ventasSemana - gastosSemana);
    const gananciaSemana = ventasSemana - gastosSemana;

    const costoInventario = productos.reduce((acc,p)=> acc + (p.costo * p.cantidad),0);
    const valorVentaInventario = productos.reduce((acc,p)=> acc + (p.precio * p.cantidad),0);
    const patrimonio = costoInventario + efectivoCaja;

    document.getElementById("total-ventas-historico").innerText = "$"+formatearNumero(ventasHistorico + ventasSemana);
    document.getElementById("total-gastos-historico").innerText = "$"+formatearNumero(gastosHistorico + gastosSemana);
    document.getElementById("ganancia-historica").innerText = "$"+formatearNumero(gananciaHistorica);
    document.getElementById("efectivo-historico").innerText = "$"+formatearNumero(ventasHistorico);

    document.getElementById("ventas-semana").innerText = "$"+formatearNumero(ventasSemana);
    document.getElementById("gastos-semana").innerText = "$"+formatearNumero(gastosSemana);
    document.getElementById("ganancia-semana").innerText = "$"+formatearNumero(gananciaSemana);
    document.getElementById("balance-final").innerText = "$"+formatearNumero(efectivoCaja);

    document.getElementById("dash-valor-inv").innerText = "$"+formatearNumero(costoInventario);
    document.getElementById("dash-patrimonio").innerText = "$"+formatearNumero(patrimonio);

    document.getElementById("float-costo").innerText = "$"+formatearNumero(costoInventario);
    document.getElementById("float-venta").innerText = "$"+formatearNumero(valorVentaInventario);
}

/* ========= INVENTARIO ========= */
function renderInventario(){
    const t = document.getElementById("tabla-inventario");
    t.innerHTML = productos.map(p=>`
        <tr>
            <td>${p.nombre}</td>
            <td>${p.cantidad}</td>
            <td>$${formatearNumero(p.costo)}</td>
            <td>$${formatearNumero(p.precio)}</td>
            <td><input type="number" value="${p.cantidad}" onchange="editarStock(${p.id},this.value)" style="width:70px"></td>
            <td><button onclick="eliminarProd(${p.id})">❌</button></td>
        </tr>
    `).join("");
}

window.editarStock = function(id,val){
    const p = productos.find(x=>x.id===id);
    if(p){
        p.cantidad = parseInt(val)||0;
        actualizarTodo();
    }
};

window.eliminarProd = function(id){
    productos = productos.filter(p=>p.id!==id);
    actualizarTodo();
};

document.getElementById("form-producto").addEventListener("submit",e=>{
    e.preventDefault();

    productos.push({
        id:Date.now(),
        nombre:document.getElementById("prod-nombre").value,
        cantidad:parseInt(document.getElementById("prod-cantidad").value),
        costo:limpiarNumero(document.getElementById("prod-costo").value),
        precio:limpiarNumero(document.getElementById("prod-precio").value)
    });

    actualizarTodo();
    e.target.reset();
});

/* ========= TRANSACCIONES ========= */
function renderTransacciones(){
    const t = document.getElementById("lista-transacciones");
    t.innerHTML = transacciones.map(tr=>`
        <tr>
            <td>${tr.fecha}</td>
            <td>${tr.desc}</td>
            <td>$${formatearNumero(tr.monto)}</td>
        </tr>
    `).join("");
}

document.getElementById("form-transaccion").addEventListener("submit",e=>{
    e.preventDefault();

    const tipo = document.getElementById("trans-tipo").value;
    const desc = document.getElementById("trans-desc").value || "Movimiento";
    const monto = limpiarNumero(document.getElementById("trans-monto").value);

    if(tipo==="gasto"){
        if(monto>efectivoCaja){ alert("No hay suficiente efectivo"); return; }
        efectivoCaja -= monto;
    }

    if(tipo==="ingreso" || tipo==="venta"){
        efectivoCaja += monto;
    }

    transacciones.push({
        id:Date.now(),
        tipo,
        desc,
        monto,
        fecha:new Date().toLocaleDateString()
    });

    actualizarTodo();
    e.target.reset();
});

/* ========= FUNCIONES VACÍAS QUE HTML USA ========= */
window.toggleProductoSelector = function(){};
window.agregarFila = function(){};

/* ========= DEUDAS / REPORTES (mínimo funcional) ========= */
function renderPedidos(){ document.getElementById("lista-pedidos-clientes").innerHTML=""; }
function renderDeudores(){ document.getElementById("tabla-deudores").innerHTML=""; }
function renderReportes(){ document.getElementById("historial-reportes").innerHTML=""; }

window.cerrarCaja = function(){
    let ing=0,gas=0;
    transacciones.forEach(t=>{
        if(t.tipo==="ingreso"||t.tipo==="venta") ing+=t.monto;
        if(t.tipo==="gasto") gas+=t.monto;
    });

    historialReportes.push({
        id:Date.now(),
        fecha:new Date().toLocaleString(),
        totalIngresos:ing,
        totalGastos:gas
    });

    transacciones=[];
    actualizarTodo();
};