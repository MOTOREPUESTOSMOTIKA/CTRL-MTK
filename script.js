console.log("Sistema Motika cargado correctamente con Firebase");

/* --- ESTADO GLOBAL --- */
let productos = [];
let transacciones = [];
let encargos = [];
let historialReportes = [];
let efectivoCaja = 0;

/* --- FORMATEO --- */
function limpiarNumero(valor) {
    if (!valor) return 0;
    return parseFloat(valor.toString().replace(/\./g, '').replace(',', '.')) || 0;
}

function formatearNumero(valor) {
    return Number(valor || 0).toLocaleString('es-CO');
}

/* --- SINCRONIZACIÓN --- */
db.ref('motika_data/').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data !== null) {
        productos = data.productos || [];
        transacciones = data.transacciones || [];
        encargos = data.encargos || [];
        historialReportes = data.historialReportes || [];
        efectivoCaja = data.efectivoCaja || 0;
        renderTodo();
    }
});

/* --- ACTUALIZAR --- */
function actualizarTodo() {
    db.ref('motika_data/').set({
        productos,
        transacciones,
        encargos,
        historialReportes,
        efectivoCaja
    });
    renderTodo();
}

/* --- DASHBOARD DOBLE COLUMNA --- */
function renderDashboard() {

    let totalHistoricoIngresos = 0;
    let totalHistoricoGastos = 0;

    historialReportes.forEach(r => {
        totalHistoricoIngresos += r.totalIngresos;
        totalHistoricoGastos += r.totalGastos;
    });

    let actualIngresos = 0;
    let actualGastos = 0;

    transacciones.forEach(t => {
        if (t.tipo === 'ingreso') actualIngresos += t.monto;
        if (t.tipo === 'gasto') actualGastos += t.monto;
    });

    const historicoGanancia = totalHistoricoIngresos - totalHistoricoGastos + (actualIngresos - actualGastos);
    const actualGanancia = actualIngresos - actualGastos;

    const h1 = document.getElementById("hist-total");
    const h2 = document.getElementById("hist-ganancia");
    const a1 = document.getElementById("actual-total");
    const a2 = document.getElementById("actual-ganancia");
    const eCaja = document.getElementById("efectivo-caja");

    if(h1) h1.innerText = "$" + formatearNumero(totalHistoricoIngresos + actualIngresos);
    if(h2) h2.innerText = "$" + formatearNumero(historicoGanancia);
    if(a1) a1.innerText = "$" + formatearNumero(actualIngresos);
    if(a2) a2.innerText = "$" + formatearNumero(actualGanancia);
    if(eCaja) eCaja.innerText = "$" + formatearNumero(efectivoCaja);
}

/* --- INVENTARIO EDITABLE --- */
function renderInventario() {
    const t = document.getElementById('tabla-inventario');
    if(!t) return;

    t.innerHTML = productos.map(p => `
        <tr>
            <td>${p.nombre}</td>
            <td>
                <input type="number" value="${p.cantidad}" 
                onchange="editarStock(${p.id}, this.value)" style="width:70px">
            </td>
            <td>$${formatearNumero(p.costo)}</td>
            <td>$${formatearNumero(p.precio)}</td>
            <td><button onclick="eliminarProd(${p.id})">❌</button></td>
        </tr>
    `).join('');
}

window.editarStock = function(id, valor){
    const p = productos.find(x => x.id === id);
    if(p){
        p.cantidad = parseInt(valor) || 0;
        actualizarTodo();
    }
};

/* --- GASTOS DESCUENTAN EFECTIVO --- */
const fTrans = document.getElementById('form-transaccion');
if(fTrans){
    fTrans.addEventListener('submit',(e)=>{
        e.preventDefault();

        const tipo = document.getElementById('trans-tipo').value;
        let monto = limpiarNumero(document.getElementById('trans-monto').value);
        const desc = document.getElementById('trans-desc').value;

        if(tipo === "gasto"){
            if(monto > efectivoCaja){
                alert("No hay suficiente efectivo");
                return;
            }
            efectivoCaja -= monto;
        }

        if(tipo === "ingreso"){
            efectivoCaja += monto;
        }

        transacciones.push({
            id: Date.now(),
            tipo,
            desc,
            monto,
            fecha: new Date().toLocaleDateString()
        });

        actualizarTodo();
        fTrans.reset();
    });
}

/* --- PEDIDOS MEJORADOS --- */
function renderPedidos(){
    const c = document.getElementById("lista-pedidos-clientes");
    if(!c) return;

    c.innerHTML = encargos
    .filter(e => e.tipo === "pedido" && !e.entregadoTotal)
    .map(e => `
        <div class="card">
            <strong>${e.cliente}</strong>
            ${e.items.map((it,i)=>`
                <div>
                    > ${it.nombre}
                    <button onclick="entregarItem(${e.id},${i})">Entregar</button>
                </div>
            `).join("")}
            <button onclick="entregarTodo(${e.id})">Entregar Todo</button>
        </div>
    `).join("");
}

window.entregarItem = function(id,index){
    const e = encargos.find(x=>x.id===id);
    if(!e) return;

    const opcion = confirm("Aceptar como venta? (Cancelar = Deudor)");
    const item = e.items[index];
    const monto = e.total / e.items.length;

    if(opcion){
        efectivoCaja += monto;
        transacciones.push({
            id: Date.now(),
            tipo:"ingreso",
            desc:"Venta pedido "+item.nombre,
            monto,
            fecha:new Date().toLocaleDateString()
        });
    }else{
        incrementarDeuda(e.cliente,monto);
    }

    e.items.splice(index,1);
    if(e.items.length===0) e.entregadoTotal=true;

    actualizarTodo();
};

window.entregarTodo = function(id){
    const e = encargos.find(x=>x.id===id);
    if(!e) return;

    const opcion = confirm("Aceptar como venta? (Cancelar = Deudor)");
    if(opcion){
        efectivoCaja += e.deuda;
        transacciones.push({
            id: Date.now(),
            tipo:"ingreso",
            desc:"Venta total pedido "+e.cliente,
            monto:e.deuda,
            fecha:new Date().toLocaleDateString()
        });
    }else{
        incrementarDeuda(e.cliente,e.deuda);
    }

    e.entregadoTotal=true;
    e.deuda=0;
    actualizarTodo();
};

/* --- DEUDORES ACUMULABLES --- */
function incrementarDeuda(cliente,monto){
    let existente = encargos.find(e=>e.cliente===cliente && e.tipo==="directa" && e.deuda>0);
    if(existente){
        existente.deuda += monto;
    }else{
        encargos.push({
            id:Date.now(),
            cliente,
            total:monto,
            abono:0,
            deuda:monto,
            entregadoTotal:true,
            tipo:"directa"
        });
    }
}

/* --- CIERRE DE CAJA --- */
window.cerrarCaja = function(){
    if(!confirm("Cerrar caja?")) return;

    let ing=0,gas=0;
    transacciones.forEach(t=>{
        if(t.tipo==="ingreso") ing+=t.monto;
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