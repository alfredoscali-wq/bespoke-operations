import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { readFileSync } from "node:fs"
import net from "node:net"
import { resolve } from "node:path"
import test from "node:test"

import { encodeSentence } from "../network-agent/src/connectors/mikrotik/protocol.ts"
import {
  bindRouterOsApiSocket,
} from "../network-agent/src/connectors/mikrotik/api-client.ts"
import { createMikrotikConnector } from "../network-agent/src/connectors/mikrotik/index.ts"
import { ConnectorError } from "../network-agent/src/connectors/types.ts"
import {
  executeDiscoveryJob,
  executeMonitoringJob,
} from "../network-agent/src/discovery/run-job.ts"
import {
  processOnce,
  runAgentLoopIteration,
} from "../network-agent/src/index.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

class FakeSocket extends EventEmitter {
  destroyed = false
  writes = []

  setTimeout() {
    return this
  }

  write(data) {
    this.writes.push(data)
    return true
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.emit("close")
  }
}

function accessFor(port) {
  return {
    host: "127.0.0.1",
    port,
    protocol: "api",
    username: "admin",
    password: "lab",
    timeoutMs: 2000,
  }
}

function executionFor(port) {
  return {
    vendor: "mikrotik",
    host: "127.0.0.1",
    port,
    protocol: "api",
    username: "admin",
    password: "lab",
  }
}

function attachFakeRouterOs(socket) {
  socket.on("data", () => {
    socket.write(
      encodeSentence([
        "!re",
        "=name=CORE-LAB",
        "=version=7.16.1",
        "=uptime=1h",
        "=cpu-load=3",
        "=total-memory=1024",
        "=free-memory=512",
        "=running=true",
        "=disabled=false",
        "=rx-byte=10",
        "=tx-byte=20",
      ])
    )
    socket.write(encodeSentence(["!done"]))
  })
}

function listen(connectionHandler) {
  return new Promise((resolveListen, reject) => {
    const server = net.createServer(connectionHandler)
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("No se pudo abrir el servidor de prueba."))
        return
      }
      resolveListen({ server, port: address.port })
    })
  })
}

async function withUncaughtGuard(run) {
  const seen = []
  const onUncaught = (error) => {
    seen.push(error)
  }
  process.on("uncaughtException", onUncaught)
  try {
    await run()
    await new Promise((resolveWait) => setImmediate(resolveWait))
    assert.equal(seen.length, 0, "no debe haber uncaughtException")
  } finally {
    process.off("uncaughtException", onUncaught)
  }
}

test("decodeSentences throw en data handler rechaza talk y no es uncaughtException", async () => {
  await withUncaughtGuard(async () => {
    const socket = new FakeSocket()
    const session = bindRouterOsApiSocket(socket, {
      decode: () => {
        throw new Error("decodeSentences boom")
      },
    })
    socket.emit("connect")
    await session.waitUntilConnected()
    const pending = session.talk(["/login"])
    socket.emit("data", Buffer.from([0x05, 0x21, 0x64, 0x6f, 0x6e, 0x65, 0x00]))
    await assert.rejects(pending, (error) => {
      assert.equal(error instanceof ConnectorError, true)
      assert.match(error.message, /decodeSentences boom/)
      return true
    })
  })
})

test("socket error rechaza la operación pendiente", async () => {
  const socket = new FakeSocket()
  const session = bindRouterOsApiSocket(socket)
  socket.emit("connect")
  await session.waitUntilConnected()
  const pending = session.talk(["/system/resource/print"])
  socket.emit("error", new Error("ECONNRESET"))
  await assert.rejects(pending, /ECONNRESET|No se pudo conectar/)
})

test("socket close inesperado rechaza la operación pendiente", async () => {
  const socket = new FakeSocket()
  const session = bindRouterOsApiSocket(socket)
  socket.emit("connect")
  await session.waitUntilConnected()
  const pending = session.talk(["/system/identity/print"])
  socket.emit("close")
  await assert.rejects(pending, /se cerró/)
})

test("poll() propaga el error del api-client y no lo convierte en éxito", async () => {
  const { server, port } = await listen((socket) => {
    socket.destroy()
  })
  try {
    const connector = createMikrotikConnector({ targetId: "tgt-1", siteId: null })
    await assert.rejects(
      connector.poll(accessFor(port), { deviceId: "dev-1" }),
      (error) => {
        assert.equal(error instanceof ConnectorError, true)
        return true
      }
    )
  } finally {
    server.close()
  }
})

test("executeMonitoringJob() captura/propaga el error de poll", async () => {
  const { server, port } = await listen((socket) => {
    socket.destroy()
  })
  try {
    await assert.rejects(
      executeMonitoringJob({
        targetId: "tgt-1",
        siteId: null,
        deviceId: "dev-1",
        execution: executionFor(port),
      }),
      (error) => {
        assert.equal(error instanceof Error, true)
        return true
      }
    )
  } finally {
    server.close()
  }
})

