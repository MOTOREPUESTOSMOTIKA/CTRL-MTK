console.log("Sistema Motika cargado correctamente con Firebase");

/* --- ESTADO GLOBAL --- */
let productos = [];
let transacciones = [];
let encargos = [];
let historialReportes = [];

/* ================= UTILIDADES ================= */

function limpiarNumero(valor) {
    if (!valor) return 0;
    return parseFloat(valor.toString().replace(/\./g, '').replace(',', '.')) || 0;
}

function formatearNumero(valor) {
    return Number(valor || 0).toLocaleString('es-CO');
}

function esMismaSemana(fechaStr) {
    const hoy = new Date();
    const fecha = new Date(fechaStr);
    const primerDiaSemana = new Date(hoy.setDate(hoy.getDate() - hoy.getDay()));
    return fecha >= primerDiaSemana;
}

/* ================= FIREBASE ================= */

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
        productos,
        transacciones,
        encargos,
        historialReportes
    });
    renderTodo();
}

/* ================= DASHBOARD ================= */

function renderDashboard() {

    let ventasHistorico = 0;
    let gastosHistorico = 0;
    let ventasSemana = 0;
    let gastosSemana = 0;
    let costoVentas = 0;

    transacciones.forEach(t => {
        if (t.tipo === 'ingreso') ventasHistorico += t.monto;
        if (t.tipo === 'gasto') gastosHistorico += t.monto;

        if (esMismaSemana(t.fecha)) {
            if (t.tipo === 'ingreso') ventasSemana += t.monto;
            if (t.tipo === 'gasto') gastosSemana += t.monto;
        }
    });

    productos.forEach(p => {
        costoVentas += (p.costo * p.cantidad);
    });

    let gananciaHistorica = ventasHistorico - gastosHistorico;
    let gananciaSemana = ventasSemana - gastosSemana;

    document.getElementById('total-ventas-historico').innerText = `$${formatearNumero(ventasHistorico)}`;
    document.getElementById('total-gastos-historico').innerText = `$${formatearNumero(gastosHistorico)}`;
    document.getElementById('ganancia-historica').innerText = `$${formatearNumero(gananciaHistorica)}`;
    document.getElementById('efectivo-historico').innerText = `$${formatearNumero(gananciaHistorica)}`;

    document.getElementById('ventas-semana').innerText = `$${formatearNumero(ventasSemana)}`;
    document.getElementById('gastos-semana').innerText = `$${formatearNumero(gastosSemana)}`;
    document.getElementById('ganancia-semana').innerText = `$${formatearNumero(gananciaSemana)}`;
    document.getElementById('balance-final').innerText = `$${formatearNumero(gananciaSemana)}`;

    let valorInventario = productos.reduce((acc, p) => acc + (p.costo * p.cantidad), 0);
    document.getElementById('dash-valor-inv').innerText = `$${formatearNumero(valorInventario)}`;
    document.getElementById('dash-patrimonio').innerText = `$${formatearNumero(valorInventario + gananciaHistorica)}`;
}

/* ================= INVENTARIO ================= */

window.editarStock = function(id) {
    const p = productos.find(x => x.id === id);
    const nuevo = prompt("Nuevo stock:", p.cantidad);
    if (nuevo !== null) {
        p.cantidad = parseInt(nuevo);
        actualizarTodo();
    }
};

function renderInventario() {
    const t = document.getElementById('tabla-inventario');
    t.innerHTML = productos.map(p => `
        <tr>
            <td>${p.nombre}</td>
            <td>${p.cantidad}</td>
            <td>$${formatearNumero(p.costo)}</td>
            <td>$${formatearNumero(p.precio)}</td>
            <td><button onclick="editarStock(${p.id})">✏</button></td>
            <td><button onclick="eliminarProd(${p.id})">❌</button></td>
        </tr>
    `).join('');
}

/* ================= PEDIDOS ================= */

window.entregarPedido = function(id) {
    const pedido = encargos.find(e => e.id === id);
    if (!pedido) return;

    if (!confirm("¿Sumar a caja como venta?\nAceptar = Caja\nCancelar = Deudor")) {
        pedido.deuda += pedido.total;
    } else {
        transacciones.push({
            id: Date.now(),
            tipo: 'ingreso',
            desc: `Pedido entregado: ${pedido.cliente}`,
            monto: pedido.total,
            fecha: new Date().toLocaleDateString()
        });
    }

    pedido.entregadoTotal = true;
    actualizarTodo();
};

/* ================= DEUDORES ================= */

window.incrementarDeuda = function(id) {
    const e = encargos.find(x => x.id === id);
    const monto = limpiarNumero(prompt("Monto a agregar:"));
    if (monto > 0) {
        e.deuda += monto;
        actualizarTodo();
    }
};

function renderDeudas() {
    const t = document.getElementById('tabla-deudores');
    t.innerHTML = encargos.filter(e => e.deuda > 0).map(e => `
        <tr>
            <td>${e.cliente}</td>
            <td style="color:red">$${formatearNumero(e.deuda)}</td>
            <td><button onclick="incrementarDeuda(${e.id})">➕</button></td>
            <td><input type="number" id="in-abono-${e.id}" style="width:70px"></td>
            <td><button onclick="abonar(${e.id})">Abonar</button></td>
        </tr>
    `).join('');
}

/* ================= FINANZAS ================= */

const fTrans = document.getElementById('form-transaccion');
if(fTrans) {
    fTrans.addEventListener('submit', (e) => {
        e.preventDefault();
        const tipo = document.getElementById('trans-tipo').value;
        let monto = limpiarNumero(document.getElementById('trans-monto').value);
        let desc = document.getElementById('trans-desc').value;

        transacciones.push({
            id: Date.now(),
            tipo: tipo === 'gasto' ? 'gasto' : 'ingreso',
            desc,
            monto,
            fecha: new Date().toLocaleDateString()
        });

        actualizarTodo();
        fTrans.reset();
    });
}

/* ================= RENDER GENERAL ================= */

function renderTodo() {
    renderInventario();
    renderDeudas();
    renderDashboard();
}

window.onload = () => {
    renderTodo();
};