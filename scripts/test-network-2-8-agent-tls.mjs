/**
 * Network Agent RouterOS API TLS (API-SSL) vs plaintext 8728.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import net from "node:net"
import { resolve } from "node:path"
import test from "node:test"
import tls from "node:tls"

import { encodeSentence } from "../network-agent/src/connectors/mikrotik/protocol.ts"
import {
  connectRouterOsApi,
  isRouterOsApiTlsEnabled,
  readRouterOsApiCaFile,
  resolveRouterOsApiTls,
} from "../network-agent/src/connectors/mikrotik/api-client.ts"
import { ConnectorError } from "../network-agent/src/connectors/types.ts"
import {
  executeDiagnosticJob,
  executeDiscoveryJob,
  executeMonitoringJob,
} from "../network-agent/src/discovery/run-job.ts"
import {
  beginAgentShutdown,
  resetAgentShutdownForTests,
} from "../network-agent/src/index.ts"

const root = resolve(import.meta.dirname, "..")
const fixtureDir = resolve(root, "scripts/fixtures/network-agent-tls")
const caPem = resolve(fixtureDir, "ca.pem")
const otherCaPem = resolve(fixtureDir, "other-ca.pem")
const serverPem = resolve(fixtureDir, "server.pem")
const serverKey = resolve(fixtureDir, "server.key")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function attachFakeRouterOs(socket) {
  socket.on("data", () => {
    socket.write(
      encodeSentence([
        "!re",
        "=name=CORE-TLS",
        "=version=6.48.6",
        "=uptime=1h",
        "=cpu-load=3",
        "=running=true",
        "=disabled=false",
      ])
    )
    socket.write(encodeSentence(["!done"]))
  })
}

function listenPlain(connectionHandler) {
  return new Promise((resolveListen, reject) => {
    const server = net.createServer(connectionHandler)
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("No se pudo abrir el servidor plano."))
        return
      }
      resolveListen({ server, port: address.port })
    })
  })
}

function listenTls(connectionHandler) {
  return new Promise((resolveListen, reject) => {
    const server = tls.createServer(
      {
        key: readFileSync(serverKey),
        cert: readFileSync(serverPem),
        ca: readFileSync(caPem),
      },
      connectionHandler
    )
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("No se pudo abrir el servidor TLS."))
        return
      }
      resolveListen({ server, port: address.port })
    })
  })
}

function listenPlainOn(port) {
  return new Promise((resolveListen, reject) => {
    const server = net.createServer(attachFakeRouterOs)
    server.once("error", reject)
    server.listen(port, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("No se pudo abrir el servidor plano."))
        return
      }
      resolveListen({ server, port: address.port })
    })
  })
}

function listenTlsOn(port) {
  return new Promise((resolveListen, reject) => {
    const server = tls.createServer(
      {
        key: readFileSync(serverKey),
        cert: readFileSync(serverPem),
        ca: readFileSync(caPem),
      },
      attachFakeRouterOs
    )
    server.once("error", reject)
    server.listen(port, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("No se pudo abrir el servidor TLS."))
        return
      }
      resolveListen({ server, port: address.port })
    })
  })
}

async function withTlsEnv(values, run) {
  const previous = {
    NETWORK_ROUTEROS_TLS: process.env.NETWORK_ROUTEROS_TLS,
    NETWORK_ROUTEROS_CA_FILE: process.env.NETWORK_ROUTEROS_CA_FILE,
  }
  try {
    if (values.NETWORK_ROUTEROS_TLS === undefined) {
      delete process.env.NETWORK_ROUTEROS_TLS
    } else {
      process.env.NETWORK_ROUTEROS_TLS = values.NETWORK_ROUTEROS_TLS
    }
    if (values.NETWORK_ROUTEROS_CA_FILE === undefined) {
      delete process.env.NETWORK_ROUTEROS_CA_FILE
    } else {
      process.env.NETWORK_ROUTEROS_CA_FILE = values.NETWORK_ROUTEROS_CA_FILE
    }
    await run()
  } finally {
    if (previous.NETWORK_ROUTEROS_TLS === undefined) {
      delete process.env.NETWORK_ROUTEROS_TLS
    } else {
      process.env.NETWORK_ROUTEROS_TLS = previous.NETWORK_ROUTEROS_TLS
    }
    if (previous.NETWORK_ROUTEROS_CA_FILE === undefined) {
      delete process.env.NETWORK_ROUTEROS_CA_FILE
    } else {
      process.env.NETWORK_ROUTEROS_CA_FILE = previous.NETWORK_ROUTEROS_CA_FILE
    }
  }
}

function mikrotikExecution(port, protocol = "api") {
  return {
    vendor: "mikrotik",
    host: "127.0.0.1",
    port,
    protocol,
    username: "bespoke-api",
    password: "secret-should-not-be-logged",
  }
}

test("A/B/C/D/E: TLS se resuelve por puerto 8728/8729, no por el env global", () => {
  const tlsOn = { NETWORK_ROUTEROS_TLS: "1" }
  const tlsOff = { NETWORK_ROUTEROS_TLS: "0" }
  assert.equal(
    resolveRouterOsApiTls({ protocol: "api", port: 8728, env: {} }),
    false
  )
  assert.equal(
    resolveRouterOsApiTls({ protocol: "api", port: 8729, env: {} }),
    true
  )
  assert.equal(
    resolveRouterOsApiTls({ protocol: "api", port: 8728, env: tlsOn }),
    false
  )
  assert.equal(
    resolveRouterOsApiTls({ protocol: "api", port: 8729, env: tlsOn }),
    true
  )
  assert.equal(
    resolveRouterOsApiTls({ protocol: "api", port: 8729, env: tlsOff }),
    true
  )
  assert.equal(
    resolveRouterOsApiTls({ protocol: "api", port: 8728, env: tlsOff }),
    false
  )
  assert.equal(
    resolveRouterOsApiTls({ protocol: "rest", port: 443, env: tlsOn }),
    false
  )
  assert.equal(
    resolveRouterOsApiTls({ protocol: "api", port: 18728, env: tlsOn }),
    true
  )
  assert.equal(
    resolveRouterOsApiTls({ protocol: "api", port: 18728, env: tlsOff }),
    false
  )
})

test("TLS deshabilitado usa net.connect y no tls.connect", async () => {
  await withTlsEnv({}, async () => {
    assert.equal(isRouterOsApiTlsEnabled(), false)
    let tlsCalls = 0
    let plainCalls = 0
    const { server, port } = await listenPlain(attachFakeRouterOs)
    try {
      const client = await connectRouterOsApi(
        {
          host: "127.0.0.1",
          port,
          username: "bespoke-api",
          password: "secret-should-not-be-logged",
          timeoutMs: 4000,
        },
        {
          connectPlain: (options) => {
            plainCalls += 1
            return net.connect(options)
          },
          connectTls: (options) => {
            tlsCalls += 1
            return tls.connect(options)
          },
        }
      )
      const sentences = await client.talk(["/system/resource/print"])
      assert.equal(plainCalls, 1)
      assert.equal(tlsCalls, 0)
      assert.ok(sentences.some((item) => item.type === "!re"))
      client.close()
    } finally {
      server.close()
    }
  })
})

test("TLS habilitado usa tls.connect con rejectUnauthorized true y CA válida", async () => {
  await withTlsEnv(
    { NETWORK_ROUTEROS_TLS: "1", NETWORK_ROUTEROS_CA_FILE: caPem },
    async () => {
      assert.equal(isRouterOsApiTlsEnabled(), true)
      let tlsCalls = 0
      let plainCalls = 0
      const { server, port } = await listenTls(attachFakeRouterOs)
      try {
        const client = await connectRouterOsApi(
          {
            host: "127.0.0.1",
            port,
            username: "bespoke-api",
            password: "secret-should-not-be-logged",
            timeoutMs: 4000,
          },
          {
            connectPlain: (options) => {
              plainCalls += 1
              return net.connect(options)
            },
            connectTls: (options) => {
              tlsCalls += 1
              assert.equal(options.rejectUnauthorized, true)
              assert.ok(options.ca)
              assert.equal(options.servername, undefined)
              assert.equal(options.host, "127.0.0.1")
              return tls.connect(options)
            },
          }
        )
        const sentences = await client.talk(["/system/resource/print"])
        assert.equal(tlsCalls, 1)
        assert.equal(plainCalls, 0)
        assert.ok(sentences.some((item) => item.type === "!re"))
        client.close()
      } finally {
        server.close()
      }
    }
  )
})

test("TLS con CA inválida rechaza la conexión", async () => {
  await withTlsEnv(
    { NETWORK_ROUTEROS_TLS: "1", NETWORK_ROUTEROS_CA_FILE: otherCaPem },
    async () => {
      const { server, port } = await listenTls(attachFakeRouterOs)
      try {
        await assert.rejects(
          connectRouterOsApi({
            host: "127.0.0.1",
            port,
            username: "bespoke-api",
            password: "secret-should-not-be-logged",
            timeoutMs: 4000,
          }),
          (error) => {
            assert.equal(error instanceof ConnectorError, true)
            return true
          }
        )
      } finally {
        server.close()
      }
    }
  )
})

test("TLS=1 sin NETWORK_ROUTEROS_CA_FILE falla antes de conectar", async () => {
  await withTlsEnv({ NETWORK_ROUTEROS_TLS: "1" }, async () => {
    assert.throws(() => readRouterOsApiCaFile(), /NETWORK_ROUTEROS_CA_FILE/)
    await assert.rejects(
      connectRouterOsApi({
        host: "127.0.0.1",
        port: 8729,
        username: "bespoke-api",
        password: "secret-should-not-be-logged",
        timeoutMs: 1000,
      }),
      /NETWORK_ROUTEROS_CA_FILE/
    )
  })
})

test("C: NETWORK_ROUTEROS_TLS=1 + api + 8728 usa net.connect y loguea tls:false", async () => {
  await withTlsEnv(
    { NETWORK_ROUTEROS_TLS: "1", NETWORK_ROUTEROS_CA_FILE: caPem },
    async () => {
      let tlsCalls = 0
      let plainCalls = 0
      const logs = []
      const originalInfo = console.info
      console.info = (...args) => {
        logs.push(args)
      }
      const { server, port } = await listenPlain(attachFakeRouterOs)
      try {
        const client = await connectRouterOsApi(
          {
            host: "127.0.0.1",
            port: 8728,
            protocol: "api",
            username: "bespoke-api",
            password: "secret-should-not-be-logged",
            timeoutMs: 4000,
          },
          {
            connectPlain: (options) => {
              plainCalls += 1
              assert.equal(options.port, 8728)
              return net.connect({ ...options, port })
            },
            connectTls: () => {
              tlsCalls += 1
              throw new Error("8728 no debe usar TLS")
            },
          }
        )
        const sentences = await client.talk(["/system/resource/print"])
        assert.equal(plainCalls, 1)
        assert.equal(tlsCalls, 0)
        assert.ok(sentences.some((item) => item.type === "!re"))
        const connecting = logs.find(
          (args) => args[0] === "[network-agent] RouterOS API connecting"
        )
        assert.ok(connecting)
        assert.equal(connecting[1].port, 8728)
        assert.equal(connecting[1].tls, false)
        assert.equal(connecting[1].protocol, "api")
        assert.doesNotMatch(JSON.stringify(connecting), /secret-should-not-be-logged/)
        client.close()
      } finally {
        console.info = originalInfo
        server.close()
      }
    }
  )
})

test("E/I: NETWORK_ROUTEROS_TLS=0 + api + 8729 usa tls.connect y loguea tls:true", async () => {
  await withTlsEnv(
    { NETWORK_ROUTEROS_TLS: "0", NETWORK_ROUTEROS_CA_FILE: caPem },
    async () => {
      let tlsCalls = 0
      let plainCalls = 0
      const logs = []
      const originalInfo = console.info
      console.info = (...args) => {
        logs.push(args)
      }
      const { server, port } = await listenTls(attachFakeRouterOs)
      try {
        const client = await connectRouterOsApi(
          {
            host: "127.0.0.1",
            port: 8729,
            protocol: "api",
            username: "bespoke-api",
            password: "secret-should-not-be-logged",
            timeoutMs: 4000,
          },
          {
            connectPlain: () => {
              plainCalls += 1
              throw new Error("8729 no debe usar TCP plano")
            },
            connectTls: (options) => {
              tlsCalls += 1
              assert.equal(options.port, 8729)
              assert.equal(options.rejectUnauthorized, true)
              assert.ok(options.ca)
              return tls.connect({ ...options, port })
            },
          }
        )
        const sentences = await client.talk(["/system/resource/print"])
        assert.equal(tlsCalls, 1)
        assert.equal(plainCalls, 0)
        assert.ok(sentences.some((item) => item.type === "!re"))
        const connecting = logs.find(
          (args) => args[0] === "[network-agent] RouterOS API connecting"
        )
        assert.ok(connecting)
        assert.equal(connecting[1].port, 8729)
        assert.equal(connecting[1].tls, true)
        assert.equal(connecting[1].protocol, "api")
        assert.doesNotMatch(JSON.stringify(connecting), /secret-should-not-be-logged/)
        client.close()
      } finally {
        console.info = originalInfo
        server.close()
      }
    }
  )
})

test("Discovery por API plano sigue funcionando con TLS deshabilitado", async () => {
  await withTlsEnv({}, async () => {
    const { server, port } = await listenPlain(attachFakeRouterOs)
    try {
      const snapshot = await executeDiscoveryJob({
        targetId: "tgt-1",
        siteId: null,
        execution: mikrotikExecution(port),
      })
      assert.equal(snapshot.vendor, "mikrotik")
      assert.equal(snapshot.devices[0].hostname, "CORE-TLS")
    } finally {
      server.close()
    }
  })
})

test("F/G/H: discovery, monitoring y diagnostic API 8728 usan conexión sin TLS", async () => {
  await withTlsEnv(
    { NETWORK_ROUTEROS_TLS: "1", NETWORK_ROUTEROS_CA_FILE: caPem },
    async () => {
      const { server, port } = await listenPlainOn(8728)
      assert.equal(port, 8728)
      const execution = mikrotikExecution(8728)
      try {
        const snapshot = await executeDiscoveryJob({
          targetId: "tgt-8728",
          siteId: null,
          execution,
        })
        assert.equal(snapshot.vendor, "mikrotik")
        assert.equal(snapshot.devices[0].hostname, "CORE-TLS")

        const monitoring = await executeMonitoringJob({
          targetId: "tgt-8728",
          siteId: null,
          deviceId: "dev-8728",
          execution,
        })
        assert.equal(monitoring.deviceId, "dev-8728")

        await executeDiagnosticJob({
          targetId: "tgt-8728",
          siteId: null,
          execution,
        })
      } finally {
        await new Promise((resolveClose) => server.close(resolveClose))
      }

      const mikrotik = read("network-agent/src/connectors/mikrotik/index.ts")
      assert.match(mikrotik, /function connectApi\(access: ConnectorAccess\)/)
      assert.match(mikrotik, /protocol: access\.protocol/)
      assert.match(mikrotik, /async function testViaApi[\s\S]*connectApi\(access\)/)
      assert.match(mikrotik, /async function discoverViaApi[\s\S]*connectApi\(access\)/)
      assert.match(mikrotik, /async function pollViaApi[\s\S]*connectApi\(access\)/)
    }
  )
})

test("I: discovery API 8729 continúa usando TLS aunque NETWORK_ROUTEROS_TLS=0", async () => {
  await withTlsEnv(
    { NETWORK_ROUTEROS_TLS: "0", NETWORK_ROUTEROS_CA_FILE: caPem },
    async () => {
      const { server, port } = await listenTlsOn(8729)
      assert.equal(port, 8729)
      try {
        const snapshot = await executeDiscoveryJob({
          targetId: "tgt-8729",
          siteId: null,
          execution: mikrotikExecution(8729),
        })
        assert.equal(snapshot.vendor, "mikrotik")
        assert.equal(snapshot.devices[0].hostname, "CORE-TLS")
      } finally {
        await new Promise((resolveClose) => server.close(resolveClose))
      }
    }
  )
})

test("J/K: no existe protocol api-ssl y REST RouterOS 7 no pasa por el cliente API", () => {
  const apiClient = read("network-agent/src/connectors/mikrotik/api-client.ts")
  const mikrotik = read("network-agent/src/connectors/mikrotik/index.ts")
  const agentIndex = read("network-agent/src/index.ts")
  const runJob = read("network-agent/src/discovery/run-job.ts")
  const restClient = read("network-agent/src/connectors/mikrotik/rest-client.ts")
  for (const source of [apiClient, mikrotik, agentIndex, runJob, restClient]) {
    assert.doesNotMatch(source, /api-ssl/)
  }
  assert.match(mikrotik, /access\.protocol === "rest"/)
  assert.match(mikrotik, /fetchRouterOsRest/)
  assert.match(mikrotik, /discoverViaRest/)
  assert.match(mikrotik, /pollViaRest/)
  assert.doesNotMatch(restClient, /connectRouterOsApi/)
  assert.doesNotMatch(restClient, /resolveRouterOsApiTls/)
  assert.equal(
    resolveRouterOsApiTls({
      protocol: "rest",
      port: 443,
      env: { NETWORK_ROUTEROS_TLS: "1" },
    }),
    false
  )
})

test("api-client nunca usa rejectUnauthorized false y no loguea secretos", () => {
  const source = read("network-agent/src/connectors/mikrotik/api-client.ts")
  assert.match(source, /tls\.connect/)
  assert.match(source, /net\.connect/)
  assert.match(source, /rejectUnauthorized:\s*true/)
  assert.doesNotMatch(source, /rejectUnauthorized:\s*false/)
  assert.match(source, /NETWORK_ROUTEROS_TLS/)
  assert.match(source, /NETWORK_ROUTEROS_CA_FILE/)
  assert.match(source, /resolveRouterOsApiTls/)
  assert.doesNotMatch(source, /console\.(info|error|log)\([\s\S]{0,120}password/)
  assert.doesNotMatch(source, /console\.(info|error|log)\([\s\S]{0,120}BEGIN CERTIFICATE/)
})

test("index.ts loguea jobId/host/port/tls/jobType y no secretos; SIGTERM/SIGINT", () => {
  const source = read("network-agent/src/index.ts")
  assert.match(source, /SIGTERM/)
  assert.match(source, /SIGINT/)
  assert.match(source, /beginAgentShutdown/)
  assert.match(source, /destroyActiveRouterOsSockets/)
  assert.match(source, /tls: resolveRouterOsApiTls\(/)
  assert.match(source, /protocol: claimed\.execution\.protocol/)
  assert.match(source, /port: claimed\.execution\.port/)
  assert.match(source, /jobType: claimed\.job\.jobType/)
  assert.doesNotMatch(source, /tls: isRouterOsApiTlsEnabled\(\)/)
  assert.doesNotMatch(source, /password/)
  assert.doesNotMatch(source, /NETWORK_AGENT_TOKEN/)
  assert.doesNotMatch(source, /execution\.password/)
  assert.doesNotMatch(source, /process\.exit\(/)
})

test("cloud-client no loguea Authorization ni el token", () => {
  const source = read("network-agent/src/cloud-client.ts")
  assert.match(source, /Authorization: `Bearer \$\{agentToken\(\)\}`/)
  const errorLogs = [...source.matchAll(/console\.error\(([\s\S]*?)\)\n/g)].map(
    (match) => match[1]
  )
  for (const block of errorLogs) {
    assert.doesNotMatch(block, /Authorization|Bearer|agentToken|NETWORK_AGENT_TOKEN/)
  }
})

test("beginAgentShutdown no usa process.exit", () => {
  resetAgentShutdownForTests()
  beginAgentShutdown("test")
  resetAgentShutdownForTests()
})

test("systemd unit no incluye secretos y usa EnvironmentFile", () => {
  const unit = read("network-agent/systemd/bespoke-network-agent.service")
  const envExample = read("network-agent/systemd/network-agent.env.example")
  assert.match(unit, /User=bespoke-agent/)
  assert.match(unit, /Restart=always/)
  assert.match(
    unit,
    /EnvironmentFile=\/etc\/bespoke\/network-agent\/agent\.env/
  )
  assert.match(unit, /node_modules\/\.bin\/tsx/)
  assert.doesNotMatch(unit, /bna_|password|BEGIN CERTIFICATE/)
  assert.match(envExample, /NETWORK_ROUTEROS_TLS=1/)
  assert.match(envExample, /NETWORK_ROUTEROS_CA_FILE=/)
  assert.match(envExample, /8728 is always plaintext/)
  assert.match(envExample, /8729 is always TLS/)
  assert.doesNotMatch(envExample, /bespoke-api-cert|177\.53\.120\.11/)
})
