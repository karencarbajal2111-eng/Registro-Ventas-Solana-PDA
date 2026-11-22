// Pruebas del Registro de Ventas (Solana Playground: ejecutar con "test").
// Sin imports: web3, anchor, pg y assert son globales en el Playground.
// Cubren los casos de "Pruebas y evidencias": flujos validos + rechazos del programa en Rust.
//
// NOTA: en Devnet una transaccion puede tardar unos segundos en verse al leer la cuenta.
// Por eso se envia con commitment "confirmed" y se lee con reintentos (esperar / existe).

describe("Registro de Ventas", () => {
  // Nombre unico por corrida para no chocar con registros de pruebas anteriores
  const nombre = "Test" + (Date.now() % 100000000); // max 30 caracteres
  const owner = pg.wallet.publicKey;
  const intruso = web3.Keypair.generate(); // wallet NO autorizada
  const C: web3.Commitment = "confirmed";
  const rpcOpts = { commitment: C };

  const u16 = (n: number) => {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(n, 0);
    return b;
  };
  const pda = (seeds: Buffer[]) =>
    web3.PublicKey.findProgramAddressSync(seeds, pg.PROGRAM_ID)[0];

  const registro = pda([Buffer.from("registro"), Buffer.from(nombre), owner.toBuffer()]);
  const cliente = (id: number) =>
    pda([Buffer.from("cliente"), registro.toBuffer(), u16(id)]);
  const venta = (cli: web3.PublicKey, sku: string) =>
    pda([Buffer.from("venta"), cli.toBuffer(), Buffer.from(sku)]);

  const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Lee repetidamente hasta que se cumpla la condicion (max ~30 s). Devuelve el ultimo valor leido.
  async function esperar<T>(leer: () => Promise<T>, ok: (v: T) => boolean): Promise<T> {
    let ultimo: any;
    let ultimoError: any = null;
    for (let i = 0; i < 20; i++) {
      try {
        ultimo = await leer();
        ultimoError = null;
        if (ok(ultimo)) return ultimo;
      } catch (e) {
        ultimoError = e;
      }
      await dormir(1500);
    }
    if (ultimoError) throw ultimoError;
    return ultimo;
  }

  // Espera a que una cuenta exista (esperado = true) o no exista (esperado = false).
  // Devuelve true si se alcanzo el estado esperado, false si se agoto el tiempo.
  async function existe(k: web3.PublicKey, esperado: boolean): Promise<boolean> {
    for (let i = 0; i < 20; i++) {
      const info = await pg.connection.getAccountInfo(k, C);
      if ((info !== null) === esperado) return true;
      await dormir(1500);
    }
    return false;
  }

  const leerRegistro = (ok: (r: any) => boolean) =>
    esperar(() => pg.program.account.registro.fetch(registro, C), ok);
  const leerCliente = (id: number, ok: (c: any) => boolean) =>
    esperar(() => pg.program.account.cliente.fetch(cliente(id), C), ok);
  const leerVenta = (cli: web3.PublicKey, sku: string, ok: (v: any) => boolean) =>
    esperar(() => pg.program.account.venta.fetch(venta(cli, sku), C), ok);

  // Espera que la promesa FALLE con el error indicado (codigo de Anchor o texto en logs/mensaje)
  async function esperaError(promesa: Promise<any>, esperado: string) {
    let fallo: any = null;
    try {
      await promesa;
    } catch (e) {
      fallo = e;
    }
    assert(fallo !== null, `Se esperaba el error ${esperado}, pero la operacion tuvo exito`);
    const texto =
      (fallo?.error?.errorCode?.code ?? "") +
      " " + (fallo?.message ?? "") +
      " " + (fallo?.logs ? fallo.logs.join(" ") : "") +
      " " + JSON.stringify(fallo?.transactionLogs ?? "");
    assert(texto.includes(esperado), `Error distinto al esperado (${esperado}): ${texto}`);
  }

  // ---------- CASOS VALIDOS ----------

  it("Crea Registro y dos Clientes (Ana id 1, Luis id 2)", async () => {
    await pg.program.methods.crearRegistro(nombre).accounts({ owner, registro }).rpc(rpcOpts);
    await pg.program.methods.crearCliente("Ana").accounts({ owner, registro, cliente: cliente(1) }).rpc(rpcOpts);
    await pg.program.methods.crearCliente("Luis").accounts({ owner, registro, cliente: cliente(2) }).rpc(rpcOpts);

    const r = await leerRegistro((x) => x.idCounter === 2 && x.clientes.length === 2);
    assert.equal(r.idCounter, 2);
    assert.equal(r.clientes.length, 2);
    assert(r.clientes[0].equals(cliente(1)));
  });

  it("Registra una venta valida y actualiza historial y compras", async () => {
    const v = venta(cliente(1), "CAF01");
    await pg.program.methods
      .registrarVenta(1, "CAF01", "Cafe americano", 25)
      .accounts({ owner, registro, cliente: cliente(1), venta: v })
      .rpc(rpcOpts);

    const c = await leerCliente(1, (x) => x.compras === 1);
    assert.equal(c.compras, 1);
    assert(c.historial[0].equals(v));
    const ve = await leerVenta(cliente(1), "CAF01", (x) => x.monto === 25);
    assert.equal(ve.monto, 25);
  });

  it("Corrige el monto de la misma venta", async () => {
    const v = venta(cliente(1), "CAF01");
    await pg.program.methods
      .cambiarMonto(1, "CAF01", 30)
      .accounts({ owner, registro, cliente: cliente(1), venta: v })
      .rpc(rpcOpts);
    const ve = await leerVenta(cliente(1), "CAF01", (x) => x.monto === 30);
    assert.equal(ve.monto, 30);
  });

  // ---------- RECHAZOS ----------

  it("RECHAZA wallet no autorizada (NoOwner)", async () => {
    await esperaError(
      pg.program.methods
        .cambiarMonto(1, "CAF01", 99)
        .accounts({ owner: intruso.publicKey, registro, cliente: cliente(1), venta: venta(cliente(1), "CAF01") })
        .signers([intruso])
        .rpc(rpcOpts),
      "NoOwner"
    );
    const ve = await leerVenta(cliente(1), "CAF01", () => true);
    assert.equal(ve.monto, 30); // sin cambios
  });

  it("RECHAZA venta ajena al cliente (ConstraintSeeds)", async () => {
    // Luis (id 2) intenta devolver la venta de Ana
    await esperaError(
      pg.program.methods
        .hacerDevolucion(2, "CAF01")
        .accounts({ owner, registro, cliente: cliente(2), venta: venta(cliente(1), "CAF01") })
        .rpc(rpcOpts),
      "ConstraintSeeds"
    );
    assert(await existe(venta(cliente(1), "CAF01"), true));
  });

  it("[APORTE] RECHAZA monto = 0 al registrar y al corregir (MontoInvalido)", async () => {
    await esperaError(
      pg.program.methods
        .registrarVenta(2, "PAN01", "Pan", 0)
        .accounts({ owner, registro, cliente: cliente(2), venta: venta(cliente(2), "PAN01") })
        .rpc(rpcOpts),
      "MontoInvalido"
    );
    assert(await existe(venta(cliente(2), "PAN01"), false)); // no se creo la cuenta

    await esperaError(
      pg.program.methods
        .cambiarMonto(1, "CAF01", 0)
        .accounts({ owner, registro, cliente: cliente(1), venta: venta(cliente(1), "CAF01") })
        .rpc(rpcOpts),
      "MontoInvalido"
    );
    const ve = await leerVenta(cliente(1), "CAF01", () => true);
    assert.equal(ve.monto, 30);
  });

  it("[APORTE] RECHAZA sku de mas de 5 caracteres (SkuInvalido)", async () => {
    await esperaError(
      pg.program.methods
        .registrarVenta(2, "ABCDEF", "Producto", 10)
        .accounts({ owner, registro, cliente: cliente(2), venta: venta(cliente(2), "ABCDEF") })
        .rpc(rpcOpts),
      "SkuInvalido"
    );
  });

  it("RECHAZA dar de baja a un cliente con ventas activas (ClienteConVentas)", async () => {
    await esperaError(
      pg.program.methods.eliminarCliente(1).accounts({ owner, registro, cliente: cliente(1) }).rpc(rpcOpts),
      "ClienteConVentas"
    );
    // Todo se conserva
    assert(await existe(cliente(1), true));
    const r = await leerRegistro(() => true);
    assert.equal(r.clientes.length, 2);
    const c = await leerCliente(1, () => true);
    assert.equal(c.compras, 1);
  });

  // ---------- DEVOLUCION Y BAJA ----------

  it("Devolucion valida: cierra la Venta y actualiza el Cliente", async () => {
    await pg.program.methods
      .hacerDevolucion(1, "CAF01")
      .accounts({ owner, registro, cliente: cliente(1), venta: venta(cliente(1), "CAF01") })
      .rpc(rpcOpts);
    assert(await existe(venta(cliente(1), "CAF01"), false));
    const c = await leerCliente(1, (x) => x.compras === 0);
    assert.equal(c.compras, 0);
    assert.equal(c.historial.length, 0);
  });

  it("Baja de un cliente vacio: cierra Cliente, retira su referencia y conserva id_counter", async () => {
    await pg.program.methods.eliminarCliente(1).accounts({ owner, registro, cliente: cliente(1) }).rpc(rpcOpts);

    assert(await existe(cliente(1), false)); // cuenta cerrada
    const r = await leerRegistro((x) => x.clientes.length === 1);
    assert.equal(r.clientes.length, 1); // solo queda Luis
    assert(r.clientes[0].equals(cliente(2)));
    assert.equal(r.idCounter, 2); // el contador NO retrocede
    const luis = await leerCliente(2, () => true);
    assert.equal(luis.nombre, "Luis"); // Luis intacto
  });

  it("El siguiente cliente recibe id 3 (no reutiliza el id 1)", async () => {
    await pg.program.methods.crearCliente("Marta").accounts({ owner, registro, cliente: cliente(3) }).rpc(rpcOpts);
    const r = await leerRegistro((x) => x.idCounter === 3);
    assert.equal(r.idCounter, 3);
    const m = await leerCliente(3, () => true);
    assert.equal(m.idCliente, 3);
  });
});