test("un fallo de polling termina enviando /result con failed", async () => {
  const submitted = []
  await processOnce({
    heartbeat: async () => ({}),
    claimJob: async () => ({
      job: {
        id: "08ceec96-dbb8-4584-a8be-7220e5b0c9a1",
        jobType: "monitoring",
        status: "dispatched",
        payload: { deviceId: "dev-1", targetId: "tgt-1" },
        siteId: null,
      },
      execution: executionFor(8728),
    }),
    startJob: async () => ({}),
    submitJobResult: async (result) => {
      submitted.push(result)
      return {}
    },
    executeMonitoringJob: async () => {
      throw new ConnectorError("La conexión API con MikroTik se cerró.")
    },
    executeDiscoveryJob: async () => {
      throw new Error("Discovery no debería ejecutarse.")
    },
  })

  assert.equal(submitted.length, 1)
  assert.equal(submitted[0].ok, false)
  assert.equal(submitted[0].jobId, "08ceec96-dbb8-4584-a8be-7220e5b0c9a1")
  assert.match(submitted[0].error, /se cerró/)
})

test("el Agent continúa su loop después de un monitoring fallido", async () => {
  const started = []
  const submitted = []
  let claims = 0

  const failingDeps = {
    heartbeat: async () => ({}),
    claimJob: async () => {
      claims += 1
      if (claims === 1) {
        return {
          job: {
            id: "job-fail",
            jobType: "monitoring",
            status: "dispatched",
            payload: { deviceId: "dev-1", targetId: "tgt-1" },
            siteId: null,
          },
          execution: executionFor(8728),
        }
      }
      return { job: null, execution: null }
    },
    startJob: async (jobId) => {
      started.push(jobId)
      return {}
    },
    submitJobResult: async (result) => {
      submitted.push(result)
      return {}
    },
    executeMonitoringJob: async () => {
      throw new Error("poll boom")
    },
    executeDiscoveryJob: async () => {
      throw new Error("Discovery no debería ejecutarse.")
    },
  }

  await runAgentLoopIteration(failingDeps)
  await runAgentLoopIteration(failingDeps)

  assert.equal(claims, 2)
  assert.deepEqual(started, ["job-fail"])
  assert.equal(submitted.length, 1)
  assert.equal(submitted[0].ok, false)
})

test("un monitoring exitoso sigue funcionando igual", async () => {
  const { server, port } = await listen(attachFakeRouterOs)
  try {
    const snapshot = await executeMonitoringJob({
      targetId: "tgt-1",
      siteId: null,
      deviceId: "dev-1",
      execution: executionFor(port),
    })
    assert.equal(snapshot.vendor, "mikrotik")
    assert.equal(snapshot.deviceId, "dev-1")
    assert.equal(snapshot.hostname, "CORE-LAB")
    assert.equal(snapshot.cpuLoad, 3)

    const submitted = []
    await processOnce({
      heartbeat: async () => ({}),
      claimJob: async () => ({
        job: {
          id: "job-ok",
          jobType: "monitoring",
          status: "dispatched",
          payload: { deviceId: "dev-1", targetId: "tgt-1" },
          siteId: null,
        },
        execution: executionFor(port),
      }),
      startJob: async () => ({}),
      submitJobResult: async (result) => {
        submitted.push(result)
        return {}
      },
      executeMonitoringJob: async () => snapshot,
      executeDiscoveryJob: async () => {
        throw new Error("Discovery no debería ejecutarse.")
      },
    })
    assert.equal(submitted.length, 1)
    assert.equal(submitted[0].ok, true)
    assert.equal(submitted[0].snapshot.hostname, "CORE-LAB")
  } finally {
    server.close()
  }
})

test("Discovery continúa funcionando exactamente igual", async () => {
  const mikrotik = read("network-agent/src/connectors/mikrotik/index.ts")
  assert.match(mikrotik, /async function discoverViaApi/)
  assert.match(mikrotik, /async discover\(access: ConnectorAccess\)/)
  assert.match(mikrotik, /\/system\/identity\/print/)
  assert.match(mikrotik, /\/ip\/neighbor\/print/)
  assert.doesNotMatch(
    mikrotik.slice(mikrotik.indexOf("async function discoverViaApi"), mikrotik.indexOf("async function discoverViaRest")),
    /monitoring/
  )

  const { server, port } = await listen(attachFakeRouterOs)
  try {
    const snapshot = await executeDiscoveryJob({
      targetId: "tgt-1",
      siteId: null,
      execution: executionFor(port),
    })
    assert.equal(snapshot.vendor, "mikrotik")
    assert.equal(snapshot.devices.length > 0, true)
    assert.equal(snapshot.devices[0].hostname, "CORE-LAB")
  } finally {
    server.close()
  }
})

test("index.ts loguea start/finish/failed de monitoring y no imprime secretos", () => {
  const source = read("network-agent/src/index.ts")
  assert.match(source, /\[network-agent\] monitoring execution started/)
  assert.match(source, /\[network-agent\] monitoring execution finished/)
  assert.match(source, /\[network-agent\] monitoring failed/)
  assert.match(source, /uncaughtException/)
  assert.match(source, /unhandledRejection/)
  assert.doesNotMatch(source, /password/)
  assert.doesNotMatch(source, /NETWORK_AGENT_TOKEN/)
  assert.doesNotMatch(source, /execution\.password/)
})
