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
} from "../network-agent/src/connectors/mikrotik/api-client.ts"
import { ConnectorError } from "../network-agent/src/connectors/types.ts"
import { executeDiscoveryJob } from "../network-agent/src/discovery/run-job.ts"
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

test("Discovery por API plano sigue funcionando con TLS deshabilitado", async () => {
  await withTlsEnv({}, async () => {
    const { server, port } = await listenPlain(attachFakeRouterOs)
    try {
      const snapshot = await executeDiscoveryJob({
        targetId: "tgt-1",
        siteId: null,
        execution: {
          vendor: "mikrotik",
          host: "127.0.0.1",
          port,
          protocol: "api",
          username: "bespoke-api",
          password: "secret-should-not-be-logged",
        },
      })
      assert.equal(snapshot.vendor, "mikrotik")
      assert.equal(snapshot.devices[0].hostname, "CORE-TLS")
    } finally {
      server.close()
    }
  })
})

test("api-client nunca usa rejectUnauthorized false y no loguea secretos", () => {
  const source = read("network-agent/src/connectors/mikrotik/api-client.ts")
  assert.match(source, /tls\.connect/)
  assert.match(source, /net\.connect/)
  assert.match(source, /rejectUnauthorized:\s*true/)
  assert.doesNotMatch(source, /rejectUnauthorized:\s*false/)
  assert.match(source, /NETWORK_ROUTEROS_TLS/)
  assert.match(source, /NETWORK_ROUTEROS_CA_FILE/)
  assert.doesNotMatch(source, /console\.(info|error|log)\([\s\S]{0,120}password/)
  assert.doesNotMatch(source, /console\.(info|error|log)\([\s\S]{0,120}BEGIN CERTIFICATE/)
})

test("index.ts loguea jobId/host/port/tls/jobType y no secretos; SIGTERM/SIGINT", () => {
  const source = read("network-agent/src/index.ts")
  assert.match(source, /SIGTERM/)
  assert.match(source, /SIGINT/)
  assert.match(source, /beginAgentShutdown/)
  assert.match(source, /destroyActiveRouterOsSockets/)
  assert.match(source, /tls: isRouterOsApiTlsEnabled\(\)/)
  assert.match(source, /port: claimed\.execution\.port/)
  assert.match(source, /jobType: claimed\.job\.jobType/)
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
  assert.doesNotMatch(envExample, /bespoke-api-cert|177\.53\.120\.11/)
})
